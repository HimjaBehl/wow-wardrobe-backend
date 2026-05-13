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

// ── Saved Plans → Combos ─────────────────────────────────────────────────────
// outfit_plans docs: { uid, date, outfit: { items: [...] }, updated_at: "..." }
// Converts them to { items } combo format, sorted oldest→newest for temporalWeight.
function extractSavedPlanCombos(savedPlans = []) {
  return savedPlans
    .map((p) => ({
      items:   p.outfit?.items || p.items || [],
      savedAt: p.updated_at || p.date || null,
    }))
    .filter((c) => c.items.length >= 2)
    .sort((a, b) => {
      if (!a.savedAt) return -1;
      if (!b.savedAt) return 1;
      return new Date(a.savedAt) - new Date(b.savedAt);
    });
}

// ── Repeated Pattern Analyser ────────────────────────────────────────────────
function analyzeRepeatedPatterns(savedPlanCombos = [], likedCombos = []) {
  const all = [...savedPlanCombos, ...likedCombos];
  if (!all.length) return { aesthetics: [], silhouettes: [], footwear: [], summary: "no patterns yet" };

  const aC = {}, sC = {}, fC = {};
  for (const combo of all) {
    const items = Array.isArray(combo) ? combo : (combo.items || []);
    if (!items.length) continue;
    const a = detectOutfitAesthetic(items);
    const s = detectOutfitSilhouette(items);
    const f = detectOutfitFootwear(items);
    aC[a] = (aC[a] || 0) + 1;
    sC[s] = (sC[s] || 0) + 1;
    if (f) fC[f] = (fC[f] || 0) + 1;
  }

  const topAesthetics  = top(aC, 3);
  const topSilhouettes = top(sC, 3);
  const topFootwear    = top(fC, 3);

  const parts = [];
  if (topAesthetics[0])  parts.push(`${topAesthetics[0]} aesthetic`);
  if (topSilhouettes[0]) parts.push(`${topSilhouettes[0]} silhouette`);
  if (topFootwear[0])    parts.push(`${topFootwear[0]}`);

  return {
    aesthetics:  topAesthetics,
    silhouettes: topSilhouettes,
    footwear:    topFootwear,
    summary:     parts.length ? `Consistently reaches for: ${parts.join(", ")}` : "still building pattern",
  };
}

// ── Weighted Profile Builder ─────────────────────────────────────────────────
// Produces the clean { styleIdentity, aesthetics, silhouettes, colors, footwear, dislikes }
// shape the frontend and prompt can consume directly.
function buildWeightedProfile(tasteWeights, styleIdentity, prefs = {}) {
  const tw = tasteWeights;

  const filterAbove = (obj, threshold) =>
    Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v >= threshold));

  const aesthetics  = filterAbove(tw.aesthetics,  0.55);
  const silhouettes = filterAbove(tw.silhouettes, 0.55);
  const footwear    = filterAbove(tw.footwear,    0.50);

  // Map internal color keys to human labels
  const colorLabelMap = { monochrome: "neutrals", neutral: "neutrals", oneAccent: "oneAccent", colorful: "bright" };
  const colors = {};
  for (const [k, v] of Object.entries(tw.colors || {})) {
    if (v >= 0.55) colors[colorLabelMap[k] || k] = v;
  }

  // Dislikes: invert low-weight aesthetics/silhouettes + explicit prefs
  const dislikes = {};
  for (const [k, v] of Object.entries(tw.aesthetics || {}))  { if (v <= 0.35) dislikes[`${k}Aesthetic`]  = Math.round((1 - v) * 100) / 100; }
  for (const [k, v] of Object.entries(tw.silhouettes || {})) { if (v <= 0.35) dislikes[`${k}Silhouette`] = Math.round((1 - v) * 100) / 100; }
  if ((tw.layering?.layered ?? 0.5) <= 0.35) dislikes.bulkyLayering = Math.round((1 - (tw.layering?.layered ?? 0.5)) * 100) / 100;
  for (const d of (prefs.dislikes || [])) { if (d) dislikes[String(d).replace(/\s+/g, "")] = 0.9; }

  return { styleIdentity, aesthetics, silhouettes, colors, footwear, dislikes };
}

