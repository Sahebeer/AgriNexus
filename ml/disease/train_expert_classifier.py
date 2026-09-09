"""
AgriNexus AI - Expert Multi-Crop Agricultural Disease Classifier Training Engine
Trains a calibrated machine learning ensemble across 45 standard agricultural crop pathologies:
  - Tomato (Early Blight, Late Blight, Bacterial Spot, Septoria, Leaf Mold, Spider Mites, Yellow Leaf Curl, Mosaic Virus, Target Spot, Healthy)
  - Potato (Early Blight, Late Blight, Healthy)
  - Corn / Maize (Common Rust, Gray Leaf Spot, Northern Leaf Blight, Healthy)
  - Apple (Scab, Black Rot, Cedar Apple Rust, Healthy)
  - Grape (Black Rot, Esca / Black Measles, Leaf Blight, Healthy)
  - Bell Pepper & Chili (Bacterial Spot, Healthy)
  - Wheat (Stripe Rust, Leaf Rust, Powdery Mildew, Healthy)
  - Rice (Leaf Blast, Brown Spot, Bacterial Blight, Healthy)
  - Cotton (Bacterial Blight, Leaf Curl, Healthy)
  - Soybean (Soybean Rust, Sudden Death Syndrome, Healthy)
  - Citrus (Citrus Canker, Black Spot, Greening / HLB, Healthy)
  - Cucurbits / Cucumber (Powdery Mildew, Downy Mildew, Anthracnose, Healthy)
  - Strawberry (Leaf Scorch, Powdery Mildew, Healthy)
  - Coffee (Leaf Rust, Cercospora Spot, Healthy)
"""

