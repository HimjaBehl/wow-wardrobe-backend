// lib/occasionMap.js
// Use broad tokens that match normalized categories + common names.
// Core tokens that MUST appear across occasions for completeness:
// 'top','bottom','dress','jumpsuit','footwear','shoes','sneakers','sandals','heels','outerwear','jacket','coat','accessory','bag','handbag','tote','belt'

export const occasionCategoryMap = {
  "workwear": [
    // core
    "top", "shirt", "blouse",
    "bottom", "trousers", "pants", "chinos",
    "outerwear", "blazer", "jacket", "coat",
    "footwear", "formal shoes", "loafers", "oxford",
    "accessory", "belt", "watch", "bag", "handbag", "tote"
  ],

  "casual": [
    // core
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
    "dress", "gown", "lehenga", "saree", "kurta", "kurta set", "anarkali", "sherwani",
    "footwear", "heels", "juttis", "shoes",
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
    "dress", "gown", "blazer dress",
    "outerwear", "blazer", "coat",
    "footwear", "heels", "shoes",
    "accessory", "clutch", "evening bag", "jewelry", "bag"
  ],

  "interview / presentation": [
    "top", "shirt", "blouse",
    "bottom", "trousers", "pants",
    "outerwear", "blazer", "coat",
    "footwear", "formal shoes", "loafers", "oxford",
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
    "footwear", "loafers", "shoes",
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
