// lib/normalizeCategory.js
export function normalizeCategory(rawCat = "", rawName = "") {
  const txt = (rawCat || rawName || "").toLowerCase();

  // Dresses
  if (/dress|gown|jumpsuit/.test(txt)) return "Dress";

  // Tops
  if (/shirt|top|blouse|t[- ]?shirt|polo|kurta/.test(txt)) return "Top";

  // Bottoms
  if (/jeans|pants|shorts|skirt|trousers?|chinos|leggings|joggers/.test(txt))
    return "Bottom";

  // Outerwear
  if (/jacket|coat|hoodie|blazer|sweater|cardigan|peacoat/.test(txt))
    return "Outerwear";

  // Footwear
  if (/shoe|sneaker|heel|boot|loafer|sandal|mule|trainer/.test(txt))
    return "Footwear";

  // Accessories
  if (/bag|watch|jewel|bracelet|ring|sunglass|belt|scarf|tie/.test(txt))
    return "Accessory";

  return "Misc";
}
