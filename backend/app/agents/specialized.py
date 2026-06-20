"""
Specialized Agents — memory retrieval, resume assistant, tool calling.
These agents handle domain-specific tasks routed from the router node.
All follow the same interface: AgentState → dict[str, Any]
"""
import json
import time
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)


# ── Memory Retrieval Agent ───────────────────────────────────────────────────

MEMORY_RETRIEVAL_SYSTEM = """You are NexusAI's memory recall specialist.
The user is asking about things they previously shared with you.
Use the retrieved memories below to give a personal, accurate response.
If you don't have relevant memories, say so honestly — don't fabricate.

Retrieved memories:
{memories}

Respond in a warm, personal tone. Reference specific things you remember about them."""


async def memory_retrieval_node(state: AgentState) -> dict[str, Any]:
    """
    Memory retrieval agent — searches long-term memory and presents
    what NexusAI remembers about the user in a conversational way.
    """
    t0 = time.time()
    messages = state["messages"]
    user_id = state.get("user_id", "")

    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    query = latest_human.content if latest_human else "what do you know about me"
    if not isinstance(query, str):
        query = str(query)

    memories_text = "No memories stored yet."
    memory_count = 0

    try:
        from app.services.memory_service import get_memory_service
        mem_service = get_memory_service()
        memories = await mem_service.retrieve(
            user_id=user_id,
            query=query,
            top_k=10,
            threshold=0.1,  # Low threshold to catch more memories
        )
        memory_count = len(memories)
        if memories:
            lines = []
            for m in memories:
                score = m.get("similarity_score", 0)
                mtype = m.get("memory_type", "fact")
                cat = m.get("category", "general")
                text = m.get("memory_text", "")
                lines.append(f"- [{mtype}/{cat}] {text} (relevance: {score:.2f})")
            memories_text = "\n".join(lines)
    except Exception as e:
        logger.warning("memory_retrieval.fetch_error", error=str(e))

    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.6,
        max_tokens=1024,
    )

    response = await llm.ainvoke([
        SystemMessage(content=MEMORY_RETRIEVAL_SYSTEM.format(memories=memories_text)),
        *messages,
    ])

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "memory_retrieval",
        "label": "Searching your memories...",
        "status": "done",
        "detail": f"{memory_count} memories found",
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
            "agent_used": "memory_retrieval",
            "memories_recalled": memory_count,
        },
    }


# ── Resume Assistant Agent ───────────────────────────────────────────────────

RESUME_SYSTEM = """You are an elite career coach and resume expert with 15+ years of experience
in tech recruiting, ATS optimization, and career development for software engineers and AI/ML roles.

Your expertise:
- Resume writing and optimization for ATS (Applicant Tracking Systems)
- LinkedIn profile optimization
- Cover letter writing
- Interview preparation
- Career path guidance for tech roles (SDE, ML Engineer, AI Engineer, Data Scientist)
- Job search strategy

{memory_section}

Guidelines:
- Use specific, measurable achievements (e.g., "Reduced latency by 40%", "Built RAG pipeline processing 10k docs/day")
- Use strong action verbs (Led, Architected, Implemented, Optimized, Designed)
- Tailor advice to the specific role/company mentioned
- Be direct and actionable — give concrete improvements, not vague suggestions
- Format resume content in clean markdown"""


async def resume_assistant_node(state: AgentState) -> dict[str, Any]:
    """Resume and career assistant — expert guidance for tech job seekers."""
    t0 = time.time()
    messages = state["messages"]

    memory = state.get("memory_context", "")
    mem_section = f"\nKnown about user:\n{memory}" if memory else ""

    llm = ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.4,
        max_tokens=settings.GROQ_MAX_TOKENS,
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=RESUME_SYSTEM.format(memory_section=mem_section)),
            *messages,
        ])

        duration_ms = (time.time() - t0) * 1000
        step: AgentStep = {
            "step": "resume_assistant",
            "label": "Career coach analyzing...",
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
                "agent_used": "resume_assistant",
            },
        }
    except Exception as e:
        logger.error("agent.resume.error", error=str(e))
        return {**state, "error": str(e), "retry_count": state.get("retry_count", 0) + 1}


# ── Tool Calling Agent ───────────────────────────────────────────────────────

TOOL_SYSTEM = """You are NexusAI's tool execution expert. You have access to these tools:
- calculator: Safe math evaluation (expressions, formulas)
- ddg_search: Free web search via DuckDuckGo
- arxiv_search: Academic paper search
- url_scraper: Extract content from any webpage URL
- get_stock_price: Current stock data from Yahoo Finance
- get_weather: Current weather from any location
- search_user_memory: Search the user's memory store

{memory_section}

Use tools proactively. For calculations, always use the calculator.
For current information, use ddg_search. For academic topics, use arxiv_search.
Show your work clearly. Format results in clean markdown."""


async def tool_calling_node(state: AgentState) -> dict[str, Any]:
    """
    Multi-tool calling agent.
    Automatically selects and executes the right tools based on the user's request.
    Uses a two-step approach: (1) decide tools, (2) synthesize results.
    """
    t0 = time.time()

    try:
        from app.agents.tools import ALL_TOOLS

        llm = ChatGroq(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.0,
            max_tokens=settings.GROQ_MAX_TOKENS,
        )
        llm_with_tools = llm.bind_tools(ALL_TOOLS)

        memory = state.get("memory_context", "")
        mem_section = f"\nUser memory:\n{memory}" if memory else ""
        system_content = TOOL_SYSTEM.format(memory_section=mem_section)
        messages_with_system = [SystemMessage(content=system_content)] + list(state["messages"])

        # Step 1: Decide which tools to call
        response = await llm_with_tools.ainvoke(messages_with_system)

        tool_results = []
        tool_messages = []

        # Step 2: Execute all tool calls
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_map = {t.name: t for t in ALL_TOOLS}
            for tc in response.tool_calls:
                tool_name = tc.get("name", "")
                tool_args = tc.get("args", {})
                tool_id = tc.get("id", f"call_{tool_name}")
                logger.info("agent.tool_calling.execute", tool=tool_name)

                if tool_name in tool_map:
                    try:
                        result = await tool_map[tool_name].ainvoke(tool_args)
                        tool_results.append({
                            "tool": tool_name, "args": tool_args,
                            "result": str(result)[:1000], "success": True,
                        })
                        tool_messages.append(ToolMessage(content=str(result), tool_call_id=tool_id))
                    except Exception as e:
                        err = f"Tool {tool_name} failed: {e}"
                        tool_results.append({"tool": tool_name, "args": tool_args, "result": err, "success": False})
                        tool_messages.append(ToolMessage(content=err, tool_call_id=tool_id))

            # Step 3: Synthesize
            final_response = await llm.ainvoke(messages_with_system + [response] + tool_messages)
        else:
            final_response = response

        duration_ms = (time.time() - t0) * 1000
        tools_used = [t["tool"] for t in tool_results]
        step: AgentStep = {
            "step": "tool_calling",
            "label": f"Tools: {', '.join(tools_used)}" if tools_used else "Direct response",
            "status": "done",
            "detail": f"{len(tool_results)} tool calls",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "messages": [final_response],
            "final_response": final_response.content,
            "tool_results": tool_results,
            "error": None,
            "agent_steps": existing_steps,
            "metadata": {
                **(state.get("metadata") or {}),
                "agent_used": "tool_calling",
                "tools_used": tools_used,
            },
        }

    except Exception as e:
        logger.error("agent.tool_calling.error", error=str(e))
        return {**state, "error": str(e), "retry_count": state.get("retry_count", 0) + 1}
