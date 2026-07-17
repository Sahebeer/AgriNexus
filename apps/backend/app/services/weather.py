import logging
import requests
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# State centroid coordinates mapper
STATE_COORDINATES = {
    "Punjab": (30.9012, 75.8568),
    "Haryana": (29.6857, 76.9907),
    "Rajasthan": (26.9124, 75.7873),
    "Uttar Pradesh": (26.8467, 80.9462),
    "Himachal Pradesh": (31.1048, 77.1734),
    "Uttarakhand": (30.3165, 78.0322),
    "Jammu & Kashmir": (34.0837, 74.7973),
    "Sikkim": (27.3314, 88.6138),
    "Kerala": (8.5241, 76.9366),
    "Karnataka": (12.9716, 77.5946),
    "Tamil Nadu": (13.0827, 80.2707),
    "Andhra Pradesh": (16.5062, 80.6480),
    "West Bengal": (22.5726, 88.3639),
    "Maharashtra": (19.0760, 72.8777),
    "Madhya Pradesh": (23.2599, 77.4126),
    "Gujarat": (23.0225, 72.5714),
    "Bihar": (25.5941, 85.1376),
    "Delhi": (28.6139, 77.2090),
    "Telangana": (17.3850, 78.4867),
    "Odisha": (20.2961, 85.8245),
    "Assam": (26.1445, 91.7362),
}

def map_wmo_code_to_condition(code: int) -> str:
    """
    Maps WMO weather interpretation codes (WW) to user-friendly conditions.
    """
    wmo_map = {
        0: "Sunny",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing Rime Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        56: "Light Freezing Drizzle",
        57: "Dense Freezing Drizzle",
        61: "Slight Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        66: "Light Freezing Rain",
        67: "Heavy Freezing Rain",
        71: "Slight Snow Fall",
        73: "Moderate Snow Fall",
        75: "Heavy Snow Fall",
        77: "Snow Grains",
        80: "Slight Rain Showers",
        81: "Moderate Rain Showers",
        82: "Violent Rain Showers",
        85: "Slight Snow Showers",
        86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm with Slight Hail",
        99: "Thunderstorm with Heavy Hail"
    }
    return wmo_map.get(code, "Partly Cloudy")

def get_wind_direction_label(degrees: float) -> str:
    """
    Converts meteorological degrees to compass direction.
    """
    if degrees is None:
        return "N"
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = int((degrees + 22.5) / 45) % 8
    return directions[idx]