// ── Formality + Layering from Prefs ─────────────────────────────────────────
function deriveFormalityFromPrefs(prefs = {}) {
  const s = (prefs.styleGoal || prefs.occasionPreference || prefs.formality || "").toLowerCase();
  if (/formal|office|work|professional|business/.test(s)) return "smart";
  if (/casual|relaxed|everyday|street/.test(s))           return "casual";
  if (/date|evening|dinner|cocktail/.test(s))             return "evening";
  return null;
}

function deriveLayeringComfortFromPrefs(prefs = {}) {
  const l = (prefs.layeringPreference || prefs.layering || "").toLowerCase();
  if (/no layer|minimal|clean|hate layer|dislike layer/.test(l)) return "prefers clean minimal layers";
  if (/enjoy|love|like layer|warm|cold/.test(l))                  return "enjoys layering";
  return null;
}

// ── Taste Weight Builder ─────────────────────────────────────────────────────
function buildTasteWeights(likedCombos = [], dislikedCombos = [], savedPlanCombos = []) {
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
  likedCombos.forEach((c, i) => accumulate(c, "liked", temporalWeight(i, tl || 1)));

  const td = dislikedCombos.length;
  // Dislike signal is slightly softer (0.8×) to prevent over-correction from a few bad days
  dislikedCombos.forEach((c, i) => accumulate(c, "disliked", temporalWeight(i, td || 1) * 0.8));

  // Saved plans = 1.5× weight vs liked — intentional scheduling is the strongest preference signal
  const ts = savedPlanCombos.length;
  savedPlanCombos.forEach((c, i) => accumulate(c, "liked", temporalWeight(i, ts || 1) * 1.5));

  const totalSignals = tl + td + ts;
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
    aesthetics:    toWeights(counts.aesthetics),
    silhouettes:   toWeights(counts.silhouettes),
    colors:        toWeights(counts.colors),
    footwear:      toWeights(counts.footwear),
    formality:     toWeights(counts.formality),
    layering:      toWeights(counts.layering),
    confidence:    Math.round(confidence * 100) / 100,
    totalSignals,
    likedCount:    tl,
    dislikedCount: td,
    savedCount:    ts,
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

  // Log style identity used for this scoring pass
  if (tasteProfile?.styleIdentity && weights.confidence > 0.2) {
    console.log(`[StyleIdentity] Scoring outfit as "${tasteProfile.styleIdentity}" (conf:${weights.confidence}) | signals: liked:${weights.likedCount ?? "?"} disliked:${weights.dislikedCount ?? "?"} saved:${weights.savedCount ?? "?"}`);
  }

  function applyW(label, group, key, boostFactor = 6, penaltyFactor = 4) {
    if (!key || !group || !(key in group)) return;
    const w = group[key];
    if (w > 0.65) {
      const boost = Math.round((w - 0.5) * boostFactor * 10) / 10;
      score += boost;
      bonuses.push(`${label} (w:${w})`);
      console.log(`[TasteBonus]   ${label} w:${w} → +${boost}`);
    } else if (w < 0.35) {
      const pen = Math.round((0.5 - w) * penaltyFactor * 10) / 10;
      score -= pen;
      penalties.push(`${label} not preferred (w:${w})`);
      console.log(`[TastePenalty] ${label} w:${w} → -${pen}`);
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

  console.log(`[TasteMatch]   score:${finalScore >= 0 ? "+" : ""}${finalScore} conf:${weights.confidence} | ${reason || "neutral"} | why: aesthetic=${aesthetic}, silhouette=${silhouette}, footwear=${footwear ?? "none"}`);

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
  dislikedCombos = [],   // full outfit combos that were disliked
  savedPlans     = []    // outfit_plans docs — intentional saved outfits
) {
  console.log(`[TasteProfile] Building profile — liked:${likedCombos.length} disliked:${dislikedCombos.length} savedPlans:${savedPlans.length} likedItems:${likedItems.length}`);

  // ── Saved plans → combo format ───────────────────────────────────────────
  const savedPlanCombos = extractSavedPlanCombos(savedPlans);

  // ── Item-level signals (backward compatible) ─────────────────────────────
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
  // Prefer explicit prefs over item-derived inference
  const layeringComfort = deriveLayeringComfortFromPrefs(prefs) || (
    likedItems.length > 0 && layeredCount / likedItems.length > 0.3
      ? "enjoys layering"
      : "prefers clean minimal layers"
  );

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

  // ── Formality level (from prefs or item signals) ─────────────────────────
  const preferredFormality = deriveFormalityFromPrefs(prefs);

  const summaryParts = [];
  if (likedColors.length)                        summaryParts.push(`favors ${likedColors.slice(0, 2).join("/")} tones`);
  if (likedCats.length)                          summaryParts.push(`often wears ${likedCats.slice(0, 2).join(" and ")}`);
  if (silhouetteTendency !== "balanced")         summaryParts.push(`leans ${silhouetteTendency} silhouettes`);
  if (aestheticHints.length)                     summaryParts.push(`${aestheticHints[0]} aesthetic tendencies`);
  if (layeringComfort !== "prefers clean minimal layers") summaryParts.push(layeringComfort);

  // ── Combo-level taste weights (includes saved plans with 1.5× boost) ────
  const tasteWeights = buildTasteWeights(likedCombos, dislikedCombos, savedPlanCombos);

  // ── Style identity ───────────────────────────────────────────────────────
  const { identity: styleIdentity, confidence: styleIdentityConfidence } =
    inferStyleIdentity(tasteWeights);

  // ── Repeated pattern analysis (saved plans + liked combos) ───────────────
  const repeatedPatterns = analyzeRepeatedPatterns(savedPlanCombos, likedCombos);

  // ── Weighted profile (clean output shape for prompts + frontend) ─────────
  const weightedProfile = buildWeightedProfile(tasteWeights, styleIdentity, prefs);

  // ── Debug logs ───────────────────────────────────────────────────────────
  console.log(`[TasteProfile] Style identity: "${styleIdentity}" (conf:${styleIdentityConfidence}) | total signals:${tasteWeights.totalSignals} (liked:${tasteWeights.likedCount} disliked:${tasteWeights.dislikedCount} saved:${tasteWeights.savedCount})`);
  if (Object.keys(tasteWeights.aesthetics).length)
    console.log(`[TasteProfile] Aesthetics:   ${JSON.stringify(tasteWeights.aesthetics)}`);
  if (Object.keys(tasteWeights.silhouettes).length)
    console.log(`[TasteProfile] Silhouettes:  ${JSON.stringify(tasteWeights.silhouettes)}`);
  if (Object.keys(tasteWeights.footwear).length)
    console.log(`[TasteProfile] Footwear:     ${JSON.stringify(tasteWeights.footwear)}`);
  if (Object.keys(tasteWeights.colors).length)
    console.log(`[TasteProfile] Colors:       ${JSON.stringify(tasteWeights.colors)}`);
  if (Object.keys(weightedProfile.dislikes).length)
    console.log(`[TasteProfile] Dislikes:     ${JSON.stringify(weightedProfile.dislikes)}`);
  if (repeatedPatterns.summary !== "no patterns yet")
    console.log(`[TasteProfile] Patterns:     ${repeatedPatterns.summary}`);

  return {
    // Positive signals (item-level)
    preferredColors:     likedColors,
    preferredPalettes:   likedPalettes,
    preferredCategories: likedCats,
    preferredFootwear:   likedFootwear,
    silhouetteTendency,
    layeringPreference:  layeringComfort,   // renamed internally but exposed as layeringPreference for backward compat
    layeringComfort,
    preferredFormality,
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
    // Combo-level taste vectors
    tasteWeights,
    // Style identity
    styleIdentity,
    styleIdentityConfidence,
    // New: repeated patterns from saved plans
    repeatedPatterns,
    // New: clean weighted profile for prompt injection + frontend
    weightedProfile,
  };
}
