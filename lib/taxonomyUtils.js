// taxonomyUtils.js

// Example taxonomy (expandable)
const TAXONOMY = [
  { mainCategory: "Clothing", subCategory: "Tops", keywords: ["t shirt", "tshirt", "shirt", "blouse", "sweater", "hoodie", "top"] },
  { mainCategory: "Clothing", subCategory: "Dresses", keywords: ["dress", "gown"] },
  { mainCategory: "Clothing", subCategory: "Bottoms", keywords: ["pants", "trouser", "chinos", "jeans", "skirt", "shorts"] },
  { mainCategory: "Clothing", subCategory: "Outerwear", keywords: ["jacket", "coat", "blazer", "overalls", "peacoat"] },

  { mainCategory: "Footwear", subCategory: "Shoes", keywords: ["shoe", "sneaker", "loafer", "boot", "sandal", "heel", "mule", "trainer"] },

  { mainCategory: "Bags", subCategory: "Women's Bags", keywords: ["bag", "tote", "backpack", "crossbody", "handbag"] },

  { mainCategory: "Accessories", subCategory: "General", keywords: ["belt", "sunglass", "glasses", "bracelet", "watch", "jewel", "earring"] },
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
    case "Outerwear":
      return { layer: "outer", typicalOccasion: ["casual", "workwear", "cold-weather"] };
    case "Shoes":
      return { layer: "footwear", typicalOccasion: ["casual", "workwear", "formal"] };
    case "Women's Bags":
      return { layer: "bag", typicalOccasion: ["casual", "workwear", "party"] };
    case "General":
      return { layer: "accessory", typicalOccasion: ["all"] };
    default:
      return {};
  }
}
