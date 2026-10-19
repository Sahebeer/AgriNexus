/**
 * AgriNexus AI - Canonical Crop and Approved Crop-Type Registry
 *
 * Local immutable static single-source-of-truth registry of approved crop types.
 * Purely data-driven: no external API calls, no AI model lookups, no speculative options.
 */

export type CropTypeOption = {
  id: string;
  label: string;
  aliases?: string[];
};

export type CropTypeRegistry = Record<string, readonly CropTypeOption[]>;

/**
 * Mapping of known aliases, display names, and legacy keys to canonical keys.
 */
export const CROP_ALIASES: Record<string, string> = {
  // Cereals & Grains
  rice: "rice",
  paddy: "rice",
  "rice (paddy)": "rice",
  wheat: "wheat",
  maize: "maize",
  corn: "maize",
  "corn (maize)": "maize",
  corn_maize: "maize",
  "corn_(maize)": "maize",

  // Fibers & Cash Crops
  cotton: "cotton",
  jute: "jute",
  sugarcane: "sugarcane",

  // Pulses & Legumes
  chickpea: "chickpea",
  chickpeas: "chickpea",
  "chickpeas (gram)": "chickpea",
  chickpeas_gram: "chickpea",
  gram: "chickpea",
  chana: "chickpea",
  kidneybeans: "kidneybeans",
  "kidney beans": "kidneybeans",
  kidney_beans: "kidneybeans",
  rajma: "kidneybeans",
  lentil: "lentil",
  lentils: "lentil",
  masoor: "lentil",
  pigeonpeas: "pigeonpeas",
  "pigeon peas": "pigeonpeas",
  "pigeon pea": "pigeonpeas",
  arhar: "pigeonpeas",
  tur: "pigeonpeas",
  mungbean: "mungbean",
  "mung bean": "mungbean",
  moong: "mungbean",
  blackgram: "blackgram",
  "black gram": "blackgram",
  urad: "blackgram",
  mothbeans: "mothbeans",
  "moth beans": "mothbeans",
  soybean: "soybean",
  soyabean: "soybean",
  groundnut: "groundnut",
  peanut: "groundnut",
  peanuts: "groundnut",
  mustard: "mustard",

  // Vegetables & Roots
  potato: "potato",
  tomato: "tomato",
  onion: "onion",
  bell_pepper: "bell_pepper",
  "bell pepper": "bell_pepper",
  capsicum: "bell_pepper",
  "pepper, bell": "bell_pepper",
  "pepper,_bell": "bell_pepper",
  cassava: "cassava",
  squash: "squash",

  // Fruits & Horticulture
  apple: "apple",
  banana: "banana",
  grapes: "grapes",
  grape: "grapes",
  mango: "mango",
  orange: "orange",
  citrus: "orange",
  papaya: "papaya",
  pomegranate: "pomegranate",
  watermelon: "watermelon",
  muskmelon: "muskmelon",
  coconut: "coconut",
  coffee: "coffee",
  blueberry: "blueberry",
  cherry: "cherry",
  "cherry (including sour)": "cherry",
  peach: "peach",
  raspberry: "raspberry",
  strawberry: "strawberry",
};

/**
 * Normalizes any crop string, alias, or legacy label into its canonical key.
 */
export function normalizeCropName(crop: string | null | undefined): string {
  if (!crop) return "";
  const cleaned = crop.trim().toLowerCase();
  if (CROP_ALIASES[cleaned]) {
    return CROP_ALIASES[cleaned];
  }
  const alt = cleaned.replace(/\s+/g, "_").replace(/-/g, "_");
  if (CROP_ALIASES[alt]) {
    return CROP_ALIASES[alt];
  }
  return cleaned;
}

/**
 * Immutable approved crop-type registry.
 */
