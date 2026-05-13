// ── Outfit Scoring Test Scenarios ──────────────────────────────────────────
// Run with: node --experimental-vm-modules testOutfitScoring.js
// (or: node testOutfitScoring.js if package.json has "type":"module")

import {
  scoreColorHarmony,
  scoreSilhouetteBalance,
  scoreWeatherFit,
  scoreOccasionFit,
  scoreAestheticConsistency,
  calculateOutfitScore,
} from "./lib/outfitScoring.js";

const PASS = "✅";
const FAIL = "❌";

function assert(label, condition, detail = "") {
  console.log(`${condition ? PASS : FAIL} ${label}${detail ? " — " + detail : ""}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const item = (name, category, color = "", tags = []) => ({ name, category, color, tags });

// ── Test 1: Female Casual Summer ─────────────────────────────────────────────
console.log("\n── Test 1: Female Casual Summer ──");
const casualSummer = [
  item("White linen shirt", "Top", "white", ["linen"]),
  item("Tailored beige shorts", "Bottom", "beige"),
  item("White leather sandals", "Footwear", "white", ["sandal"]),
];
const cs = calculateOutfitScore(casualSummer, { weather: "32°C sunny", occasion: "brunch", vibe: "casual" });
assert("color: light neutrals score well",  cs.breakdown.color.score >= 2, cs.breakdown.color.reason);
assert("silhouette: fitted top + shorts OK", cs.breakdown.silhouette.score >= 0, cs.breakdown.silhouette.reason);
assert("weather: linen + sandals in heat",  cs.breakdown.weather.score >= 0, cs.breakdown.weather.reason);
assert("occasion: sandals OK for brunch",   cs.breakdown.occasion.score >= 0, cs.breakdown.occasion.reason);
console.log("  Total score:", cs.total);

// ── Test 2: Male Smart Casual ─────────────────────────────────────────────────
console.log("\n── Test 2: Male Smart Casual ──");
const smartCasual = [
  item("White Oxford button-down shirt", "Top", "white"),
  item("Navy slim chinos", "Bottom", "navy"),
  item("Tan leather loafers", "Footwear", "tan", ["loafer"]),
];
const sc = calculateOutfitScore(smartCasual, { weather: "22°C clear", occasion: "brunch", vibe: "smart casual" });
assert("color: white + navy + tan — tonal",  sc.breakdown.color.score >= 2, sc.breakdown.color.reason);
assert("silhouette: shirt + slim chinos balanced", sc.breakdown.silhouette.score >= 0, sc.breakdown.silhouette.reason);
assert("occasion: loafers boost smart casual", sc.breakdown.occasion.score >= 0, sc.breakdown.occasion.reason);
console.log("  Total score:", sc.total);

// ── Test 3: Rainy Day ─────────────────────────────────────────────────────────
console.log("\n── Test 3: Rainy Day Styling ──");
const rainyGood = [
  item("Oversized white shirt", "Top", "white"),
  item("Straight black jeans", "Bottom", "black"),
  item("Black ankle boots", "Footwear", "black", ["boot"]),
];
const rainyBad = [
  item("Beige suede mules", "Footwear", "beige", ["suede"]),
  item("Floral silk blouse", "Top", "multicolor", ["silk"]),
  item("White linen trousers", "Bottom", "white"),
];
const rGood = calculateOutfitScore(rainyGood, { weather: "rainy 18°C" });
const rBad  = calculateOutfitScore(rainyBad,  { weather: "rainy 18°C" });
assert("rainy: boots score better than suede mules", rGood.total > rBad.total,
  `boots:${rGood.breakdown.weather.reason} | suede:${rBad.breakdown.weather.reason}`);

// ── Test 4: Oversized Hoodie Anchor ──────────────────────────────────────────
console.log("\n── Test 4: Oversized Hoodie Anchor ──");
const hoodyGood = [
  item("Grey oversized hoodie", "Outer", "grey", ["oversized","hoodie"]),
  item("Black skinny jeans", "Bottom", "black", ["skinny"]),
  item("White chunky sneakers", "Footwear", "white", ["sneaker"]),
];
const hoodyBad = [
  item("Grey oversized hoodie", "Outer", "grey", ["oversized","hoodie"]),
  item("Black wide-leg trousers", "Bottom", "black", ["wide leg"]),
  item("White chunky sneakers", "Footwear", "white"),
];
const hGood = calculateOutfitScore(hoodyGood, { vibe: "streetwear" });
const hBad  = calculateOutfitScore(hoodyBad,  { vibe: "streetwear" });
assert("oversized hoodie + skinny jeans scores better than + wide-leg",
  hGood.total > hBad.total,
  `skinny:${hGood.breakdown.silhouette.reason} | wide:${hBad.breakdown.silhouette.reason}`);

// ── Test 5: Ethnic Fusion ─────────────────────────────────────────────────────
console.log("\n── Test 5: Ethnic Fusion / Festive ──");
const ethnic = [
  item("Embroidered silk kurta", "Top", "gold", ["kurta","silk","embroidered"]),
  item("Straight palazzo", "Bottom", "ivory"),
  item("Gold juttis", "Footwear", "gold", ["jutti"]),
];
const ef = calculateOutfitScore(ethnic, { occasion: "festive", vibe: "ethnic" });
assert("festive occasion + jutti boost",    ef.breakdown.occasion.score >= 3, ef.breakdown.occasion.reason);
console.log("  Total score:", ef.total);

// ── Test 6: Monochrome Neutral Outfit ─────────────────────────────────────────
console.log("\n── Test 6: Monochrome Neutral ──");
const mono = [
  item("Beige relaxed shirt", "Top", "beige"),
  item("Camel straight trousers", "Bottom", "camel"),
  item("Brown leather loafers", "Footwear", "brown", ["loafer"]),
];
const mn = calculateOutfitScore(mono, { occasion: "casual" });
assert("all-neutral palette high color score", mn.breakdown.color.score >= 2, mn.breakdown.color.reason);
console.log("  Total score:", mn.total);

// ── Test 7: Clashing Colors (should score low) ────────────────────────────────
console.log("\n── Test 7: Color Clash (should score low) ──");
const clash = [
  item("Bright red tee", "Top", "red"),
  item("Orange cargo pants", "Bottom", "orange"),
  item("Green chunky sneakers", "Footwear", "green"),
];
const cl = calculateOutfitScore(clash, { occasion: "casual" });
assert("3+ loud colors score negatively", cl.breakdown.color.score < 0, cl.breakdown.color.reason);

console.log("\n── All tests complete ──\n");
