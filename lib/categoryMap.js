// 🔥 Core category definitions for Tina's Week 1 training
export const coreCategories = {
  Top: [
    "t-shirt", "shirt", "blouse", "tank", "sweater", "hoodie", "kurti", "top"
  ],
  Bottom: [
    "jeans", "pants", "trousers", "skirt", "shorts", "leggings", "palazzo"
  ],
  Footwear: [
    "sneakers", "boots", "heels", "sandals", "loafers", "juttis", "shoes", "footwear"
  ],
  Accessory: [
    "bag", "belt", "watch", "jewelry", "scarf", "sunglasses", "accessory"
  ],
  Dress: [
    "dress", "jumpsuit", "romper", "gown", "anarkali", "one-piece"
  ]
};

// 🔎 Map a raw name or category string → Core category
export function mapToCoreCategory(name = "") {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(coreCategories)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "Misc";
}
