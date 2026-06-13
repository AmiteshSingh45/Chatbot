"""
General Chat Agent — handles everyday conversation with full memory context.
Enriches every prompt with long-term memory context and reflection feedback.
"""
import time
from typing import Any

from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are NexusAI, a highly capable, friendly, and knowledgeable AI assistant.
You are honest, helpful, and direct. You think step by step when needed.
You can help with analysis, writing, math, coding, research, and general questions.
Always be concise unless detail is explicitly requested.

Guidelines:
- Use markdown for formatted responses (code blocks, lists, headers)
- Cite sources if you reference specific information
- Say "I don't know" rather than hallucinating
- Ask clarifying questions when the request is ambiguous
- Personalize your response using the memory context below

{memory_section}

{reflection_section}"""


def _build_system(state: AgentState) -> str:
    memory = state.get("memory_context", "")
    mem_section = (
        f"\n**User Memory Context:**\n{memory}\n"
        if memory else ""
    )

    feedback = state.get("reflection_feedback", "")
    refl_section = (
        f"\n**Improvement needed (retry):** {feedback}\n"
        if feedback and state.get("retry_count", 0) > 0 else ""
    )

    return SYSTEM_PROMPT.format(
        memory_section=mem_section,
        reflection_section=refl_section,
    )


async def general_chat_node(state: AgentState) -> dict[str, Any]:
    """General chat agent — handles the majority of everyday queries."""
    t0 = time.time()

    try:
        llm = ChatGroq(
            model=state.get("metadata", {}).get("model") or settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=settings.GROQ_TEMPERATURE,
            max_tokens=settings.GROQ_MAX_TOKENS,
            streaming=True,
        )

        system_content = _build_system(state)
        messages_with_system = [SystemMessage(content=system_content)] + list(state["messages"])

        response = await llm.ainvoke(messages_with_system)

        duration_ms = (time.time() - t0) * 1000
        logger.info(
            "agent.general_chat.response",
            thread_id=state.get("thread_id"),
            duration_ms=round(duration_ms, 1),
        )

        step: AgentStep = {
            "step": "general_chat",
            "label": "Generating response...",
            "status": "done",
            "detail": f"{len(response.content)} chars",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "error": None,
            "agent_steps": existing_steps,
            "metadata": {
                **(state.get("metadata") or {}),
                "agent_used": "general_chat",
                "model": settings.GROQ_MODEL,
            },
        }

    except Exception as e:
        logger.error("agent.general_chat.error", error=str(e))
        retry_count = state.get("retry_count", 0)
        if retry_count < 2:
            return {**state, "error": str(e), "retry_count": retry_count + 1}
        fallback = AIMessage(content="I'm having trouble processing your request right now. Please try again.")
        return {
            **state,
            "messages": [fallback],
            "final_response": fallback.content,
            "error": str(e),
        }
