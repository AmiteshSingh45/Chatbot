"""
Memory Update Node — extracts new facts from the conversation and stores them.
Runs as the LAST node before END (after reflection passes).

This implements the "write to long-term memory" step of the memory cycle:
  retrieve (memory_inject) → use → update (memory_update)

Facts extracted and stored:
- Personal facts: name, job, college, location, skills
- Preferences: favorite tools, languages, communication style
- Goals: what they're working on, career ambitions
- Context: current project, challenges

This creates the "Claude-like memory" experience where NexusAI remembers
things you told it across sessions.
"""
import time
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

MEMORY_EXTRACT_SYSTEM = """You are a memory extraction system. Analyze the latest conversation exchange and extract any NEW facts about the user that would be worth remembering for future conversations.

Only extract PERSONAL, DURABLE facts — not temporary queries.

Examples of what to extract:
- "I am a CSE student at SVNIT Surat" → {memory: "User is a CSE student at SVNIT Surat", type: "semantic", category: "education"}
- "I prefer Python over Java" → {memory: "User prefers Python over Java", type: "semantic", category: "preference"}
- "I'm building a portfolio for AI internships" → {memory: "User is building an AI/ML portfolio for internships", type: "semantic", category: "goal"}

Do NOT extract:
- Transient questions ("what is 2+2")
- Factual queries about the world
- Greetings or casual chat

Respond with a JSON array (can be empty if nothing memorable):
[
  {"memory": "...", "type": "semantic", "category": "...", "importance": 0.0-1.0},
  ...
]

Return [] if nothing worth storing."""


async def memory_update_node(state: AgentState) -> dict[str, Any]:
    """
    Extracts and stores new user facts from the latest exchange.
    Non-blocking — failures are logged but don't affect the response.
    """
    t0 = time.time()
    user_id = state.get("user_id", "")
    thread_id = state.get("thread_id", "")

    facts_stored = 0

    try:
        messages = state.get("messages", [])
        final_response = state.get("final_response", "")

        # Get latest human message
        latest_human = next(
            (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
        )
        if not latest_human or not user_id:
            raise ValueError("No user message or user_id")

        user_text = latest_human.content
        if not isinstance(user_text, str):
            user_text = str(user_text)

        # Only extract from substantive messages (>20 chars)
        if len(user_text) < 20:
            raise ValueError("Message too short for memory extraction")

        llm = ChatGroq(
            model=settings.GROQ_MODEL_FAST,
            api_key=settings.GROQ_API_KEY,
            temperature=0.0,
            max_tokens=400,
        )

        exchange = f"User: {user_text[:300]}\nAssistant: {final_response[:300]}"

        response = await llm.ainvoke([
            SystemMessage(content=MEMORY_EXTRACT_SYSTEM),
            HumanMessage(content=exchange),
        ])

        import json
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        facts = json.loads(content)
        if not isinstance(facts, list):
            facts = []

        if facts:
            from app.services.memory_service import get_memory_service
            mem_service = get_memory_service()
            for fact in facts:
                if fact.get("memory"):
                    await mem_service.store(
                        user_id=user_id,
                        memory_text=fact["memory"],
                        memory_type=fact.get("type", "semantic"),
                        category=fact.get("category", "general"),
                        importance_score=float(fact.get("importance", 0.5)),
                        source_conversation_id=thread_id,
                    )
                    facts_stored += 1

            logger.info(
                "memory_update.stored",
                facts_count=facts_stored,
                user_id=user_id,
            )

    except Exception as e:
        if "too short" not in str(e) and "No user message" not in str(e):
            logger.warning("memory_update.error", error=str(e))

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "memory_update",
        "label": "Updating memory...",
        "status": "done",
        "detail": f"{facts_stored} facts stored" if facts_stored else "Nothing to store",
        "duration_ms": round(duration_ms, 1),
    }
    existing_steps = list(state.get("agent_steps") or [])
    existing_steps.append(step)

    return {**state, "agent_steps": existing_steps}
