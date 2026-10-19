"""
AgriNexus AI - Canonical Crop and Approved Crop-Type Registry
Provides local, immutable, static single-source-of-truth crop type catalogs
and cross-crop validation rules.
"""

from typing import Dict, List, Optional, Tuple, NamedTuple
from fastapi import HTTPException, status


class CropTypeOption(NamedTuple):
    id: str
    label: str
    aliases: Tuple[str, ...] = ()


# ─── Canonical Normalization Mapping ─────────────────────────────────────────
# Maps common display names, aliases, and legacy keys to the canonical key.
CROP_ALIASES: Dict[str, str] = {
    # Cereals & Grains
    "rice": "rice",
    "paddy": "rice",
    "rice (paddy)": "rice",
    "wheat": "wheat",
    "maize": "maize",
    "corn": "maize",
    "corn_(maize)": "maize",
    # Fibers & Commercial
    "cotton": "cotton",
    "jute": "jute",
    "sugarcane": "sugarcane",
    # Pulses & Legumes
    "chickpea": "chickpea",
    "chickpeas": "chickpea",
    "chickpeas (gram)": "chickpea",
    "gram": "chickpea",
    "chana": "chickpea",
    "kidneybeans": "kidneybeans",
    "kidney beans": "kidneybeans",
    "kidney_beans": "kidneybeans",
    "rajma": "kidneybeans",
    "lentil": "lentil",
    "lentils": "lentil",
    "masoor": "lentil",
    "pigeonpeas": "pigeonpeas",
    "pigeon peas": "pigeonpeas",
    "pigeon pea": "pigeonpeas",
    "arhar": "pigeonpeas",
    "tur": "pigeonpeas",
    "mungbean": "mungbean",
    "mung bean": "mungbean",
    "moong": "mungbean",
    "blackgram": "blackgram",
    "black gram": "blackgram",
    "urad": "blackgram",
    "mothbeans": "mothbeans",
    "moth beans": "mothbeans",
    "soybean": "soybean",
    "soyabean": "soybean",
    "groundnut": "groundnut",
    "peanut": "groundnut",
    "peanuts": "groundnut",
    "mustard": "mustard",
    # Vegetables & Roots
    "potato": "potato",
    "tomato": "tomato",
    "onion": "onion",
    "bell_pepper": "bell_pepper",
    "bell pepper": "bell_pepper",
    "capsicum": "bell_pepper",
    "pepper,_bell": "bell_pepper",
    "cassava": "cassava",
    "squash": "squash",
    # Fruits & Plantation
    "apple": "apple",
    "banana": "banana",
    "grapes": "grapes",
    "grape": "grapes",
    "mango": "mango",
    "orange": "orange",
    "citrus": "orange",
    "papaya": "papaya",
    "pomegranate": "pomegranate",
    "watermelon": "watermelon",
    "muskmelon": "muskmelon",
    "coconut": "coconut",
    "coffee": "coffee",
    "blueberry": "blueberry",
    "cherry": "cherry",
    "cherry_(including_sour)": "cherry",
    "peach": "peach",
    "raspberry": "raspberry",
    "strawberry": "strawberry",
}


def normalize_crop_name(name: Optional[str]) -> str:
    """
    Normalizes any crop display string, alias, or legacy key to its canonical lowercase identifier.
    Returns empty string if name is None or blank.
    """
    if not name:
        return ""
    cleaned = name.strip().lower()
    # Direct alias lookup
    if cleaned in CROP_ALIASES:
        return CROP_ALIASES[cleaned]
    # Replace space/hyphen with underscore and retry
    alt_cleaned = cleaned.replace(" ", "_").replace("-", "_")
    if alt_cleaned in CROP_ALIASES:
        return CROP_ALIASES[alt_cleaned]
    return cleaned


