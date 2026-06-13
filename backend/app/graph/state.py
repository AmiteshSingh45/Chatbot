"""
LangGraph Agent State — the single shared state object passed through all nodes.
Every node reads from and writes to this TypedDict.

Fields are grouped by purpose:
- Core: conversation messages + user identity
- Routing: which agent to invoke
- Memory: short-term context + long-term recall
- Planning: execution plan from planner node
- HITL: human-in-the-loop approval flow
- Reflection: self-evaluation results
- Output: final response + citations + tool results
- Control: error handling + retry logic + observability
"""
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentStep(TypedDict):
    """Represents a single step in agent execution (for UI visibility)."""
    step: str          # "memory_inject" | "router" | "planner" | "tool_calling" etc.
    label: str         # Human-readable: "Retrieving memories..." | "Searching web..."
    status: str        # "running" | "done" | "error"
    detail: str        # Extra info: route chosen, tool called, score, etc.
    duration_ms: float # Time taken


class AgentState(TypedDict):
    """
    Central state for the entire LangGraph agent graph.
    Persisted via SqliteSaver between turns (resumable conversations).
    """

    # ── Core Conversation ─────────────────────────────────────────────────────
    messages: Annotated[list[BaseMessage], add_messages]
    thread_id: str       # LangGraph thread — maps to conversation.thread_id
    user_id: str         # Authenticated user

    # ── Routing ───────────────────────────────────────────────────────────────
    route: Optional[str]
    # "general" | "rag" | "web_search" | "code" | "resume" | "tool" | "memory"

    # ── Memory System ─────────────────────────────────────────────────────────
    memory_context: Optional[str]   # Injected long-term memories (semantic)
    short_term_summary: Optional[str]  # Summarized old messages for context mgmt

    # ── Planning ──────────────────────────────────────────────────────────────
    execution_plan: Optional[str]   # Planner node output: "1. Search web, 2. Synthesize"
    active_tools: Optional[list[str]]  # Tools planner selected for this request

    # ── Human-in-the-Loop (HITL) ──────────────────────────────────────────────
    requires_human: bool            # True = graph interrupted, waiting for approval
    human_approval: Optional[str]   # "approved" | "rejected" | None (pending)
    hitl_action: Optional[str]      # Description of action awaiting approval
    hitl_args: Optional[dict]       # Arguments of the action

    # ── Reflection ────────────────────────────────────────────────────────────
    reflection_score: Optional[float]     # 0.0-1.0 quality score
    reflection_feedback: Optional[str]    # What to improve on retry
    reflection_done: bool                 # Prevents infinite reflection loops

    # ── Context Enrichment ────────────────────────────────────────────────────
    context: Optional[str]              # RAG context injected into prompt
    retrieved_docs: Optional[list[dict]]  # Full RAG chunks with metadata
    uploaded_file_ids: Optional[list[str]]

    # ── Tool Results ──────────────────────────────────────────────────────────
    tool_results: Optional[list[dict[str, Any]]]
    web_search_results: Optional[list[dict[str, Any]]]

    # ── Output ────────────────────────────────────────────────────────────────
    final_response: Optional[str]
    citations: Optional[list[dict[str, Any]]]

    # ── Observability ─────────────────────────────────────────────────────────
    agent_steps: Optional[list[AgentStep]]  # Execution step log for UI

    # ── Error Handling ────────────────────────────────────────────────────────
    error: Optional[str]
    retry_count: int

    # ── Metadata ──────────────────────────────────────────────────────────────
    metadata: Optional[dict[str, Any]]
