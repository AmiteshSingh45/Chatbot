"""Weather tool — free wttr.in weather data, no API key needed."""
from langchain_core.tools import tool


@tool
def get_weather(location: str) -> str:
    """
    Get current weather and 3-day forecast for any city or location.
    Uses wttr.in — completely free, no API key needed.
    Input: city name or location (e.g., 'New York', 'London', 'Mumbai', 'Surat').
    """
    try:
        import httpx

        # wttr.in returns JSON weather data
        url = f"https://wttr.in/{location}?format=j1"
        response = httpx.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        current = data["current_condition"][0]
        area = data["nearest_area"][0]

        city = area["areaName"][0]["value"]
        country = area["country"][0]["value"]
        temp_c = current["temp_C"]
        temp_f = current["temp_F"]
        feels_c = current["FeelsLikeC"]
        humidity = current["humidity"]
        wind_kmph = current["windspeedKmph"]
        desc = current["weatherDesc"][0]["value"]
        visibility = current["visibility"]
        uv_index = current["uvIndex"]

        # 3-day forecast
        forecast_lines = []
        for day in data.get("weather", [])[:3]:
            date = day["date"]
            max_c = day["maxtempC"]
            min_c = day["mintempC"]
            day_desc = day["hourly"][4]["weatherDesc"][0]["value"]  # noon
            forecast_lines.append(f"  {date}: {day_desc}, {min_c}°C - {max_c}°C")

        forecast = "\n".join(forecast_lines) if forecast_lines else "Not available"

        return (
            f"**Weather in {city}, {country}**\n"
            f"Condition: {desc}\n"
            f"Temperature: {temp_c}°C / {temp_f}°F (Feels like {feels_c}°C)\n"
            f"Humidity: {humidity}%\n"
            f"Wind: {wind_kmph} km/h\n"
            f"Visibility: {visibility} km\n"
            f"UV Index: {uv_index}\n\n"
            f"**3-Day Forecast:**\n{forecast}"
        )

    except Exception as e:
        return f"Could not get weather for '{location}': {e}. Try a different city name."
