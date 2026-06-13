"""
Web Search Agent — uses Tavily to fetch real-time internet information.
Synthesizes search results into a coherent, cited response.
"""
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.core.config import settings
from app.core.logging import get_logger
from app.graph.state import AgentState

logger = get_logger(__name__)

WEB_SEARCH_SYSTEM = """You are a research assistant with access to real-time web search results.
Given the user's question and the search results below, provide a comprehensive, accurate answer.

Rules:
- Always cite your sources with [Source N] markers
- Be factual — use ONLY information from the search results
- If results are insufficient, say so
- Format your answer in clear markdown
- Include the most relevant URLs at the bottom"""


def get_search_tool():
    return TavilySearchResults(
        max_results=5,
        api_key=settings.TAVILY_API_KEY,
        include_answer=True,
        include_raw_content=False,
    )


def get_llm():
    return ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.3,
        max_tokens=settings.GROQ_MAX_TOKENS,
    )


async def web_search_node(state: AgentState) -> AgentState:
    """Performs web search and synthesizes results into a response."""
    messages = state["messages"]
    latest_human = next(
        (m for m in reversed(messages) if isinstance(m, HumanMessage)), None
    )
    if not latest_human:
        return {**state, "route": "general"}

    query = latest_human.content if isinstance(latest_human.content, str) else str(latest_human.content)

    try:
        search_tool = get_search_tool()
        results = await search_tool.ainvoke({"query": query})

        # Format search results for LLM
        formatted_results = "\n\n".join([
            f"[Source {i+1}] {r.get('title', 'No title')}\nURL: {r.get('url', '')}\n{r.get('content', '')}"
            for i, r in enumerate(results)
        ])

        llm = get_llm()
        synthesis_messages = [
            SystemMessage(content=WEB_SEARCH_SYSTEM),
            *messages,
            SystemMessage(content=f"SEARCH RESULTS:\n{formatted_results}"),
        ]
        response = await llm.ainvoke(synthesis_messages)

        citations = [
            {"title": r.get("title"), "url": r.get("url"), "index": i+1}
            for i, r in enumerate(results)
        ]

        logger.info("agent.web_search.done", query=query[:50], num_results=len(results))

        return {
            **state,
            "messages": [response],
            "final_response": response.content,
            "web_search_results": results,
            "citations": citations,
            "error": None,
            "metadata": {**(state.get("metadata") or {}), "agent_used": "web_search"},
        }

    except Exception as e:
        logger.error("agent.web_search.error", error=str(e))
        # Fallback to general chat
        return {**state, "route": "general", "error": str(e)}
