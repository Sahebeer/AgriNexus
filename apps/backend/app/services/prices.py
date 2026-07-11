from typing import List, Dict, Any

MARKET_PRICES_DATABASE = [
    {
        "crop": "Rice",
        "msp": 2183,  # Minimum Support Price (₹/quintal)
        "average_price": 2350,
        "high_price": 2500,
        "low_price": 2100,
        "change_percent": 1.2,
        "mandis": [
            {"name": "Punjab Mandi (Khanna)", "price": 2420, "volume_tons": 450},
            {"name": "Haryana Mandi (Karnal)", "price": 2380, "volume_tons": 320},
            {"name": "Delhi Narela Mandi", "price": 2350, "volume_tons": 180},
            {"name": "UP Mandi (Mathura)", "price": 2250, "volume_tons": 250}
        ],
        "history_7d": [2310, 2320, 2315, 2330, 2345, 2340, 2350]
    },
    {
        "crop": "Wheat",
        "msp": 2275,
        "average_price": 2420,
        "high_price": 2550,
        "low_price": 2275,
        "change_percent": 0.8,
        "mandis": [
            {"name": "Punjab Mandi (Jalandhar)", "price": 2460, "volume_tons": 500},
            {"name": "UP Mandi (Hapur)", "price": 2430, "volume_tons": 410},
            {"name": "Delhi Azadpur Mandi", "price": 2450, "volume_tons": 220},
            {"name": "MP Mandi (Indore)", "price": 2340, "volume_tons": 380}
        ],
        "history_7d": [2400, 2405, 2410, 2408, 2415, 2418, 2420]
    },
    {
        "crop": "Tomato",
        "msp": 0,  # No standard MSP for perishables
        "average_price": 1800,
        "high_price": 2200,
        "low_price": 1200,
        "change_percent": -4.5,  # Drop due to fresh arrivals
        "mandis": [
            {"name": "Delhi Azadpur Mandi", "price": 1800, "volume_tons": 120},
            {"name": "Kolar Mandi (Karnataka)", "price": 1600, "volume_tons": 290},
            {"name": "Pune Mandi (Maharashtra)", "price": 1750, "volume_tons": 150},
            {"name": "Madanapalle Mandi (AP)", "price": 1650, "volume_tons": 210}
        ],
        "history_7d": [1980, 1950, 1920, 1880, 1850, 1820, 1800]
    },
    {
        "crop": "Potato",
        "msp": 0,
        "average_price": 1400,
        "high_price": 1650,
        "low_price": 1100,
        "change_percent": 2.1,
        "mandis": [
            {"name": "Agra Mandi (UP)", "price": 1450, "volume_tons": 600},
            {"name": "Delhi Azadpur Mandi", "price": 1480, "volume_tons": 340},
            {"name": "Indore Mandi (MP)", "price": 1380, "volume_tons": 280},
            {"name": "Hooghly Mandi (WB)", "price": 1320, "volume_tons": 450}
        ],
        "history_7d": [1360, 1370, 1375, 1380, 1390, 1395, 1400]
    },
    {
        "crop": "Corn",
        "msp": 2090,
        "average_price": 2150,
        "high_price": 2300,
        "low_price": 1950,
        "change_percent": 0.2,
        "mandis": [
            {"name": "Karnataka Mandi (Haveri)", "price": 2220, "volume_tons": 240},
            {"name": "Bihar Mandi (Gulabbagh)", "price": 2180, "volume_tons": 480},
            {"name": "UP Mandi (Bahraich)", "price": 2110, "volume_tons": 150},
            {"name": "Rajasthan Mandi (Kota)", "price": 2090, "volume_tons": 190}
        ],
        "history_7d": [2140, 2145, 2142, 2148, 2150, 2148, 2150]
    },
    {
        "crop": "Apple",
        "msp": 0,
        "average_price": 8500,
        "high_price": 10500,
        "low_price": 6500,
        "change_percent": -1.8,
        "mandis": [
            {"name": "Shimla Mandi (HP)", "price": 8800, "volume_tons": 90},
            {"name": "Sopore Mandi (J&K)", "price": 8400, "volume_tons": 140},
            {"name": "Delhi Azadpur Mandi", "price": 9200, "volume_tons": 75},
            {"name": "Srinagar Mandi (J&K)", "price": 8300, "volume_tons": 110}
        ],
        "history_7d": [8650, 8620, 8580, 8550, 8540, 8520, 8500]
    }
]

def get_market_prices(search_crop: str = None) -> List[Dict[str, Any]]:
    """
    Returns Mandi price structures.
    Can be filtered by crop names.
    """
    if not search_crop:
        return MARKET_PRICES_DATABASE
        
    cleaned_search = search_crop.strip().lower()
    return [c for c in MARKET_PRICES_DATABASE if cleaned_search in c["crop"].lower()]
