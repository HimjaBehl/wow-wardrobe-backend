// ── User Taste Profile Builder ──────────────────────────────────────────────
// Distills liked/disliked feedback into a rich, evolving style snapshot
// that Tina uses to personalise outfit suggestions.

function countBy(items, field) {
  return items.reduce((acc, it) => {
    const v = String(it[field] || "").toLowerCase().trim();
    if (v) acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
}

function top(obj, n = 3) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function detectSilhouetteFromItem(it) {
  const t = `${it.name || ""} ${it.category || ""}`.toLowerCase();
  if (/oversized|boxy|baggy|relaxed/.test(t)) return "oversized";
  if (/fitted|slim|skinny|bodycon|tapered/.test(t)) return "fitted";
  if (/flowy|flare|pleated|maxi|a-line/.test(t)) return "flowy";
  if (/wide.leg|palazzo|bootcut/.test(t)) return "wide";
  if (/structured|tailored|blazer|coat/.test(t)) return "structured";
  return null;
}

export function buildUserTasteProfile(
  likedItems = [],
  dislikedItems = [],
  feedbackMemory = [],
  prefs = {}
) {
  // ── Color preferences ───────────────────────────────────────────────────
  const likedColors    = top(countBy(likedItems, "color"), 4);
  const likedPalettes  = top(countBy(likedItems, "palette"), 3);
  const dislikedColors = top(countBy(dislikedItems, "color"), 3);

  // ── Category preferences ─────────────────────────────────────────────────
  const likedCats    = top(countBy(likedItems, "category"), 4);
  const dislikedCats = top(countBy(dislikedItems, "category"), 3);

  // ── Footwear preference ────────────────────────────────────────────────
  const footwearRe = /footwear|shoe|boot|sandal|sneaker|heel|loafer|jutti|pump/;
  const likedFootwear = likedItems
    .filter((it) => footwearRe.test((it.category || it.name || "").toLowerCase()))
    .map((it) => (it.name || it.category || "").toLowerCase().split(" ")[0])
    .filter(Boolean)
    .slice(0, 3);

  // ── Silhouette tendencies ────────────────────────────────────────────────
  const silCounts = { oversized: 0, fitted: 0, flowy: 0, wide: 0, structured: 0 };
  for (const it of likedItems) {
    const s = detectSilhouetteFromItem(it);
    if (s) silCounts[s]++;
  }
  const silhouetteTendency = top(silCounts, 2).filter((k) => silCounts[k] > 0).join(", ") || "balanced";

  // ── Layering preference ────────────────────────────────────────────────
  const layerRe = /jacket|blazer|cardigan|coat|layer|hoodie|shrug|outerwear/;
  const layeredCount = likedItems.filter((it) =>
    layerRe.test((it.name || "").toLowerCase())
  ).length;
  const layeringPreference =
    likedItems.length > 0 && layeredCount / likedItems.length > 0.3
      ? "enjoys layering"
      : "prefers clean minimal layers";

  // ── Aesthetic fingerprint ────────────────────────────────────────────────
  const aestheticHints = [];
  const nb = likedItems.map((it) => `${it.name || ""} ${it.category || ""}`.toLowerCase()).join(" ");
  if (/oversized|graphic|streetwear|cargo|cap/.test(nb)) aestheticHints.push("streetwear");
  if (/blazer|trouser|structured|chinos|loafer/.test(nb)) aestheticHints.push("smart/minimal");
  if (/floral|flowy|linen|ruffle|boho/.test(nb)) aestheticHints.push("boho/romantic");
  if (/leather|black|boot|chain|edgy|grunge/.test(nb)) aestheticHints.push("edgy");
  if (/pastel|pink|soft|delicate|pearl/.test(nb)) aestheticHints.push("soft/feminine");

  // ── Feedback-derived dislikes ────────────────────────────────────────────
  const dislikedReasons = feedbackMemory
    .filter((fb) => (fb.feedback === "dislike" || fb.type === "dislike") && fb.reason)
    .map((fb) => fb.reason)
    .filter(Boolean)
    .slice(0, 5);

  // ── Summary line for the prompt ──────────────────────────────────────────
  const summaryParts = [];
  if (likedColors.length)        summaryParts.push(`favors ${likedColors.slice(0, 2).join("/")} tones`);
  if (likedCats.length)          summaryParts.push(`often wears ${likedCats.slice(0, 2).join(" and ")}`);
  if (silhouetteTendency !== "balanced") summaryParts.push(`leans ${silhouetteTendency} silhouettes`);
  if (aestheticHints.length)     summaryParts.push(`${aestheticHints[0]} aesthetic tendencies`);
  if (layeringPreference !== "prefers clean minimal layers") summaryParts.push(layeringPreference);

  return {
    // Positive signals
    preferredColors:     likedColors,
    preferredPalettes:   likedPalettes,
    preferredCategories: likedCats,
    preferredFootwear:   likedFootwear,
    silhouetteTendency,
    layeringPreference,
    aestheticHints,
    // Negative signals
    dislikedColors,
    dislikedCategories:  dislikedCats,
    dislikedReasons,
    // Context
    bodyShape:           prefs.bodyShape || "",
    complexion:          prefs.complexion || "",
    summaryLine:
      summaryParts.join(", ") || "taste profile still developing — suggest broadly",
  };
}
