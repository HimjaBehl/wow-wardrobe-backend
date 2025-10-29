// normalizeCategory.js

// Prefer Blazer > Coat > Jacket when occasion calls for polish.
// Returns a numeric priority: 3 (blazer), 2 (coat), 1 (jacket), 0 (other)
export function outerwearPriority(category = "", name = "") {
  const s = `${(category || "").toLowerCase()} ${(name || "").toLowerCase()}`;
  if (s.includes("blazer")) return 3;
  if (s.includes("coat"))   return 2;
  if (s.includes("jacket")) return 1;
  return 0;
}

export function normalizeCategory(category, name = "") {
  const cleanCategory = (category || "").toLowerCase();
  const cleanName = (name || "").toLowerCase();

  // Priority: use explicit category if it's strong enough
  if (cleanCategory.includes("top")) return "Top";
  if (cleanCategory.includes("dress")) return "Dress";
  if (cleanCategory.includes("bottom") || cleanCategory.includes("pants") || cleanCategory.includes("trousers")) return "Bottom";
  if (cleanCategory.includes("outerwear") || cleanCategory.includes("jacket") || cleanCategory.includes("coat") || cleanCategory.includes("blazer")) return "Outerwear";
  if (cleanCategory.includes("footwear") || cleanCategory.includes("shoes") || cleanCategory.includes("sneakers") || cleanCategory.includes("sandals") || cleanCategory.includes("boots")) return "Footwear";
  if (cleanCategory.includes("bag")) return "Bag";
  if (cleanCategory.includes("accessory") || cleanCategory.includes("belt") || cleanCategory.includes("sunglass") || cleanCategory.includes("bracelet") || cleanCategory.includes("jewellery") || cleanCategory.includes("jewelry")) return "Accessory";

  // Secondary: infer from name if category was weak (like "Misc")
  if (cleanName.includes("t shirt") || cleanName.includes("tshirt") || cleanName.includes("shirt") || cleanName.includes("blouse") || cleanName.includes("sweater") || cleanName.includes("hoodie")) return "Top";
  if (cleanName.includes("dress")) return "Dress";
  if (cleanName.includes("skirt") || cleanName.includes("shorts") || cleanName.includes("jeans") || cleanName.includes("trouser") || cleanName.includes("chinos")) return "Bottom";
  if (cleanName.includes("jacket") || cleanName.includes("coat") || cleanName.includes("blazer") || cleanName.includes("overalls") || cleanName.includes("peacoat")) return "Outerwear";
  if (cleanName.includes("sneaker") || cleanName.includes("shoe") || cleanName.includes("loafer") || cleanName.includes("boot") || cleanName.includes("sandal") || cleanName.includes("heel") || cleanName.includes("mule") || cleanName.includes("trainer")) return "Footwear";
  if (cleanName.includes("bag") || cleanName.includes("tote") || cleanName.includes("backpack")) return "Bag";
  if (cleanName.includes("belt") || cleanName.includes("sunglass") || cleanName.includes("bracelet") || cleanName.includes("watch") || cleanName.includes("jewel") || cleanName.includes("earring")) return "Accessory";

  // Default fallback
  return "Misc";
}
