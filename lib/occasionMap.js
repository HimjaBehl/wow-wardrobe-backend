// lib/occasionMap.js
// Gender-aware occasion category tokens.
//
// Core tokens that SHOULD appear across occasions for completeness:
// 'top','bottom','dress','jumpsuit','footwear','shoes','sneakers','sandals','heels','outerwear','jacket','coat','accessory','bag','handbag','tote','belt'

const FEMALE = "female";
const MALE = "male";

// ------------------------
// FEMALE MAP
// ------------------------
export const occasionCategoryMapFemale = {
  "workwear": [
    "top", "shirt", "blouse",
    "bottom", "trousers", "pants", "chinos",
    "outerwear", "blazer", "jacket", "coat",
    "footwear", "formal shoes", "loafers", "oxford", "heels",
    "accessory", "belt", "watch", "bag", "handbag", "tote"
  ],

  "casual": [
    "top", "t-shirt", "tee", "shirt",
    "bottom", "jeans", "pants", "shorts",
    "outerwear", "denim jacket", "jacket",
    "footwear", "shoes", "sneakers", "sandals",
    "accessory", "bag", "handbag", "cap"
  ],

  "party": [
    "dress", "jumpsuit", "co-ord",
    "top", "statement top",
    "bottom", "skirt", "pants",
    "footwear", "heels", "shoes",
    "accessory", "jewelry", "clutch", "bag"
  ],

  "wedding / festive": [
    "saree", "lehenga", "anarkali", "kurta set", "dress", "gown",
    "footwear", "heels", "juttis", "sandals", "shoes",
    "outerwear", "shawl",
    "accessory", "jewelry", "dupatta", "clutch", "bag"
  ],

  "date night": [
    "dress", "skirt", "co-ord",
    "top", "blouse",
    "bottom", "trousers", "pants",
    "outerwear", "blazer",
    "footwear", "heels", "shoes",
    "accessory", "sling bag", "bag"
  ],

  "travel / airport": [
    "top", "t-shirt", "hoodie",
    "bottom", "joggers", "leggings", "jeans",
    "outerwear", "jacket",
    "footwear", "sneakers", "shoes",
    "accessory", "crossbody bag", "backpack", "cap", "sunglasses", "bag"
  ],

  "athleisure": [
    "top", "sports bra", "oversized tee",
    "bottom", "tights", "track pants", "shorts",
    "outerwear", "zip hoodie",
    "footwear", "trainers", "sneakers", "shoes",
    "accessory", "gym bag", "bag"
  ],

  "brunch": [
    "dress", "wrap dress", "maxi dress", "jumpsuit",
    "top", "blouse",
    "bottom", "skirt", "pants",
    "footwear", "sandals", "mules", "shoes", "heels",
    "accessory", "straw bag", "bag", "handbag", "sunglasses"
  ],

  "dinner": [
    "dress",
    "top", "silk top", "blouse",
    "bottom", "trousers", "pants",
    "outerwear", "blazer",
    "footwear", "heels", "shoes",
    "accessory", "clutch", "bag"
  ],

  "gym / workout": [
    "top", "tank top", "sports bra",
    "bottom", "leggings", "shorts",
    "footwear", "trainers", "shoes",
    "accessory", "bag"
  ],

  "beach / resort": [
    "dress", "kaftan",
    "top", "cover-up",
    "bottom", "shorts",
    "footwear", "sandals", "flip-flops", "shoes",
    "accessory", "straw hat", "beach bag", "sunglasses", "bag"
  ],

  "formal event / gala": [
    "dress", "gown", "blazer dress", "jumpsuit",
    "outerwear", "blazer", "coat",
    "footwear", "heels", "shoes",
    "accessory", "clutch", "evening bag", "jewelry", "bag"
  ],

  "interview / presentation": [
    "top", "shirt", "blouse",
    "bottom", "trousers", "pants",
    "outerwear", "blazer", "coat",
    "footwear", "formal shoes", "loafers", "oxford", "heels",
    "accessory", "watch", "portfolio bag", "belt", "bag"
  ],

  "shopping / errands": [
    "top", "t-shirt", "hoodie",
    "bottom", "jeans", "pants",
    "footwear", "sneakers", "shoes", "sandals",
    "accessory", "crossbody bag", "bag", "cap"
  ],

  "concert / festival": [
    "top", "graphic tee",
    "bottom", "denim shorts", "pants",
    "footwear", "boots", "combat boots", "shoes", "sneakers",
    "outerwear", "jacket",
    "accessory", "belt bag", "hat", "bag", "jewelry"
  ],

  "winter": [
    "top", "sweater", "turtleneck",
    "outerwear", "coat", "jacket",
    "bottom", "pants",
    "footwear", "boots", "shoes",
    "accessory", "scarf", "beanie", "gloves", "bag"
  ],

  "summer": [
    "top", "tank top", "linen shirt", "t-shirt",
    "bottom", "shorts", "pants",
    "footwear", "sandals", "shoes",
    "accessory", "sunglasses", "sun hat", "bag"
  ],

  "streetwear / urban": [
    "top", "hoodie", "t-shirt", "oversized tee",
    "bottom", "cargo pants", "jeans",
    "outerwear", "jacket",
    "footwear", "sneakers", "shoes",
    "accessory", "crossbody bag", "bag", "cap"
  ],

  "business casual": [
    "top", "shirt", "blouse",
    "bottom", "chinos", "pants", "trousers",
    "outerwear", "blazer",
    "footwear", "loafers", "shoes", "heels",
    "accessory", "watch", "handbag", "bag", "belt"
  ],

  "adventure / hiking": [
    "top", "t-shirt",
    "bottom", "trek pants", "shorts",
    "outerwear", "windcheater", "jacket",
    "footwear", "hiking shoes", "boots", "shoes",
    "accessory", "backpack", "cap", "bag"
  ]
};