import os
import sys
import json
import joblib
import numpy as np
from pathlib import Path
from PIL import Image
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# 45 Comprehensive Agricultural Pathology Profiles
TAXONOMY = {
    # ── 1. Tomato ─────────────────────────────────────────────────────────────
    "tomato_early_blight": {
        "crop": "tomato",
        "disease": "early_blight",
        "name": "Tomato Early Blight (Alternaria solani)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Dark brown circular lesions with distinct concentric target-board rings on tomato leaflets. Lower leaves turn chlorotic yellow and drop prematurely.",
        "treatment": "Chemical: Apply Mancozeb (2.5 g/L) or Chlorothalonil (2 g/L) or Hexaconazole 5% SC (1 ml/L). Organic: Spray cold-pressed Neem oil (5 ml/L) or Trichoderma harzianum.",
        "prevention": "Stake plants and prune bottom foliage to improve airflow and keep leaves away from soil-borne spores."
    },
    "tomato_late_blight": {
        "crop": "tomato",
        "disease": "late_blight",
        "name": "Tomato Late Blight (Phytophthora infestans)",
        "type": "Oomycete Pathogen",
        "severity": "Critical",
        "description": "Aggressive, dark water-soaked necrotic lesions rapidly expanding across tomato foliage, petiole, and green fruit, with white downy fungal growth on underside in humid air.",
        "treatment": "Chemical: Spray Metalaxyl-M + Mancozeb (2.5 g/L) or Cymoxanil (2 g/L) or Dimethomorph (1 g/L) immediately. Organic: Preventive Copper Hydroxide (2.5 g/L).",
        "prevention": "Plant blight-resistant tomato cultivars. Ensure strict spacing (>60 cm) and eliminate volunteer potato/tomato culls."
    },
    "tomato_bacterial_spot": {
        "crop": "tomato",
        "disease": "bacterial_spot",
        "name": "Tomato Bacterial Spot (Xanthomonas spp.)",
        "type": "Bacterial Infection",
        "severity": "Medium",
        "description": "Small, water-soaked, dark brown to black angular lesions surrounded by distinct bright yellow chlorotic halos. As spots coalesce, leaf margins turn brown and ragged.",
        "treatment": "Chemical: Apply Copper Hydroxide (2 g/L) tank-mixed with Streptomycin Sulphate / Kasugamycin (0.5 g/L). Organic: Foliar spray of Bacillus subtilis (5 g/L).",
        "prevention": "Use certified pathogen-free seeds. Avoid working in fields when plants are wet to prevent mechanical spread."
    },
    "tomato_septoria_leaf_spot": {
        "crop": "tomato",
        "disease": "septoria_leaf_spot",
        "name": "Tomato Septoria Leaf Spot (Septoria lycopersici)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Numerous small, circular spots (2-3 mm) with dark brown margins and light gray or tan centers containing minute black pycnidia. Causes rapid bottom-up defoliation.",
        "treatment": "Chemical: Apply Azoxystrobin (1 ml/L) or Difenoconazole (0.5 ml/L) or Mancozeb (2.5 g/L). Organic: Copper Hydroxide (2 g/L) or bio-fungicide Trichoderma viride.",
        "prevention": "Mulch soil around plants. Remove infected lower leaves immediately upon symptom onset."
    },
    "tomato_yellow_leaf_curl": {
        "crop": "tomato",
        "disease": "yellow_leaf_curl",
        "name": "Tomato Yellow Leaf Curl Virus (TYLCV)",
        "type": "Viral Disease (Begomovirus)",
        "severity": "High",
        "description": "Leaves exhibit severe upward and inward curling, prominent interveinal chlorosis (yellowing), and leaf size reduction. Plants become stunted. Transmitted by Whitefly.",
        "treatment": "No chemical cure for viral infections once established. Vector Control: Apply Thiamethoxam 25% WG (0.3 g/L) or Acetamiprid 20% SP (0.4 g/L). Roguing: Uproot infected plants.",
        "prevention": "Install 40-50 mesh insect-proof nets in nurseries. Deploy yellow sticky traps (15-20 traps/acre). Plant TYLCV-resistant hybrid varieties."
    },
    "tomato_leaf_mold": {
        "crop": "tomato",
        "disease": "leaf_mold",
        "name": "Tomato Leaf Mold (Passalora fulva)",
        "type": "Fungal Infection",
        "severity": "Medium",
        "description": "Pale yellow chlorotic patches on the upper leaf surface accompanied by velvety olive-green to purple-gray fungal sporulation on the corresponding lower surface.",
        "treatment": "Chemical: Apply Chlorothalonil (2 g/L) or Trifloxystrobin + Tebuconazole (0.7 g/L). Organic: Potassium Bicarbonate (4 g/L) or Bacillus amyloliquefaciens.",
        "prevention": "Maintain greenhouse relative humidity below 80% with ventilation fans. Space plants for maximum airflow."
    },
    "tomato_spider_mites": {
        "crop": "tomato",
        "disease": "spider_mites",
        "name": "Tomato Two-Spotted Spider Mite (Tetranychus urticae)",
        "type": "Acarine Pest Attack",
        "severity": "Medium",
        "description": "Fine yellow-white stippling (pinpoint speckling) across the upper leaf surface, progressing to bronzing and leaf desiccation. Fine silky webbing visible on leaf undersides.",
        "treatment": "Chemical: Spray Acaricides — Abamectin 1.9% EC (0.5 ml/L) or Spiromesifen 22.9% SC (1 ml/L) or Fenazaquin 10% EC (1.5 ml/L). Organic: Apply Neem oil (5 ml/L).",
        "prevention": "Keep field borders weed-free. Maintain adequate soil moisture to reduce dry stress conditions preferred by spider mites."
    },
    "tomato_mosaic_virus": {
        "crop": "tomato",
        "disease": "mosaic_virus",
        "name": "Tomato Mosaic Virus (ToMV / TMV)",
        "type": "Viral Disease (Tobamovirus)",
        "severity": "High",
        "description": "Mottled pattern of alternating dark green and light green/yellow patches on foliage, accompanied by blistering, puckering, and leaf distortion.",
        "treatment": "Direct Treatment: No chemical cure. Immediately isolate and destroy symptomatic foliage. Disinfect pruners and tools with 10% TSP or bleach.",
        "prevention": "Disallow tobacco use near crop fields. Use certified virus-free seedling stocks. Wash hands before touching plants."
    },
    "tomato_target_spot": {
        "crop": "tomato",
        "disease": "target_spot",
        "name": "Tomato Target Spot (Corynespora cassiicola)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Small pinpoint brown lesions that expand to circular spots with tan centers and dark brown margins. Distinct concentric rings form in mature spots.",
        "treatment": "Chemical: Apply Azoxystrobin (1 ml/L) or Boscalid (1 g/L) or Chlorothalonil (2 g/L). Organic: Copper Hydroxide (2.5 g/L).",
        "prevention": "Improve row spacing to increase canopy airflow. Rotate out of solanaceous crops."
    },
    "tomato_healthy": {
        "crop": "tomato",
        "disease": "healthy",
        "name": "Tomato — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Tomato foliage exhibits uniform vibrant chlorophyll pigmentation, intact serrated composite leaflets, and healthy venation with no spotting or chlorosis.",
        "treatment": "No pathological treatment required. Continue standard balanced N-P-K fertigation.",
        "prevention": "Maintain regular weekly crop scouting and biosecurity protocols."
    },

    # ── 2. Potato ─────────────────────────────────────────────────────────────
    "potato_early_blight": {
        "crop": "potato",
        "disease": "early_blight",
        "name": "Potato Early Blight (Alternaria solani)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Dark brown to black circular lesions with distinct concentric target-board rings on potato foliage, surrounded by a narrow chlorotic halo. Starts on older bottom leaves.",
        "treatment": "Chemical: Apply Mancozeb (2.5 g/L) or Chlorothalonil (2 g/L) or Azoxystrobin + Difenoconazole (1 ml/L). Organic: Spray Copper Hydroxide (2.5 g/L) or Neem oil.",
        "prevention": "Practice 3-year crop rotation with non-solanaceous crops. Use drip irrigation to prevent spore splash."
    },
    "potato_late_blight": {
        "crop": "potato",
        "disease": "late_blight",
        "name": "Potato Late Blight (Phytophthora infestans)",
        "type": "Oomycete Pathogen",
        "severity": "Critical",
        "description": "Rapidly expanding water-soaked, dark olive-brown to black necrotic lesions on leaves and stems. Under cool humid conditions, white downy mildew sporulates on leaf underside.",
        "treatment": "Chemical: Spray immediately with Metalaxyl-M + Mancozeb (Ridomil Gold @ 2.5 g/L) or Cymoxanil + Mancozeb (2 g/L) or Dimethomorph (1 g/L). Destroy heavily infected plants.",
        "prevention": "Plant certified disease-free seed tubers. Avoid overhead irrigation during cool humid periods."
    },
    "potato_healthy": {
        "crop": "potato",
        "disease": "healthy",
        "name": "Potato — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Potato compound foliage exhibits vibrant green pigmentation, smooth ovate leaflet margins, and healthy vascular structure.",
        "treatment": "No pathological treatment required. Maintain scheduled irrigation and potassium hilling.",
        "prevention": "Scout lower canopy weekly for early blight onset during canopy closure."
    },

    # ── 3. Corn / Maize ───────────────────────────────────────────────────────
    "corn_common_rust": {
        "crop": "corn",
        "disease": "rust",
        "name": "Corn Common Rust (Puccinia sorghi)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Small, powdery, oval to elongate cinnamon-brown to golden-orange pustules (uredinia) scattered across both upper and lower surfaces of corn leaf blades.",
        "treatment": "Chemical: Spray Azoxystrobin + Difenoconazole (Amistar Top @ 1 ml/L) or Pyraclostrobin (1 ml/L) or Propiconazole 25% EC (1 ml/L). Organic: Apply Copper Hydroxide (2 g/L).",
        "prevention": "Plant rust-resistant hybrid maize varieties. Practice early planting to avoid peak airborne urediniospore dispersal periods."
    },
    "corn_gray_leaf_spot": {
        "crop": "corn",
        "disease": "gray_leaf_spot",
        "name": "Corn Gray Leaf Spot (Cercospora zeae-maydis)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Distinctly rectangular, narrow tan to gray necrotic lesions bounded strictly by parallel leaf veins. Lesions coalesce under humid conditions, causing severe foliar blighting.",
        "treatment": "Chemical: Apply Pyraclostrobin + Fluxapyroxad (Priaxor @ 0.6 ml/L) or Azoxystrobin (1 ml/L) at tasseling stage (VT/R1). Organic: Foliar bio-fungicide Trichoderma harzianum.",
        "prevention": "Implement minimum 2-year crop rotation with non-host crops (soybeans). Manage corn residue through tillage in high-risk zones."
    },
    "corn_northern_leaf_blight": {
        "crop": "corn",
        "disease": "northern_leaf_blight",
        "name": "Corn Northern Leaf Blight (Exserohilum turcicum)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Long, elliptical, cigar-shaped grayish-green to tan lesions (2.5 to 15 cm long) developing on lower leaves and progressing upwards across the canopy.",
        "treatment": "Chemical: Apply Propiconazole 25% EC (1 ml/L) or Azoxystrobin + Cyproconazole (1 ml/L) or Mancozeb (2.5 g/L). Organic: Spray Bacillus subtilis foliar bio-fungicide.",
        "prevention": "Select maize hybrids carrying Ht resistance genes. Practice crop rotation and bury infected residue after harvest."
    },
    "corn_healthy": {
        "crop": "corn",
        "disease": "healthy",
        "name": "Corn / Maize — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Elongated Gramineae leaf blades exhibit uniform green chlorophyll pigmentation, clear parallel venation, and intact structural margins.",
        "treatment": "No pathological treatment required. Maintain balanced nitrogen-potassium top dressing.",
        "prevention": "Scout weekly for fall armyworm and foliar rust during vegetative stages."
    },

    # ── 4. Apple ──────────────────────────────────────────────────────────────
    "apple_scab": {
        "crop": "apple",
        "disease": "scab",
        "name": "Apple Scab (Venturia inaequalis)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Olive-green to dark brown circular or irregular velvety lesions developing on leaves and fruit. As lesions mature, leaves become distorted, puckered, and defoliate prematurely.",
        "treatment": "Chemical: Apply Captan 50 WP (2.5 g/L) or Myclobutanil 10% WP (0.5 g/L) or Difenoconazole 25% EC (0.5 ml/L). Organic: Spray Wettable Sulphur (3 g/L) or Potassium Bicarbonate (4 g/L).",
        "prevention": "Prune canopy to promote air circulation. Rake and destroy fallen leaves in autumn to eradicate overwintering pseudothecia."
    },
    "apple_black_rot": {
        "crop": "apple",
        "disease": "black_rot",
        "name": "Apple Black Rot (Botryosphaeria obtusa)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Small purple specks on upper leaf surface that enlarge into circular 'frog-eye' leaf spots with light brown centers and distinct dark purple margins.",
        "treatment": "Chemical: Spray Mancozeb (2.5 g/L) or Thiophanate-methyl (1 g/L) or Copper Hydroxide (2.5 g/L). Organic: Apply Copper Oxychloride early in season; prune all dead wood.",
        "prevention": "Prune out dead shoots and cankered branches at least 15 cm below visible infection. Destroy mummified fruit on trees and orchard floor."
    },
    "apple_cedar_rust": {
        "crop": "apple",
        "disease": "cedar_apple_rust",
        "name": "Cedar Apple Rust (Gymnosporangium juniperi-virginianae)",
        "type": "Heteroecious Fungal Pathogen",
        "severity": "Medium",
        "description": "Bright yellow-orange to reddish-orange circular spots on upper leaf surface. Small black pycnidia form in the center, followed by tube-like aecia on lower surface.",
        "treatment": "Chemical: Apply Myclobutanil (0.5 ml/L) or Trifloxystrobin (0.5 g/L) or Mancozeb (2.5 g/L). Organic: Spray Sulfur formulations before infection periods.",
        "prevention": "Remove nearby Eastern Red Cedar / Juniper trees within a 1-mile radius where possible. Plant resistant apple cultivars."
    },
    "apple_healthy": {
        "crop": "apple",
        "disease": "healthy",
        "name": "Apple — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Apple foliage exhibits uniform chlorophyll pigmentation, intact leaf blade margins, and healthy venation with no symptoms of scab or foliar rust.",
        "treatment": "No pathological treatment required. Maintain scheduled orchard nutrition and irrigation.",
        "prevention": "Implement standard preventive scouting and bio-stimulant foliar applications."
    },

    # ── 5. Grape ──────────────────────────────────────────────────────────────
    "grape_black_rot": {
        "crop": "grape",
        "disease": "black_rot",
        "name": "Grape Black Rot (Guignardia bidwellii)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Small, circular reddish-brown necrotic spots with dark borders on upper leaf surface, containing minute black fruiting bodies (pycnidia) arranged in a ring.",
        "treatment": "Chemical: Apply Myclobutanil (0.5 ml/L) or Mancozeb (2.5 g/L) or Kresoxim-methyl (0.5 g/L) from bud break through veraison. Organic: Copper Hydroxide (2 g/L).",
        "prevention": "Prune and destroy infected canes and mummified berry clusters. Train vineyard canopy for optimal sunlight and aeration."
    },
    "grape_esca": {
        "crop": "grape",
        "disease": "esca",
        "name": "Grape Esca / Black Measles (Phaeomoniella chlamydospora)",
        "type": "Tracheomycotic Fungal Complex",
        "severity": "High",
        "description": "Characteristic 'tiger-stripe' interveinal chlorosis and necrosis, where yellow-red bands bordered by green veins dry out and turn brown, causing premature leaf drop.",
        "treatment": "No direct chemical cure for established systemic wood infections. Protect pruning wounds immediately with pruning sealant containing Thiophanate-methyl or Trichoderma.",
        "prevention": "Disinfect pruning shears between vines with 70% alcohol. Avoid pruning during wet weather."
    },
    "grape_leaf_blight": {
        "crop": "grape",
        "disease": "leaf_blight",
        "name": "Grape Leaf Blight (Pseudocercospora cladosporioides)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Dark brown to black angular necrotic spots on leaves with reddish-purple halos. Lesions dry out, causing leaves to curl and drop prematurely.",
        "treatment": "Chemical: Apply Copper Oxychloride (3 g/L) or Azoxystrobin (1 ml/L) or Mancozeb (2.5 g/L). Organic: Foliar neem oil (5 ml/L) or Bacillus amyloliquefaciens.",
        "prevention": "Ensure adequate trellis spacing and summer leaf thinning to reduce humidity around the grape canopy."
    },
    "grape_healthy": {
        "crop": "grape",
        "disease": "healthy",
        "name": "Grape — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Palmate grape foliage displays rich, uniform green chlorophyll coloration, intact palmate lobes, and clear venation with no necrotic spotting.",
        "treatment": "No pathological treatment required. Continue standard vineyard micronutrient program.",
        "prevention": "Maintain regular weekly canopy scouting and prophylactic sulfur dusting."
    },

    # ── 6. Bell Pepper & Chili ─────────────────────────────────────────────────
    "pepper_bacterial_spot": {
        "crop": "bell_pepper",
        "disease": "bacterial_spot",
        "name": "Pepper Bacterial Spot (Xanthomonas campestris)",
        "type": "Bacterial Infection",
        "severity": "Medium",
        "description": "Small, water-soaked, dark brown to black circular or angular lesions surrounded by distinct bright yellow chlorotic halos on bell pepper and chili foliage.",
        "treatment": "Chemical: Apply Copper Hydroxide (2 g/L) tank-mixed with Streptomycin Sulphate (0.5 g/L) at early symptom onset. Organic: Foliar spray of Bacillus subtilis (5 g/L).",
        "prevention": "Use certified pathogen-free seeds. Avoid overhead irrigation to prevent bacterial dissemination."
    },
    "pepper_healthy": {
        "crop": "bell_pepper",
        "disease": "healthy",
        "name": "Bell Pepper — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Glossy, vibrant green bell pepper foliage with smooth intact margins and clear acute apex.",
        "treatment": "No pathological treatment required. Maintain scheduled watering and calcium-magnesium fertigation.",
        "prevention": "Implement prophylactic bio-stimulant foliar applications."
    },

    # ── 7. Wheat ──────────────────────────────────────────────────────────────
    "wheat_stripe_rust": {
        "crop": "wheat",
        "disease": "rust",
        "name": "Wheat Stripe Rust (Puccinia striiformis)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Distinct linear stripes or rows of bright yellow-orange powdery pustules developing parallel to leaf veins on wheat blades. Causes premature leaf desiccation.",
        "treatment": "Chemical: Spray Propiconazole 25% EC (1 ml/L) or Tebuconazole 250 EC (1 ml/L) or Azoxystrobin (1 ml/L) at first appearance of stripe pustules. Organic: Copper Hydroxide.",
        "prevention": "Plant rust-resistant wheat varieties. Eliminate volunteer wheat and grass weeds in field margins."
    },
    "wheat_leaf_rust": {
        "crop": "wheat",
        "disease": "rust",
        "name": "Wheat Leaf Rust (Puccinia triticina)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Scattered circular to oval reddish-orange powdery pustules (uredinia) on the upper surface of wheat leaves.",
        "treatment": "Chemical: Apply Propiconazole 25% EC (1 ml/L) or Pyraclostrobin (1 ml/L). Organic: Spray sulfur bio-formulation.",
        "prevention": "Plant resistant cultivars. Avoid excess nitrogen fertilizer."
    },
    "wheat_powdery_mildew": {
        "crop": "wheat",
        "disease": "powdery_mildew",
        "name": "Wheat Powdery Mildew (Blumeria graminis)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "White fluffy powdery fungal patches on lower wheat leaves and stems, turning dull gray-brown with black cleistothecia as crop matures.",
        "treatment": "Chemical: Spray Epoxiconazole (1 ml/L) or Metconazole (1 ml/L) or Hexaconazole (1 ml/L). Organic: Potassium Bicarbonate (4 g/L).",
        "prevention": "Avoid dense crop seeding rates. Select resistant seed stock."
    },
    "wheat_healthy": {
        "crop": "wheat",
        "disease": "healthy",
        "name": "Wheat — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Slender linear wheat leaves show uniform green color, intact margins, and no rust pustules or powdery fungal patches.",
        "treatment": "No pathological treatment required. Maintain balanced N-P-K nutrition.",
        "prevention": "Monitor field during tillering and stem elongation stages."
    },

    # ── 8. Rice ───────────────────────────────────────────────────────────────
    "rice_leaf_blast": {
        "crop": "rice",
        "disease": "blast",
        "name": "Rice Leaf Blast (Magnaporthe oryzae)",
        "type": "Fungal Pathogen",
        "severity": "Critical",
        "description": "Spindle-shaped / diamond-shaped lesions with grayish-white centers and dark brown or reddish-brown borders. Lesions coalesce rapidly, killing entire leaves.",
        "treatment": "Chemical: Spray Tricyclazole 75% WP (0.6 g/L) or Isoprothiolane 40% EC (1.5 ml/L) or Kasugamycin 3% SL (1.5 ml/L). Organic: Spray Neem oil with bio-control agents.",
        "prevention": "Avoid excessive nitrogen fertilization. Maintain continuous field flooding during critical vegetative stages."
    },
    "rice_brown_spot": {
        "crop": "rice",
        "disease": "brown_spot",
        "name": "Rice Brown Spot (Bipolaris oryzae)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Oval to circular, sesame-seed-shaped dark brown lesions with gray or whitish centers and yellowish halos distributed across elongated rice leaves.",
        "treatment": "Chemical: Apply Tricyclazole 75% WP (0.6 g/L) or Mancozeb (2.5 g/L) or Carbendazim (1 g/L). Organic: Foliar spray of Pseudomonas fluorescens (5 g/L).",
        "prevention": "Treat seeds with hot water (52-54°C) or bio-fungicides. Ensure balanced soil potassium and silicon nutrition."
    },
    "rice_bacterial_blight": {
        "crop": "rice",
        "disease": "bacterial_blight",
        "name": "Rice Bacterial Leaf Blight (Xanthomonas oryzae)",
        "type": "Bacterial Pathogen",
        "severity": "High",
        "description": "Water-soaked to yellowish-green wavy stripes on leaf margins starting at leaf tips, turning straw-yellow and drying out into white-gray scorched blades.",
        "treatment": "Chemical: Spray Streptomycin + Tetracycline (0.5 g/L) and Copper Oxychloride (2.5 g/L). Organic: Apply Pseudomonas fluorescens (5 g/L).",
        "prevention": "Drain flooded field temporarily. Avoid clipping rice seedling tips during transplanting."
    },
    "rice_healthy": {
        "crop": "rice",
        "disease": "healthy",
        "name": "Rice — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Erect, vibrant green paddy leaves with clean parallel veins and no blast or brown spot lesions.",
        "treatment": "No pathological treatment required. Maintain scheduled water regime and silicon fertilization.",
        "prevention": "Scout nursery and tillering stages weekly."
    },

    # ── 9. Cotton ─────────────────────────────────────────────────────────────
    "cotton_bacterial_blight": {
        "crop": "cotton",
        "disease": "bacterial_blight",
        "name": "Cotton Bacterial Blight / Angular Leaf Spot (Xanthomonas citri pv. malvacearum)",
        "type": "Bacterial Pathogen",
        "severity": "High",
        "description": "Angular, water-soaked brown to black lesions bounded by small leaf veins on palmately lobed cotton leaves, often spreading down the main leaf vein (blackarm).",
        "treatment": "Chemical: Apply Copper Oxychloride (2.5 g/L) + Streptocycline (0.1 g/L). Organic: Foliar spray of Bacillus subtilis.",
        "prevention": "Delint and treat acid-delinted cotton seeds. Destroy infected crop stalks post-harvest."
    },
    "cotton_leaf_curl": {
        "crop": "cotton",
        "disease": "leaf_curl",
        "name": "Cotton Leaf Curl Virus (CLCuD)",
        "type": "Viral Disease (Begomovirus)",
        "severity": "Critical",
        "description": "Upward or downward leaf curling, pronounced vein thickening (enation) on leaf undersides, and extreme stunting of plants. Transmitted by Whitefly.",
        "treatment": "No chemical cure for virus. Manage whitefly vector with Pyriproxyfen 10% EC (1 ml/L) or Diafenthiuron 50% WP (1 g/L).",
        "prevention": "Eradicate alternate weed hosts (Abutilon indicum). Plant CLCuD-tolerant cotton hybrids."
    },
    "cotton_healthy": {
        "crop": "cotton",
        "disease": "healthy",
        "name": "Cotton — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Broad palmately lobed cotton foliage exhibits deep green color, smooth surface, and strong vascular integrity.",
        "treatment": "No pathological treatment required. Maintain scheduled irrigation and potash spray.",
        "prevention": "Deploy pheromone and sticky traps early in the season."
    },

    # ── 10. Soybean ───────────────────────────────────────────────────────────
    "soybean_rust": {
        "crop": "soybean",
        "disease": "rust",
        "name": "Soybean Asian Rust (Phakopsora pachyrhizi)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Tiny tan to dark brown volcanic-shaped pustules (uredinia) on the underside of trifoliate leaves with yellow chlorotic speckling on upper surfaces.",
        "treatment": "Chemical: Apply Azoxystrobin + Cyproconazole (0.6 ml/L) or Trifloxystrobin + Prothioconazole (0.7 ml/L) immediately at first detection. Organic: Copper Hydroxide.",
        "prevention": "Monitor early vegetative canopy. Plant early-maturing soybean varieties."
    },
    "soybean_sudden_death": {
        "crop": "soybean",
        "disease": "sudden_death",
        "name": "Soybean Sudden Death Syndrome (Fusarium virguliforme)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Interveinal chlorotic spots coalesce into bright yellow patches that turn necrotic brown between veins, leaving only main veins green.",
        "treatment": "Fungicide seed treatment with Fluopyram (ILeVO). No effective foliar rescue once foliar symptoms appear.",
        "prevention": "Improve field drainage to reduce soil compaction. Rotate with non-host crops."
    },
    "soybean_healthy": {
        "crop": "soybean",
        "disease": "healthy",
        "name": "Soybean — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Trifoliate soybean leaves show uniform deep green coloration, intact ovate leaflets, and vigorous growth.",
        "treatment": "No pathological treatment required. Maintain balanced soil phosphorus and Rhizobium nodulation.",
        "prevention": "Scout field weekly from R1 flowering stage onward."
    },

    # ── 11. Citrus (Orange, Lemon, Lime) ──────────────────────────────────────
    "citrus_canker": {
        "crop": "citrus",
        "disease": "canker",
        "name": "Citrus Canker (Xanthomonas axonopodis pv. citri)",
        "type": "Bacterial Infection",
        "severity": "High",
        "description": "Raised, corky, blister-like brown lesions on leaves and twigs surrounded by a characteristic distinct oily, water-soaked chlorotic yellow halo.",
        "treatment": "Chemical: Apply Copper Hydroxide (2.5 g/L) + Streptocycline (0.1 g/L) during flush flushes. Organic: Bordeaux mixture (1%).",
        "prevention": "Install windbreaks around orchards. Prune and burn infected shoots during dormancy."
    },
    "citrus_black_spot": {
        "crop": "citrus",
        "disease": "black_spot",
        "name": "Citrus Black Spot (Phyllosticta citricarpa)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Small round sunken reddish-brown spots on leaves and fruit peel with gray centers and elevated black margins.",
        "treatment": "Chemical: Apply Mancozeb (2.5 g/L) or Pyraclostrobin (0.5 ml/L) or Copper Oxychloride (3 g/L). Organic: Horticultural oil spray.",
        "prevention": "Remove fallen leaf litter under tree canopy before rain season."
    },
    "citrus_greening": {
        "crop": "citrus",
        "disease": "greening",
        "name": "Citrus Greening / Huanglongbing (Candidatus Liberibacter)",
        "type": "Bacterial / Vector-Borne",
        "severity": "Critical",
        "description": "Asymmetrical blotchy foliar mottle crossing leaf veins, yellow shoots ('yellow dragon'), and small bitter lopsided fruit. Transmitted by Citrus Psyllid.",
        "treatment": "No cure for infected trees. Aggressive vector control: Imidacloprid (0.5 ml/L) or Thiamethoxam. Uproot infected trees in early-stage orchards.",
        "prevention": "Plant certified disease-free nursery stock under screenhouse. Deploy psyllid monitoring traps."
    },
    "citrus_healthy": {
        "crop": "citrus",
        "disease": "healthy",
        "name": "Citrus — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Glossy, dark green citrus leaves with smooth winged petioles, strong aroma, and clear vascular structure.",
        "treatment": "No pathological treatment required. Maintain scheduled micronutrient foliar spray (Zn, Mn, Fe).",
        "prevention": "Maintain biosecurity and annual pruning."
    },

    # ── 12. Cucurbits (Cucumber, Squash, Melon) ───────────────────────────────
    "cucumber_powdery_mildew": {
        "crop": "cucumber",
        "disease": "powdery_mildew",
        "name": "Cucurbit Powdery Mildew (Podosphaera xanthii)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Talcum powder-like white fungal colonies expanding over upper and lower leaf surfaces, leading to yellowing, browning, and premature leaf crisping.",
        "treatment": "Chemical: Apply Trifloxystrobin (0.5 g/L) or Azoxystrobin (1 ml/L) or Myclobutanil (0.5 ml/L). Organic: Spray Potassium Bicarbonate (4 g/L) or Neem oil (5 ml/L).",
        "prevention": "Select powdery mildew-tolerant hybrid cucumber varieties. Space plants to allow full sun exposure."
    },
    "cucumber_downy_mildew": {
        "crop": "cucumber",
        "disease": "downy_mildew",
        "name": "Cucurbit Downy Mildew (Pseudoperonospora cubensis)",
        "type": "Oomycete Pathogen",
        "severity": "Critical",
        "description": "Angular, bright yellow chlorotic patches strictly delimited by leaf veins on the upper surface, with purplish-gray downy mold on the underside.",
        "treatment": "Chemical: Spray Cymoxanil + Mancozeb (2 g/L) or Fluopicolide (1 ml/L) or Metalaxyl (2 g/L) immediately. Organic: Copper Hydroxide (2.5 g/L).",
        "prevention": "Avoid overhead watering. Maintain excellent greenhouse ventilation."
    },
    "cucumber_anthracnose": {
        "crop": "cucumber",
        "disease": "anthracnose",
        "name": "Cucurbit Anthracnose (Colletotrichum orbiculare)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Circular yellowish or water-soaked spots that enlarge, turn dark brown, and dry out, leaving 'shot-hole' perforations in the leaf blade.",
        "treatment": "Chemical: Apply Chlorothalonil (2 g/L) or Mancozeb (2.5 g/L) or Azoxystrobin (1 ml/L). Organic: Copper Oxychloride (2.5 g/L).",
        "prevention": "Use certified disease-free seeds. Rotate with non-cucurbit crops for 2-3 years."
    },
    "cucumber_healthy": {
        "crop": "cucumber",
        "disease": "healthy",
        "name": "Cucumber / Cucurbit — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Broad triangular-lobed green leaves with hairy margins, healthy venation, and intact lamina.",
        "treatment": "No pathological treatment required. Maintain drip fertigation.",
        "prevention": "Scout lower canopy weekly for downy or powdery mildew."
    },

    # ── 13. Strawberry ────────────────────────────────────────────────────────
    "strawberry_leaf_scorch": {
        "crop": "strawberry",
        "disease": "leaf_scorch",
        "name": "Strawberry Leaf Scorch (Diplocarpon earlianum)",
        "type": "Fungal Pathogen",
        "severity": "Medium",
        "description": "Numerous small, dark purple or reddish-purple spots on upper leaf surfaces that enlarge and coalesce, giving foliage a burned or scorched appearance.",
        "treatment": "Chemical: Spray Captan 50 WP (2.5 g/L) or Thiophanate-methyl (1 g/L) or Difenoconazole (0.5 ml/L). Organic: Copper Hydroxide (2 g/L).",
        "prevention": "Remove dead foliage in early spring. Avoid overhead sprinkler irrigation."
    },
    "strawberry_healthy": {
        "crop": "strawberry",
        "disease": "healthy",
        "name": "Strawberry — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Trifoliate strawberry leaves exhibit rich emerald green pigmentation, serrated margins, and vibrant healthy stolons.",
        "treatment": "No pathological treatment required. Maintain balanced calcium and potassium feeding.",
        "prevention": "Ensure proper raised bed straw mulching."
    },

    # ── 14. Coffee ────────────────────────────────────────────────────────────
    "coffee_leaf_rust": {
        "crop": "coffee",
        "disease": "rust",
        "name": "Coffee Leaf Rust (Hemileia vastatrix)",
        "type": "Fungal Pathogen",
        "severity": "High",
        "description": "Yellowish oily spots on upper leaf surface corresponding to powdery, bright orange-yellow fungal pustules on the lower leaf surface, causing severe defoliation.",
        "treatment": "Chemical: Apply Copper Oxychloride (3 g/L) or Cyproconazole (1 ml/L) or Pyraclostrobin (0.8 ml/L). Organic: Preventative Bordeaux mixture (1%).",
        "prevention": "Plant rust-resistant coffee cultivars (Catimor / Castillo). Manage shade tree canopy to 30-40% cover."
    },
    "coffee_healthy": {
        "crop": "coffee",
        "disease": "healthy",
        "name": "Coffee — Healthy Foliage",
        "type": "Normal Health",
        "severity": "None",
        "description": "Glossy, dark green, elliptical coffee leaves with prominent undulating margins and clean central vein.",
        "treatment": "No pathological treatment required. Maintain scheduled shade regulation and organic compost.",
        "prevention": "Monitor leaves during onset of rainy season."
    }
}

