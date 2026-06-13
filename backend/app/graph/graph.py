"""
Main LangGraph graph assembly — Production Architecture v2.0
Full pipeline with persistence, HITL, reflection, memory, and planning.

Graph Flow:
  START
    → memory_inject    (retrieve long-term memories)
    → router           (classify intent)
    → planner          (create execution plan + select tools)
    → [agent node]     (execute: general/rag/web_search/code/tool/memory/resume)
    → hitl_check       (risky action? interrupt for human approval)
    → reflection       (self-evaluate quality, retry if poor)
    → memory_update    (extract + store new user facts)
    → END

Persistence: SqliteSaver checkpointer for resumable conversations.
HITL: interrupt_before=["hitl_gate"] enables graph suspension.
"""
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver

from app.graph.state import AgentState
from app.graph.router import router_node, route_selector
from app.graph.nodes.memory_inject import memory_inject_node
from app.graph.nodes.planner import planner_node
from app.graph.nodes.hitl import hitl_check_node, hitl_route
from app.graph.nodes.reflection import reflection_node, reflection_route
from app.graph.nodes.memory_update import memory_update_node
from app.agents.general_chat import general_chat_node
from app.agents.rag_agent import rag_agent_node
from app.agents.web_search import web_search_node
from app.agents.code_assistant import code_assistant_node
from app.agents.specialized import (
    memory_retrieval_node,
    resume_assistant_node,
    tool_calling_node,
)
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# All agent node names
AGENT_NODES = [
    "general_chat",
    "rag_agent",
    "web_search",
    "code_assistant",
    "resume_assistant",
    "tool_calling",
    "memory_retrieval",
]


def build_graph() -> StateGraph:
    """
    Constructs the full LangGraph agent pipeline.

    Architecture overview:
    ┌─────────────────────────────────────────────┐
    │  START → memory_inject → router → planner   │
    │                                             │
    │  planner → [conditional routing] → agent   │
    │  (general_chat | rag | web_search | code |  │
    │   tool | memory | resume)                   │
    │                                             │
    │  agent → hitl_check                         │
    │    ├─ safe → reflection                     │
    │    └─ risky → wait_for_human (interrupt)    │
    │                                             │
    │  reflection                                 │
    │    ├─ good → memory_update → END            │
    │    └─ poor → route_to_agent (retry)         │
    └─────────────────────────────────────────────┘
    """
    builder = StateGraph(AgentState)

    # ── Core Infrastructure Nodes ───────────────────────────────────────────
    builder.add_node("memory_inject", memory_inject_node)
    builder.add_node("router", router_node)
    builder.add_node("planner", planner_node)

    # ── Agent Nodes ─────────────────────────────────────────────────────────
    builder.add_node("general_chat", general_chat_node)
    builder.add_node("rag_agent", rag_agent_node)
    builder.add_node("web_search", web_search_node)
    builder.add_node("code_assistant", code_assistant_node)
    builder.add_node("resume_assistant", resume_assistant_node)
    builder.add_node("tool_calling", tool_calling_node)
    builder.add_node("memory_retrieval", memory_retrieval_node)

    # ── Post-Processing Nodes ───────────────────────────────────────────────
    builder.add_node("hitl_check", hitl_check_node)
    builder.add_node("reflection", reflection_node)
    builder.add_node("memory_update", memory_update_node)

    # ── Entry Point ──────────────────────────────────────────────────────────
    builder.add_edge(START, "memory_inject")
    builder.add_edge("memory_inject", "router")
    builder.add_edge("router", "planner")

    # ── Router → Agents (conditional) ───────────────────────────────────────
    builder.add_conditional_edges(
        "planner",
        route_selector,
        {
            "general_chat": "general_chat",
            "rag_agent": "rag_agent",
            "web_search": "web_search",
            "code_assistant": "code_assistant",
            "resume_assistant": "resume_assistant",
            "tool_calling": "tool_calling",
            "memory_retrieval": "memory_retrieval",
        },
    )

    # ── All Agents → HITL Check ──────────────────────────────────────────────
    for agent in AGENT_NODES:
        builder.add_edge(agent, "hitl_check")

    # ── HITL → Reflection or Wait ────────────────────────────────────────────
    builder.add_conditional_edges(
        "hitl_check",
        hitl_route,
        {
            "wait_for_human": END,  # Graph pauses here — resumed via API
            "reflection": "reflection",
        },
    )

    # ── Reflection → Memory Update or Retry ─────────────────────────────────
    builder.add_conditional_edges(
        "reflection",
        reflection_route,
        {
            "memory_update": "memory_update",
            "retry": "router",  # Re-route with reflection feedback
        },
    )

    # ── Memory Update → END ──────────────────────────────────────────────────
    builder.add_edge("memory_update", END)

    return builder


# ── Singleton compiled graph ─────────────────────────────────────────────────
_compiled_graph = None
_checkpointer = None


async def get_checkpointer():
    """
    Returns SqliteSaver for persistent, resumable conversations.
    Falls back to MemorySaver if sqlite package unavailable.
    """
    global _checkpointer
    if _checkpointer is None:
        try:
            from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
            _checkpointer = AsyncSqliteSaver.from_conn_string(
                settings.LANGGRAPH_CHECKPOINT_DB
            )
            logger.info("langgraph.using_sqlite_checkpointer", db=settings.LANGGRAPH_CHECKPOINT_DB)
        except ImportError:
            logger.warning("langgraph.sqlite_unavailable", fallback="MemorySaver")
            _checkpointer = MemorySaver()
    return _checkpointer


async def get_compiled_graph():
    """Return singleton compiled graph with persistence checkpointer."""
    global _compiled_graph
    if _compiled_graph is None:
        checkpointer = await get_checkpointer()
        builder = build_graph()
        _compiled_graph = builder.compile(
            checkpointer=checkpointer,
            interrupt_before=["hitl_check"],  # Pause before HITL evaluation for inspection
        )
        logger.info("langgraph.compiled", version="v2.0")
    return _compiled_graph


def get_compiled_graph_sync():
    """
    Synchronous accessor for graph compilation (startup warm-up).
    Uses MemorySaver as temporary checkpointer until async version initializes.
    """
    global _compiled_graph
    if _compiled_graph is None:
        builder = build_graph()
        _compiled_graph = builder.compile(checkpointer=MemorySaver())
        logger.info("langgraph.compiled_sync", note="will_upgrade_to_sqlite")
    return _compiled_graph
