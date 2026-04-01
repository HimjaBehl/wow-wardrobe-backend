function guessSilhouette(text = "") {
  const t = (text || "").toLowerCase();

  // One-piece anchors
  if (/dress|jumpsuit|gown/.test(t)) return "anchor";

  // Tops
  if (/shirt|top|blouse|t-shirt|tank/.test(t)) {
    if (/oversized|loose|boxy/.test(t)) return "upper-oversized";
    if (/slim|fitted|bodycon/.test(t)) return "upper-fitted";
    if (/flowy|ruffle/.test(t)) return "upper-flowy";
    return "upper";
  }

  // Bottoms
  if (/pants|jeans|trousers/.test(t)) {
    if (/wide|flared|bootcut/.test(t)) return "lower-wide";
    if (/skinny|slim/.test(t)) return "lower-fitted";
    return "lower";
  }
  if (/skirt/.test(t)) {
    if (/pleated|a-line/.test(t)) return "lower-flowy";
    return "lower";
  }
  if (/shorts/.test(t)) return "lower";

  // Outerwear
  if (/jacket|coat|blazer/.test(t)) {
    if (/oversized|longline/.test(t)) return "outer-oversized";
    return "outer";
  }

  // Accessories / Footwear
  if (/shoe|sandal|boot|heel|sneaker/.test(t)) return "footwear";
  if (/bag|purse|clutch|backpack/.test(t)) return "bag";
  if (/belt|scarf|jewel|watch|sunglass/.test(t)) return "accessory";

  return "misc";
}

function pickPalette(color) {
  // Simple color palette mapping
  const c = (color || "").toLowerCase();
  if (/red|pink|coral/.test(c)) return "warm";
  if (/blue|green|purple/.test(c)) return "cool";
  if (/black|white|grey|beige/.test(c)) return "neutral";
  return "mixed";
}

const fashionTags = {
  guessSilhouette,
  pickPalette,
  silhouetteRole: guessSilhouette // alias for backward compatibility
};

export default fashionTags;
export { guessSilhouette };