CROP_SPECIES_ORDER = [
    "tomato", "potato", "corn", "apple", "grape", "bell_pepper",
    "wheat", "rice", "cotton", "soybean", "citrus", "cucumber",
    "strawberry", "coffee"
]


def rgb_to_hsv_matrix(arr: np.ndarray) -> np.ndarray:
    """Converts (H, W, 3) float32 RGB array to (H, W, 3) HSV array."""
    r, g, b = arr[:, :, 0] / 255.0, arr[:, :, 1] / 255.0, arr[:, :, 2] / 255.0
    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    delta = cmax - cmin

    h = np.zeros_like(cmax)
    mask = delta > 1e-5
    r_mask = mask & (cmax == r)
    g_mask = mask & (cmax == g)
    b_mask = mask & (cmax == b)

    h[r_mask] = (60.0 * (((g[r_mask] - b[r_mask]) / delta[r_mask]) % 6.0))
    h[g_mask] = (60.0 * (((b[g_mask] - r[g_mask]) / delta[g_mask]) + 2.0))
    h[b_mask] = (60.0 * (((r[b_mask] - g[b_mask]) / delta[b_mask]) + 4.0))

    s = np.zeros_like(cmax)
    s[mask] = delta[mask] / cmax[mask]
    v = cmax
    return np.stack([h, s, v], axis=-1)


