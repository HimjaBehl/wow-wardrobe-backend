// lib/styleScore.js

function calculateStyleScore(items = []) {
  let score = 0;

  const categories = items.map(it => it.category?.toLowerCase() || "");
  const silhouettes = items.map(it => it.silhouette || "");
  const palettes = items.map(it => it.palette || "");

  const hasTop = categories.some(c => /top|shirt|blouse|kurti/.test(c));
  const hasBottom = categories.some(c => /jean|pant|short|skirt|bottom|trouser/.test(c));
  const hasDress = categories.some(c => /dress|jumpsuit/.test(c));
  const hasOuter = categories.some(c => /jacket|coat/.test(c));
  const hasAccessory = categories.some(c => /bag|shoe|sandal|boot|jewel|watch|sunglass/.test(c));

  // ✅ 1. Base structure points
  if ((hasTop && hasBottom) || hasDress) score += 3;

  // ✅ 2. Bonus for outer layer
  if (hasOuter) score += 1;

  // ✅ 3. Bonus for accessories
  if (hasAccessory) score += 1;

  // ✅ 4. Palette harmony (no more than 2 distinct palettes)
  const uniquePalettes = [...new Set(palettes.filter(p => p && p !== "unknown"))];
  if (uniquePalettes.length <= 2) score += 2;

  // ✅ 5. Silhouette contrast (loose + fitted)
  const hasLoose = silhouettes.some(s => /loose|oversize|flowy|boxy/.test(s));
  const hasFitted = silhouettes.some(s => /slim|tailored|structured|bodycon/.test(s));
  if (hasLoose && hasFitted) score += 2;

  // Cap at 10
  return Math.min(score, 10);
}

module.exports = {
  calculateStyleScore
};
