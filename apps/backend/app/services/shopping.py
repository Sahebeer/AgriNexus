"""
services/shopping.py
────────────────────
Deterministic rule-engine that generates a complete farm shopping list from:
  crop × soil_type × season × growth_stage × farm_size (hectares)

All quantities are expressed per-hectare and then scaled by farm_size.
Prices are approximate INR retail/wholesale 2024-25 values.
"""
from __future__ import annotations
from typing import List, Dict, Any
import math

# ─── Per-hectare item templates ───────────────────────────────────────────────
# Structure: { category, name, description, qty_per_ha, unit, unit_cost (INR) }

CROP_RECIPES: Dict[str, List[Dict[str, Any]]] = {
    "Rice": [
        {"category": "Seeds",        "name": "Paddy Seeds (Certified HYV)",  "description": "High-yielding certified paddy variety (e.g. PR-126, Pusa Basmati)", "qty_per_ha": 25,  "unit": "kg",   "unit_cost": 65},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Nitrogen source — split in 3 doses", "qty_per_ha": 120, "unit": "kg",   "unit_cost": 6},
        {"category": "Fertilizers",  "name": "DAP (18-46-0)",                "description": "Phosphorus + Nitrogen basal dose",  "qty_per_ha": 60,  "unit": "kg",   "unit_cost": 27},
        {"category": "Fertilizers",  "name": "Muriate of Potash (MOP)",      "description": "Potassium source",                  "qty_per_ha": 40,  "unit": "kg",   "unit_cost": 17},
        {"category": "Micronutrients","name": "Zinc Sulphate (21%)",          "description": "Prevents khaira disease in paddy",  "qty_per_ha": 25,  "unit": "kg",   "unit_cost": 35},
        {"category": "Pesticides",   "name": "Carbofuran 3G (Stem borer)",   "description": "Granular insecticide for stem borer control", "qty_per_ha": 33, "unit": "kg", "unit_cost": 80},
        {"category": "Pesticides",   "name": "Tricyclazole 75WP (Blast)",    "description": "Fungicide for blast disease",        "qty_per_ha": 0.6, "unit": "kg",  "unit_cost": 1200},
        {"category": "Pesticides",   "name": "Cartap Hydrochloride 50SP",    "description": "For leaf folder & BPH control",     "qty_per_ha": 0.5, "unit": "kg",  "unit_cost": 1100},
        {"category": "Tools",        "name": "Paddy Transplanter (Hire)",    "description": "Mechanized transplanting service",   "qty_per_ha": 1,   "unit": "session", "unit_cost": 4500},
        {"category": "Tools",        "name": "Power Weeder (Hire)",          "description": "Inter-row weeding",                 "qty_per_ha": 1,   "unit": "session", "unit_cost": 1200},
    ],
    "Wheat": [
        {"category": "Seeds",        "name": "Wheat Seeds (HD-3086 / PBW-752)", "description": "High-yielding rust-resistant variety", "qty_per_ha": 100, "unit": "kg",  "unit_cost": 42},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Nitrogen — 3 split applications",    "qty_per_ha": 130, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "DAP (18-46-0)",                "description": "Phosphorus basal",                   "qty_per_ha": 65,  "unit": "kg",  "unit_cost": 27},
        {"category": "Fertilizers",  "name": "Muriate of Potash (MOP)",      "description": "Potassium basal",                    "qty_per_ha": 30,  "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Sulphur (Bentonite 90%)",      "description": "For protein improvement",            "qty_per_ha": 20,  "unit": "kg",  "unit_cost": 22},
        {"category": "Pesticides",   "name": "Propiconazole 25EC (Rust)",    "description": "Fungicide for yellow rust control",   "qty_per_ha": 0.5, "unit": "L",   "unit_cost": 900},
        {"category": "Pesticides",   "name": "Isoproturon 75WP (Weeds)",     "description": "Pre-emergence weedicide",            "qty_per_ha": 1.25,"unit": "kg",  "unit_cost": 400},
        {"category": "Tools",        "name": "Seed Drill (Hire)",            "description": "Row seeding at correct depth",       "qty_per_ha": 1,   "unit": "session", "unit_cost": 1500},
        {"category": "Tools",        "name": "Combine Harvester (Hire)",     "description": "Harvesting + threshing",             "qty_per_ha": 1,   "unit": "session", "unit_cost": 6000},
    ],
    "Cotton": [
        {"category": "Seeds",        "name": "Bt Cotton Hybrid Seeds",       "description": "Bollworm-resistant Bt hybrid seeds", "qty_per_ha": 0.75,"unit": "kg",  "unit_cost": 8000},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Nitrogen — split doses",             "qty_per_ha": 130, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "Single Super Phosphate (SSP)", "description": "Phosphorus + Sulphur source",        "qty_per_ha": 250, "unit": "kg",  "unit_cost": 8},
        {"category": "Fertilizers",  "name": "Muriate of Potash (MOP)",      "description": "Potassium for boll development",     "qty_per_ha": 60,  "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Boron (0.5% foliar spray)",   "description": "Prevents boll drop",                 "qty_per_ha": 1.5, "unit": "kg",  "unit_cost": 400},
        {"category": "Pesticides",   "name": "Imidacloprid 70WG (Aphids)",   "description": "Seed treatment for aphid control",   "qty_per_ha": 0.07,"unit": "kg",  "unit_cost": 3500},
        {"category": "Pesticides",   "name": "Profenofos 50EC (Bollworm)",   "description": "Contact insecticide for bollworms",  "qty_per_ha": 1.0, "unit": "L",   "unit_cost": 650},
        {"category": "Pesticides",   "name": "Mancozeb 75WP (Leaf spot)",    "description": "Fungicide for fungal leaf diseases", "qty_per_ha": 2.0, "unit": "kg",  "unit_cost": 250},
        {"category": "Tools",        "name": "Ridger/Furrow Opener (Hire)",  "description": "Ridge preparation",                 "qty_per_ha": 1,   "unit": "session", "unit_cost": 1800},
        {"category": "Tools",        "name": "Knapsack Sprayer",             "description": "16L manual crop sprayer",            "qty_per_ha": 1,   "unit": "unit","unit_cost": 1800},
    ],
    "Tomato": [
        {"category": "Seeds",        "name": "Hybrid Tomato Seeds (F1)",     "description": "Virus-tolerant indeterminate hybrid", "qty_per_ha": 0.25,"unit": "kg",  "unit_cost": 20000},
        {"category": "Fertilizers",  "name": "NPK 19:19:19 (Starter)",       "description": "Balanced starter for transplanting", "qty_per_ha": 200, "unit": "kg",  "unit_cost": 55},
        {"category": "Fertilizers",  "name": "Calcium Nitrate",              "description": "Prevents blossom end rot",           "qty_per_ha": 100, "unit": "kg",  "unit_cost": 55},
        {"category": "Fertilizers",  "name": "NPK 0:52:34 (Fruiting)",       "description": "High-P/K for fruit set",             "qty_per_ha": 80,  "unit": "kg",  "unit_cost": 85},
        {"category": "Micronutrients","name": "Boron + Zinc Foliar Mix",      "description": "For fruit quality",                  "qty_per_ha": 2,   "unit": "kg",  "unit_cost": 450},
        {"category": "Pesticides",   "name": "Metalaxyl 8% + Mancozeb 64%",  "description": "For early blight and late blight",   "qty_per_ha": 2.5, "unit": "kg",  "unit_cost": 320},
        {"category": "Pesticides",   "name": "Imidacloprid 17.8SL (Whitefly)","description": "Controls whitefly & TYLCV vector", "qty_per_ha": 0.5, "unit": "L",   "unit_cost": 750},
        {"category": "Tools",        "name": "Drip Irrigation System",       "description": "Inline drip with laterals",          "qty_per_ha": 1,   "unit": "set", "unit_cost": 45000},
        {"category": "Tools",        "name": "Bamboo Stakes (Staking)",       "description": "Crop support stakes",                "qty_per_ha": 2000,"unit": "pcs", "unit_cost": 4},
        {"category": "Tools",        "name": "Mulch Film (Silver/Black)",     "description": "Weed suppression + moisture",        "qty_per_ha": 60,  "unit": "kg",  "unit_cost": 120},
    ],
    "Potato": [
        {"category": "Seeds",        "name": "Potato Seed Tubers (Certified)","description": "Disease-free certified seed tubers (Kufri Pukhraj/Jyoti)", "qty_per_ha": 2500, "unit": "kg", "unit_cost": 18},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Nitrogen split doses",               "qty_per_ha": 100, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "SSP (Single Super Phosphate)", "description": "Phosphorus basal dose",              "qty_per_ha": 375, "unit": "kg",  "unit_cost": 8},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "Critical for tuber development",    "qty_per_ha": 150, "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Zinc Sulphate",                "description": "Soil application pre-planting",      "qty_per_ha": 20,  "unit": "kg",  "unit_cost": 35},
        {"category": "Pesticides",   "name": "Mancozeb 75WP (Late Blight)",  "description": "Most critical disease in potato",    "qty_per_ha": 2.0, "unit": "kg",  "unit_cost": 250},
        {"category": "Pesticides",   "name": "Chlorpyrifos 20EC (Cutworm)",  "description": "Soil-drench for cutworm control",    "qty_per_ha": 2.5, "unit": "L",   "unit_cost": 450},
        {"category": "Tools",        "name": "Potato Ridger (Hire)",         "description": "Ridge & furrow making",              "qty_per_ha": 1,   "unit": "session", "unit_cost": 2000},
        {"category": "Tools",        "name": "Cold Storage Access (3 mos)",  "description": "Post-harvest storage charge",        "qty_per_ha": 5,   "unit": "MT",  "unit_cost": 2500},
    ],
    "Sugarcane": [
        {"category": "Seeds",        "name": "Sugarcane Sets (3-bud setts)", "description": "Disease-free seed cane setts",       "qty_per_ha": 7500,"unit": "pcs", "unit_cost": 2},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Split doses over 12 months",         "qty_per_ha": 200, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "SSP",                          "description": "Phosphorus basal",                   "qty_per_ha": 375, "unit": "kg",  "unit_cost": 8},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "Ratoon yield improvement",           "qty_per_ha": 120, "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Zinc Sulphate",                "description": "For chlorosis prevention",           "qty_per_ha": 25,  "unit": "kg",  "unit_cost": 35},
        {"category": "Pesticides",   "name": "Chlorpyrifos 20EC (Termite)",  "description": "Furrow treatment against termites",  "qty_per_ha": 5,   "unit": "L",   "unit_cost": 450},
        {"category": "Pesticides",   "name": "Atrazine 50WP (Weed)",         "description": "Pre-emergence weedicide",            "qty_per_ha": 2,   "unit": "kg",  "unit_cost": 600},
        {"category": "Tools",        "name": "Trash Mulching Labour",        "description": "Ratoon mulching",                   "qty_per_ha": 10,  "unit": "labour-days", "unit_cost": 500},
    ],
    "Mustard": [
        {"category": "Seeds",        "name": "Hybrid Mustard Seeds",         "description": "High oil content hybrid (Pusa Bold/Varuna)", "qty_per_ha": 5, "unit": "kg", "unit_cost": 180},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Two splits — basal + 30 DAS",        "qty_per_ha": 80,  "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "DAP",                          "description": "Phosphorus basal",                   "qty_per_ha": 40,  "unit": "kg",  "unit_cost": 27},
        {"category": "Micronutrients","name": "Sulphur (Bentonite 90%)",      "description": "Improves oil content",               "qty_per_ha": 40,  "unit": "kg",  "unit_cost": 22},
        {"category": "Pesticides",   "name": "Imidacloprid 17.8SL (Aphid)",  "description": "Mustard aphid control",              "qty_per_ha": 0.25,"unit": "L",   "unit_cost": 750},
        {"category": "Pesticides",   "name": "Mancozeb (Alternaria Blight)", "description": "Fungal blight prevention",           "qty_per_ha": 1.5, "unit": "kg",  "unit_cost": 250},
        {"category": "Tools",        "name": "Zero-till Ferti-Seed Drill (Hire)", "description": "Direct seeding without tillage", "qty_per_ha": 1, "unit": "session", "unit_cost": 2000},
    ],
    "Corn": [
        {"category": "Seeds",        "name": "Hybrid Maize Seeds (3421/NK-6240)", "description": "Single cross hybrid for high yield", "qty_per_ha": 20, "unit": "kg", "unit_cost": 300},
        {"category": "Fertilizers",  "name": "Urea (46% N)",                 "description": "Heavy nitrogen feeder — split 4×",   "qty_per_ha": 180, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "DAP",                          "description": "Phosphorus basal",                   "qty_per_ha": 80,  "unit": "kg",  "unit_cost": 27},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "Potassium for grain fill",           "qty_per_ha": 60,  "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Zinc Sulphate",                "description": "Prevents white bud",                "qty_per_ha": 25,  "unit": "kg",  "unit_cost": 35},
        {"category": "Pesticides",   "name": "Atrazine 50WP (Weed)",         "description": "Pre-emergence broadleaf weed control", "qty_per_ha": 2.0, "unit": "kg", "unit_cost": 600},
        {"category": "Pesticides",   "name": "Chlorpyrifos 20EC (Stem borer)","description": "Maize stem borer control",           "qty_per_ha": 2.0, "unit": "L",   "unit_cost": 450},
        {"category": "Tools",        "name": "Planter (4-row tractor mounted, Hire)", "description": "Precision planting", "qty_per_ha": 1, "unit": "session", "unit_cost": 2500},
    ],
    "Soybean": [
        {"category": "Seeds",        "name": "Soybean Seeds (JS-335 / MACS-1407)", "description": "Certified disease-free variety", "qty_per_ha": 70, "unit": "kg", "unit_cost": 80},
        {"category": "Fertilizers",  "name": "DAP",                          "description": "Low N — fixes own; needs P",         "qty_per_ha": 80,  "unit": "kg",  "unit_cost": 27},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "Potassium for pod fill",             "qty_per_ha": 40,  "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Rhizobium + PSB Biofertilizer","description": "Seed inoculant for N-fixation",      "qty_per_ha": 0.5, "unit": "kg",  "unit_cost": 200},
        {"category": "Pesticides",   "name": "Imidacloprid 70WS (Seed trt)", "description": "Seed treatment against thrips/aphids","qty_per_ha": 0.12,"unit": "kg",  "unit_cost": 3200},
        {"category": "Pesticides",   "name": "Hexaconazole 5SC (Rust)",      "description": "Soybean rust fungicide",             "qty_per_ha": 1.0, "unit": "L",   "unit_cost": 600},
    ],
    "Groundnut": [
        {"category": "Seeds",        "name": "Groundnut Pods (GJG-22/TAG-24)","description": "Bold-seeded high oil variety",       "qty_per_ha": 120, "unit": "kg",  "unit_cost": 70},
        {"category": "Fertilizers",  "name": "Gypsum (Calcium + Sulphur)",   "description": "Peg-zone Ca — crucial for nut fill", "qty_per_ha": 400, "unit": "kg",  "unit_cost": 5},
        {"category": "Fertilizers",  "name": "DAP",                          "description": "Phosphorus basal",                   "qty_per_ha": 50,  "unit": "kg",  "unit_cost": 27},
        {"category": "Micronutrients","name": "Boron (Solubor)",              "description": "Prevents empty pod",                "qty_per_ha": 0.5, "unit": "kg",  "unit_cost": 500},
        {"category": "Pesticides",   "name": "Chlorothalonil 75WP (Tikka)",  "description": "Leaf spot (tikka) control",          "qty_per_ha": 2.0, "unit": "kg",  "unit_cost": 280},
        {"category": "Tools",        "name": "Groundnut Digger (Hire)",      "description": "Mechanical vine lifting",            "qty_per_ha": 1,   "unit": "session", "unit_cost": 3000},
    ],
    "Onion": [
        {"category": "Seeds",        "name": "Onion Seeds (Bhima Kiran/Agrifound Dark Red)", "description": "High yield, good storage variety", "qty_per_ha": 8, "unit": "kg", "unit_cost": 1200},
        {"category": "Fertilizers",  "name": "Urea",                         "description": "Nitrogen — 3 splits",                "qty_per_ha": 110, "unit": "kg",  "unit_cost": 6},
        {"category": "Fertilizers",  "name": "SSP",                          "description": "Phosphorus basal",                   "qty_per_ha": 375, "unit": "kg",  "unit_cost": 8},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "For bulb size",                      "qty_per_ha": 100, "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Zinc Sulphate",                "description": "Foliar spray at bulb initiation",   "qty_per_ha": 2,   "unit": "kg",  "unit_cost": 35},
        {"category": "Pesticides",   "name": "Mancozeb (Purple Blotch)",     "description": "Fungicide for leaf diseases",        "qty_per_ha": 2,   "unit": "kg",  "unit_cost": 250},
        {"category": "Pesticides",   "name": "Chlorpyrifos (Thrips)",        "description": "Thrips control spray",               "qty_per_ha": 1,   "unit": "L",   "unit_cost": 450},
        {"category": "Tools",        "name": "Mulch / Straw Covering",       "description": "Nursery protection",                 "qty_per_ha": 5,   "unit": "quintals", "unit_cost": 200},
    ],
    "Apple": [
        {"category": "Seeds",        "name": "Apple Rootstocks (MM-106/MM-111)", "description": "Clonal rootstocks for orchard establishment", "qty_per_ha": 400, "unit": "plants", "unit_cost": 120},
        {"category": "Fertilizers",  "name": "FYM / Farm Yard Manure",       "description": "Base organic application",           "qty_per_ha": 20000,"unit": "kg", "unit_cost": 0.5},
        {"category": "Fertilizers",  "name": "NPK 10:26:26",                 "description": "Pre-bloom fertilization",            "qty_per_ha": 150, "unit": "kg",  "unit_cost": 60},
        {"category": "Fertilizers",  "name": "Calcium Nitrate",              "description": "Fruit quality + storage life",       "qty_per_ha": 50,  "unit": "kg",  "unit_cost": 55},
        {"category": "Micronutrients","name": "Boron (Borax foliar)",         "description": "Pollen germination + fruit set",     "qty_per_ha": 3,   "unit": "kg",  "unit_cost": 200},
        {"category": "Pesticides",   "name": "Captan 50WP (Scab)",           "description": "Apple scab fungicide — critical",    "qty_per_ha": 2.5, "unit": "kg",  "unit_cost": 350},
        {"category": "Pesticides",   "name": "Chlorpyrifos (San Jose Scale)", "description": "Dormant spray for scale insects",   "qty_per_ha": 1.5, "unit": "L",   "unit_cost": 450},
        {"category": "Tools",        "name": "Anti-Hail Net (150 GSM)",      "description": "Orchard protection netting",         "qty_per_ha": 1200,"unit": "m²",  "unit_cost": 22},
        {"category": "Tools",        "name": "Pruning Shears (Felco-2 type)","description": "Professional pruning tool",          "qty_per_ha": 2,   "unit": "pcs", "unit_cost": 1200},
    ],
    "Mango": [
        {"category": "Seeds",        "name": "Alphonso/Kesar Grafted Saplings", "description": "1-year grafted high-value variety", "qty_per_ha": 100, "unit": "plants", "unit_cost": 150},
        {"category": "Fertilizers",  "name": "FYM (Organic Manure)",         "description": "Pit filling at planting",            "qty_per_ha": 10000,"unit":"kg",   "unit_cost": 0.5},
        {"category": "Fertilizers",  "name": "NPK 12:32:16",                 "description": "Pre-flowering fertilization",        "qty_per_ha": 100, "unit": "kg",  "unit_cost": 60},
        {"category": "Micronutrients","name": "Manganese + Zinc foliar mix",  "description": "For panicle development",            "qty_per_ha": 3,   "unit": "kg",  "unit_cost": 300},
        {"category": "Pesticides",   "name": "Mancozeb (Anthracnose)",       "description": "Flower + fruit phase fungicide",     "qty_per_ha": 2,   "unit": "kg",  "unit_cost": 250},
        {"category": "Pesticides",   "name": "Imidacloprid (Hopper)",        "description": "Mango hopper control",               "qty_per_ha": 0.5, "unit": "L",   "unit_cost": 750},
        {"category": "Tools",        "name": "Mist Blower Sprayer (Hire)",   "description": "Canopy coverage for tall trees",     "qty_per_ha": 2,   "unit": "session", "unit_cost": 2000},
    ],
    "Chickpeas (Gram)": [
        {"category": "Seeds",        "name": "Chickpea Seeds (GNG-663/JG-315)","description": "Desi or Kabuli certified variety",  "qty_per_ha": 80,  "unit": "kg",  "unit_cost": 85},
        {"category": "Fertilizers",  "name": "DAP",                          "description": "Low N (fixes N) — P critical",       "qty_per_ha": 50,  "unit": "kg",  "unit_cost": 27},
        {"category": "Fertilizers",  "name": "Muriate of Potash",            "description": "Potassium for podding",              "qty_per_ha": 25,  "unit": "kg",  "unit_cost": 17},
        {"category": "Micronutrients","name": "Rhizobium Biofertilizer",      "description": "Seed inoculant for N-fixation",      "qty_per_ha": 0.5, "unit": "pkt", "unit_cost": 80},
        {"category": "Pesticides",   "name": "Helicide (Helicoverpa NPV)",   "description": "Pod borer bioinsecticide",           "qty_per_ha": 0.25,"unit": "L",   "unit_cost": 1200},
        {"category": "Pesticides",   "name": "Hexaconazole (Wilt/Blight)",   "description": "Fusarium wilt + Botrytis control",   "qty_per_ha": 1,   "unit": "L",   "unit_cost": 600},
    ],
}