export const APPROVED_CROP_TYPE_CATALOG: CropTypeRegistry = {
  rice: [
    { id: "basmati", label: "Basmati" },
    { id: "sona_masuri", label: "Sona Masuri", aliases: ["sonamasuri"] },
    { id: "ir64", label: "IR64", aliases: ["ir_64"] },
    { id: "swarna", label: "Swarna" },
    { id: "ponni", label: "Ponni" },
    { id: "matta_red_rice", label: "Matta / Red Rice", aliases: ["matta", "red_rice"] },
    { id: "black_rice", label: "Black Rice" },
    { id: "other_non_basmati", label: "Other Non-Basmati", aliases: ["non_basmati"] },
  ],
  wheat: [
    { id: "bread_wheat", label: "Common / Bread Wheat", aliases: ["common_wheat"] },
    { id: "durum", label: "Durum Wheat", aliases: ["durum_wheat"] },
    { id: "emmer", label: "Emmer Wheat", aliases: ["emmer_wheat", "khapli"] },
    { id: "sharbati", label: "Sharbati" },
    { id: "lokwan", label: "Lokwan" },
  ],
  maize: [
    { id: "field_grain", label: "Field / Grain Maize", aliases: ["grain_maize", "field_corn"] },
    { id: "sweet_corn", label: "Sweet Corn" },
    { id: "baby_corn", label: "Baby Corn" },
    { id: "popcorn", label: "Popcorn" },
    { id: "fodder_maize", label: "Fodder Maize", aliases: ["fodder_corn"] },
  ],
  cotton: [
    { id: "desi", label: "Desi Cotton" },
    { id: "upland", label: "American / Upland Cotton", aliases: ["american_cotton"] },
    { id: "egyptian_long_staple", label: "Egyptian / Long-Staple Cotton", aliases: ["long_staple"] },
  ],
  jute: [
    { id: "tossa", label: "Tossa Jute" },
    { id: "white_jute", label: "White Jute" },
  ],
  chickpea: [
    { id: "desi", label: "Desi Chickpea" },
    { id: "kabuli", label: "Kabuli Chickpea" },
  ],
  kidneybeans: [
    { id: "red_kidney", label: "Red Kidney Bean" },
    { id: "white_kidney", label: "White Kidney Bean" },
    { id: "cranberry", label: "Cranberry Bean" },
  ],
  lentil: [
    { id: "red", label: "Red Lentil" },
    { id: "brown_green", label: "Brown / Green Lentil", aliases: ["green_lentil", "brown_lentil"] },
  ],
  apple: [
    { id: "red_delicious", label: "Red Delicious" },
    { id: "royal_delicious", label: "Royal Delicious" },
    { id: "gala", label: "Gala" },
    { id: "fuji", label: "Fuji" },
    { id: "granny_smith", label: "Granny Smith" },
    { id: "golden_delicious", label: "Golden Delicious" },
    { id: "ambri", label: "Ambri" },
  ],
  banana: [
    { id: "cavendish", label: "Cavendish" },
    { id: "robusta", label: "Robusta" },
    { id: "rasthali", label: "Rasthali" },
    { id: "poovan", label: "Poovan" },
    { id: "nendran", label: "Nendran" },
    { id: "yelakki", label: "Yelakki" },
    { id: "red_banana", label: "Red Banana" },
  ],
  grapes: [
    { id: "thompson_seedless", label: "Thompson Seedless" },
    { id: "sonaka", label: "Sonaka" },
    { id: "sharad_seedless", label: "Sharad Seedless" },
    { id: "crimson_seedless", label: "Crimson Seedless" },
    { id: "flame_seedless", label: "Flame Seedless" },
    { id: "bangalore_blue", label: "Bangalore Blue" },
  ],
  mango: [
    { id: "alphonso", label: "Alphonso" },
    { id: "kesar", label: "Kesar" },
    { id: "dashehari", label: "Dashehari" },
    { id: "langra", label: "Langra" },
    { id: "banganapalli", label: "Banganapalli" },
    { id: "totapuri", label: "Totapuri" },
    { id: "chaunsa", label: "Chaunsa" },
    { id: "amrapali", label: "Amrapali" },
  ],
  orange: [
    { id: "nagpur_mandarin", label: "Nagpur Mandarin" },
    { id: "kinnow", label: "Kinnow" },
    { id: "khasi_mandarin", label: "Khasi Mandarin" },
    { id: "mosambi", label: "Sweet Orange / Mosambi" },
    { id: "valencia", label: "Valencia Orange" },
  ],
  papaya: [
    { id: "red_lady", label: "Red Lady" },
    { id: "pusa_delicious", label: "Pusa Delicious" },
    { id: "pusa_nanha", label: "Pusa Nanha" },
    { id: "co_2", label: "CO-2" },
    { id: "arka_prabhath", label: "Arka Prabhath" },
  ],
  pomegranate: [
    { id: "bhagwa", label: "Bhagwa" },
    { id: "ganesh", label: "Ganesh" },
    { id: "arakta", label: "Arakta" },
    { id: "mridula", label: "Mridula" },
  ],
  watermelon: [
    { id: "crimson_sweet", label: "Crimson Sweet" },
    { id: "sugar_baby", label: "Sugar Baby" },
    { id: "arka_manik", label: "Arka Manik" },
    { id: "black_diamond", label: "Black Diamond" },
    { id: "seedless_hybrid", label: "Seedless Hybrid" },
  ],
  muskmelon: [
    { id: "hara_madhu", label: "Hara Madhu" },
    { id: "punjab_sunehri", label: "Punjab Sunehri" },
    { id: "pusa_madhuras", label: "Pusa Madhuras" },
    { id: "kashi_madhu", label: "Kashi Madhu" },
    { id: "galia", label: "Galia" },
  ],
  coconut: [
    { id: "tall", label: "Tall Coconut" },
    { id: "dwarf", label: "Dwarf Coconut" },
    { id: "hybrid", label: "Hybrid Coconut" },
  ],
  coffee: [
    { id: "arabica", label: "Arabica" },
    { id: "robusta", label: "Robusta" },
    { id: "liberica", label: "Liberica" },
  ],
  potato: [
    { id: "table", label: "Table Potato" },
    { id: "processing", label: "Processing Potato" },
    { id: "kufri_jyoti", label: "Kufri Jyoti" },
    { id: "kufri_pukhraj", label: "Kufri Pukhraj" },
    { id: "kufri_chandramukhi", label: "Kufri Chandramukhi" },
  ],
  tomato: [
    { id: "determinate", label: "Determinate" },
    { id: "indeterminate", label: "Indeterminate" },
    { id: "cherry", label: "Cherry Tomato" },
    { id: "roma", label: "Roma / Plum Tomato" },
    { id: "beefsteak", label: "Beefsteak Tomato" },
  ],
  bell_pepper: [
    { id: "green", label: "Green" },
    { id: "red", label: "Red" },
    { id: "yellow", label: "Yellow" },
    { id: "orange", label: "Orange" },
  ],
  groundnut: [
    { id: "spanish_bunch", label: "Spanish Bunch" },
    { id: "virginia_bunch", label: "Virginia Bunch" },
    { id: "valencia", label: "Valencia" },
    { id: "runner", label: "Runner" },
  ],
  mustard: [
    { id: "indian_brown", label: "Indian / Brown Mustard" },
    { id: "yellow", label: "Yellow Mustard" },
    { id: "black", label: "Black Mustard" },
  ],
  onion: [
    { id: "red", label: "Red Onion" },
    { id: "yellow", label: "Yellow Onion" },
    { id: "white", label: "White Onion" },
    { id: "shallot", label: "Shallot" },
  ],
  soybean: [
    { id: "yellow_grain", label: "Yellow Grain Soybean" },
    { id: "black_soybean", label: "Black Soybean" },
    { id: "green_edamame", label: "Green Soybean / Edamame" },
  ],
};