def get_state_weather_fallback(state: str) -> Dict[str, Any]:
    """
    Returns realistic simulated meteorological values and warning alerts
    tailored to the farmer's geographic region. Useful as a robust fallback.
    """
    normalized_state = state.strip().title() if state else "General"
    
    # Default values (Loam Plains climate)
    temp = 28.5
    humidity = 65
    condition = "Partly Cloudy"
    wind_speed = 12.0  # km/h
    wind_dir = "NW"
    rain_chance = 15   # percentage
    
    forecast: List[Dict[str, Any]] = [
        {"day": "Mon", "temp": 29.0, "condition": "Sunny", "rain_chance": 5},
        {"day": "Tue", "temp": 28.5, "condition": "Partly Cloudy", "rain_chance": 15},
        {"day": "Wed", "temp": 27.0, "condition": "Scattered Showers", "rain_chance": 60},
        {"day": "Thu", "temp": 26.5, "condition": "Cloudy", "rain_chance": 30},
        {"day": "Fri", "temp": 28.0, "condition": "Sunny", "rain_chance": 10}
    ]
    
    alerts: List[Dict[str, Any]] = []
    advisories: List[str] = [
        "Optimal conditions for general crop checking and sowing.",
        "Verify soil moisture content before activating irrigation systems."
    ]

    # Region-specific adjustments
    if normalized_state in ["Punjab", "Haryana", "Rajasthan", "Uttar Pradesh"]:
        temp = 34.2
        humidity = 55
        condition = "Sunny"
        wind_speed = 22.4  # Higher winds
        wind_dir = "W"
        rain_chance = 5
        
        forecast = [
            {"day": "Mon", "temp": 34.0, "condition": "Sunny", "rain_chance": 0},
            {"day": "Tue", "temp": 35.5, "condition": "Sunny", "rain_chance": 5},
            {"day": "Wed", "temp": 36.0, "condition": "Sunny", "rain_chance": 10},
            {"day": "Thu", "temp": 34.5, "condition": "Partly Cloudy", "rain_chance": 15},
            {"day": "Fri", "temp": 32.0, "condition": "Thunderstorms", "rain_chance": 75}
        ]
        
        if wind_speed > 20:
            alerts.append({
                "type": "Wind Alert",
                "severity": "Amber",
                "message": f"High wind speeds of {wind_speed} km/h detected in {normalized_state}. Defer chemical pesticide sprays to prevent drift."
            })
            advisories.append("High winds can cause foliar damage to young tomato plants. Secure support stakes.")
            
    elif normalized_state in ["Himachal Pradesh", "Uttarakhand", "Jammu & Kashmir", "Sikkim"]:
        temp = 14.8
        humidity = 80
        condition = "Mist"
        wind_speed = 8.5
        wind_dir = "NE"
        rain_chance = 40
        
        forecast = [
            {"day": "Mon", "temp": 14.0, "condition": "Cloudy", "rain_chance": 45},
            {"day": "Tue", "temp": 12.5, "condition": "Rainy", "rain_chance": 80},
            {"day": "Wed", "temp": 9.0, "condition": "Heavy Rain", "rain_chance": 95},
            {"day": "Thu", "temp": 6.5, "condition": "Mist", "rain_chance": 50},
            {"day": "Fri", "temp": 4.0, "condition": "Frost Hazard", "rain_chance": 10}
        ]
        
        alerts.append({
            "type": "Frost Warning",
            "severity": "Red",
            "message": f"Night temperatures in {normalized_state} expected to fall near 2°C. Severe frost risk for vegetable and fruit holdings."
        })
        advisories.append("Apply plastic mulching sheets or organic straw cover to protect sensitive root cells from freezing.")
        advisories.append("Decline heavy evening watering cycles to prevent water logging in sub-zero soil surfaces.")
        
    elif normalized_state in ["Kerala", "Karnataka", "Tamil Nadu", "Andhra Pradesh"]:
        temp = 29.5
        humidity = 88  # High humidity
        condition = "Humid / Rain"
        wind_speed = 15.0
        wind_dir = "SW"
        rain_chance = 80
        
        forecast = [
            {"day": "Mon", "temp": 29.0, "condition": "Scattered Showers", "rain_chance": 80},
            {"day": "Tue", "temp": 28.5, "condition": "Heavy Rain", "rain_chance": 90},
            {"day": "Wed", "temp": 28.0, "condition": "Thunderstorms", "rain_chance": 95},
            {"day": "Thu", "temp": 29.0, "condition": "Cloudy", "rain_chance": 60},
            {"day": "Fri", "temp": 30.5, "condition": "Partly Cloudy", "rain_chance": 40}
        ]
        
        alerts.append({
            "type": "Heavy Rain Alert",
            "severity": "Red",
            "message": "Localized heavy rainfall exceeds 75mm. High flooding index in low-lying crop beds."
        })
        advisories.append("Clean drain trenches immediately to clear standing water from root zones, avoiding fungal root rots.")
        advisories.append("High relative humidity is highly conductive to powdery mildew. Apply preventive bio-fungicide sprays post-rain.")

    return {
        "state": normalized_state,
        "temperature": temp,
        "humidity": humidity,
        "condition": condition,
        "wind_speed": wind_speed,
        "wind_direction": wind_dir,
        "rain_chance": rain_chance,
        "forecast": forecast,
        "alerts": alerts,
        "advisories": advisories
    }

