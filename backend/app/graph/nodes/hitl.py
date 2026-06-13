"""
HITL (Human-in-the-Loop) Check Node.
Evaluates whether the planned action requires human approval before execution.

Risky actions that require approval:
- MCP tool calls (external side effects)
- File deletion or overwrite operations
- External API POST/PUT/DELETE requests
- Code execution with system access
- Any action the model flags as potentially destructive

When requires_human=True, the LangGraph graph INTERRUPTS at this node.
The graph resumes when POST /chat/approve or POST /chat/reject is called.

This demonstrates the LangGraph interrupt() pattern — critical for safe AI agents.
"""
import time
from typing import Any

from langchain_core.messages import HumanMessage

from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

# Actions that always need HITL
ALWAYS_REQUIRE_APPROVAL = {
    "file_delete", "file_overwrite", "send_email", "post_to_api",
    "database_write", "execute_code", "mcp_destructive",
}

# Keywords in tool calls that trigger HITL
RISKY_KEYWORDS = {
    "delete", "remove", "drop", "truncate", "overwrite", "write",
    "post", "put", "send", "execute", "run", "sudo",
}


async def hitl_check_node(state: AgentState) -> dict[str, Any]:
    """
    Analyzes the pending action and decides if human approval is required.
    If yes, sets requires_human=True so the graph can interrupt.

    The LangGraph interrupt is handled in graph.py via interrupt_before=["hitl_gate"].
    """
    t0 = time.time()

    route = state.get("route", "general")
    active_tools = state.get("active_tools") or []
    tool_results = state.get("tool_results") or []
    execution_plan = state.get("execution_plan", "")

    # Already approved? Skip check.
    if state.get("human_approval") == "approved":
        duration_ms = (time.time() - t0) * 1000
        step: AgentStep = {
            "step": "hitl",
            "label": "Action approved ✓",
            "status": "done",
            "detail": "Human approved — continuing",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)
        return {**state, "requires_human": False, "agent_steps": existing_steps}

    # Check if any active tools are risky
    risky_tools = [t for t in active_tools if t in ALWAYS_REQUIRE_APPROVAL]
    risky_keyword_tools = [
        t for t in active_tools
        if any(k in t.lower() for k in RISKY_KEYWORDS)
    ]
    all_risky = risky_tools + risky_keyword_tools

    requires_human = False
    hitl_action = None
    hitl_args = None

    if all_risky:
        requires_human = True
        hitl_action = f"Execute tool(s): {', '.join(all_risky)}"
        hitl_args = {
            "tools": all_risky,
            "plan": execution_plan[:200],
            "route": route,
        }
        logger.warning(
            "hitl.intervention_required",
            risky_tools=all_risky,
            thread_id=state.get("thread_id"),
        )

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "hitl",
        "label": "Safety check..." if not requires_human else "⚠️ Approval required",
        "status": "done" if not requires_human else "running",
        "detail": "Safe to proceed" if not requires_human else f"Risky tools: {all_risky}",
        "duration_ms": round(duration_ms, 1),
    }
    existing_steps = list(state.get("agent_steps") or [])
    existing_steps.append(step)

    return {
        **state,
        "requires_human": requires_human,
        "hitl_action": hitl_action,
        "hitl_args": hitl_args,
        "agent_steps": existing_steps,
    }


def hitl_route(state: AgentState) -> str:
    """
    LangGraph conditional edge function for HITL.
    Returns "wait_for_human" if approval needed, "reflection" if safe.
    """
    if state.get("requires_human") and state.get("human_approval") != "approved":
        return "wait_for_human"
    return "reflection"
