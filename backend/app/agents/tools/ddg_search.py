"""
DuckDuckGo Search tool — free web search, no API key required.
Primary search tool for NexusAI (replaces Tavily as default).
"""
from langchain_core.tools import tool


@tool
def ddg_search(query: str, max_results: int = 5) -> str:
    """
    Search the web using DuckDuckGo (free, no API key needed).
    Returns top results with title, URL, and snippet.
    Use for: current events, news, factual questions, recent information.
    Input: search query as a string.
    """
    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(r)

        if not results:
            return f"No results found for: {query}"

        formatted = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            url = r.get("href", "")
            body = r.get("body", "")[:300]
            formatted.append(f"[{i}] **{title}**\nURL: {url}\n{body}")

        return "\n\n---\n\n".join(formatted)

    except Exception as e:
        return f"Search failed: {e}. Try rephrasing your query."
