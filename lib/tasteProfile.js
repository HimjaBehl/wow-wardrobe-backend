// ── User Taste Profile Builder ──────────────────────────────────────────────
// Distils liked/disliked feedback into weighted taste vectors, a style
// identity, and per-outfit taste match scoring. All taste logic lives here.

// ── Shared helpers ───────────────────────────────────────────────────────────

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

function itemBlobList(items = []) {
  return items
    .map((it) => `${it.name || ""} ${it.category || ""} ${(it.tags || []).join(" ")} ${it.color || ""}`)
    .join(" ")
    .toLowerCase();
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

// ── Outfit-level detectors (exported for consistency with taste weight building) ──

export function detectOutfitAesthetic(items = []) {
  const b = itemBlobList(items);
  // Strong distinctive signals first (most specific to least)
  if (/\b(oversized|hoodie|sneaker|baggy|cargo|graphic|cap|tracksuit)\b/.test(b))         return "streetwear";
  if (/\b(satin|sequin|bodycon|metallic|gown|clutch)\b/.test(b))                          return "glamour";
  if (/\b(track|athletic|activewear|zip.up|training|sport bra)\b/.test(b))                return "sporty";
  if (/\b(ruffle|puff sleeve|lace|pearl|ribbon)\b/.test(b))                               return "romantic";
  if (/\b(leather|studded|chain|grunge|distressed|moto)\b/.test(b))                       return "edgy";
  if (/\b(flowy|floral|linen|maxi|fringe|tassel|embroidered|crochet)\b/.test(b))          return "boho";
  if (/\b(polo|plaid|argyle|cable knit)\b/.test(b))                                       return "preppy";
  // Smart requires an actual structured top — blazer or button-up as the centrepiece
  if (/\b(blazer|button.up|dress shirt|structured jacket)\b/.test(b))                     return "smart";
  // Minimal: neutral-palette basics without a dominant style signature (catch-all before mixed)
  if (/\b(white|beige|cream|ivory|turtleneck)\b/.test(b))                                 return "minimal";
  return "mixed";
}

export function detectOutfitSilhouette(items = []) {
  const b = itemBlobList(items);
  const hasOversized = /\b(oversized|boxy|baggy)\b/.test(b);
  const hasWide      = /\b(wide.leg|palazzo|flared)\b/.test(b);
  const hasSlim      = /\b(slim|skinny|straight|fitted|tapered)\b/.test(b);
  const hasOnepiece  = /\b(dress|jumpsuit|saree|gown|lehenga)\b/.test(b);
  const hasLayer     = /\b(jacket|blazer|coat|cardigan|hoodie)\b/.test(b);

  if (hasOnepiece)                       return "onepiece";
  if (hasOversized && !hasWide)          return "oversizedTopSlimBottom";
  if (hasWide && !hasOversized)          return "wideLegFittedTop";
  if (hasSlim && !hasOversized)          return "slim";
  if (hasOversized)                      return "oversized";
  if (hasLayer)                          return "layered";
  return "balanced";
}

export function detectOutfitColors(items = []) {
  const colors = items.map((it) => (it.color || "").toLowerCase()).filter(Boolean);
  const NEUTRALS = ["black","white","grey","gray","beige","cream","ivory","tan","camel","navy","denim","brown","charcoal","khaki","nude","stone"];
  const isNeutral = (c) => NEUTRALS.some((n) => c.includes(n));
  const accents   = colors.filter((c) => !isNeutral(c));

  if (accents.length === 0 && colors.length >= 2) return "monochrome";
  if (accents.length === 1)                        return "oneAccent";
  if (accents.length >= 2)                         return "colorful";
  return "neutral";
}

export function detectOutfitFootwear(items = []) {
  const b = itemBlobList(items);
  if (/\b(sneaker|trainer|canvas shoe)\b/.test(b))  return "sneakers";
  if (/\b(loafer|oxford|derby|moccasin)\b/.test(b)) return "loafers";
  if (/\b(boot|ankle boot|chelsea|combat)\b/.test(b)) return "boots";
  if (/\b(heel|pump|stiletto|kitten)\b/.test(b))    return "heels";
  if (/\b(sandal|slide|mule|flip.flop)\b/.test(b))  return "sandals";
  if (/\b(jutti|kolhapuri)\b/.test(b))               return "ethnic";
  return null;
}

export function detectOutfitFormality(items = []) {
  const b = itemBlobList(items);
  if (/\b(gown|cocktail|sequin|satin|evening)\b/.test(b))               return "evening";
  if (/\b(blazer|suit|dress shirt|formal trouser|interview)\b/.test(b)) return "smart";
  if (/\b(tee|t-shirt|sneaker|hoodie|jogger|casual)\b/.test(b))         return "casual";
  return "smart-casual";
}

// ── Temporal weighting ───────────────────────────────────────────────────────
// Most recent combo (last in array) = weight 1.0; older entries decay by 0.85/step.
function temporalWeight(index, total) {
  return Math.pow(0.85, total - 1 - index);
}

// ── Taste Weight Builder ─────────────────────────────────────────────────────
function buildTasteWeights(likedCombos = [], dislikedCombos = []) {
  const counts = {
    aesthetics:  { liked: {}, disliked: {} },
    silhouettes: { liked: {}, disliked: {} },
    colors:      { liked: {}, disliked: {} },
    footwear:    { liked: {}, disliked: {} },
    formality:   { liked: {}, disliked: {} },
    layering:    { liked: {}, disliked: {} },
  };

  function accumulate(combo, side, w) {
    const items = Array.isArray(combo) ? combo : (combo.items || []);
    if (!items.length) return;
    const add = (group, key) => { counts[group][side][key] = (counts[group][side][key] || 0) + w; };

    add("aesthetics",  detectOutfitAesthetic(items));
    add("silhouettes", detectOutfitSilhouette(items));
    add("colors",      detectOutfitColors(items));
    add("formality",   detectOutfitFormality(items));

    const fw = detectOutfitFootwear(items);
    if (fw) add("footwear", fw);

    const hasLayer = /\b(jacket|blazer|coat|cardigan)\b/.test(itemBlobList(items));
    add("layering", hasLayer ? "layered" : "minimal");
  }

  const tl = likedCombos.length;
  likedCombos.forEach((c, i) => accumulate(c, "liked",    temporalWeight(i, tl || 1)));

  const td = dislikedCombos.length;
  // Dislike signal is slightly softer (0.8×) to prevent over-correction from a few bad days
  dislikedCombos.forEach((c, i) => accumulate(c, "disliked", temporalWeight(i, td || 1) * 0.8));

  const totalSignals = tl + td;
  // Full confidence requires 6 signals — prevents overfitting on early feedback
  const confidence   = Math.min(totalSignals / 6, 1.0);

  function toWeights(group) {
    const keys = new Set([...Object.keys(group.liked), ...Object.keys(group.disliked)]);
    const out  = {};
    for (const key of keys) {
      const l = group.liked[key]    || 0;
      const d = group.disliked[key] || 0;
      // Laplace-smoothed preference: 2 pseudocounts keep us from extremes on thin data
      const base = l / (l + d + 2);
      // Confidence scaling: pulls weight toward 0.5 when signals are few
      out[key] = Math.round((0.5 + (base - 0.5) * confidence) * 100) / 100;
    }
    return out;
  }

  return {
    aesthetics:  toWeights(counts.aesthetics),
    silhouettes: toWeights(counts.silhouettes),
    colors:      toWeights(counts.colors),
    footwear:    toWeights(counts.footwear),
    formality:   toWeights(counts.formality),
    layering:    toWeights(counts.layering),
    confidence:  Math.round(confidence * 100) / 100,
    totalSignals,
  };
}

// ── Style Identity Inference ─────────────────────────────────────────────────

const STYLE_IDENTITIES = [
  { name: "Elevated Minimal",   signals: [["aesthetics.minimal", 0.60], ["colors.monochrome", 0.55], ["formality.smart-casual", 0.55]] },
  { name: "Relaxed Streetwear", signals: [["aesthetics.streetwear", 0.60], ["footwear.sneakers", 0.60], ["silhouettes.oversizedTopSlimBottom", 0.55]] },
  { name: "Sporty Casual",      signals: [["aesthetics.sporty", 0.60], ["footwear.sneakers", 0.50], ["formality.casual", 0.55]] },
  { name: "Feminine Soft",      signals: [["aesthetics.romantic", 0.60], ["footwear.heels", 0.50], ["formality.smart-casual", 0.50]] },
  { name: "Boho Free Spirit",   signals: [["aesthetics.boho", 0.65], ["colors.colorful", 0.50], ["footwear.sandals", 0.50]] },
  { name: "Edgy Urban",         signals: [["aesthetics.edgy", 0.60], ["footwear.boots", 0.60], ["colors.monochrome", 0.50]] },
  { name: "Preppy Classic",     signals: [["aesthetics.preppy", 0.60], ["footwear.loafers", 0.55], ["formality.smart-casual", 0.60]] },
  { name: "Glam Evening",       signals: [["aesthetics.glamour", 0.65], ["footwear.heels", 0.65], ["formality.evening", 0.60]] },
  { name: "Smart Casual",       signals: [["aesthetics.smart", 0.60], ["footwear.loafers", 0.50], ["formality.smart-casual", 0.65]] },
  { name: "Monochrome Minimal", signals: [["colors.monochrome", 0.70], ["aesthetics.minimal", 0.55]] },
  { name: "Resort Casual",      signals: [["footwear.sandals", 0.60], ["formality.casual", 0.60], ["colors.colorful", 0.50]] },
];

export function inferStyleIdentity(tasteWeights = {}) {
  if (!tasteWeights || (tasteWeights.confidence || 0) < 0.15) {
    return { identity: "Style explorer — still learning your taste", confidence: 0 };
  }

  function getW(path) {
    const [group, key] = path.split(".");
    return (tasteWeights[group] || {})[key] ?? 0.5;
  }

  let bestScore = -Infinity;
  let bestName  = null;

  for (const profile of STYLE_IDENTITIES) {
    const score = profile.signals.reduce((sum, [path, threshold]) => sum + (getW(path) - threshold), 0) / profile.signals.length;
    if (score > bestScore) { bestScore = score; bestName = profile.name; }
  }

  const confidence = Math.min(Math.max(bestScore * tasteWeights.confidence, 0), 1.0);
  return {
    identity:   bestScore > 0 ? bestName : "Style explorer — broad taste",
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ── Taste Match Scorer ───────────────────────────────────────────────────────
// Rewards outfits that align with user's historical taste. Called per-outfit
// in fullOutfitScore(). Returns 0 if taste data is thin (avoids early overfitting).
export function scoreTasteMatch(items = [], tasteProfile = null) {
  const weights = tasteProfile?.tasteWeights;
  if (!weights || weights.confidence < 0.1) {
    return { score: 0, reason: "taste profile still developing", debug: {} };
  }

  const aesthetic  = detectOutfitAesthetic(items);
  const silhouette = detectOutfitSilhouette(items);
  const colors     = detectOutfitColors(items);
  const footwear   = detectOutfitFootwear(items);
  const formality  = detectOutfitFormality(items);
  const hasLayer   = /\b(jacket|blazer|coat|cardigan)\b/.test(itemBlobList(items));
  const layerKey   = hasLayer ? "layered" : "minimal";

  let score = 0;
  const bonuses   = [];
  const penalties = [];

  function applyW(label, group, key, boostFactor = 6, penaltyFactor = 4) {
    if (!key || !group || !(key in group)) return;
    const w = group[key];
    if (w > 0.65) {
      score += (w - 0.5) * boostFactor;
      bonuses.push(`${label} (w:${w})`);
    } else if (w < 0.35) {
      score -= (0.5 - w) * penaltyFactor;
      penalties.push(`${label} not preferred (w:${w})`);
    }
  }

  applyW(`aesthetic:${aesthetic}`,   weights.aesthetics,  aesthetic,  6, 4);
  applyW(`silhouette:${silhouette}`, weights.silhouettes, silhouette, 8, 5);
  applyW(`color:${colors}`,         weights.colors,      colors,     5, 3);
  applyW(`footwear:${footwear}`,     weights.footwear,    footwear,   5, 3);
  applyW(`formality:${formality}`,   weights.formality,   formality,  4, 2);
  applyW(`layering:${layerKey}`,     weights.layering,    layerKey,   3, 2);

  // Scale by confidence: early users get low impact, established users get strong signal
  const finalScore = Math.round(score * weights.confidence * 10) / 10;

  const reason = [
    bonuses.length   ? `taste match: ${bonuses.join(", ")}`      : "",
    penalties.length ? `taste mismatch: ${penalties.join(", ")}` : "",
  ].filter(Boolean).join(" | ");

  if (finalScore !== 0) {
    console.log(`[TasteMatch] score:${finalScore >= 0 ? "+" : ""}${finalScore} conf:${weights.confidence} | ${reason || "neutral"}`);
  }

  return {
    score:  finalScore,
    reason: reason || "taste-neutral",
    debug:  { aesthetic, silhouette, colors, footwear, formality, confidence: weights.confidence, bonuses, penalties },
  };
}

// ── Main Profile Builder ─────────────────────────────────────────────────────
export function buildUserTasteProfile(
  likedItems     = [],
  dislikedItems  = [],
  feedbackMemory = [],
  prefs          = {},
  likedCombos    = [],   // full outfit combos that were liked
  dislikedCombos = []    // full outfit combos that were disliked
) {
  // ── Item-level signals (existing — backward compatible) ──────────────────
  const likedColors    = top(countBy(likedItems, "color"), 4);
  const likedPalettes  = top(countBy(likedItems, "palette"), 3);
  const dislikedColors = top(countBy(dislikedItems, "color"), 3);
  const likedCats      = top(countBy(likedItems, "category"), 4);
  const dislikedCats   = top(countBy(dislikedItems, "category"), 3);

  const footwearRe = /footwear|shoe|boot|sandal|sneaker|heel|loafer|jutti|pump/;
  const likedFootwear = likedItems
    .filter((it) => footwearRe.test((it.category || it.name || "").toLowerCase()))
    .map((it) => (it.name || it.category || "").toLowerCase().split(" ")[0])
    .filter(Boolean)
    .slice(0, 3);

  const silCounts = { oversized: 0, fitted: 0, flowy: 0, wide: 0, structured: 0 };
  for (const it of likedItems) {
    const s = detectSilhouetteFromItem(it);
    if (s) silCounts[s]++;
  }
  const silhouetteTendency = top(silCounts, 2).filter((k) => silCounts[k] > 0).join(", ") || "balanced";

  const layerRe = /jacket|blazer|cardigan|coat|layer|hoodie|shrug|outerwear/;
  const layeredCount = likedItems.filter((it) => layerRe.test((it.name || "").toLowerCase())).length;
  const layeringPreference =
    likedItems.length > 0 && layeredCount / likedItems.length > 0.3
      ? "enjoys layering"
      : "prefers clean minimal layers";

  const aestheticHints = [];
  const nb = likedItems.map((it) => `${it.name || ""} ${it.category || ""}`.toLowerCase()).join(" ");
  if (/oversized|graphic|streetwear|cargo|cap/.test(nb))  aestheticHints.push("streetwear");
  if (/blazer|trouser|structured|chinos|loafer/.test(nb)) aestheticHints.push("smart/minimal");
  if (/floral|flowy|linen|ruffle|boho/.test(nb))          aestheticHints.push("boho/romantic");
  if (/leather|black|boot|chain|edgy|grunge/.test(nb))    aestheticHints.push("edgy");
  if (/pastel|pink|soft|delicate|pearl/.test(nb))         aestheticHints.push("soft/feminine");

  const dislikedReasons = feedbackMemory
    .filter((fb) => (fb.feedback === "dislike" || fb.type === "dislike") && fb.reason)
    .map((fb) => fb.reason)
    .filter(Boolean)
    .slice(0, 5);

  const summaryParts = [];
  if (likedColors.length)                      summaryParts.push(`favors ${likedColors.slice(0, 2).join("/")} tones`);
  if (likedCats.length)                        summaryParts.push(`often wears ${likedCats.slice(0, 2).join(" and ")}`);
  if (silhouetteTendency !== "balanced")       summaryParts.push(`leans ${silhouetteTendency} silhouettes`);
  if (aestheticHints.length)                   summaryParts.push(`${aestheticHints[0]} aesthetic tendencies`);
  if (layeringPreference !== "prefers clean minimal layers") summaryParts.push(layeringPreference);

  // ── Combo-level taste weights (NEW) ─────────────────────────────────────
  const tasteWeights = buildTasteWeights(likedCombos, dislikedCombos);

  // ── Style identity (NEW) ─────────────────────────────────────────────────
  const { identity: styleIdentity, confidence: styleIdentityConfidence } =
    inferStyleIdentity(tasteWeights);

  return {
    // Positive signals (item-level)
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
    bodyShape:  prefs.bodyShape || "",
    complexion: prefs.complexion || "",
    summaryLine:
      summaryParts.join(", ") || "taste profile still developing — suggest broadly",
    // Combo-level taste vectors (NEW)
    tasteWeights,
    styleIdentity,
    styleIdentityConfidence,
  };
}
