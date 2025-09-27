import { harmonious, isColorGoodForSkinTone } from "./colorRules.js";
import { guessSilhouette } from "./fashionTags.js";
import { isFabricSeasonal } from "./fashionBrain.js";

// Level 1 validation: Basic outfit completeness (Top + Bottom + Footwear, no dresses)
function validateLevel1(look) {
  const items = look.items || [];
  const cats = items.map(it => (it.category || "").toLowerCase());

  // Must include Top, Bottom, Footwear
  if (!(cats.includes("top") && cats.includes("bottom") && cats.includes("footwear"))) {
    return false;
  }

  // No Dress or Jumpsuit allowed at Level 1
  if (cats.includes("dress") || cats.includes("jumpsuit")) return false;

  return true;
}

// Level 2 validation: Enhanced rules with silhouette and color checks
function validateLevel2(look) {
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

function validateLookAgainstRules(look, userRules = {}) {
  const items = look.items || [];
  const banned = userRules.bannedItems || [];
  const weather = userRules.weather || "";
  const prefs = userRules.prefs || {};
  const occasion = userRules.occasion || "";

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

  // 🔥 NEW: Occasion-based rules
  errors.push(...occasionCheck(items, occasion));

  // 🔥 NEW: Accessory polish
  errors.push(...accessoryCheck(items));

  // 🔥 NEW: Weather rules
  errors.push(...weatherCheck(items, weather));

  // 🔥 NEW: Body shape awareness
  errors.push(...bodyShapeCheck(items, prefs));

  // 🔥 NEW: Complexion awareness
  errors.push(...complexionCheck(items, prefs));

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Advanced Rule Helpers ───────────────────────────────────────────
function occasionCheck(items = [], occasion = "") {
  const cats = items.map(i => (i.category || "").toLowerCase());
  const errors = [];

  if (/brunch|day/i.test(occasion)) {
    if (!cats.some(c => /dress|skirt|shorts|casual/i.test(c))) {
      errors.push("Brunch look should include a dress, skirt, or shorts.");
    }
    if (cats.some(c => /blazer|suit|formal/i.test(c))) {
      errors.push("Brunch look should not include formal pieces.");
    }
  }

  if (/formal|office|work/i.test(occasion)) {

    if (cats.some(c => /sneaker|flipflop|shorts/i.test(c))) {
      errors.push("Casual pieces not suitable for formal occasion.");
    }
  }
  if (/workout|sport/i.test(occasion)) {
    if (!cats.some(c => /sneaker|trainer/i.test(c))) {
      errors.push("Workout look must include sneakers.");
    }
  }
  if (/party|festive/i.test(occasion)) {
    if (!cats.some(c => /dress|heels|bling|gown/i.test(c))) {
      errors.push("Party look should include a dress, gown, or festive accessory.");
    }
  }

  return errors;
}

function accessoryCheck(items = []) {
  const hasAccessory = items.some(i =>
    /(bag|jewel|scarf|watch|belt|sunglass)/i.test(i.category || i.name || "")
  );
  return hasAccessory ? [] : ["Outfit missing accessory for styling polish."];
}

function weatherCheck(items = [], weather = "") {
  const errors = [];
  if (/cold|snow/i.test(weather)) {
    if (!items.some(i => /jacket|coat|sweater|hoodie/i.test(i.category))) {
      errors.push("Cold weather requires outerwear.");
    }
  }
  if (/rain/i.test(weather)) {
    if (!items.some(i => /boot|jacket/i.test(i.category))) {
      errors.push("Rainy weather requires waterproof boots or jacket.");
    }
  }
  if (/hot|sunny|humid/i.test(weather)) {
    if (items.some(i => /wool|leather|sweater|coat/i.test(i.category))) {
      errors.push("Hot weather outfit includes heavy fabric (not suitable).");
    }
  }
  return errors;
}

function bodyShapeCheck(items = [], prefs = {}) {
  const errors = [];
  const shape = (prefs.bodyShape || "").toLowerCase();

  if (shape.includes("pear")) {
    if (items.some(i => /tight skirt|skinny jeans/i.test(i.name))) {
      errors.push("Pear shape: avoid tight bottoms, prefer A-line or wide leg.");
    }
  }
  if (shape.includes("apple")) {
    if (items.some(i => /crop top|tight tee/i.test(i.name))) {
      errors.push("Apple shape: avoid tight tops, prefer flowy or structured.");
    }
  }
  if (shape.includes("rectangle")) {
    if (!items.some(i => /belt|layer|structured jacket/i.test(i.name))) {
      errors.push("Rectangle shape: add belt/layers to define waist.");
    }
  }

  return errors;
}

function complexionCheck(items = [], prefs = {}) {
  const tone = prefs.complexion || "";
  const errors = [];
  items.forEach(i => {
    if (!isColorGoodForSkinTone(i.color, tone)) {
      errors.push(`Color ${i.color} may clash with ${tone} complexion.`);
    }
  });
  return errors;
}

// ─── Utilities ───────────────────────────────────────────────────────
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
  validateLevel1,
  validateLevel2,
  classify,
  isValidCombo,
  bansHeels,
  needsLayer
};
