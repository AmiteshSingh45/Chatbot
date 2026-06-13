"""
Router Node — classifies user intent and decides which agent to invoke.
Uses structured output with Groq to get a reliable routing decision.
Injects memory_context into prompt for context-aware routing.
"""
import time
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

ROUTE_OPTIONS = ["general", "rag", "web_search", "code", "resume", "tool", "memory"]

ROUTER_SYSTEM_PROMPT = """You are an expert routing agent for an AI assistant platform.
Analyze the user's latest message and classify it into exactly ONE of these routes:

- "general"      → General conversation, questions, explanations, creative writing, opinions
- "rag"          → Questions about uploaded documents/files the user has shared
- "web_search"   → Questions requiring current/real-time internet information (news, prices, weather, recent events, sports)
- "code"         → Code generation, debugging, explaining code, programming help, technical architecture
- "resume"       → Resume/CV review, improvement, career advice, job applications, LinkedIn
- "tool"         → Calculator, math, unit conversion, stock price, weather lookup, structured data
- "memory"       → User asking about things they told the AI previously ("what did I say", "do you remember")

User context (long-term memory): {memory_context}

Respond ONLY with valid JSON:
{{"route": "<one of the options above>", "confidence": <0.0-1.0>, "reason": "<one sentence>"}}"""


def build_router_chain():
    llm = ChatGroq(
        model=settings.GROQ_MODEL_FAST,  # Use fast model for routing
        api_key=settings.GROQ_API_KEY,
        temperature=0.0,
        max_tokens=150,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", ROUTER_SYSTEM_PROMPT),
        ("human", "User message: {message}"),
    ])
    return prompt | llm | JsonOutputParser()


_router_chain = None


def get_router_chain():
    global _router_chain
    if _router_chain is None:
        _router_chain = build_router_chain()
    return _router_chain


async def router_node(state: AgentState) -> AgentState:
    """
    Router node — reads the latest human message and decides which agent runs next.
    Falls back to 'general' on any parsing error.
    Includes memory context for smarter routing.
    """
    t0 = time.time()
    messages = state["messages"]
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    if not latest_human:
        return {**state, "route": "general", "error": None}

    user_text = latest_human.content if isinstance(latest_human.content, str) else str(latest_human.content)
    memory_context = (state.get("memory_context") or "")[:200]

    try:
        chain = get_router_chain()
        result = await chain.ainvoke({
            "message": user_text,
            "memory_context": memory_context or "No memories yet",
        })
        route = result.get("route", "general")
        if route not in ROUTE_OPTIONS:
            route = "general"

        logger.info(
            "router.decision",
            route=route,
            confidence=result.get("confidence"),
            reason=result.get("reason"),
            thread_id=state.get("thread_id"),
        )

        duration_ms = (time.time() - t0) * 1000
        step: AgentStep = {
            "step": "router",
            "label": "Routing intent...",
            "status": "done",
            "detail": f"→ {route} (confidence: {result.get('confidence', 0):.0%})",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "route": route,
            "error": None,
            "retry_count": state.get("retry_count", 0),
            "agent_steps": existing_steps,
        }

    except Exception as e:
        logger.error("router.error", error=str(e))
        return {**state, "route": "general", "error": str(e)}


def route_selector(state: AgentState) -> str:
    """
    LangGraph conditional edge function.
    Returns the name of the next node based on state["route"].
    """
    route_to_node = {
        "general": "general_chat",
        "rag": "rag_agent",
        "web_search": "web_search",
        "code": "code_assistant",
        "resume": "resume_assistant",
        "tool": "tool_calling",
        "memory": "memory_retrieval",
    }
    return route_to_node.get(state.get("route", "general"), "general_chat")
