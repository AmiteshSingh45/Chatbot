"""URL scraper tool — extract clean text content from any webpage."""
from langchain_core.tools import tool


@tool
def url_scraper(url: str) -> str:
    """
    Fetch and extract clean text content from a webpage URL.
    Returns the main text content (removes HTML, scripts, nav, etc.).
    Use for: reading articles, documentation, blog posts, any specific URL.
    Input: full URL including https://.
    """
    try:
        import httpx
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }

        # Synchronous request (tools are called synchronously in LangGraph)
        response = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # Remove noise elements
        for tag in soup(["script", "style", "nav", "header", "footer",
                          "aside", "form", "iframe", "noscript"]):
            tag.decompose()

        # Get main content — try common content containers first
        main = (
            soup.find("main")
            or soup.find("article")
            or soup.find(id="content")
            or soup.find(class_="content")
            or soup.find("body")
        )

        if not main:
            return f"Could not extract content from {url}"

        text = main.get_text(separator="\n", strip=True)
        # Collapse multiple blank lines
        lines = [l for l in text.split("\n") if l.strip()]
        text = "\n".join(lines)

        # Limit to 3000 chars
        if len(text) > 3000:
            text = text[:3000] + "\n\n[Content truncated — first 3000 chars shown]"

        return f"Content from {url}:\n\n{text}"

    except Exception as e:
        return f"Failed to scrape {url}: {e}"
