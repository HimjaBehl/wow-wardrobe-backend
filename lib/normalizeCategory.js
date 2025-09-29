// lib/normalizeCategory.js
export function normalizeCategory(rawCat = "", rawName = "") {
  const txt = (rawCat || rawName || "").toLowerCase();

  if (/dress|jumpsuit/.test(txt)) return "Dress";
  if (/shirt|top|blouse|t[- ]?shirt|upper/.test(txt)) return "Top";
  if (/jeans|pants|shorts|skirt|trousers?|bottom/.test(txt)) return "Bottom";
  if (/shoe|sneaker|heel|boot|loafer|sandal|footwear/.test(txt)) return "Footwear";
  if (/jacket|coat|hoodie|outerwear/.test(txt)) return "Outerwear";
  if (/bag|watch|jewel|bracelet|ring|sunglass|belt|scarf/.test(txt)) return "Accessory";

  return "Misc";
}
