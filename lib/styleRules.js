
import { harmonious } from "./colorRules.js";
import { guessSilhouette } from "./fashionTags.js";
import { isFabricSeasonal } from "./fashionBrain.js";

function validateLookAgainstRules(look, userRules = {}) {
  const items = look.items || [];
  const banned = userRules.bannedItems || [];
  const weather = userRules.weather || "";

  if (items.length < 3) {
    return { valid: false, errors: ["Look too small (need 3+ items)."] };
  }

  let hasTop = false;
  let hasBottom = false;
  let hasFootwear = false;
  let isDress = false;
  const errors = [];

  for (const item of items) {
    const category = (item.category || "").toLowerCase();
    const name = (item.name || "").toLowerCase();

    // ✅ Category checks
    if (["t-shirt", "shirt", "top", "blouse", "tank"].some(k => name.includes(k) || category.includes(k))) {
      hasTop = true;
    }
    if (["jeans", "shorts", "pants", "trousers", "skirt"].some(k => name.includes(k) || category.includes(k))) {
      hasBottom = true;
    }
    if (["footwear", "shoes", "heels", "sneakers", "sandals", "boots"].some(k => name.includes(k) || category.includes(k))) {
      hasFootwear = true;
    }
    if (["dress", "jumpsuit", "gown"].some(k => name.includes(k) || category.includes(k))) {
      isDress = true;
    }

    // ❌ Respect banned items
    const color = (item.color || "").toLowerCase();

    for (const ban of banned) {
      const b = ban.toLowerCase();
      if (
        name.includes(b) ||
        category.includes(b) ||
        color.includes(b)
      ) {
        errors.push(`Banned item/color: ${b}`);
      }
    }

    // ❌ Seasonal fabric mismatch
    if (!isFabricSeasonal(item, weather)) {
      errors.push(`Non-seasonal fabric: ${item.name} (${item.fabric})`);
    }
  }

  // ✅ Outfit completeness
  const fullSet = hasTop && hasBottom && hasFootwear;
  const onePieceSet = isDress && hasFootwear;
  if (!fullSet && !onePieceSet) {
    errors.push("Outfit missing balance: need Dress OR Top+Bottom + Footwear.");
  }

  // ❌ No mixing dress/jumpsuit with bottoms
  if (isDress && hasBottom) {
    return { valid: false, errors: ["Dress/jumpsuit cannot be paired with bottoms."] };
  }

  // ❌ Only one bag allowed
  const bags = items.filter(it => (it.category || "").toLowerCase().includes("bag"));
  if (bags.length > 1) {
    return { valid: false, errors: ["Multiple bags not allowed."] };
  }

  // ❌ Must always include footwear
  if (!hasFootwear) {
    return { valid: false, errors: ["Footwear is required."] };
  }

  // ✅ Silhouette balance (oversized vs fitted, flowy vs structured)
  const roles = items.map(it => guessSilhouette(it.name || it.category || ""));
  const anchors = roles.filter(r => r === "anchor").length;
  if (anchors > 1) errors.push("Multiple anchor pieces (e.g., 2 dresses/jumpsuits).");

  const hasOversized = roles.some(r => r.includes("oversized"));
  const hasFitted = roles.some(r => r.includes("fitted"));
  if (!((hasOversized && hasFitted) || roles.includes("anchor"))) {
    errors.push("Silhouette imbalance: try mixing oversized with fitted.");
  }

  // ✅ Color harmony
  const colors = items.map(it => it.color).filter(Boolean);
  if (colors.length >= 2 && !harmonious(colors)) {
    errors.push(`Clashing colors: ${colors.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Additional utility functions
const onePiece    = /dress|jumpsuit|one-piece/i;
const topwear     = /shirt|blouse|tee|kurta|sweater/i;
const bottomwear  = /jeans|pants|trouser|skirt|shorts/i;

function classify(cat="") {
  if (onePiece.test(cat))   return "onePiece";
  if (topwear.test(cat))    return "top";
  if (bottomwear.test(cat)) return "bottom";
  return "other";
}

function isValidCombo(items=[]) {
  let hasDress = false, hasTop = false, hasBottom = false;
  items.forEach(i => {
    const t = classify(i.category);
    if (t==="onePiece") hasDress  = true;
    if (t==="top")      hasTop    = true;
    if (t==="bottom")   hasBottom = true;
  });
  if (hasDress && (hasTop || hasBottom)) return false;
  if (!hasDress && (!hasTop || !hasBottom)) return false;
  return true;
}

function bansHeels(prefs={}) {
  return (prefs.dislikes||[]).some(d => /heel/i.test(d));
}

function needsLayer(items=[], weather="") {
  return /cold|rain|snow/i.test(weather) && !items.some(i=>/jacket|coat/i.test(i.category));
}

export { 
  validateLookAgainstRules,
  classify,
  isValidCombo,
  bansHeels,
  needsLayer
};