# ─── Default fallback for crops not in recipes ────────────────────────────────
DEFAULT_RECIPE = [
    {"category": "Seeds",        "name": "Certified Seeds",              "description": "Use certified disease-free seeds from government depot", "qty_per_ha": 30,  "unit": "kg",   "unit_cost": 80},
    {"category": "Fertilizers",  "name": "NPK Complex (12:32:16)",       "description": "Balanced starter fertilizer",                           "qty_per_ha": 100, "unit": "kg",   "unit_cost": 55},
    {"category": "Fertilizers",  "name": "Urea",                         "description": "Top-dress nitrogen",                                    "qty_per_ha": 100, "unit": "kg",   "unit_cost": 6},
    {"category": "Micronutrients","name": "Zinc Sulphate",                "description": "General micronutrient correction",                      "qty_per_ha": 20,  "unit": "kg",   "unit_cost": 35},
    {"category": "Pesticides",   "name": "Mancozeb 75WP",                "description": "Broad-spectrum protective fungicide",                    "qty_per_ha": 2,   "unit": "kg",   "unit_cost": 250},
    {"category": "Tools",        "name": "Knapsack Sprayer (16L)",       "description": "Manual crop protection sprayer",                         "qty_per_ha": 1,   "unit": "unit", "unit_cost": 1800},
    {"category": "Tools",        "name": "Tractor Ploughing (Hire)",     "description": "Land preparation",                                       "qty_per_ha": 1,   "unit": "session","unit_cost": 2000},
]