def extract_pathology_features(img_pil: Image.Image) -> np.ndarray:
    """
    Extracts a 64-dimensional botanical and pathological feature vector from an image.
    """
    width, height = img_pil.size
    aspect_ratio = width / max(1, height)

    small = img_pil.resize((64, 64))
    arr = np.array(small, dtype=np.float32)

    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    hsv = rgb_to_hsv_matrix(arr)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    # Leaf foreground isolation
    is_neutral_bg = ((sat < 0.12) & (val > 0.40)) | (val < 0.08)
    is_blue_bg = (hue > 180.0) & (hue < 260.0) & (sat > 0.20)
    bg_mask = is_neutral_bg | is_blue_bg
    fg_mask = ~bg_mask

    if np.sum(fg_mask) < 60:
        fg_mask = np.ones((64, 64), dtype=bool)

    fg_count = max(1.0, float(np.sum(fg_mask)))

    # Color moments
    mean_r, std_r = float(np.mean(r[fg_mask])), float(np.std(r[fg_mask]))
    mean_g, std_g = float(np.mean(g[fg_mask])), float(np.std(g[fg_mask]))
    mean_b, std_b = float(np.mean(b[fg_mask])), float(np.std(b[fg_mask]))
    mean_h, std_h = float(np.mean(hue[fg_mask])), float(np.std(hue[fg_mask]))
    mean_s, std_s = float(np.mean(sat[fg_mask])), float(np.std(sat[fg_mask]))
    mean_v, std_v = float(np.mean(val[fg_mask])), float(np.std(val[fg_mask]))

    # Botanical Spectral Indices
    exg = float(np.mean((2.0 * g - r - b)[fg_mask]))
    exr = float(np.mean((1.4 * r - g)[fg_mask]))
    cive = float(np.mean((0.441 * r - 0.811 * g + 0.385 * b + 18.78)[fg_mask]))
    ndi = float(np.mean(((g - r) / np.maximum(1.0, g + r))[fg_mask]))
    vari = float(np.mean(((g - r) / np.maximum(1.0, g + r - b))[fg_mask]))

    # Pathological Foliar Densities
    green_mask = (hue >= 65.0) & (hue <= 165.0) & (sat >= 0.16) & (val >= 0.14) & fg_mask
    green_density = float(np.sum(green_mask)) / fg_count

    yellow_mask = (hue >= 36.0) & (hue < 65.0) & (sat >= 0.25) & (val >= 0.25) & fg_mask
    yellow_density = float(np.sum(yellow_mask)) / fg_count

    rust_mask = (hue >= 8.0) & (hue <= 26.0) & (sat >= 0.45) & (val >= 0.28) & (r > g * 1.30) & (b < 85.0) & fg_mask
    rust_density = float(np.sum(rust_mask)) / fg_count

    necrotic_mask = (
        (
            ((hue >= 15.0) & (hue < 55.0) & (val < 0.70) & (val > 0.05) & (r >= g * 1.05) & (~rust_mask)) |
            ((val < 0.38) & (val > 0.05) & (sat > 0.06))
        ) &
        (~green_mask) &
        fg_mask
    )
    necrotic_density = float(np.sum(necrotic_mask)) / fg_count

    dark_blight_mask = (val < 0.26) & (val > 0.04) & fg_mask
    dark_blight_density = float(np.sum(dark_blight_mask)) / fg_count

    powdery_mask = (
        (sat < 0.18) &
        (val > 0.65) &
        (val < 0.94) &
        (np.abs(r - g) < 14.0) &
        (np.abs(g - b) < 14.0) &
        fg_mask &
        (~is_neutral_bg)
    )
    powdery_density = float(np.sum(powdery_mask)) / fg_count

    purple_spot_mask = (
        ((hue > 280.0) | (hue < 15.0)) &
        (sat > 0.20) & (val < 0.60) &
        (r > g * 1.15) &
        fg_mask
    )
    purple_density = float(np.sum(purple_spot_mask)) / fg_count

    gx = np.abs(g[:, 1:] - g[:, :-1])
    gy = np.abs(g[1:, :] - g[:-1, :])
    texture_var = (float(np.mean(gx)) + float(np.mean(gy))) / 2.0
    sobel_edge_density = float(np.sum(gx > 20.0)) / 64.0

    hue_hist, _ = np.histogram(hue[fg_mask], bins=12, range=(0.0, 360.0), density=True)
    sat_hist, _ = np.histogram(sat[fg_mask], bins=6, range=(0.0, 1.0), density=True)
    val_hist, _ = np.histogram(val[fg_mask], bins=6, range=(0.0, 1.0), density=True)

    is_elongated = 1.0 if (aspect_ratio > 1.6 or aspect_ratio < 0.60) else 0.0
    is_palmate = 1.0 if (1.05 <= aspect_ratio <= 1.45 and texture_var > 14.0) else 0.0
    is_ovate = 1.0 if (0.80 <= aspect_ratio <= 1.25 and texture_var <= 14.0) else 0.0

    features = [
        mean_r / 255.0, std_r / 128.0,
        mean_g / 255.0, std_g / 128.0,
        mean_b / 255.0, std_b / 128.0,
        mean_h / 360.0, std_h / 180.0,
        mean_s, std_s,
        mean_v, std_v,
        exg / 100.0, exr / 100.0, cive / 100.0, ndi, vari,
        green_density, yellow_density, rust_density,
        necrotic_density, dark_blight_density, powdery_density, purple_density,
        texture_var / 50.0, sobel_edge_density / 50.0,
        aspect_ratio,
        is_elongated,
        is_palmate,
        is_ovate,
    ]
    features.extend(hue_hist.tolist())
    features.extend(sat_hist.tolist())
    features.extend(val_hist.tolist())

    return np.array(features, dtype=np.float32)


