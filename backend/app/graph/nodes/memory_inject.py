"""
Memory Inject Node — retrieves relevant long-term memories BEFORE routing.
Injects them into state.memory_context so all downstream agents are personalized.

This is the first node in the graph — every request passes through it.
"""
import time
from typing import Any

from langchain_core.messages import HumanMessage

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)


def _append_step(state: AgentState, step: AgentStep) -> list[AgentStep]:
    existing = list(state.get("agent_steps") or [])
    existing.append(step)
    return existing


async def memory_inject_node(state: AgentState) -> dict[str, Any]:
    """
    Retrieve semantically relevant long-term memories for the current user + query.
    Injects them as structured context into state.memory_context.

    If no memories exist yet, sets memory_context to empty string (no-op).
    """
    t0 = time.time()
    user_id = state.get("user_id", "")

    # Get the latest user message for semantic search
    messages = state.get("messages", [])
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    query = latest_human.content if latest_human else ""
    if not isinstance(query, str):
        query = str(query)

    memory_context = ""

    try:
        if user_id and query:
            from app.services.memory_service import get_memory_service
            mem_service = get_memory_service()
            memories = await mem_service.retrieve(
                user_id=user_id,
                query=query,
                top_k=settings.MEMORY_MAX_RESULTS,
                threshold=settings.MEMORY_SIMILARITY_THRESHOLD,
            )

            if memories:
                lines = ["[Long-term memory about this user]"]
                for i, m in enumerate(memories, 1):
                    lines.append(f"{i}. [{m.get('memory_type', 'fact')}] {m['memory_text']}")
                memory_context = "\n".join(lines)
                logger.info(
                    "memory_inject.retrieved",
                    count=len(memories),
                    user_id=user_id,
                    query_preview=query[:50],
                )

    except Exception as e:
        logger.warning("memory_inject.error", error=str(e))
        # Non-fatal — continue without memories

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "memory_inject",
        "label": "Retrieving memories...",
        "status": "done",
        "detail": f"{memory_context.count('\\n')} memories found" if memory_context else "No memories",
        "duration_ms": round(duration_ms, 1),
    }

    return {
        **state,
        "memory_context": memory_context,
        "agent_steps": _append_step(state, step),
        "reflection_done": False,
        "requires_human": False,
        "human_approval": None,
    }
