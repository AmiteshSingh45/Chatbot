"""
Tool Calling Agent — orchestrates all registered tools with LLM decision-making.
Handles: math, web search, stock prices, weather, arXiv, URL scraping, memory search.
"""
import json
import time
from typing import Any

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

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

        # First LLM call — decide which tools to use
        response = await llm_with_tools.ainvoke(messages_with_system)

        tool_results = []
        tool_messages = []

        # Execute all tool calls
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_map = {t.name: t for t in ALL_TOOLS}

            for tc in response.tool_calls:
                tool_name = tc.get("name", "")
                tool_args = tc.get("args", {})
                tool_id = tc.get("id", f"call_{tool_name}")

                logger.info("agent.tool_calling.execute", tool=tool_name, args=tool_args)

                if tool_name in tool_map:
                    try:
                        result = await tool_map[tool_name].ainvoke(tool_args)
                        tool_results.append({
                            "tool": tool_name,
                            "args": tool_args,
                            "result": str(result)[:1000],
                            "success": True,
                        })
                        tool_messages.append(
                            ToolMessage(content=str(result), tool_call_id=tool_id)
                        )
                    except Exception as e:
                        error_msg = f"Tool {tool_name} failed: {e}"
                        tool_results.append({
                            "tool": tool_name,
                            "args": tool_args,
                            "result": error_msg,
                            "success": False,
                        })
                        tool_messages.append(
                            ToolMessage(content=error_msg, tool_call_id=tool_id)
                        )

            # Second LLM call — synthesize tool results into final response
            synthesis_messages = messages_with_system + [response] + tool_messages
            final_response = await llm.ainvoke(synthesis_messages)
        else:
            # LLM chose not to use tools — direct response
            final_response = response

        duration_ms = (time.time() - t0) * 1000
        tools_used = [t["tool"] for t in tool_results]

        step: AgentStep = {
            "step": "tool_calling",
            "label": f"Using tools: {', '.join(tools_used)}" if tools_used else "Direct response",
            "status": "done",
            "detail": f"{len(tool_results)} tool calls executed",
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
