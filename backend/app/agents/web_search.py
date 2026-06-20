"""
Web Search Agent — uses DuckDuckGo (free, no API key) as primary search.
Falls back to Tavily if USE_TAVILY=true and TAVILY_API_KEY is set.
Synthesizes results into a coherent, cited markdown response.
"""
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState, AgentStep

logger = get_logger(__name__)

WEB_SEARCH_SYSTEM = """You are a research assistant with real-time web search results.
Given the user's question and search results below, provide a comprehensive, accurate answer.

Rules:
- Cite sources with [Source N] markers inline
- Be factual — use ONLY information from the search results
- If results are insufficient, say so honestly
- Format answer in clear markdown with headers where appropriate
- List all cited URLs at the bottom under ## Sources

{memory_section}"""


async def _search_ddg(query: str, max_results: int = 5) -> list[dict]:
    """DuckDuckGo search — free, no API key."""
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "content": r.get("body", "")[:500],
                })
        return results
    except Exception as e:
        logger.warning("web_search.ddg_error", error=str(e))
        return []


async def _search_tavily(query: str, max_results: int = 5) -> list[dict]:
    """Tavily search — requires TAVILY_API_KEY."""
    try:
        from langchain_community.tools.tavily_search import TavilySearchResults
        tool = TavilySearchResults(
            max_results=max_results,
            api_key=settings.TAVILY_API_KEY,
        )
        raw = await tool.ainvoke({"query": query})
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:500],
            }
            for r in (raw or [])
        ]
    except Exception as e:
        logger.warning("web_search.tavily_error", error=str(e))
        return []


async def web_search_node(state: AgentState) -> dict[str, Any]:
    """
    Web search agent — DuckDuckGo primary, Tavily fallback.
    Synthesizes search results into a cited markdown response.
    """
    t0 = time.time()
    messages = state["messages"]
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    if not latest_human:
        return {**state, "route": "general"}

    query = (
        latest_human.content
        if isinstance(latest_human.content, str)
        else str(latest_human.content)
    )

    try:
        # Choose search provider
        if settings.USE_TAVILY and settings.TAVILY_API_KEY:
            results = await _search_tavily(query)
            provider = "Tavily"
        else:
            results = await _search_ddg(query)
            provider = "DuckDuckGo"

        if not results:
            # Fallback to general chat if no results
            logger.warning("web_search.no_results", query=query[:50])
            return {**state, "route": "general"}

        # Format results for LLM
        formatted = "\n\n".join([
            f"[Source {i+1}] **{r['title']}**\nURL: {r['url']}\n{r['content']}"
            for i, r in enumerate(results)
        ])

        memory = state.get("memory_context", "")
        mem_section = f"\nUser context:\n{memory}" if memory else ""

        llm = ChatGroq(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.3,
            max_tokens=settings.GROQ_MAX_TOKENS,
        )

        response = await llm.ainvoke([
            SystemMessage(content=WEB_SEARCH_SYSTEM.format(memory_section=mem_section)),
            *messages,
            SystemMessage(content=f"SEARCH RESULTS (via {provider}):\n\n{formatted}"),
        ])

        citations = [
            {
                "index": i + 1,
                "source": r.get("title", f"Source {i+1}"),
                "url": r.get("url", ""),
                "score": 1.0,
            }
            for i, r in enumerate(results)
        ]

        duration_ms = (time.time() - t0) * 1000
        logger.info(
            "agent.web_search.done",
            query=query[:50],
            results=len(results),
            provider=provider,
            duration_ms=round(duration_ms, 1),
        )

        step: AgentStep = {
            "step": "web_search",
            "label": f"Searching {provider}...",
            "status": "done",
            "detail": f"{len(results)} results found",
            "duration_ms": round(duration_ms, 1),
        }
        existing_steps = list(state.get("agent_steps") or [])
        existing_steps.append(step)

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "web_search_results": results,
            "citations": citations,
            "error": None,
            "agent_steps": existing_steps,
            "metadata": {
                **(state.get("metadata") or {}),
                "agent_used": "web_search",
                "search_provider": provider,
                "results_count": len(results),
            },
        }

    except Exception as e:
        logger.error("agent.web_search.error", error=str(e))
        return {**state, "route": "general", "error": str(e)}
