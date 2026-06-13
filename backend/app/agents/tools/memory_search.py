"""Memory search tool — semantic search over user's long-term memories."""
from langchain_core.tools import tool


@tool
def search_user_memory(query: str) -> str:
    """
    Search the user's long-term memory store for relevant facts, preferences, or past context.
    Use when the user asks 'what do you know about me', 'do you remember', 'what did I tell you'.
    Input: what to search for (e.g., 'career goals', 'programming preferences', 'personal info').
    Note: This tool requires user_id context — it's injected at runtime.
    """
    # This tool is a placeholder — actual execution happens in memory_retrieval_node
    # which has access to the full state including user_id
    return "Memory search will be executed by the memory retrieval agent."
