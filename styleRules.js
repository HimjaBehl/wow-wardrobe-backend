import { harmonious } from "./colorRules.js";
import { guessSilhouette } from "./fashionTags.js";
import { isFabricSeasonal } from "./fashionBrain.js";

// ───────────────────────────────
// ✅ LEVEL 1 VALIDATION (Beginner)
// ───────────────────────────────
export function validateLevel1(look) {
  const items = look.items || [];
  const cats = items.map(it => (it.category || "").toLowerCase());

  // Must include Top, Bottom, Footwear
  if (!(cats.includes("top") && cats.includes("bottom") && cats.includes("footwear"))) {
    return false;
  }

  // No Dress or Jumpsuit allowed
  if (cats.includes("dress") || cats.includes("jumpsuit")) return false;

  return true;
}

// ───────────────────────────────
// ✅ LEVEL 2 VALIDATION (Intermediate)
// Adds Color Harmony + Silhouette Balance
// ───────────────────────────────
export function validateLevel2(look) {
  const items = look.items || [];
  const errors = [];

  let hasTop = false;
  let hasBottom = false;
  let hasFootwear = false;
  let isDress = false;

  for (const item of items) {
    const cat = (item.category || "").toLowerCase();
    const name = (item.name || "").toLowerCase();

    if (/t-?shirt|shirt|top|blouse|tank/.test(name) || /top/.test(cat)) hasTop = true;
    if (/jeans|shorts|pants|trousers|skirt/.test(name) || /bottom/.test(cat)) hasBottom = true;
    if (/footwear|shoes|heels|sneakers|sandals|boots/.test(name) || /footwear/.test(cat)) hasFootwear = true;
    if (/dress|jumpsuit|gown/.test(name) || /dress|jumpsuit/.test(cat)) isDress = true;
  }

  // ✅ Outfit completeness
  const fullSet = hasTop && hasBottom && hasFootwear;
  const onePieceSet = isDress && hasFootwear;
  if (!fullSet && !onePieceSet) {
    errors.push("Outfit must include either (Top + Bottom + Footwear) OR (Dress/Jumpsuit + Footwear).");
  }

  // ❌ No mixing Dress with Bottoms
  if (isDress && hasBottom) {
    errors.push("Dress/jumpsuit cannot be paired with bottoms.");
  }

  // ❌ Multiple bags not allowed
  const bags = items.filter(it => (it.category || "").toLowerCase().includes("bag"));
  if (bags.length > 1) errors.push("Multiple bags not allowed.");

  // ❌ Must always include footwear
  if (!hasFootwear) errors.push("Footwear is required.");

  // ✅ Silhouette balance
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

// ───────────────────────────────
// ✅ GENERAL VALIDATOR (used in index.js)
// Respects userRules (banned items, weather, fabrics)
// ───────────────────────────────
export function validateLookAgainstRules(look, userRules = {}) {
  const items = look.items || [];
  const banned = userRules.bannedItems || [];
  const weather = userRules.weather || "";

  const errors = [];
  let hasTop = false;
  let hasBottom = false;
  let hasFootwear = false;
  let isDress = false;

  for (const item of items) {
    const cat = (item.category || "").toLowerCase();
    const name = (item.name || "").toLowerCase();
    const color = (item.color || "").toLowerCase();

    if (/t-?shirt|shirt|top|blouse|tank/.test(name) || /top/.test(cat)) hasTop = true;
    if (/jeans|shorts|pants|trousers|skirt/.test(name) || /bottom/.test(cat)) hasBottom = true;
    if (/footwear|shoes|heels|sneakers|sandals|boots/.test(name) || /footwear/.test(cat)) hasFootwear = true;
    if (/dress|jumpsuit|gown/.test(name) || /dress|jumpsuit/.test(cat)) isDress = true;

    // ❌ Respect banned items
    for (const ban of banned) {
      const b = ban.toLowerCase();
      if (name.includes(b) || cat.includes(b) || color.includes(b)) {
        errors.push(`Banned item/color: ${b}`);
      }
    }

    // ❌ Seasonal fabric mismatch
    if (!isFabricSeasonal(item, weather)) {
      errors.push(`Non-seasonal fabric: ${item.name} (${item.fabric})`);
    }
  }

  // ✅ Completeness
  const fullSet = hasTop && hasBottom && hasFootwear;
  const onePieceSet = isDress && hasFootwear;
  if (!fullSet && !onePieceSet) {
    errors.push("Outfit missing balance: need Dress OR Top+Bottom + Footwear.");
  }

  // ❌ No mixing Dress with Bottoms
  if (isDress && hasBottom) {
    errors.push("Dress/jumpsuit cannot be paired with bottoms.");
  }

  // ❌ Only one bag allowed
  const bags = items.filter(it => (it.category || "").toLowerCase().includes("bag"));
  if (bags.length > 1) {
    errors.push("Multiple bags not allowed.");
  }

  // ❌ Must always include footwear
  if (!hasFootwear) {
    errors.push("Footwear is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