# ─── Approved Crop-Type Catalog Registry ─────────────────────────────────────
# Only define types for approved crops as mandated by system specifications.
APPROVED_CROP_TYPE_CATALOG: Dict[str, Tuple[CropTypeOption, ...]] = {
    "rice": (
        CropTypeOption("basmati", "Basmati"),
        CropTypeOption("sona_masuri", "Sona Masuri", ("sonamasuri",)),
        CropTypeOption("ir64", "IR64", ("ir_64",)),
        CropTypeOption("swarna", "Swarna"),
        CropTypeOption("ponni", "Ponni"),
        CropTypeOption("matta_red_rice", "Matta / Red Rice", ("matta", "red_rice")),
        CropTypeOption("black_rice", "Black Rice"),
        CropTypeOption("other_non_basmati", "Other Non-Basmati", ("non_basmati",)),
    ),
    "wheat": (
        CropTypeOption("bread_wheat", "Common / Bread Wheat", ("common_wheat",)),
        CropTypeOption("durum", "Durum Wheat", ("durum_wheat",)),
        CropTypeOption("emmer", "Emmer Wheat", ("emmer_wheat", "khapli")),
        CropTypeOption("sharbati", "Sharbati"),
        CropTypeOption("lokwan", "Lokwan"),
    ),
    "maize": (
        CropTypeOption("field_grain", "Field / Grain Maize", ("grain_maize", "field_corn")),
        CropTypeOption("sweet_corn", "Sweet Corn"),
        CropTypeOption("baby_corn", "Baby Corn"),
        CropTypeOption("popcorn", "Popcorn"),
        CropTypeOption("fodder_maize", "Fodder Maize", ("fodder_corn",)),
    ),
    "cotton": (
        CropTypeOption("desi", "Desi Cotton"),
        CropTypeOption("upland", "American / Upland Cotton", ("american_cotton",)),
        CropTypeOption("egyptian_long_staple", "Egyptian / Long-Staple Cotton", ("long_staple",)),
    ),
    "jute": (
        CropTypeOption("tossa", "Tossa Jute"),
        CropTypeOption("white_jute", "White Jute"),
    ),
    "chickpea": (
        CropTypeOption("desi", "Desi Chickpea"),
        CropTypeOption("kabuli", "Kabuli Chickpea"),
    ),
    "kidneybeans": (
        CropTypeOption("red_kidney", "Red Kidney Bean"),
        CropTypeOption("white_kidney", "White Kidney Bean"),
        CropTypeOption("cranberry", "Cranberry Bean"),
    ),
    "lentil": (
        CropTypeOption("red", "Red Lentil"),
        CropTypeOption("brown_green", "Brown / Green Lentil", ("green_lentil", "brown_lentil")),
    ),
    "apple": (
        CropTypeOption("red_delicious", "Red Delicious"),
        CropTypeOption("royal_delicious", "Royal Delicious"),
        CropTypeOption("gala", "Gala"),
        CropTypeOption("fuji", "Fuji"),
        CropTypeOption("granny_smith", "Granny Smith"),
        CropTypeOption("golden_delicious", "Golden Delicious"),
        CropTypeOption("ambri", "Ambri"),
    ),
    "banana": (
        CropTypeOption("cavendish", "Cavendish"),
        CropTypeOption("robusta", "Robusta"),
        CropTypeOption("rasthali", "Rasthali"),
        CropTypeOption("poovan", "Poovan"),
        CropTypeOption("nendran", "Nendran"),
        CropTypeOption("yelakki", "Yelakki"),
        CropTypeOption("red_banana", "Red Banana"),
    ),
    "grapes": (
        CropTypeOption("thompson_seedless", "Thompson Seedless"),
        CropTypeOption("sonaka", "Sonaka"),
        CropTypeOption("sharad_seedless", "Sharad Seedless"),
        CropTypeOption("crimson_seedless", "Crimson Seedless"),
        CropTypeOption("flame_seedless", "Flame Seedless"),
        CropTypeOption("bangalore_blue", "Bangalore Blue"),
    ),
    "mango": (
        CropTypeOption("alphonso", "Alphonso"),
        CropTypeOption("kesar", "Kesar"),
        CropTypeOption("dashehari", "Dashehari"),
        CropTypeOption("langra", "Langra"),
        CropTypeOption("banganapalli", "Banganapalli"),
        CropTypeOption("totapuri", "Totapuri"),
        CropTypeOption("chaunsa", "Chaunsa"),
        CropTypeOption("amrapali", "Amrapali"),
    ),
    "orange": (
        CropTypeOption("nagpur_mandarin", "Nagpur Mandarin"),
        CropTypeOption("kinnow", "Kinnow"),
        CropTypeOption("khasi_mandarin", "Khasi Mandarin"),
        CropTypeOption("mosambi", "Sweet Orange / Mosambi"),
        CropTypeOption("valencia", "Valencia Orange"),
    ),
    "papaya": (
        CropTypeOption("red_lady", "Red Lady"),
        CropTypeOption("pusa_delicious", "Pusa Delicious"),
        CropTypeOption("pusa_nanha", "Pusa Nanha"),
        CropTypeOption("co_2", "CO-2"),
        CropTypeOption("arka_prabhath", "Arka Prabhath"),
    ),
    "pomegranate": (
        CropTypeOption("bhagwa", "Bhagwa"),
        CropTypeOption("ganesh", "Ganesh"),
        CropTypeOption("arakta", "Arakta"),
        CropTypeOption("mridula", "Mridula"),
    ),
    "watermelon": (
        CropTypeOption("crimson_sweet", "Crimson Sweet"),
        CropTypeOption("sugar_baby", "Sugar Baby"),
        CropTypeOption("arka_manik", "Arka Manik"),
        CropTypeOption("black_diamond", "Black Diamond"),
        CropTypeOption("seedless_hybrid", "Seedless Hybrid"),
    ),
    "muskmelon": (
        CropTypeOption("hara_madhu", "Hara Madhu"),
        CropTypeOption("punjab_sunehri", "Punjab Sunehri"),
        CropTypeOption("pusa_madhuras", "Pusa Madhuras"),
        CropTypeOption("kashi_madhu", "Kashi Madhu"),
        CropTypeOption("galia", "Galia"),
    ),
    "coconut": (
        CropTypeOption("tall", "Tall Coconut"),
        CropTypeOption("dwarf", "Dwarf Coconut"),
        CropTypeOption("hybrid", "Hybrid Coconut"),
    ),
    "coffee": (
        CropTypeOption("arabica", "Arabica"),
        CropTypeOption("robusta", "Robusta"),
        CropTypeOption("liberica", "Liberica"),
    ),
    "potato": (
        CropTypeOption("table", "Table Potato"),
        CropTypeOption("processing", "Processing Potato"),
        CropTypeOption("kufri_jyoti", "Kufri Jyoti"),
        CropTypeOption("kufri_pukhraj", "Kufri Pukhraj"),
        CropTypeOption("kufri_chandramukhi", "Kufri Chandramukhi"),
    ),
    "tomato": (
        CropTypeOption("determinate", "Determinate"),
        CropTypeOption("indeterminate", "Indeterminate"),
        CropTypeOption("cherry", "Cherry Tomato"),
        CropTypeOption("roma", "Roma / Plum Tomato"),
        CropTypeOption("beefsteak", "Beefsteak Tomato"),
    ),
    "bell_pepper": (
        CropTypeOption("green", "Green"),
        CropTypeOption("red", "Red"),
        CropTypeOption("yellow", "Yellow"),
        CropTypeOption("orange", "Orange"),
    ),
    "groundnut": (
        CropTypeOption("spanish_bunch", "Spanish Bunch"),
        CropTypeOption("virginia_bunch", "Virginia Bunch"),
        CropTypeOption("valencia", "Valencia"),
        CropTypeOption("runner", "Runner"),
    ),
    "mustard": (
        CropTypeOption("indian_brown", "Indian / Brown Mustard"),
        CropTypeOption("yellow", "Yellow Mustard"),
        CropTypeOption("black", "Black Mustard"),
    ),
    "onion": (
        CropTypeOption("red", "Red Onion"),
        CropTypeOption("yellow", "Yellow Onion"),
        CropTypeOption("white", "White Onion"),
        CropTypeOption("shallot", "Shallot"),
    ),
    "soybean": (
        CropTypeOption("yellow_grain", "Yellow Grain Soybean"),
        CropTypeOption("black_soybean", "Black Soybean"),
        CropTypeOption("green_edamame", "Green Soybean / Edamame"),
    ),
}