// ------------------------
// MALE MAP
// ------------------------
export const occasionCategoryMapMale = {
  "workwear": [
    "top", "shirt",
    "bottom", "trousers", "pants", "chinos",
    "outerwear", "blazer", "jacket", "coat",
    "footwear", "formal shoes", "loafers", "oxford",
    "accessory", "belt", "watch", "bag", "tote"
  ],

  "casual": [
    "top", "t-shirt", "tee", "shirt",
    "bottom", "jeans", "pants", "shorts",
    "outerwear", "denim jacket", "jacket",
    "footwear", "shoes", "sneakers", "sandals",
    "accessory", "bag", "cap"
  ],

  "party": [
    "top", "shirt",
    "bottom", "pants", "trousers",
    "outerwear", "blazer", "jacket",
    "footwear", "shoes", "loafers",
    "accessory", "watch", "belt", "bag"
  ],

  "wedding / festive": [
    "kurta", "kurta set", "sherwani", "bandhgala", "nehru jacket",
    "bottom", "churidar", "pants",
    "footwear", "juttis", "mojari", "shoes", "loafers",
    "outerwear", "shawl",
    "accessory", "stole", "watch", "belt", "bag"
  ],

  "date night": [
    "top", "shirt",
    "bottom", "trousers", "pants",
    "outerwear", "blazer", "jacket",
    "footwear", "shoes", "loafers",
    "accessory", "watch", "belt", "bag"
  ],

  "travel / airport": [
    "top", "t-shirt", "hoodie",
    "bottom", "joggers", "track pants", "jeans",
    "outerwear", "jacket",
    "footwear", "sneakers", "shoes",
    "accessory", "backpack", "cap", "sunglasses", "bag"
  ],

  "athleisure": [
    "top", "sports tee", "oversized tee",
    "bottom", "track pants", "shorts",
    "outerwear", "zip hoodie",
    "footwear", "trainers", "sneakers", "shoes",
    "accessory", "gym bag", "bag"
  ],

  "brunch": [
    "top", "shirt", "polo",
    "bottom", "pants", "shorts",
    "footwear", "shoes", "loafers", "sneakers",
    "accessory", "watch", "sunglasses", "bag"
  ],

  "dinner": [
    "top", "shirt",
    "bottom", "trousers", "pants",
    "outerwear", "blazer",
    "footwear", "shoes", "loafers",
    "accessory", "watch", "belt", "bag"
  ],

  "gym / workout": [
    "top", "tank top", "sports tee",
    "bottom", "shorts", "track pants",
    "footwear", "trainers", "shoes",
    "accessory", "bag"
  ],

  "beach / resort": [
    "top", "linen shirt", "t-shirt",
    "bottom", "shorts",
    "footwear", "sandals", "flip-flops", "shoes",
    "accessory", "sunglasses", "cap", "beach bag", "bag"
  ],

  "formal event / gala": [
    "top", "shirt",
    "outerwear", "blazer", "coat", "suit",
    "bottom", "trousers", "pants",
    "footwear", "formal shoes", "loafers", "oxford",
    "accessory", "watch", "belt", "bag"
  ],

  "interview / presentation": [
    "top", "shirt",
    "bottom", "trousers", "pants",
    "outerwear", "blazer", "coat",
    "footwear", "formal shoes", "loafers", "oxford",
    "accessory", "watch", "portfolio bag", "belt", "bag"
  ],

  "shopping / errands": [
    "top", "t-shirt", "hoodie",
    "bottom", "jeans", "pants",
    "footwear", "sneakers", "shoes", "sandals",
    "accessory", "bag", "cap"
  ],

  "concert / festival": [
    "top", "graphic tee",
    "bottom", "shorts", "pants",
    "footwear", "boots", "combat boots", "shoes", "sneakers",
    "outerwear", "jacket",
    "accessory", "belt bag", "hat", "bag"
  ],

  "winter": [
    "top", "sweater", "turtleneck",
    "outerwear", "coat", "jacket",
    "bottom", "pants",
    "footwear", "boots", "shoes",
    "accessory", "scarf", "beanie", "gloves", "bag"
  ],

  "summer": [
    "top", "linen shirt", "t-shirt",
    "bottom", "shorts", "pants",
    "footwear", "sandals", "shoes",
    "accessory", "sunglasses", "cap", "bag"
  ],

  "streetwear / urban": [
    "top", "hoodie", "t-shirt", "oversized tee",
    "bottom", "cargo pants", "jeans",
    "outerwear", "jacket",
    "footwear", "sneakers", "shoes",
    "accessory", "crossbody bag", "bag", "cap"
  ],

  "business casual": [
    "top", "shirt", "polo",
    "bottom", "chinos", "pants", "trousers",
    "outerwear", "blazer",
    "footwear", "loafers", "shoes",
    "accessory", "watch", "bag", "belt"
  ],

  "adventure / hiking": [
    "top", "t-shirt",
    "bottom", "trek pants", "shorts",
    "outerwear", "windcheater", "jacket",
    "footwear", "hiking shoes", "boots", "shoes",
    "accessory", "backpack", "cap", "bag"
  ]
};

// ------------------------
// Backward-compatible default export name
// ------------------------
// If gender isn't provided, keep the old "mixed" behavior by defaulting to Female map,
// OR you can switch this to a merged map if you want neutral behavior.
export const occasionCategoryMap = occasionCategoryMapFemale;

// Helper used by the route/reranker
export function getOccasionCategoryMap(gender) {
  const g = (gender || "").toLowerCase();
  if (g === MALE) return occasionCategoryMapMale;
  if (g === FEMALE) return occasionCategoryMapFemale;
  return occasionCategoryMap; // default fallback
}
