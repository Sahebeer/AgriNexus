from typing import List, Dict, Any

# Complete agricultural scheme dataset
SCHEMES_DATABASE = [
    {
        "id": "pm_kisan",
        "name": "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
        "agency": "Central Government",
        "category": "Direct Benefit Transfer",
        "description": "An initiative by the Government of India that provides up to ₹6,000 per year in three equal installments directly into the bank accounts of small and marginal farmers.",
        "benefits": "₹6,000 per annum (₹2,000 every 4 months) direct cash support.",
        "documents": ["Aadhaar Card", "Landholding Records (Khata/Khesra)", "Bank Account Passbook", "Mobile Number linked to Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": 2.0,  # Targeted to small & marginal farmers
            "states": [],          # All states eligible
            "crops": []            # All crops eligible
        }
    },
    {
        "id": "kcc",
        "name": "Kisan Credit Card (KCC) Scheme",
        "agency": "Reserve Bank of India & NABARD",
        "category": "Agricultural Credit",
        "description": "Provides farmers with timely access to short-term credit for crop cultivation, post-harvest expenses, and farm maintenance at highly subsidized interest rates.",
        "benefits": "Subsidized loans up to ₹3 Lakhs at 4% interest rate (after prompt repayment incentive). No collateral required for loans up to ₹1.6 Lakhs.",
        "documents": ["Land Ownership Certificate", "Crop Cultivation proof", "Identity Proof (Voter ID/Aadhaar)", "Three years land cultivation records"],
        "eligibility_rules": {
            "max_farm_size": None,  # No limit
            "states": [],
            "crops": []
        }
    },
    {
        "id": "pmfby",
        "name": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Crop Insurance",
        "description": "A comprehensive crop insurance scheme designed to provide financial support to farmers experiencing crop damage or yield losses due to natural calamities, pests, or diseases.",
        "benefits": "Insurance payout against localized calamities. Low premium rates: 2% for Kharif crops, 1.5% for Rabi crops, and 5% for commercial/horticultural crops.",
        "documents": ["Land tenancy agreement or ownership deed", "Sowing certificate issued by local Patwari", "Bank Account Passbook", "Aadhaar Card"],
        "eligibility_rules": {
            "max_farm_size": None,
            "states": [],
            "crops": ["Rice", "Wheat", "Corn", "Potato", "Tomato", "Apple"] # Standard insurance crops
        }
    },
    {
        "id": "urea_subsidy",
        "name": "Neem Coated Urea Subsidy Scheme",
        "agency": "Department of Fertilizers",
        "category": "Fertilizer Subsidy",
        "description": "Subsidizes the retail price of Neem Coated Urea to prevent misuse for industrial purposes, regulate supply, and reduce fertilizer input costs for farmers.",
        "benefits": "Availability of standard 45kg urea bags at heavily subsidized statutory prices (fixed at ₹242 per bag).",
        "documents": ["Soil Health Card (recommended)", "Farmer ID card (e.g. Kisan Card)"],
        "eligibility_rules": {
            "max_farm_size": None,
            "states": [],
            "crops": ["Rice", "Wheat", "Corn"] # Urea intensive crops
        }
    },
    {
        "id": "pmksy_drip",
        "name": "PMKSY - Per Drop More Crop (Micro Irrigation Subsidy)",
        "agency": "Central & State Governments",
        "category": "Equipment & Irrigation",
        "description": "Focuses on water-use efficiency at the farm level through micro-irrigation technologies like drip and sprinkler systems. Helps optimize water usage and fertilizers.",
        "benefits": "Up to 55% subsidy on micro-irrigation equipment for small and marginal farmers, and up to 45% for other category farmers.",
        "documents": ["Drip installation plan layout", "Land records copy", "Soil and Water testing reports", "Electricity bill or water source proof"],
        "eligibility_rules": {
            "max_farm_size": 5.0,
            "states": [],
            "crops": ["Tomato", "Potato", "Apple"] # Drip irrigation friendly crops
        }
    },
    {
        "id": "tractor_sub_punjab",
        "name": "Punjab Agricultural Mechanization Subsidy (SMAM Punjab)",
        "agency": "Punjab Department of Agriculture",
        "category": "State Equipment Subsidy",
        "description": "Provides financial assistance to farmers of Punjab to purchase modern machinery like laser land levelers, tractors, rotavators, and straw management systems.",
        "benefits": "40% to 50% capital subsidy on standard agricultural tractors and land preparation machinery.",
        "documents": ["Land registration document (Jamabandi)", "Punjab Resident Certificate", "Tractor quotation from authorized dealer"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 1.0,
            "states": ["Punjab"],
            "crops": []
        }
    },
    {
        "id": "machinery_sub_haryana",
        "name": "Haryana Farm Implement Subsidy (SMAM Haryana)",
        "agency": "Haryana Agriculture & Farmers Welfare Department",
        "category": "State Equipment Subsidy",
        "description": "State scheme to support farm mechanization, residue management, and custom hiring centers. Intended to reduce residue burning.",
        "benefits": "50% individual subsidy on rotavators, seed drills, and crop residue implements. 80% subsidy for custom hiring centers.",
        "documents": ["Haryana Resident Certificate", "Aadhaar Card linked Bank account", "Dealer Invoice"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 1.0,
            "states": ["Haryana"],
            "crops": []
        }
    },
    {
        "id": "apple_sub_hp",
        "name": "Himachal Horticulture Development Project (Apple Subsidy)",
        "agency": "HP Department of Horticulture",
        "category": "Horticulture Development",
        "description": "Promotes high-density apple orchards in Himachal Pradesh. Subsidizes high-yield rootstocks, anti-hail nets, and orchard wiring infrastructure.",
        "benefits": "50% to 60% capital subsidy on imported high-density rootstock plants and orchard structural equipment (anti-hail nets, trellis support).",
        "documents": ["Himachal Bonafide Certificate", "Soil testing report", "Orchard land map layout"],
        "eligibility_rules": {
            "max_farm_size": 4.0,
            "states": ["Himachal Pradesh", "Uttarakhand"],
            "crops": ["Apple"]
        }
    },
    {
        "id": "pkvy_organic",
        "name": "Paramparagat Krishi Vikas Yojana (PKVY)",
        "agency": "Ministry of Agriculture",
        "category": "Organic Farming Subsidy",
        "description": "Promotes chemical-free organic farming through a cluster-based approach. Provides funds for organic seeds, composting infrastructure, and certification labels.",
        "benefits": "₹50,000 per hectare financial assistance over 3 years, with ₹31,000 directly distributed to farmers for organic inputs.",
        "documents": ["Cluster membership certification", "Pledge for organic conversion", "Soil test report"],
        "eligibility_rules": {
            "max_farm_size": 2.0,
            "states": [],
            "crops": ["Tomato", "Potato"]
        }
    }
]

