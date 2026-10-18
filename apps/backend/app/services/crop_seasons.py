"""
AgriNexus AI - Crop Seasonality Engine
Provides seasonal categorization and calendar alignment for crop recommendations.
"""

from typing import Dict, List, Tuple


# Agronomic approximations; review with an agronomist
CROP_SEASONS: Dict[str, List[str]] = {
    # Kharif crops (Monsoon/Autumn)
    "rice": ["kharif"],
    "cotton": ["kharif"],
    "jute": ["kharif"],
    "pigeonpeas": ["kharif"],
    "mothbeans": ["kharif"],
    "kidneybeans": ["kharif"],
    # Rabi crops (Winter/Spring)
    "chickpea": ["rabi"],
    "lentil": ["rabi"],
    # Dual-season field crops
    "maize": ["kharif", "rabi"],
    "mungbean": ["kharif", "zaid"],
    "blackgram": ["kharif", "zaid"],
    # Zaid crops (Summer)
    "watermelon": ["zaid"],
    "muskmelon": ["zaid"],
    # Perennial plantation and horticulture crops
    "pomegranate": ["perennial"],
    "banana": ["perennial"],
    "mango": ["perennial"],
    "grapes": ["perennial"],
    "apple": ["perennial"],
    "orange": ["perennial"],
    "papaya": ["perennial"],
    "coconut": ["perennial"],
    "coffee": ["perennial"],
}


def season_for_month(month: int) -> str:
    """
    Returns the Indian agricultural cropping season corresponding to the given month (1-12):
      - Kharif: June (6) to October (10)
      - Rabi: November (11) to March (3)
      - Zaid: April (4) to May (5)
    """
    if not (1 <= month <= 12):
        raise ValueError(f"Month must be between 1 and 12, got {month}")
    if 6 <= month <= 10:
        return "kharif"
    elif month in (11, 12, 1, 2, 3):
        return "rabi"
    else:
        return "zaid"


def season_fit(crop: str, current_season: str) -> Tuple[str, float]:
    """
    Determines season fit category and multiplier:
      - 'in_season' (multiplier 1.0) if current_season matches
      - 'perennial' (multiplier 0.9) if the crop is perennial
      - 'off_season' (multiplier 0.6) if planted out of recommended season
    """
    normalized_crop = crop.strip().lower()
    allowed_seasons = CROP_SEASONS.get(normalized_crop, ["perennial"])

    if "perennial" in allowed_seasons:
        return "perennial", 0.9
    elif current_season in allowed_seasons:
        return "in_season", 1.0
    else:
        return "off_season", 0.6
