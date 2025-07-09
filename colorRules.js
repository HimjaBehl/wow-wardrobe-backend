// ─── Color Utilities ───────────────────────────────
const NEUTRALS = ["white", "black", "grey", "gray", "beige", "nude", "cream"];

function isNeutral(color = "") {
  return NEUTRALS.includes(color.toLowerCase());
}

function dominantPalette(colors = []) {
  const warm = ["red", "orange", "yellow", "brown", "gold"];
  const cool = ["blue", "green", "purple", "silver"];

  let warmCount = 0;
  let coolCount = 0;

  colors.forEach((c) => {
    const lc = c.toLowerCase();
    if (warm.includes(lc)) warmCount++;
    if (cool.includes(lc)) coolCount++;
  });

  if (warmCount > coolCount) return "warm";
  if (coolCount > warmCount) return "cool";
  return "neutral";
}

function harmonious(palettes = []) {
  const nonNeutral = palettes.filter(p => p !== "neutral");
  if (nonNeutral.length <= 2) return true;                 // 👍 up to 2 non-neutrals

  const hasWarm    = palettes.includes("warm");
  const hasCool    = palettes.includes("cool");
  const hasNeutral = palettes.includes("neutral");
  return hasWarm && hasCool && hasNeutral;                 // 👍 warm+cool+neutral okay
}

module.exports = { isNeutral, dominantPalette, harmonious };
