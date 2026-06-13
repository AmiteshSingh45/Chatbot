"""Stock price tool — free Yahoo Finance data via yfinance."""
from langchain_core.tools import tool


@tool
def get_stock_price(symbol: str) -> str:
    """
    Get current stock price, market cap, P/E ratio, and 52-week range for a stock.
    Uses Yahoo Finance (free, no API key needed).
    Input: stock ticker symbol (e.g., 'AAPL', 'GOOGL', 'TSLA', 'RELIANCE.NS' for Indian stocks).
    """
    try:
        import yfinance as yf

        ticker = yf.Ticker(symbol.upper().strip())
        info = ticker.info
        hist = ticker.history(period="5d")

        if not info or "currentPrice" not in info and hist.empty:
            return f"Could not find stock data for symbol '{symbol}'. Please check the ticker."

        current_price = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or (hist["Close"].iloc[-1] if not hist.empty else "N/A")
        )

        name = info.get("longName", symbol)
        currency = info.get("currency", "USD")
        market_cap = info.get("marketCap", 0)
        pe_ratio = info.get("trailingPE", "N/A")
        week_52_high = info.get("fiftyTwoWeekHigh", "N/A")
        week_52_low = info.get("fiftyTwoWeekLow", "N/A")
        volume = info.get("volume", "N/A")

        if market_cap:
            if market_cap >= 1e12:
                mcap_str = f"{market_cap/1e12:.2f}T {currency}"
            elif market_cap >= 1e9:
                mcap_str = f"{market_cap/1e9:.2f}B {currency}"
            else:
                mcap_str = f"{market_cap/1e6:.2f}M {currency}"
        else:
            mcap_str = "N/A"

        return (
            f"**{name} ({symbol.upper()})**\n"
            f"Current Price: {current_price:.2f} {currency}\n"
            f"Market Cap: {mcap_str}\n"
            f"P/E Ratio: {pe_ratio}\n"
            f"52-Week High: {week_52_high}\n"
            f"52-Week Low: {week_52_low}\n"
            f"Volume: {volume:,}" if isinstance(volume, int) else f"Volume: {volume}"
        )
    except Exception as e:
        return f"Error fetching stock data for '{symbol}': {e}"
