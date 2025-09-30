// taxonomyUtils.js

// 🔖 Expanded taxonomy
const TAXONOMY = [
  // CLOTHING
  { mainCategory: "Clothing", subCategory: "Tops", keywords: ["t shirt", "tshirt", "shirt", "blouse", "sweater", "hoodie", "top", "tank", "camisole"] },
  { mainCategory: "Clothing", subCategory: "Dresses", keywords: ["dress", "gown", "maxi dress", "mini dress", "cocktail dress", "evening dress", "blouse dress", "casual dresses", "little black dress"] },
  { mainCategory: "Clothing", subCategory: "Bottoms", keywords: ["pants", "trouser", "chinos", "jeans", "skirt", "shorts", "leggings", "joggers"] },
  { mainCategory: "Clothing", subCategory: "Outerwear", keywords: ["jacket", "coat", "blazer", "overalls", "peacoat", "denim jacket", "cardigan", "parka", "trench"] },
  { mainCategory: "Clothing", subCategory: "Suits", keywords: ["suit", "formal suit", "blazer suit"] },

  // FOOTWEAR
  { mainCategory: "Footwear", subCategory: "Sneakers", keywords: ["sneaker", "trainer", "running shoes", "sports shoes"] },
  { mainCategory: "Footwear", subCategory: "Heels", keywords: ["heel", "heeks", "stiletto", "pump", "high heel", "block heel"] },
  { mainCategory: "Footwear", subCategory: "Sandals", keywords: ["sandal", "flip flop", "open feet shoes", "slippers", "slides"] },
  { mainCategory: "Footwear", subCategory: "Boots", keywords: ["boot", "ankle boot", "chelsea boot", "combat boot", "knee high boot"] },
  { mainCategory: "Footwear", subCategory: "Loafers", keywords: ["loafer", "moccasin"] },
  { mainCategory: "Footwear", subCategory: "Footwear Misc", keywords: ["shoe", "footwear"] },

  // BAGS
  { mainCategory: "Bags", subCategory: "Handbags", keywords: ["handbag", "purse", "shoulder bag"] },
  { mainCategory: "Bags", subCategory: "Crossbody", keywords: ["crossbody", "sling bag", "messenger bag", "mini bag"] },
  { mainCategory: "Bags", subCategory: "Tote Bags", keywords: ["tote", "shopper bag"] },
  { mainCategory: "Bags", subCategory: "Backpacks", keywords: ["backpack", "rucksack"] },
  { mainCategory: "Bags", subCategory: "Bucket Bags", keywords: ["bucket bag"] },
  { mainCategory: "Bags", subCategory: "Clutches", keywords: ["clutch"] },
  { mainCategory: "Bags", subCategory: "Wallets", keywords: ["wallet", "cardholder"] },
  { mainCategory: "Bags", subCategory: "Bag Misc", keywords: ["bag"] },

  // ACCESSORIES
  { mainCategory: "Accessories", subCategory: "Belts", keywords: ["belt"] },
  { mainCategory: "Accessories", subCategory: "Eyewear", keywords: ["sunglass", "glasses", "goggles", "spectacles", "eyewear", "sunglasses"] },
  { mainCategory: "Accessories", subCategory: "Jewelry", keywords: ["bracelet", "necklace", "ring", "earring", "jewel", "pendant", "bangle", "anklet", "jewellery"] },
  { mainCategory: "Accessories", subCategory: "Hats", keywords: ["hat", "cap", "beanie"] },
  { mainCategory: "Accessories", subCategory: "Scarves", keywords: ["scarf", "shawl", "dupatta"] },
  { mainCategory: "Accessories", subCategory: "Watches", keywords: ["watch"] },
  { mainCategory: "Accessories", subCategory: "Accessory Misc", keywords: ["accessory"] },
];

// 🔍 Category finder
export function findCategory(input) {
  const text = (input || "").toLowerCase();

  for (const entry of TAXONOMY) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      return entry;
    }
  }
  return null;
}

// 🎯 Attributes per subCategory
export function getAttributes(subCategory) {
  switch (subCategory) {
    // CLOTHING
    case "Tops":
      return { layer: "upper", typicalOccasion: ["casual", "workwear", "party"] };
    case "Dresses":
      return { layer: "anchor", typicalOccasion: ["party", "formal", "casual"] };
    case "Bottoms":
      return { layer: "lower", typicalOccasion: ["casual", "workwear"] };
    case "Outerwear":
      return { layer: "outer", typicalOccasion: ["casual", "workwear", "cold-weather"] };
    case "Suits":
      return { layer: "outer", typicalOccasion: ["workwear", "formal"] };

    // FOOTWEAR
    case "Sneakers":
      return { layer: "footwear", typicalOccasion: ["casual", "travel", "athletic"] };
    case "Heels":
      return { layer: "footwear", typicalOccasion: ["formal", "party"] };
    case "Sandals":
      return { layer: "footwear", typicalOccasion: ["casual", "party", "travel"] };
    case "Boots":
      return { layer: "footwear", typicalOccasion: ["casual", "cold-weather", "formal"] };
    case "Loafers":
      return { layer: "footwear", typicalOccasion: ["casual", "workwear"] };
    case "Footwear Misc":
      return { layer: "footwear", typicalOccasion: ["casual"] };

    // BAGS
    case "Handbags":
    case "Crossbody":
    case "Tote Bags":
    case "Backpacks":
    case "Bucket Bags":
    case "Clutches":
    case "Wallets":
    case "Bag Misc":
      return { layer: "bag", typicalOccasion: ["casual", "workwear", "party"] };

    // ACCESSORIES
    case "Belts":
      return { layer: "accessory", typicalOccasion: ["casual", "workwear", "party"] };
    case "Eyewear":
      return { layer: "accessory", typicalOccasion: ["casual", "workwear", "travel"] };
    case "Jewelry":
      return { layer: "accessory", typicalOccasion: ["party", "wedding", "casual", "formal"] };
    case "Hats":
    case "Scarves":
    case "Watches":
    case "Accessory Misc":
      return { layer: "accessory", typicalOccasion: ["casual"] };

    default:
      return {};
  }
}

// ✅ Export taxonomy
export const taxonomy = TAXONOMY;