def get_state_weather(
    state: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None
) -> Dict[str, Any]:
    """
    Returns actual meteorological values from Open-Meteo API for target coordinates.
    Falls back to state centroid coordinates or simulated fallbacks upon failures.
    """
    normalized_state = state.strip().title() if state else "General"
    
    # 1. Resolve coordinates if not provided
    if lat is None or lon is None:
        if normalized_state in STATE_COORDINATES:
            lat, lon = STATE_COORDINATES[normalized_state]
        else:
            # Fallback centroid (Ludhiana, Punjab base)
            lat, lon = 30.9012, 75.8568

    # 2. Query Open-Meteo Live API
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m", "wind_direction_10m"],
        "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max"],
        "timezone": "auto"
    }

    try:
        res = requests.get(url, params=params, timeout=5)
        if res.status_code != 200:
            logger.warning(f"Open-Meteo API returned status {res.status_code}, falling back to simulation.")
            return get_state_weather_fallback(state)
        
        data = res.json()
        current_data = data.get("current", {})
        daily_data = data.get("daily", {})
        
        # Parse current metrics
        temp = round(current_data.get("temperature_2m", 28.5), 1)
        humidity = int(current_data.get("relative_humidity_2m", 65))
        wcode = current_data.get("weather_code", 0)
        condition = map_wmo_code_to_condition(wcode)
        wind_speed = round(current_data.get("wind_speed_10m", 12.0), 1)
        wind_deg = current_data.get("wind_direction_10m")
        wind_dir = get_wind_direction_label(wind_deg)
        
        # Precipitation probability for today
        rain_chances_list = daily_data.get("precipitation_probability_max", [])
        rain_chance = rain_chances_list[0] if rain_chances_list else 15
        
        # Build 5-day outlook
        forecast = []
        times = daily_data.get("time", [])
        temp_maxs = daily_data.get("temperature_2m_max", [])
        temp_mins = daily_data.get("temperature_2m_min", [])
        weather_codes = daily_data.get("weather_code", [])
        
        for i in range(min(5, len(times))):
            dt_str = times[i]
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d")
                day_name = dt.strftime("%a")
            except Exception:
                day_name = f"Day {i+1}"
                
            t_max = temp_maxs[i] if i < len(temp_maxs) else 28.0
            t_min = temp_mins[i] if i < len(temp_mins) else 18.0
            avg_temp = round((t_max + t_min) / 2.0, 1)
            fc_wcode = weather_codes[i] if i < len(weather_codes) else 0
            fc_cond = map_wmo_code_to_condition(fc_wcode)
            fc_rain = rain_chances_list[i] if i < len(rain_chances_list) else 10
            
            forecast.append({
                "day": day_name,
                "temp": avg_temp,
                "condition": fc_cond,
                "rain_chance": fc_rain
            })
            
        # 3. Dynamic warnings and advisories based on actual values
        alerts = []
        advisories = [
            "Optimal conditions for general crop checking and sowing.",
            "Verify soil moisture content before activating irrigation systems."
        ]
        
        # Location mismatch validation check
        if lat is not None and lon is not None and normalized_state in STATE_COORDINATES:
            state_lat, state_lon = STATE_COORDINATES[normalized_state]
            distance = ((lat - state_lat) ** 2 + (lon - state_lon) ** 2) ** 0.5
            if distance > 6.0:
                alerts.append({
                    "type": "Location Mismatch Warning",
                    "severity": "Amber",
                    "message": f"GPS coordinates ({lat}, {lon}) do not correspond to the selected state of {normalized_state}."
                })
                advisories.append("Verify and update your farm field's GPS coordinates in the Operator Profile.")
        
        # Wind Alerts
        if wind_speed > 20.0:
            alerts.append({
                "type": "Wind Alert",
                "severity": "Amber",
                "message": f"High wind speeds of {wind_speed} km/h detected in {normalized_state}. Defer chemical pesticide sprays to prevent drift."
            })
            advisories.append("High winds can cause foliar damage to young tomato plants. Secure support stakes.")
            
        # Extreme Temperature Alerts
        min_temp = min(temp_mins) if temp_mins else temp
        max_temp = max(temp_maxs) if temp_maxs else temp
        max_rain_chance = max(rain_chances_list) if rain_chances_list else rain_chance
        
        if min_temp < 5.0:
            alerts.append({
                "type": "Frost Warning",
                "severity": "Red",
                "message": f"Night temperatures in {normalized_state} expected to fall near {round(min_temp, 1)}°C. Severe frost risk for vegetable and fruit holdings."
            })
            advisories.append("Apply plastic mulching sheets or organic straw cover to protect sensitive root cells from freezing.")
            advisories.append("Decline heavy evening watering cycles to prevent water logging in sub-zero soil surfaces.")
            
        if max_temp > 40.0:
            alerts.append({
                "type": "Extreme Heat Alert",
                "severity": "Red",
                "message": f"Extreme heat warning in {normalized_state}: daytime temperatures expected to peak near {round(max_temp, 1)}°C. Risk of heat stress and excessive transpiration."
            })
            advisories.append("Increase irrigation frequency to counter high evapotranspiration rates, preferably during early morning or late evening.")
            advisories.append("Consider providing shade covers for sensitive young seedlings to prevent leaf scorch.")
            
        # Heavy Rain Alerts
        if max_rain_chance > 75 or (len(daily_data.get("precipitation_sum", [])) > 0 and max(daily_data.get("precipitation_sum", [])) > 20.0):
            alerts.append({
                "type": "Heavy Rain Alert",
                "severity": "Red",
                "message": "Localized heavy rainfall. High flooding index in low-lying crop beds."
            })
            advisories.append("Clean drain trenches immediately to clear standing water from root zones, avoiding fungal root rots.")
            advisories.append("High relative humidity is highly conductive to powdery mildew. Apply preventive bio-fungicide sprays post-rain.")

        return {
            "state": normalized_state,
            "temperature": temp,
            "humidity": humidity,
            "condition": condition,
            "wind_speed": wind_speed,
            "wind_direction": wind_dir,
            "rain_chance": rain_chance,
            "forecast": forecast,
            "alerts": alerts,
            "advisories": advisories
        }
    except Exception as e:
        logger.warning(f"Error querying Open-Meteo: {e}. Falling back to simulated weather.")
        return get_state_weather_fallback(state)