# ─── Soil-type add-ons ────────────────────────────────────────────────────────
SOIL_ADDONS: Dict[str, List[Dict[str, Any]]] = {
    "Clay": [
        {"category": "Soil Amendments", "name": "Gypsum (Soil conditioner)", "description": "Improves clay soil structure and drainage", "qty_per_ha": 200, "unit": "kg", "unit_cost": 5},
    ],
    "Sandy": [
        {"category": "Soil Amendments", "name": "FYM / Vermicompost",         "description": "Organic matter to improve water retention", "qty_per_ha": 5000, "unit": "kg", "unit_cost": 0.5},
    ],
    "Peat": [
        {"category": "Soil Amendments", "name": "Agricultural Lime (Dolomite)","description": "pH correction for acidic peat soils",     "qty_per_ha": 500, "unit": "kg", "unit_cost": 6},
    ],
}

# ─── Season add-ons ───────────────────────────────────────────────────────────
SEASON_ADDONS: Dict[str, List[Dict[str, Any]]] = {
    "Rabi": [
        {"category": "Tools", "name": "Irrigation Pipe Set (Pipe Irrigation)", "description": "Rabi crops need supplemental irrigation", "qty_per_ha": 1, "unit": "set", "unit_cost": 3500},
    ],
    "Kharif": [
        {"category": "Tools", "name": "Rainwater Harvesting Bund Labour",      "description": "Field bunding for Kharif water retention",  "qty_per_ha": 3, "unit": "labour-days", "unit_cost": 500},
    ],
}


