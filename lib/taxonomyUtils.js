// taxonomyUtils.js

// Expanded taxonomy with better coverage
const TAXONOMY = [
  // --- CLOTHING ---
  { mainCategory: "Clothing", subCategory: "Tops", keywords: ["t shirt", "tshirt", "shirt", "blouse", "sweater", "hoodie", "top", "polo"] },
  { mainCategory: "Clothing", subCategory: "Dresses", keywords: ["dress", "gown", "maxi", "midi", "little black dress"] },
  { mainCategory: "Clothing", subCategory: "Bottoms", keywords: ["pants", "trouser", "chinos", "jeans", "skirt", "shorts"] },
  { mainCategory: "Clothing", subCategory: "Suits", keywords: ["suit", "tuxedo", "formal jacket", "blazer"] },
  { mainCategory: "Clothing", subCategory: "Outerwear", keywords: ["jacket", "coat", "overalls", "peacoat", "cardigan"] },
  { mainCategory: "Clothing", subCategory: "Activewear", keywords: ["sportswear", "joggers", "tracksuit", "leggings"] },

  // --- FOOTWEAR ---
  { mainCategory: "Footwear", subCategory: "Sneakers", keywords: ["sneaker", "trainer", "running shoes"] },
  { mainCategory: "Footwear", subCategory: "Formal Shoes", keywords: ["oxford", "loafer", "derby", "dress shoe"] },
  { mainCategory: "Footwear", subCategory: "Heels", keywords: ["heel", "stiletto", "pump", "pumps"] },
  { mainCategory: "Footwear", subCategory: "Boots", keywords: ["boot", "ankle boot", "chelsea", "combat boot"] },
  { mainCategory: "Footwear", subCategory: "Sandals", keywords: ["sandal", "mule", "flip flop", "slides"] },

  // --- BAGS ---
  { mainCategory: "Bags", subCategory: "Handbags", keywords: ["handbag", "purse", "tote", "hobo bag"] },
  { mainCategory: "Bags", subCategory: "Crossbody", keywords: ["crossbody", "sling bag"] },
  { mainCategory: "Bags", subCategory: "Backpacks", keywords: ["backpack", "rucksack"] },
  { mainCategory: "Bags", subCategory: "Luxury Bags", keywords: ["clutch", "shoulder bag", "designer bag"] },

  // --- ACCESSORIES ---
  { mainCategory: "Accessories", subCategory: "Belts", keywords: ["belt"] },
  { mainCategory: "Accessories", subCategory: "Eyewear", keywords: ["sunglass", "glasses"] },
  { mainCategory: "Accessories", subCategory: "Jewelry", keywords: ["bracelet", "watch", "jewel", "earring", "necklace"] },
  { mainCategory: "Accessories", subCategory: "General", keywords: ["scarf", "hat", "cap"] },
];

export function findCategory(input) {
  const text = (input || "").toLowerCase();

  for (const entry of TAXONOMY) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      return entry;
    }
  }
  return null;
}

export function getAttributes(subCategory) {
  switch (subCategory) {
    case "Tops":
      return { layer: "upper", typicalOccasion: ["casual", "workwear", "party"] };
    case "Dresses":
      return { layer: "anchor", typicalOccasion: ["party", "formal", "casual"] };
    case "Bottoms":
      return { layer: "lower", typicalOccasion: ["casual", "workwear"] };
    case "Suits":
      return { layer: "outer", typicalOccasion: ["workwear", "formal"] };
    case "Outerwear":
      return { layer: "outer", typicalOccasion: ["casual", "workwear", "cold-weather"] };
    case "Activewear":
      return { layer: "lower", typicalOccasion: ["casual", "travel", "athletic"] };

    case "Sneakers":
      return { layer: "footwear", typicalOccasion: ["casual", "travel", "athletic"] };
    case "Formal Shoes":
      return { layer: "footwear", typicalOccasion: ["workwear", "formal"] };
    case "Heels":
      return { layer: "footwear", typicalOccasion: ["party", "wedding", "formal"] };
    case "Boots":
      return { layer: "footwear", typicalOccasion: ["casual", "cold-weather", "party"] };
    case "Sandals":
      return { layer: "footwear", typicalOccasion: ["casual", "party", "travel"] };

    case "Handbags":
    case "Crossbody":
    case "Backpacks":
    case "Luxury Bags":
      return { layer: "bag", typicalOccasion: ["casual", "workwear", "party"] };

    case "Belts":
      return { layer: "accessory", typicalOccasion: ["casual", "workwear", "party"] };
    case "Eyewear":
      return { layer: "accessory", typicalOccasion: ["casual", "workwear", "travel"] };
    case "Jewelry":
      return { layer: "accessory", typicalOccasion: ["party", "wedding", "casual", "formal"] };
    case "General":
      return { layer: "accessory", typicalOccasion: ["all"] };
    default:
      return {};
  }
}

// ✅ Export taxonomy for use in hydration
export const taxonomy = TAXONOMY;