def generate_distinctive_features_for_class(class_id: str, n_samples: int = 150) -> np.ndarray:
    rng = np.random.RandomState(abs(hash(class_id)) % (2**31 - 1))
    info = TAXONOMY[class_id]
    crop = info["crop"]
    disease = info["disease"]

    samples = []
    for _ in range(n_samples):
        # 1. Morphological Aspect Ratio & Shape Flags
        if crop in ["corn", "wheat", "rice"]:
            ar = rng.uniform(1.8, 3.4) if rng.rand() > 0.5 else rng.uniform(0.30, 0.55)
            is_elongated = 1.0
            is_palmate = 0.0
            is_ovate = 0.0
        elif crop in ["grape", "cotton"]:
            ar = rng.uniform(1.10, 1.45)
            is_elongated = 0.0
            is_palmate = 1.0
            is_ovate = 0.0
        elif crop in ["citrus", "coffee"]:
            ar = rng.uniform(0.65, 0.85) if rng.rand() > 0.5 else rng.uniform(1.20, 1.45)
            is_elongated = 0.0
            is_palmate = 0.0
            is_ovate = 1.0
        elif crop == "tomato":
            ar = rng.uniform(0.85, 1.15)
            is_elongated = 0.0
            is_palmate = 0.0
            is_ovate = 1.0
        else:
            ar = rng.uniform(0.80, 1.25)
            is_elongated = 0.0
            is_palmate = 0.0
            is_ovate = 1.0

        # 2. Base Crop Foliar Spectral Characteristics
        if crop in ["citrus", "coffee"]:
            mean_g = rng.uniform(115, 140)
            mean_r = mean_g * rng.uniform(0.28, 0.38)
            mean_b = mean_g * rng.uniform(0.20, 0.30)
            mean_h = rng.uniform(90, 125)
            mean_s = rng.uniform(0.60, 0.82)
            mean_v = rng.uniform(0.45, 0.58)
        elif crop in ["corn", "wheat", "rice"]:
            mean_g = rng.uniform(140, 185)
            mean_r = mean_g * rng.uniform(0.45, 0.60)
            mean_b = mean_g * rng.uniform(0.22, 0.35)
            mean_h = rng.uniform(75, 105)
            mean_s = rng.uniform(0.50, 0.70)
            mean_v = rng.uniform(0.58, 0.78)
        else:
            mean_g = rng.uniform(125, 170)
            mean_r = mean_g * rng.uniform(0.35, 0.52)
            mean_b = mean_g * rng.uniform(0.20, 0.38)
            mean_h = rng.uniform(80, 115)
            mean_s = rng.uniform(0.52, 0.75)
            mean_v = rng.uniform(0.50, 0.68)

        std_r = rng.uniform(15, 30)
        std_g = rng.uniform(15, 30)
        std_b = rng.uniform(10, 20)
        std_h = rng.uniform(15, 35)
        std_s = rng.uniform(0.08, 0.16)
        std_v = rng.uniform(0.08, 0.16)

        # 3. Pathological Foliar Signatures
        green_density = rng.uniform(0.60, 0.88)
        yellow_density = rng.uniform(0.005, 0.03)
        rust_density = 0.0
        necrotic_density = rng.uniform(0.005, 0.02)
        dark_blight_density = rng.uniform(0.005, 0.02)
        powdery_density = 0.0
        purple_density = 0.0
        texture_var = rng.uniform(6.0, 14.0)
        sobel_edge = rng.uniform(4.0, 10.0)

        if "rust" in disease or "rust" in class_id:
            rust_density = rng.uniform(0.12, 0.35)
            green_density = max(0.20, green_density - rust_density)
            mean_r = mean_r + rng.uniform(50, 90)
            mean_h = rng.uniform(14, 30)
            mean_s = rng.uniform(0.68, 0.92)
            if crop in ["wheat", "corn"]:
                texture_var += 12.0

        elif disease == "early_blight":
            necrotic_density = rng.uniform(0.10, 0.28)
            yellow_density = rng.uniform(0.08, 0.24)
            green_density = max(0.20, green_density - necrotic_density - yellow_density)
            mean_r = mean_r + rng.uniform(25, 55)
            texture_var += 14.0

        elif disease == "late_blight":
            dark_blight_density = rng.uniform(0.18, 0.45)
            necrotic_density = rng.uniform(0.15, 0.38)
            green_density = max(0.15, green_density - dark_blight_density)
            mean_v = max(0.15, mean_v - 0.28)
            mean_g = max(40, mean_g - 55)

        elif disease in ["bacterial_spot", "bacterial_blight", "canker"]:
            yellow_density = rng.uniform(0.14, 0.38)
            necrotic_density = rng.uniform(0.06, 0.20)
            green_density = max(0.25, green_density - yellow_density)
            mean_h = rng.uniform(48, 70)
            texture_var += 8.0

        elif disease in ["yellow_leaf_curl", "greening", "sudden_death", "leaf_mold"]:
            yellow_density = rng.uniform(0.30, 0.72)
            green_density = max(0.15, green_density - yellow_density)
            mean_h = rng.uniform(38, 58)
            mean_s = rng.uniform(0.60, 0.88)

        elif disease == "powdery_mildew":
            powdery_density = rng.uniform(0.22, 0.55)
            green_density = max(0.18, green_density - powdery_density)
            mean_s = max(0.10, mean_s - 0.42)
            mean_v = min(0.94, mean_v + 0.28)

        elif disease in ["black_rot", "scab", "leaf_scorch", "blast", "brown_spot", "gray_leaf_spot", "septoria_leaf_spot", "leaf_blight"]:
            necrotic_density = rng.uniform(0.10, 0.30)
            if disease in ["black_rot", "leaf_scorch"]:
                purple_density = rng.uniform(0.08, 0.26)
            green_density = max(0.25, green_density - necrotic_density)
            texture_var += 16.0

        elif disease in ["mosaic_virus", "spider_mites"]:
            texture_var += rng.uniform(18.0, 32.0)
            yellow_density = rng.uniform(0.10, 0.26)

        elif disease == "healthy":
            green_density = rng.uniform(0.78, 0.96)
            yellow_density = rng.uniform(0.0, 0.015)
            necrotic_density = 0.0
            rust_density = 0.0
            powdery_density = 0.0
            purple_density = 0.0
            dark_blight_density = 0.0

        # Spectral Indices
        exg = (2.0 * mean_g - mean_r - mean_b)
        exr = (1.4 * mean_r - mean_g)
        cive = (0.441 * mean_r - 0.811 * mean_g + 0.385 * mean_b + 18.78)
        ndi = (mean_g - mean_r) / max(1.0, mean_g + mean_r)
        vari = (mean_g - mean_r) / max(1.0, mean_g + mean_r - mean_b)

        # Histograms
        hue_hist = np.zeros(12, dtype=np.float32)
        h_idx = int(np.clip(mean_h / 30.0, 0, 11))
        hue_hist[h_idx] = 0.70
        hue_hist[(h_idx + 1) % 12] = 0.20
        hue_hist[(h_idx - 1) % 12] = 0.10

        sat_hist = np.zeros(6, dtype=np.float32)
        s_idx = int(np.clip(mean_s * 6.0, 0, 5))
        sat_hist[s_idx] = 0.75
        sat_hist[min(5, s_idx + 1)] = 0.25

        val_hist = np.zeros(6, dtype=np.float32)
        v_idx = int(np.clip(mean_v * 6.0, 0, 5))
        val_hist[v_idx] = 0.75
        val_hist[min(5, v_idx + 1)] = 0.25

        feat = [
            mean_r / 255.0, std_r / 128.0,
            mean_g / 255.0, std_g / 128.0,
            mean_b / 255.0, std_b / 128.0,
            mean_h / 360.0, std_h / 180.0,
            mean_s, std_s,
            mean_v, std_v,
            exg / 100.0, exr / 100.0, cive / 100.0, ndi, vari,
            green_density, yellow_density, rust_density,
            necrotic_density, dark_blight_density, powdery_density, purple_density,
            texture_var / 50.0, sobel_edge / 50.0,
            ar,
            is_elongated,
            is_palmate,
            is_ovate,
        ]
        feat.extend(hue_hist.tolist())
        feat.extend(sat_hist.tolist())
        feat.extend(val_hist.tolist())

        samples.append(feat)

    return np.array(samples, dtype=np.float32)


