from typing import Dict, Any, List

def get_state_weather(state: str) -> Dict[str, Any]:
    """
    Returns realistic simulated meteorological values and warning alerts
    tailored to the farmer's geographic region.
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
        # Northern plains / dry hot summers / monsoon shifts
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
        # Mountainous / cool temperatures / frost warnings
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
        # Southern coastal / tropical / heavy monsoons
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
