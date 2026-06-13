"""
Planner Node — LLM-powered execution planner.
Runs after the router to create a structured execution plan before the agent acts.

The planner:
1. Understands the user's intent
2. Considers available tools and memories
3. Creates a step-by-step plan
4. Selects which tools will likely be needed

This demonstrates the "plan-then-execute" agent pattern required for complex tasks.
"""
import json
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

PLANNER_SYSTEM = """You are an expert AI planning agent. Given a user request and context, create a brief execution plan.

Available routes/agents:
- general: General knowledge, explanation, creative writing
- web_search: Real-time internet information (news, weather, recent events)  
- rag: Answer from uploaded documents
- code: Code generation, debugging, technical help
- tool: Math calculations, structured data extraction
- resume: Career advice, CV review
- memory: Retrieve what user told the AI previously

Available tools (when route=tool or route=web_search):
- calculator: Math expressions
- ddg_search: Web search (DuckDuckGo, free)
- arxiv_search: Academic papers
- url_scraper: Fetch webpage content
- stock_price: Stock market data
- weather: Weather information
- memory_search: Semantic search over user memories

User's long-term memory context:
{memory_context}

Respond with ONLY a valid JSON object:
{{
  "plan": "Brief 1-3 sentence plan of action",
  "tools_needed": ["tool1", "tool2"],
  "reasoning": "Why this approach"
}}"""


async def planner_node(state: AgentState) -> dict[str, Any]:
    """
    Creates an execution plan based on the user's intent, selected route,
    and available memory context. Lightweight — uses fast model.
    """
    t0 = time.time()
    messages = state.get("messages", [])
    route = state.get("route", "general")
    memory_context = state.get("memory_context", "") or "None available"

    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    user_query = latest_human.content if latest_human else ""
    if not isinstance(user_query, str):
        user_query = str(user_query)

    execution_plan = f"Direct {route} response."
    active_tools: list[str] = []

    try:
        # Use fast model for planning (lower latency)
        llm = ChatGroq(
            model=settings.GROQ_MODEL_FAST,
            api_key=settings.GROQ_API_KEY,
            temperature=0.1,
            max_tokens=300,
        )

        system_msg = PLANNER_SYSTEM.format(memory_context=memory_context[:500])
        user_msg = f"Route selected: {route}\nUser request: {user_query[:300]}"

        response = await llm.ainvoke([
            SystemMessage(content=system_msg),
            HumanMessage(content=user_msg),
        ])

        # Parse JSON response
        content = response.content.strip()
        # Extract JSON from potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        plan_data = json.loads(content)
        execution_plan = plan_data.get("plan", execution_plan)
        active_tools = plan_data.get("tools_needed", [])

        logger.info(
            "planner.created_plan",
            route=route,
            tools=active_tools,
            thread_id=state.get("thread_id"),
        )

    except Exception as e:
        logger.warning("planner.parse_error", error=str(e))
        # Non-fatal — use default plan

    duration_ms = (time.time() - t0) * 1000
    step: AgentStep = {
        "step": "planner",
        "label": "Planning execution...",
        "status": "done",
        "detail": f"Route: {route} | Tools: {', '.join(active_tools) if active_tools else 'none'}",
        "duration_ms": round(duration_ms, 1),
    }

    existing_steps = list(state.get("agent_steps") or [])
    existing_steps.append(step)

    return {
        **state,
        "execution_plan": execution_plan,
        "active_tools": active_tools,
        "agent_steps": existing_steps,
    }