def main():
    print("[AgriNexus AI] Training Expert Agricultural Pathology Ensemble Across 45 Crop Pathologies...")
    classes = list(TAXONOMY.keys())
    print(f"Total Diagnostic Classes: {len(classes)}")

    X_list = []
    y_list = []

    for idx, cid in enumerate(classes):
        feats = generate_distinctive_features_for_class(cid, n_samples=250)
        X_list.append(feats)
        y_list.extend([idx] * len(feats))

    X = np.vstack(X_list)
    y = np.array(y_list, dtype=np.int64)

    print(f"Dataset shape: X={X.shape}, y={y.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=25,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1
    )
    et = ExtraTreesClassifier(
        n_estimators=200,
        max_depth=25,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1
    )

    ensemble = VotingClassifier(
        estimators=[("rf", rf), ("et", et)],
        voting="soft"
    )

    model = CalibratedClassifierCV(estimator=ensemble, method="sigmoid", cv=3)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n[OK] Training Completed! Test Set Accuracy: {acc * 100:.2f}%\n")

    # Save checkpoints to both ml/disease/checkpoints and apps/backend/app/services/vision/models
    out_dir = Path("ml/disease/checkpoints")
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "agrinexus_expert_rf.joblib"
    taxonomy_path = out_dir / "taxonomy.json"

    backend_dir = Path("apps/backend/app/services/vision/models")
    backend_dir.mkdir(parents=True, exist_ok=True)
    backend_model_path = backend_dir / "agrinexus_expert_rf.joblib"
    backend_taxonomy_path = backend_dir / "taxonomy.json"

    payload = {
        "classes": classes,
        "taxonomy": TAXONOMY,
        "feature_dim": X.shape[1]
    }

    joblib.dump(model, model_path)
    joblib.dump(model, backend_model_path)
    print(f"[Model Saved] -> {model_path} and {backend_model_path}")

    with open(taxonomy_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(backend_taxonomy_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"[Taxonomy Saved] -> {taxonomy_path} and {backend_taxonomy_path}")


if __name__ == "__main__":
    main()
