from typing import List, Dict, Any

# ─────────────────────────────────────────────────────────────────────────────
# COMPREHENSIVE INDIA AGRICULTURAL SCHEMES DATABASE
# Sources: agriwelfare.gov.in, pmkisan.gov.in, myscheme.gov.in, state portals
# Last Updated: July 2026
# ─────────────────────────────────────────────────────────────────────────────
SCHEMES_DATABASE = [

    # ─── CENTRAL GOVERNMENT SCHEMES ─────────────────────────────────────────

    {
        "id": "pm_kisan",
        "name": "PM-KISAN — Pradhan Mantri Kisan Samman Nidhi",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Direct Benefit Transfer",
        "scope": "National",
        "description": (
            "Provides ₹6,000 per year in 3 equal installments of ₹2,000 directly into the bank accounts "
            "of eligible farmer families holding cultivable land across India."
        ),
        "benefits": "₹6,000 per year (₹2,000 every 4 months). Direct bank transfer.",
        "helpline": "155261 / 011-23381092",
        "portal_url": "https://pmkisan.gov.in/",
        "documents": ["Aadhaar Card", "Land ownership records (Khatauni/Patta)", "Bank Passbook", "Mobile linked to Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "pmfby",
        "name": "PMFBY — Pradhan Mantri Fasal Bima Yojana",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Crop Insurance",
        "scope": "National",
        "description": (
            "Comprehensive crop insurance for losses due to natural calamities, pests, and diseases. "
            "Premium rates are just 2% for Kharif, 1.5% for Rabi, and 5% for commercial crops. "
            "Claim settlements are processed within 2 months of crop cutting experiments."
        ),
        "benefits": "Full sum insured payout against localized and widespread calamities. Low premiums subsidized by Centre & State.",
        "helpline": "1800-200-7710",
        "portal_url": "https://pmfby.gov.in/",
        "documents": ["Sowing certificate (Buwai Pramaan Patra)", "Land tenancy/ownership deed", "Bank Passbook", "Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": [
                "Rice", "Wheat", "Corn", "Barley", "Millet", "Sorghum", "Oats",
                "Mustard", "Soybean", "Groundnut", "Sunflower", "Sesame",
                "Cotton", "Sugarcane", "Tomato", "Potato", "Onion",
                "Apple", "Mango", "Banana", "Orange", "Grapes", "Chilli",
                "Chickpeas (Gram)", "Lentils (Masoor)", "Pigeon Peas (Tur)", "Mung Beans"
            ]
        }
    },
    {
        "id": "pm_kisan_maan_dhan",
        "name": "PM Kisan Maandhan Yojana — Farmer Pension Scheme",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Social Security / Pension",
        "scope": "National",
        "description": (
            "A voluntary and contributory pension scheme providing ₹3,000 per month after the age of 60 "
            "to small and marginal farmers. The government matches the farmer's monthly contribution."
        ),
        "benefits": "₹3,000 monthly pension from age 60. Government matches your monthly deposit (₹55–₹200 depending on entry age).",
        "helpline": "1800-267-6888",
        "portal_url": "https://pmkmy.gov.in/",
        "documents": ["Aadhaar Card", "Bank Passbook", "Land ownership records"],
        "eligibility_rules": {
            "max_farm_size": 2.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "kcc",
        "name": "KCC — Kisan Credit Card Scheme",
        "agency": "NABARD / Reserve Bank of India",
        "category": "Agricultural Credit",
        "scope": "National",
        "description": (
            "Short-term revolving credit for crop cultivation, post-harvest expenses, farm maintenance, "
            "and allied activities at highly subsidized interest rates (4% effective rate for timely repayment). "
            "No collateral required for loans up to ₹1.6 Lakhs."
        ),
        "benefits": "Credit up to ₹3 Lakh @ 4% effective interest p.a. Flexible repayment tied to crop cycle.",
        "helpline": "1800-180-1111 (SBI) / Bank Branch",
        "portal_url": "https://www.nabard.org/content1.aspx?id=572",
        "documents": ["Land records copy", "Identity Proof (Voter ID / Aadhaar)", "3-year cultivation history", "Passport-size photos"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "pmksy_drip",
        "name": "PMKSY — Per Drop More Crop (Micro-Irrigation)",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Irrigation & Equipment Subsidy",
        "scope": "National",
        "description": (
            "Focuses on expanding micro-irrigation coverage through drip and sprinkler systems to reduce water wastage. "
            "Provides capital subsidy up to 55% for small/marginal farmers and 45% for others. "
            "Linked to improving water-use efficiency at field level."
        ),
        "benefits": "55% capital subsidy (small/marginal) or 45% (other farmers) on drip and sprinkler equipment cost.",
        "helpline": "1800-180-1551",
        "portal_url": "https://pmksy.gov.in/MicroIrrigation/Default.aspx",
        "documents": ["Drip layout plan", "Land records", "Soil & water testing report", "Water source proof"],
        "eligibility_rules": {
            "max_farm_size": 5.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": [
                "Tomato", "Potato", "Onion", "Garlic", "Ginger", "Chilli",
                "Apple", "Mango", "Orange", "Pomegranate", "Grapes", "Banana", "Guava", "Papaya",
                "Sugarcane", "Cotton", "Soybean", "Groundnut", "Sunflower"
            ]
        }
    },
    {
        "id": "soil_health_card",
        "name": "Soil Health Card Scheme (SHC)",
        "agency": "Department of Agriculture & Farmers Welfare",
        "category": "Soil & Nutrient Management",
        "scope": "National",
        "description": (
            "Provides farmers with a Soil Health Card (SHC) every 2 years, containing soil nutrient status "
            "and fertilizer recommendations tailored to their specific field. Helps optimize fertilizer use, "
            "reduce costs, and improve crop yields by up to 10–15%."
        ),
        "benefits": "Free soil testing + personalized fertilizer recommendation card. Reduces input cost by 8–10%.",
        "helpline": "1800-180-1551",
        "portal_url": "https://soilhealth.dac.gov.in/",
        "documents": ["Land ownership or tenancy record", "Aadhaar Card"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "pkvy_organic",
        "name": "PKVY — Paramparagat Krishi Vikas Yojana (Organic Farming)",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Organic Farming Subsidy",
        "scope": "National",
        "description": (
            "Promotes chemical-free organic farming through cluster-based certification. Provides financial "
            "assistance of ₹50,000 per hectare over 3 years (₹31,000 directly to farmer; remainder via agencies) "
            "for organic inputs, composting, and certification under PGS-India."
        ),
        "benefits": "₹50,000/hectare over 3 years (₹31,000 directly). Includes training + certification support.",
        "helpline": "1800-180-1551",
        "portal_url": "https://pgsindia-ncof.gov.in/PKVY/Index.aspx",
        "documents": ["Cluster group membership certificate", "Land ownership records", "Pledge for organic conversion", "Soil test"],
        "eligibility_rules": {
            "max_farm_size": 2.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": [
                "Tomato", "Potato", "Onion", "Garlic", "Chilli", "Cabbage",
                "Cauliflower", "Okra (Bhindi)", "Brinjal", "Ginger",
                "Rice", "Wheat", "Mung Beans", "Chickpeas (Gram)"
            ]
        }
    },
    {
        "id": "urea_subsidy",
        "name": "Neem-Coated Urea Subsidy Scheme",
        "agency": "Department of Fertilizers, Ministry of Chemicals & Fertilizers",
        "category": "Fertilizer Subsidy",
        "scope": "National",
        "description": (
            "Mandates neem coating on all domestically produced urea and subsidizes its retail price to prevent "
            "diversion and reduce input costs for farmers. Neem coating improves nitrogen use efficiency by 10–15%. "
            "Maximum retail price is fixed by government at ₹266.50 per 45-kg bag."
        ),
        "benefits": "Subsidized urea at MRP ₹266.50/bag (market equivalent ₹1,600+). Improves soil nitrogen use.",
        "helpline": "1800-180-1551",
        "portal_url": "https://fert.nic.in/",
        "documents": ["Soil Health Card (recommended)", "Farmer Identity Proof"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": ["Rice", "Wheat", "Corn", "Barley", "Millet", "Sorghum", "Sugarcane", "Cotton", "Potato"]
        }
    },
    {
        "id": "midh_horticulture",
        "name": "MIDH — Mission for Integrated Development of Horticulture",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Horticulture Development",
        "scope": "National",
        "description": (
            "A Centrally Sponsored Scheme for holistic growth of the horticulture sector covering fruits, vegetables, "
            "mushrooms, spices, flowers, and plantation crops. Provides capital subsidy for establishing orchards, "
            "poly-houses, nurseries, cold storage, and post-harvest units."
        ),
        "benefits": "40–50% capital subsidy on orchard establishment, protected cultivation, and post-harvest infrastructure.",
        "helpline": "1800-180-1551",
        "portal_url": "https://midh.gov.in/",
        "documents": ["Land ownership records", "Detailed Project Report (DPR)", "Soil test report", "Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": 4.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": [
                "Mango", "Banana", "Guava", "Orange", "Pomegranate", "Grapes", "Papaya",
                "Apple", "Tomato", "Potato", "Onion", "Garlic", "Chilli",
                "Cabbage", "Cauliflower", "Okra (Bhindi)", "Brinjal", "Ginger"
            ]
        }
    },
    {
        "id": "nmeo_edible_oils",
        "name": "NMEO — National Mission on Edible Oils",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Oilseeds Incentive",
        "scope": "National",
        "description": (
            "Focuses on reducing India's edible oil import dependence (currently ~60%) by boosting domestic oilseed production. "
            "Provides price support, input subsidies for certified seeds, drip irrigation, and processing units. "
            "Special focus on oil palm cultivation (NMEO-OP) in North-East and Andaman."
        ),
        "benefits": "₹29,000/hectare for oil palm orchard, up to 50% on processing equipment, MSP price support for oilseeds.",
        "helpline": "1800-180-1551",
        "portal_url": "https://nmoop.gov.in/",
        "documents": ["Land possession certificate", "Certified seed procurement bill", "Bank Passbook"],
        "eligibility_rules": {
            "max_farm_size": 5.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": ["Mustard", "Soybean", "Groundnut", "Sunflower", "Sesame", "Oil Palm"]
        }
    },
    {
        "id": "nfsm_pulses",
        "name": "NFSM-Pulses — National Food Security Mission (Pulses)",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Seed & Input Subsidy",
        "scope": "National",
        "description": (
            "Aims to increase pulse production through high-yielding seed distribution, cluster demonstrations, "
            "sprinkler irrigation subsidies, and crop protection. Particularly targets rain-fed districts and "
            "low-productivity states to bridge the demand-supply gap in domestic pulses."
        ),
        "benefits": "₹5,000/quintal on certified breeder seeds, 50% subsidy on crop protection tools and micro-sprinklers.",
        "helpline": "1800-180-1551",
        "portal_url": "https://nfsm.gov.in/",
        "documents": ["Seed procurement receipt from cooperative", "Land cultivation declaration", "Identity Proof"],
        "eligibility_rules": {
            "max_farm_size": 2.0,
            "min_farm_size": 0.0,
            "states": [],
            "crops": ["Chickpeas (Gram)", "Lentils (Masoor)", "Pigeon Peas (Tur)", "Mung Beans"]
        }
    },
    {
        "id": "cotton_msp_cci",
        "name": "CCI-MSP — Cotton Corporation of India Price Support",
        "agency": "Cotton Corporation of India (CCI)",
        "category": "Minimum Support Price (MSP)",
        "scope": "National",
        "description": (
            "The CCI intervenes in the cotton market when prices fall below the MSP declared by CCEA. "
            "Farmers can sell to CCI procurement centers at guaranteed MSP rates (₹7,121 per quintal for medium staple in 2024). "
            "Payment is directly credited within 72 hours of mandi procurement."
        ),
        "benefits": "Guaranteed MSP of ₹7,121/quintal (Medium Staple) or ₹7,521/quintal (Long Staple) FY2024-25. Direct bank credit.",
        "helpline": "1800-222-222 (CCI Toll-Free)",
        "portal_url": "https://cotcorp.org.in/",
        "documents": ["CCI Mandi procurement card", "Girdawari / crop registration record", "Bank linked to Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": ["Cotton"]
        }
    },
    {
        "id": "sugarcane_frp",
        "name": "Sugarcane FRP — Fair and Remunerative Price Scheme",
        "agency": "Cabinet Committee on Economic Affairs (CCEA)",
        "category": "Minimum Support Price (MSP)",
        "scope": "National",
        "description": (
            "Statutory guaranteed floor price for sugarcane supplied to sugar mills, based on a basic sugar recovery "
            "rate of 10.25%. FRP for 2024-25 is ₹340/quintal. Mill factories must pay within 14 days; unpaid amounts attract 15% interest."
        ),
        "benefits": "Statutory price of ₹340/quintal (FY2024-25). Interest @15% on delayed mill payments.",
        "helpline": "011-23388040 (DFPD)",
        "portal_url": "https://dfpd.gov.in/",
        "documents": ["Sugar mill supply slip (cane receipt)", "Land ownership record", "Bank Passbook"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": ["Sugarcane"]
        }
    },
    {
        "id": "aif",
        "name": "AIF — Agriculture Infrastructure Fund",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Infrastructure & Credit Guarantee",
        "scope": "National",
        "description": (
            "Medium- to long-term debt financing for post-harvest management and community farming assets. "
            "Provides 3% per annum interest subvention on loans up to ₹2 crore for warehouses, cold chains, "
            "primary processing units, sorting/grading units, and e-marketing platforms."
        ),
        "benefits": "3% p.a. interest subvention on loans up to ₹2 Crore. Credit guarantee via CGTMSE for up to ₹2 Crore.",
        "helpline": "1800-3000-2061",
        "portal_url": "https://agriinfra.dac.gov.in/",
        "documents": ["Project Report (DPR)", "Incorporation Certificate (if entity)", "Bank Statement", "Land lease/ownership"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "enam",
        "name": "e-NAM — National Agriculture Market",
        "agency": "Small Farmers Agribusiness Consortium (SFAC)",
        "category": "Digital Market Access",
        "scope": "National",
        "description": (
            "A pan-India electronic trading portal integrating APMCs across 23 states/UTs into a unified national market. "
            "Enables online bidding, quality assaying, and e-payment. Farmers get access to a larger buyer pool, "
            "transparent price discovery, and direct online bank payment within 2 working days."
        ),
        "benefits": "Online auction with 1,361+ integrated mandis. Direct bank payment. Access to pan-India buyers without intermediaries.",
        "helpline": "1800-270-0224",
        "portal_url": "https://enam.gov.in/web/",
        "documents": ["Mandi registration", "Bank account linked to Aadhaar", "Aadhaar Card"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "smam",
        "name": "SMAM — Sub-Mission on Agricultural Mechanization",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Farm Mechanization Subsidy",
        "scope": "National",
        "description": (
            "Promotes farm mechanization among small and marginal farmers by subsidizing purchase of tractors, power tillers, "
            "combine harvesters, laser land levelers, drones, and other equipment. Also supports setting up of Custom Hiring Centers (CHCs)."
        ),
        "benefits": "25–50% capital subsidy on agricultural machinery. 80% subsidy for CHC group setups.",
        "helpline": "1800-180-1551",
        "portal_url": "https://agrimachinery.nic.in/",
        "documents": ["Land records", "Identity Proof", "Dealer quotation from authorized dealer", "Caste Certificate (for SC/ST)"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "namo_drone_didi",
        "name": "Namo Drone Didi Scheme",
        "agency": "Ministry of Agriculture & Farmers Welfare",
        "category": "Technology & Precision Farming",
        "scope": "National",
        "description": (
            "Empowers women self-help groups (SHGs) with agricultural drones for crop protection spraying and monitoring. "
            "Provides financial assistance covering up to 80% of drone cost (max ₹8 lakhs). "
            "Selected SHGs also get 15 days training on drone operation and maintenance."
        ),
        "benefits": "Up to 80% subsidy on drone cost (max ₹8 Lakh). Free 15-day training included.",
        "helpline": "1800-180-1551",
        "portal_url": "https://namodronedidi.da.gov.in/",
        "documents": ["SHG registration certificate", "DAY-NRLM enrollment proof", "Bank Account details"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "pmddky",
        "name": "PMDDKY — PM Dhan-Dhaanya Krishi Yojana",
        "agency": "Ministry of Agriculture & Farmers Welfare / NITI Aayog",
        "category": "Integrated District Development",
        "scope": "National",
        "description": (
            "Launched in Union Budget 2025-26, this convergence scheme transforms agriculture in 100 low-productivity districts. "
            "It converges 36 existing schemes from 11 departments covering irrigation, credit, digital services, "
            "and market access into a single district-level mission dashboard."
        ),
        "benefits": "Convergence of 36 schemes for targeted districts. Priority credit, irrigation, and digital coverage.",
        "helpline": "1800-180-1551",
        "portal_url": "https://agriwelfare.gov.in/en/PM-Dhan-Dhaanya",
        "documents": ["Aadhaar Card", "Land records"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },
    {
        "id": "fpo_scheme",
        "name": "10,000 FPO Formation & Promotion Scheme",
        "agency": "Ministry of Agriculture & SFAC",
        "category": "Collective Farming / Agri-Business",
        "scope": "National",
        "description": (
            "Facilitates formation and strengthening of 10,000 Farmer Producer Organizations (FPOs) over 5 years. "
            "Each FPO receives handholding support, management cost of up to ₹18 Lakh, matching equity grants "
            "up to ₹15 Lakh, and credit guarantee."
        ),
        "benefits": "₹18 Lakh management cost support, ₹15 Lakh equity grant, credit guarantee, 5-year handholding.",
        "helpline": "1800-270-0224",
        "portal_url": "https://sfacindia.com/",
        "documents": ["Group membership list", "FPO registration certificate", "Business plan"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": [],
            "crops": []
        }
    },

    # ─── STATE-SPECIFIC SCHEMES ──────────────────────────────────────────────

    {
        "id": "smam_punjab",
        "name": "Punjab SMAM — Farm Mechanization & Stubble Management Subsidy",
        "agency": "Punjab Department of Agriculture",
        "category": "Farm Mechanization (State)",
        "scope": "State",
        "description": (
            "Provides 50% individual subsidy (80% for groups/cooperatives) on crop residue management (CRM) machinery "
            "like Happy Seeders, Super SMS, Mulchers, and Balers to prevent stubble burning. "
            "Also covers Hi-Power Tractors under CM Hi-Power Tractor Programme."
        ),
        "benefits": "50% (individual) / 80% (group) subsidy on CRM machinery. CM Kissan Card for interest-free loans.",
        "helpline": "1800-180-2117 (Punjab Agri Helpline)",
        "portal_url": "https://agrimachinerypb.com/",
        "documents": ["Punjab Resident Certificate", "Jamabandi (land records)", "Tractor/machinery dealer quotation"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 1.0,
            "states": ["Punjab"],
            "crops": []
        }
    },
    {
        "id": "mfmb_haryana",
        "name": "Haryana — Meri Fasal Mera Byora (MFMB) Portal Subsidy",
        "agency": "Haryana Agriculture & Farmers Welfare Department",
        "category": "Farm Mechanization & Horticulture (State)",
        "scope": "State",
        "description": (
            "Haryana's Meri Fasal Mera Byora portal is the gateway to all state agricultural subsidies. "
            "Offers 50% subsidy on farm implements, up to 65% on polyhouses and net houses under NHM, "
            "and cash incentive under Mera Pani Meri Virasat for shifting from paddy to alternative crops."
        ),
        "benefits": "50% subsidy on implements. ₹7,000/acre incentive to shift from paddy to alternative crops.",
        "helpline": "1800-180-2117",
        "portal_url": "https://fasal.haryana.gov.in/",
        "documents": ["Haryana Resident Certificate", "Aadhaar linked bank account", "Parivar Pehchan Patra"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.5,
            "states": ["Haryana"],
            "crops": []
        }
    },
    {
        "id": "up_agri_darshan",
        "name": "UP — Tractor & Equipment Subsidy (Agridarshan Portal)",
        "agency": "UP Department of Agriculture",
        "category": "Farm Mechanization (State)",
        "scope": "State",
        "description": (
            "Uttar Pradesh provides up to 50% subsidy on tractors and high-tech agricultural equipment under SMAM "
            "and state schemes. Applications are submitted through the Agridarshan portal. "
            "Separate quotas are reserved for SC/ST farmers (5% additional benefit)."
        ),
        "benefits": "Up to 50% capital subsidy on tractors, reapers, and threshers. SC/ST get additional 5%.",
        "helpline": "1800-180-5566",
        "portal_url": "https://agridarshan.up.gov.in/",
        "documents": ["Aadhaar Card", "Land Records (Khatauni)", "Bank Passbook", "SC/ST certificate if applicable"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.5,
            "states": ["Uttar Pradesh"],
            "crops": []
        }
    },
    {
        "id": "mahadbt_maharashtra",
        "name": "Maharashtra — MahaDBT Shetkari Subsidy Scheme",
        "agency": "Maharashtra Agriculture Department",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Maharashtra's MahaDBT platform consolidates all state agricultural subsidies. Includes Namo Shetkari "
            "Maha Sanman Nidhi (₹6,000/year state top-up to PM-KISAN), micro-irrigation subsidies up to 80% for "
            "marginal farmers, and comprehensive dairy/goat/poultry allied schemes."
        ),
        "benefits": "₹6,000/year Namo Shetkari state top-up. 80% micro-irrigation subsidy for marginal farmers.",
        "helpline": "1800-233-6663",
        "portal_url": "https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData",
        "documents": ["7/12 Satbara extract", "Aadhaar", "Bank Passbook", "Category Certificate if applicable"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Maharashtra"],
            "crops": []
        }
    },
    {
        "id": "ikhedut_gujarat",
        "name": "Gujarat — iKhedut Farmer Scheme Portal",
        "agency": "Gujarat Agriculture Department",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Gujarat's iKhedut portal offers a one-stop platform for all agricultural schemes: Mukhyamantri Kisan Sahay Yojana "
            "for crop loss compensation, seed subsidies, fertilizer support, farm mechanization, and horticulture grants. "
            "Farmer must register on iKhedut to access any state scheme."
        ),
        "benefits": "Up to ₹25,000/hectare crop loss compensation. Seed & fertilizer subsidies. Equipment grants.",
        "helpline": "1800-233-0019 (Gujarat Kisan Call Center)",
        "portal_url": "https://ikhedut.gujarat.gov.in/",
        "documents": ["8-A land record extract", "Aadhaar Card", "Bank Passbook", "Cooperative membership (if applicable)"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Gujarat"],
            "crops": []
        }
    },
    {
        "id": "rajkisan_rajasthan",
        "name": "Rajasthan — RajKisan Saathi Portal Schemes",
        "agency": "Rajasthan Department of Agriculture",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Rajasthan's RajKisan Saathi platform provides single-window access to agricultural schemes: "
            "Mukhyamantri Krishak Saathi Sahayata Yojana (₹2 Lakh accident insurance for farmers), "
            "seed subsidies, farm mechanization grants, and horticulture schemes for arid zone crops."
        ),
        "benefits": "₹2 Lakh accident cover via CM Krishak Saathi. Machinery subsidies up to 50%.",
        "helpline": "0141-2922614",
        "portal_url": "https://rajkisan.rajasthan.gov.in/",
        "documents": ["Bhu-Adhikar Passbook (Land rights)", "Aadhaar", "Bank Passbook", "Girdawari for crop declaration"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Rajasthan"],
            "crops": []
        }
    },
    {
        "id": "tn_agri_schemes",
        "name": "Tamil Nadu — Uzhavar Suraksha Thittam & State Agri Schemes",
        "agency": "Tamil Nadu Agriculture Department",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Tamil Nadu offers a comprehensive package including free crop insurance (Uzhavar Suraksha), "
            "subsidized seeds at 50% cost from government depots, farm machinery subsidies via the Uzhavan App, "
            "and horticulture development grants. Tamil Nadu Farmer Registry (Farmer ID) is required for all benefits."
        ),
        "benefits": "Free crop insurance for paddy. 50% seed subsidy. 40-75% machinery grants via Uzhavan App.",
        "helpline": "1800-425-1551",
        "portal_url": "https://tnagrisnet.tn.gov.in/",
        "documents": ["Tamil Nadu Farmer ID (TNFR)", "Aadhaar Card", "Patta document", "Bank Passbook"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Tamil Nadu"],
            "crops": ["Rice", "Wheat", "Corn", "Banana", "Mango", "Sugarcane", "Cotton", "Groundnut", "Soybean"]
        }
    },
    {
        "id": "fruits_karnataka",
        "name": "Karnataka — FRUITS Portal & Krishi Bhagya Scheme",
        "agency": "Karnataka Department of Agriculture",
        "category": "Water Conservation & State Subsidy",
        "scope": "State",
        "description": (
            "Karnataka's FRUITS (Farmer Registration & Unified Beneficiary Information System) portal is the gateway "
            "to all state subsidies. Krishi Bhagya scheme provides up to 75% subsidy for farm ponds, drip irrigation, "
            "and polyhouse construction. Savayava Bhagya supports organic transition with ₹10,000/hectare input subsidy."
        ),
        "benefits": "75% subsidy on farm ponds, drip systems. ₹10,000/ha organic input subsidy under Savayava Bhagya.",
        "helpline": "1800-425-1070",
        "portal_url": "https://fruits.karnataka.gov.in/",
        "documents": ["RTC (Pahani) land record", "Aadhaar Card", "Bank Passbook", "FRUITS Farmer ID"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Karnataka"],
            "crops": []
        }
    },
    {
        "id": "aims_kerala",
        "name": "Kerala — AIMS Farmer Portal Schemes",
        "agency": "Kerala Department of Agriculture",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Kerala's AIMS (Agricultural Information Management System) portal provides subsidies for vegetable cultivation, "
            "spice development (cardamom, pepper, ginger, turmeric), soil conservation, organic farming support, "
            "and climate-resilient farming schemes for coconut and rubber smallholders."
        ),
        "benefits": "50% input subsidy for vegetables. Spice development grants. Climate-resilient crop support.",
        "helpline": "0471-2321581",
        "portal_url": "https://aims.kerala.gov.in/",
        "documents": ["Kerala Farmer Registration ID", "Land possession certificate", "Aadhaar Card"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Kerala"],
            "crops": ["Coconut", "Ginger", "Tomato", "Banana", "Rubber", "Tea", "Coffee", "Pepper"]
        }
    },
    {
        "id": "dbtagri_bihar",
        "name": "Bihar — DBT Agriculture Schemes Portal",
        "agency": "Bihar Agriculture Department",
        "category": "Multi-Category State Subsidy",
        "scope": "State",
        "description": (
            "Bihar's DBT Agriculture portal provides direct benefit transfer for Krishi Input Subsidy (crop loss compensation "
            "up to ₹13,500/hectare), diesel subsidy for irrigation, seed subsidies on certified varieties, "
            "and farm mechanization grants. Must register on dbtagriculture.bihar.gov.in."
        ),
        "benefits": "Up to ₹13,500/ha crop loss subsidy. Diesel subsidy. Certified seed subsidy.",
        "helpline": "0612-2233555",
        "portal_url": "https://dbtagriculture.bihar.gov.in/",
        "documents": ["Bihar Farmer Registration ID", "Land Dakhil Kharij", "Bank Passbook", "Aadhaar"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.0,
            "states": ["Bihar"],
            "crops": ["Rice", "Wheat", "Corn", "Lentils (Masoor)", "Mung Beans", "Mustard", "Sugarcane"]
        }
    },
    {
        "id": "apple_hp_midh",
        "name": "Himachal Pradesh — Apple High-Density Orchard Subsidy",
        "agency": "HP Department of Horticulture",
        "category": "Horticulture Development (State)",
        "scope": "State",
        "description": (
            "Under MIDH & state NHM, HP provides 50–60% capital subsidy on high-density apple rootstocks, "
            "anti-hail nets, trellis wiring, and drip irrigation for apple orchards. "
            "Linked to Himachal Pradesh Horticulture Development Project (HPHDP) with World Bank co-financing."
        ),
        "benefits": "50–60% subsidy on anti-hail nets, high-density rootstocks, orchard wiring.",
        "helpline": "1800-180-8010",
        "portal_url": "https://www.hphorticulture.gov.in/",
        "documents": ["HP Bonafide Resident Certificate", "Land records (Jamabandi)", "Soil test report", "Orchard layout map"],
        "eligibility_rules": {
            "max_farm_size": 4.0,
            "min_farm_size": 0.0,
            "states": ["Himachal Pradesh", "Uttarakhand", "Jammu & Kashmir"],
            "crops": ["Apple"]
        }
    },
    {
        "id": "mp_kisan_anudan",
        "name": "Madhya Pradesh — e-Krishi Yantra Anudan (E-KYA) Scheme",
        "agency": "MP Kisan Kalyan tatha Krishi Vikas Vibhag",
        "category": "Farm Mechanization (State)",
        "scope": "State",
        "description": (
            "MP's E-KYA portal provides lottery-based allocation of farm equipment subsidies (tractors, threshers, "
            "rotavators, seed drills). Small/marginal farmers get 50% subsidy; other farmers get 40%. "
            "Applications open in seasonal windows and are selected through transparent lottery system."
        ),
        "benefits": "40–50% capital subsidy on tractors and implements. Lottery-based transparent selection.",
        "helpline": "0755-2550400",
        "portal_url": "https://farmer.mpdage.org/",
        "documents": ["MP Kisan ID", "Land records (B1/Khasra)", "Bank Passbook", "Dealer quotation"],
        "eligibility_rules": {
            "max_farm_size": None,
            "min_farm_size": 0.5,
            "states": ["Madhya Pradesh"],
            "crops": []
        }
    }
]


def get_recommended_schemes(
    user_state: str,
    farm_size: float,
    active_crops: List[str]
) -> List[Dict[str, Any]]:
    """
    Match farmer's profile against the full schemes database.
    Returns matching schemes with eligibility checklist and match score.
    """
    recommended = []

    normalized_crops = [c.strip().title() for c in active_crops if c.strip()]
    normalized_state = user_state.strip().title() if user_state else ""

    for scheme in SCHEMES_DATABASE:
        rules = scheme["eligibility_rules"]

        # 1. State check
        if not rules["states"]:
            state_match = True
        else:
            normalized_rule_states = [s.strip().title() for s in rules["states"]]
            state_match = normalized_state in normalized_rule_states

        # 2. Farm size check
        min_size = rules.get("min_farm_size", 0.0) or 0.0
        max_size = rules.get("max_farm_size")
        size_match = (max_size is None and farm_size >= min_size) or \
                     (max_size is not None and min_size <= farm_size <= max_size)

        # 3. Crop check
        if not rules["crops"]:
            crop_match = True
        else:
            normalized_rule_crops = [cr.strip().title() for cr in rules["crops"]]
            crop_match = bool(normalized_crops) and \
                         any(crop in normalized_rule_crops for crop in normalized_crops)

        is_eligible = state_match and size_match and crop_match
        if not is_eligible:
            continue

        # Match score logic
        specificity = 0
        if rules["states"]:
            specificity += 2
        if rules["crops"]:
            specificity += 1
        if rules.get("max_farm_size") is not None:
            specificity += 1
        match_score = 100 if specificity >= 3 else (90 if specificity == 2 else (80 if specificity == 1 else 70))

        checklist = [
            {
                "criterion": "Location / State",
                "value": user_state if user_state else "National",
                "status": "matches"
            },
            {
                "criterion": "Landholding Size",
                "value": f"{farm_size} Hectares",
                "status": "matches"
            },
            {
                "criterion": "Cultivated Crops",
                "value": ", ".join(normalized_crops) if normalized_crops else "Any Crop",
                "status": "matches"
            }
        ]

        recommended.append({
            "id": scheme["id"],
            "name": scheme["name"],
            "agency": scheme["agency"],
            "category": scheme["category"],
            "scope": scheme.get("scope", "National"),
            "description": scheme["description"],
            "benefits": scheme["benefits"],
            "documents": scheme["documents"],
            "helpline": scheme.get("helpline", "1800-180-1551"),
            "portal_url": scheme.get("portal_url", "https://agriwelfare.gov.in/"),
            "checklist": checklist,
            "match_score": match_score
        })

    recommended.sort(key=lambda x: x["match_score"], reverse=True)
    return recommended