def get_recommended_schemes(
    user_state: str,
    farm_size: float,
    active_crops: List[str]
) -> List[Dict[str, Any]]:
    """
    Evaluates farmer inputs against the scheme rules to determine eligibility.
    Returns matched schemes along with a checklist of matched criteria.
    """
    recommended = []
    
    # Normalize crop strings to title-case to prevent formatting mismatches
    normalized_crops = [c.strip().title() for c in active_crops if c.strip()]
    normalized_state = user_state.strip().title() if user_state else ""
    
    for scheme in SCHEMES_DATABASE:
        rules = scheme["eligibility_rules"]
        
        state_match = False
        size_match = False
        crop_match = False
        
        # 1. State check
        if not rules["states"]:
            # Empty list means open to all states
            state_match = True
        else:
            normalized_rules_states = [s.strip().title() for s in rules["states"]]
            if normalized_state in normalized_rules_states:
                state_match = True
                
        # 2. Farm size check
        min_size = rules.get("min_farm_size", 0.0)
        max_size = rules.get("max_farm_size")
        
        if max_size is None:
            size_match = farm_size >= min_size
        else:
            size_match = min_size <= farm_size <= max_size
            
        # 3. Crop check
        if not rules["crops"]:
            # Empty list means open to all crops
            crop_match = True
        else:
            # Check intersection
            normalized_rules_crops = [cr.strip().title() for cr in rules["crops"]]
            crop_match = any(crop in normalized_rules_crops for crop in normalized_crops)
            
        # Overall Match Determination
        is_eligible = state_match and size_match and crop_match
        
        if is_eligible:
            # Construct a clear match checklist for the client visual display
            checklist = [
                {
                    "criterion": "Location State",
                    "value": f"{user_state if user_state else 'General'}",
                    "status": "matches" if state_match else "failed"
                },
                {
                    "criterion": "Farm Landholdings",
                    "value": f"{farm_size} Hectares",
                    "status": "matches" if size_match else "failed"
                },
                {
                    "criterion": "Cultivated Crops",
                    "value": f"{', '.join(normalized_crops) if normalized_crops else 'Any'}",
                    "status": "matches" if crop_match else "failed"
                }
            ]
            
            # Construct match percentage score
            match_score = 100
            if rules["states"] and rules["crops"]:
                match_score = 100
            elif rules["states"] or rules["crops"]:
                match_score = 90
            else:
                match_score = 75  # General matching
                
            recommended.append({
                "id": scheme["id"],
                "name": scheme["name"],
                "agency": scheme["agency"],
                "category": scheme["category"],
                "description": scheme["description"],
                "benefits": scheme["benefits"],
                "documents": scheme["documents"],
                "checklist": checklist,
                "match_score": match_score
            })
            
    # Sort recommendations by match score descending
    recommended.sort(key=lambda x: x["match_score"], reverse=True)
    return recommended
