// lib/fashionBrain.js

import { harmonious } from "./colorRules.js";
import { guessSilhouette } from "./fashionTags.js";

// ─── CATEGORY BALANCE ───────────────────────────────
function isCategoryBalanced(items) {
  const cats = items.map(it => (it.category || "").toLowerCase());

  const hasDress = cats.some(c => c.includes("dress"));
  const hasTop = cats.some(c => ["top", "shirt", "blouse", "t-shirt"].some(t => c.includes(t)));
  const hasBottom = cats.some(c => ["pants", "jeans", "trousers", "skirt", "shorts"].some(b => c.includes(b)));

  // Valid if: dress OR (top + bottom)
  return hasDress || (hasTop && hasBottom);
}

// ─── FABRIC & WEATHER ───────────────────────────────
function isFabricSeasonal(item, weather = "") {
  const fabric = (item.fabric || "").toLowerCase();
  const w = (weather || "").toLowerCase();

  if (!fabric) return true; // no data → allow

  const summer = ["cotton", "linen", "rayon", "chiffon", "silk"];
  const winter = ["wool", "cashmere", "velvet", "fleece", "knit", "leather"];
  const rain = ["nylon", "polyester", "gore-tex", "synthetic"];

  if (/hot|summer|sun/.test(w)) {
    return summer.some(f => fabric.includes(f));
  }
  if (/cold|winter|snow/.test(w)) {
    return winter.some(f => fabric.includes(f));
  }
  if (/rain|storm|wet/.test(w)) {
    return rain.some(f => fabric.includes(f)) && !/suede/.test(fabric);
  }

  return true;
}

// ─── SILHOUETTE BALANCE ───────────────────────────────
function isSilhouetteBalanced(items) {
  const roles = items.map(it => guessSilhouette(it.name || it.category || ""));

  // ❌ Rule: Disallow duplicate anchors
  const anchors = roles.filter(r => r === "anchor").length;
  if (anchors > 1) return false;

  // ✅ Rule: Encourage contrast (oversized + fitted, flowy + structured)
  const hasOversized = roles.some(r => r.includes("oversized"));
  const hasFitted = roles.some(r => r.includes("fitted"));
  const hasFlowy = roles.some(r => r.includes("flowy"));
  const hasStructured = roles.some(r => r.includes("tailored") || r.includes("structured"));

  if (hasOversized && hasFitted) return true;
  if (hasFlowy && hasStructured) return true;

  // Otherwise allow but warn
  return true;
}


// ─── COLOR THEORY ───────────────────────────────
function isColorBalanced(items) {
  const colors = items.map(it => it.color).filter(Boolean);

  if (colors.length < 2) return true; // not enough colors to compare
  return harmonious(colors);
}

// ─── MAIN LOOK VALIDATOR ───────────────────────────────
function validateLook(items, context = {}) {
  const { weather } = context;

  const errors = [];

  if (!isCategoryBalanced(items)) {
    errors.push("Outfit missing balance: need Dress OR Top+Bottom.");
  }

  const badFabrics = items.filter(it => !isFabricSeasonal(it, weather));
  if (badFabrics.length) {
    errors.push(`Non-seasonal fabrics: ${badFabrics.map(it => it.name).join(", ")}`);
  }

  if (!isSilhouetteBalanced(items)) {
    errors.push("Silhouette clash: items don’t balance well.");
  }

  if (!isColorBalanced(items)) {
    errors.push("Colors don’t harmonize well.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export {
  isCategoryBalanced,
  isFabricSeasonal,
  isSilhouetteBalanced,
  isColorBalanced,
  validateLook,
};
