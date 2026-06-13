"""arXiv search tool — search academic papers for free."""
from langchain_core.tools import tool


@tool
def arxiv_search(query: str, max_results: int = 3) -> str:
    """
    Search arXiv for academic papers and research.
    Returns paper titles, authors, abstracts, and links.
    Use for: AI research, scientific papers, academic questions, technical topics.
    Input: search query (e.g. 'LangGraph multi-agent systems', 'transformer attention').
    """
    try:
        import arxiv

        client = arxiv.Client()
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )

        results = list(client.results(search))
        if not results:
            return f"No arXiv papers found for: {query}"

        formatted = []
        for i, paper in enumerate(results, 1):
            authors = ", ".join(a.name for a in paper.authors[:3])
            if len(paper.authors) > 3:
                authors += " et al."
            abstract = paper.summary[:400].replace("\n", " ")
            formatted.append(
                f"[{i}] **{paper.title}**\n"
                f"Authors: {authors}\n"
                f"Published: {paper.published.strftime('%Y-%m-%d')}\n"
                f"URL: {paper.entry_id}\n"
                f"Abstract: {abstract}..."
            )

        return "\n\n---\n\n".join(formatted)

    except Exception as e:
        return f"arXiv search failed: {e}"
