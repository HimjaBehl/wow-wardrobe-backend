// lib/normalizeCategory.js
export function normalizeCategory(rawCat = "", rawName = "") {
  const txt = (rawCat || rawName || "").toLowerCase();

  if (/dress|jumpsuit/.test(txt)) return "Dress";
  if (/shirt|top|blouse|t[- ]?shirt|upper|formal shirt|polo/.test(txt)) return "Top";
  if (/jeans|pants|shorts|skirt|trousers?|bottom|chinos/.test(txt)) return "Bottom";
  if (/shoe|sneaker|heel|boot|loafer|sandal|footwear/.test(txt)) return "Footwear";
  if (/jacket|coat|hoodie|blazer|outerwear/.test(txt)) return "Outerwear";
  if (/bag|watch|jewel|bracelet|ring|sunglass|belt|scarf|tie/.test(txt)) return "Accessory";

  return "Misc";
}