/**
 * Returns true if the crop has an approved crop-type catalog.
 */
export function hasCropTypes(crop: string | null | undefined): boolean {
  const canonical = normalizeCropName(crop);
  return Boolean(canonical && APPROVED_CROP_TYPE_CATALOG[canonical]);
}

/**
 * Returns the list of approved crop types for the given crop, or an empty array if none.
 */
export function getCropTypes(crop: string | null | undefined): readonly CropTypeOption[] {
  const canonical = normalizeCropName(crop);
  if (!canonical || !APPROVED_CROP_TYPE_CATALOG[canonical]) {
    return [];
  }
  return APPROVED_CROP_TYPE_CATALOG[canonical];
}

/**
 * Validates if a crop_type_id belongs to the given crop.
 */
export function isValidCropType(
  crop: string | null | undefined,
  typeId: string | null | undefined
): boolean {
  if (!typeId) return false;
  const canonical = normalizeCropName(crop);
  const options = APPROVED_CROP_TYPE_CATALOG[canonical];
  if (!options) return false;
  const target = typeId.trim().toLowerCase();
  return options.some((opt) => opt.id === target || opt.aliases?.includes(target));
}

/**
 * Returns the user-facing label for a given crop and crop_type_id, or null if not found.
 */
export function getCropTypeLabel(
  crop: string | null | undefined,
  typeId: string | null | undefined
): string | null {
  if (!typeId) return null;
  const canonical = normalizeCropName(crop);
  const options = APPROVED_CROP_TYPE_CATALOG[canonical];
  if (!options) return null;
  const target = typeId.trim().toLowerCase();
  const found = options.find((opt) => opt.id === target || opt.aliases?.includes(target));
  return found ? found.label : null;
}