# Explicit list of crops that have NO approved crop type catalog
EXPLICIT_NO_TYPE_CROPS = {
    "pigeonpeas",
    "mungbean",
    "blackgram",
    "mothbeans",
    "blueberry",
    "cassava",
    "cherry",
    "peach",
    "raspberry",
    "squash",
    "strawberry",
    "sugarcane",
}


def get_crop_types(crop_name: Optional[str]) -> List[CropTypeOption]:
    """
    Returns the list of approved CropTypeOption instances for the given crop.
    Returns empty list if the crop has no approved type catalog.
    """
    canonical = normalize_crop_name(crop_name)
    if not canonical:
        return []
    return list(APPROVED_CROP_TYPE_CATALOG.get(canonical, ()))


def has_crop_types(crop_name: Optional[str]) -> bool:
    """Returns True if the crop has an approved crop-type catalog."""
    canonical = normalize_crop_name(crop_name)
    return canonical in APPROVED_CROP_TYPE_CATALOG


def get_crop_type_label(crop_name: Optional[str], crop_type_id: Optional[str]) -> Optional[str]:
    """Retrieves user-facing label for a stored crop type id, or None."""
    if not crop_name or not crop_type_id:
        return None
    canonical = normalize_crop_name(crop_name)
    options = APPROVED_CROP_TYPE_CATALOG.get(canonical, ())
    target = crop_type_id.strip().lower()
    for opt in options:
        if opt.id == target or target in opt.aliases:
            return opt.label
    return None


def validate_crop_type(
    crop_name: Optional[str],
    crop_type_id: Optional[str],
) -> Optional[str]:
    """
    Validates crop_type_id against crop_name.
    
    Rules:
      1. If crop_type_id is None, empty, or whitespace: returns None (always valid).
      2. If crop has NO approved types, crop_type_id MUST be None.
         Submitting a type for an unapproved crop raises HTTP 400.
      3. If crop HAS approved types:
         crop_type_id must match an approved ID (or alias).
         Returns the canonical ID string.
         Mismatch raises HTTP 400.
    """
    if crop_type_id is None:
        return None
    
    clean_type = crop_type_id.strip().lower()
    if not clean_type:
        return None

    canonical_crop = normalize_crop_name(crop_name)
    
    # Check if crop has approved catalog
    if canonical_crop not in APPROVED_CROP_TYPE_CATALOG:
        display_name = crop_name or "Unknown"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Crop '{display_name}' does not support crop types. "
                "The crop_type_id field must be null or omitted."
            ),
        )

    options = APPROVED_CROP_TYPE_CATALOG[canonical_crop]
    for opt in options:
        if opt.id == clean_type or clean_type in opt.aliases:
            return opt.id

    valid_ids = [opt.id for opt in options]
    display_name = crop_name or canonical_crop
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Invalid crop_type_id '{clean_type}' for crop '{display_name}'. "
            f"Allowed types: {', '.join(valid_ids)}."
        ),
    )