def generate_shopping_list(
    crop: str,
    farm_size: float,
    soil_type: str = "",
    season: str = "",
    growth_stage: str = "",
) -> Dict[str, Any]:
    """
    Returns a structured shopping list for the given parameters.
    All quantities are scaled to the actual farm_size (hectares).
    """
    crop_key = crop.strip()
    template = CROP_RECIPES.get(crop_key, DEFAULT_RECIPE)

    items = []
    for t in template:
        qty = round(t["qty_per_ha"] * farm_size, 2)
        cost = round(qty * t["unit_cost"], 2)
        items.append({
            "category":    t["category"],
            "name":        t["name"],
            "description": t.get("description", ""),
            "quantity":    qty,
            "unit":        t["unit"],
            "unit_cost":   t["unit_cost"],
            "total_cost":  cost,
            "is_purchased": False,
            "notes":       "",
        })

    # Soil add-ons
    for addon in SOIL_ADDONS.get(soil_type, []):
        qty = round(addon["qty_per_ha"] * farm_size, 2)
        items.append({
            "category":    addon["category"],
            "name":        addon["name"],
            "description": addon.get("description", ""),
            "quantity":    qty,
            "unit":        addon["unit"],
            "unit_cost":   addon["unit_cost"],
            "total_cost":  round(qty * addon["unit_cost"], 2),
            "is_purchased": False,
            "notes":       "",
        })

    # Season add-ons
    for addon in SEASON_ADDONS.get(season, []):
        qty = round(addon["qty_per_ha"] * farm_size, 2)
        items.append({
            "category":    addon["category"],
            "name":        addon["name"],
            "description": addon.get("description", ""),
            "quantity":    qty,
            "unit":        addon["unit"],
            "unit_cost":   addon["unit_cost"],
            "total_cost":  round(qty * addon["unit_cost"], 2),
            "is_purchased": False,
            "notes":       "",
        })

    estimated_total = round(sum(i["total_cost"] for i in items), 2)
    list_name = f"{crop} — {farm_size} Ha"
    if season:
        list_name += f" ({season})"

    return {
        "name": list_name,
        "crop": crop_key,
        "farm_size": farm_size,
        "soil_type": soil_type,
        "season": season,
        "growth_stage": growth_stage,
        "estimated_total_cost": estimated_total,
        "items": items,
    }
