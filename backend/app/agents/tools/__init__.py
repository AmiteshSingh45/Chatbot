"""
NexusAI Tool Registry — all available tools for agent use.
Tools are registered here and injected into appropriate agents.
"""
from app.agents.tools.calculator import calculator
from app.agents.tools.ddg_search import ddg_search
from app.agents.tools.arxiv_search import arxiv_search
from app.agents.tools.url_scraper import url_scraper
from app.agents.tools.stock_price import get_stock_price
from app.agents.tools.weather import get_weather
from app.agents.tools.memory_search import search_user_memory

# All tools available to the tool_calling agent
ALL_TOOLS = [
    calculator,
    ddg_search,
    arxiv_search,
    url_scraper,
    get_stock_price,
    get_weather,
    search_user_memory,
]

# Web search tools only
SEARCH_TOOLS = [ddg_search, arxiv_search, url_scraper]

# Math/calculation tools
MATH_TOOLS = [calculator]

__all__ = [
    "ALL_TOOLS", "SEARCH_TOOLS", "MATH_TOOLS",
    "calculator", "ddg_search", "arxiv_search",
    "url_scraper", "get_stock_price", "get_weather", "search_user_memory",
]
