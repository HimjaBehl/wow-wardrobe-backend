// ── Outfit Scoring Engine ──────────────────────────────────────────────────
// Modular, traceable scoring for Tina's outfit intelligence.
// Every function returns { score, reason } so callers can log breakdowns.

const NEUTRALS = new Set([
  "black","white","grey","gray","beige","cream","ivory","off-white",
  "tan","camel","navy","denim","brown","charcoal","khaki","nude","stone",
]);

function isNeutral(color = "") {
  const c = color.toLowerCase().trim();
  return NEUTRALS.has(c) || [...NEUTRALS].some((n) => c.includes(n));
}

function blob(items) {
  return items.map((it) =>
    `${it.name || ""} ${it.category || ""} ${(it.tags || []).join(" ")}`
  ).join(" ").toLowerCase();
}

// ── 1. Color Harmony ────────────────────────────────────────────────────────
function areComplementary(c1, c2) {
  const pairs = [["red","green"],["blue","orange"],["yellow","purple"],["pink","teal"]];
  return pairs.some(([a,b]) =>
    (c1.includes(a) && c2.includes(b)) || (c1.includes(b) && c2.includes(a))
  );
}

function areAnalogous(c1, c2) {
  const families = [
    ["red","orange","coral","pink","rose"],
    ["blue","teal","cyan","turquoise"],
    ["yellow","lime","olive","green"],
    ["purple","violet","lavender","pink"],
  ];
  return families.some((f) => f.some((x) => c1.includes(x)) && f.some((x) => c2.includes(x)));
}

export function scoreColorHarmony(items = []) {
  const colors = items.map((it) => (it.color || "").toLowerCase().trim()).filter(Boolean);
  if (colors.length < 2) return { score: 0, reason: "single item" };

  const nonNeutral = colors.filter((c) => !isNeutral(c));

  if (nonNeutral.length === 0)
    return { score: 3, reason: "all-neutral palette — effortlessly wearable" };

  if (nonNeutral.length === 1)
    return { score: 4, reason: `one pop color (${nonNeutral[0]}) on neutral base — polished` };

  if (nonNeutral.length === 2) {
    const [a, b] = nonNeutral;
    if (a.includes(b) || b.includes(a))
      return { score: 3, reason: `tonal depth: ${a} + ${b}` };
    if (areComplementary(a, b))
      return { score: 2.5, reason: `complementary pair: ${a} + ${b}` };
    if (areAnalogous(a, b))
      return { score: 2, reason: `analogous harmony: ${a} + ${b}` };
    return { score: -1, reason: `clashing risk: ${a} vs ${b} — needs neutral anchor` };
  }

  return { score: -3, reason: `color overload: ${nonNeutral.join(", ")} — too many loud pieces` };
}

// ── 2. Silhouette Balance ────────────────────────────────────────────────────
function getSilhouette(item) {
  const t = `${item.name || ""} ${item.category || ""}`.toLowerCase();
  if (/dress|jumpsuit|saree|gown|co-ord/.test(t)) return "onepiece";
  const isUpper = /shirt|top|blouse|tee|t-shirt|tank|kurta|bodysuit|bralette|crop/.test(t);
  const isOuter = /jacket|coat|blazer|cardigan|shrug|hoodie|sweatshirt|sweater|pullover/.test(t);
  const isLower = /pants|trouser|jeans|shorts|skirt|palazzo|leggings|salwar|chino|jogger|culotte/.test(t);
  const isOversized = /oversized|boxy|baggy|relaxed|loose/.test(t);
  const isFitted = /fitted|slim|skinny|bodycon|tapered|straight/.test(t);
  const isWide = /wide.leg|flared|bootcut|palazzo|flare/.test(t);

  if (isOuter) return isOversized ? "outer-oversized" : "outer";
  if (isUpper) {
    if (isOversized) return "upper-oversized";
    if (isFitted)    return "upper-fitted";
    return "upper";
  }
  if (isLower) {
    if (isWide)   return "lower-wide";
    if (isFitted) return "lower-fitted";
    return "lower";
  }
  if (/shoe|sandal|boot|heel|sneaker|loafer|jutti/.test(t)) return "footwear";
  if (/bag|purse|clutch|backpack|tote/.test(t)) return "bag";
  if (/belt|scarf|watch|necklace|earring|ring|sunglass/.test(t)) return "accessory";
  return "misc";
}

export function scoreSilhouetteBalance(items = []) {
  const silos = items.map(getSilhouette);

  if (silos.includes("onepiece")) {
    const hasExtra = silos.some((s) =>
      s.startsWith("upper") || s.startsWith("lower")
    );
    if (hasExtra)
      return { score: -6, reason: "dress/jumpsuit paired with separate top or bottom — structural conflict" };
    return { score: 3, reason: "clean one-piece silhouette" };
  }

  const upper = silos.find((s) => s.startsWith("upper") || s === "upper");
  const lower = silos.find((s) => s.startsWith("lower") || s === "lower");
  // An outer layer (hoodie, blazer worn as the top piece) substitutes for upper
  const outerRole = silos.find((s) => s.startsWith("outer") || s === "outer");
  const effectiveUpper = upper || (outerRole
    ? (outerRole === "outer-oversized" ? "upper-oversized" : "upper")
    : null);

  if (!effectiveUpper || !lower)
    return { score: -1, reason: "incomplete separates — missing top or bottom" };

  if (effectiveUpper === "upper-oversized" && (lower === "lower-fitted" || lower === "lower"))
    return { score: 5, reason: "oversized top + slim bottom — textbook proportion balance" };

  if (lower === "lower-wide" && (effectiveUpper === "upper-fitted" || effectiveUpper === "upper"))
    return { score: 5, reason: "wide-leg + fitted top — editorial balance" };

  if (effectiveUpper === "upper-oversized" && lower === "lower-wide")
    return { score: -4, reason: "oversized top + wide-leg bottom — both pieces add volume, looks bulky" };

  const outerOversized = silos.includes("outer-oversized");
  if (outerOversized && lower === "lower-wide")
    return { score: -3, reason: "oversized outer + wide-leg — triple volume conflict" };

  if (effectiveUpper === "upper-fitted" && lower === "lower-fitted")
    return { score: 2, reason: "head-to-toe fitted — clean and sleek" };

  return { score: 1, reason: "balanced silhouette" };
}

// ── 3. Weather Fit ────────────────────────────────────────────────────────────
export function scoreWeatherFit(items = [], weatherStr = "") {
  if (!weatherStr) return { score: 0, reason: "no weather context" };

  const w = weatherStr.toLowerCase();
  const tempMatch = w.match(/(-?\d+)\s*°?\s*c/i);
  const tempC = tempMatch ? Number(tempMatch[1]) : null;
  const nameblob = blob(items);
  let score = 0;
  const notes = [];

  const isHot    = tempC !== null && tempC >= 30;
  const isWarm   = tempC !== null && tempC >= 24 && tempC < 30;
  const isMild   = tempC !== null && tempC >= 16 && tempC < 24;
  const isChilly = tempC !== null && tempC >= 10 && tempC < 16;
  const isCold   = tempC !== null && tempC < 10;
  const isRainy  = /rain|drizzle|shower|overcast/.test(w);

  const hasHeavyFabric = /wool|fleece|heavy knit|puffer|padded|sherpa|velvet/.test(nameblob);
  const hasLightFabric = /linen|cotton|chiffon|silk|organza|seersucker/.test(nameblob);
  const hasLayers      = /jacket|coat|blazer|cardigan|hoodie|sweater|shrug/.test(nameblob);
  const hasSuede       = /suede|nubuck/.test(nameblob);
  const hasOpenToe     = /sandal|flip.flop|slide|mule/.test(nameblob);
  const hasBoots       = /boot|ankle boot|chelsea boot/.test(nameblob);
  const hasMiniOrShort = /mini|short(?!s)|micro/.test(nameblob);
  const hasSleeveless  = /tank|sleeveless|strapless|tube|spaghetti/.test(nameblob);
  const hasHeavyLayer  = /coat|trench|parka|puffer/.test(nameblob);

  if (isHot) {
    if (hasHeavyFabric) { score -= 8; notes.push("heavy fabric in 30°C+ heat"); }
    if (hasHeavyLayer)  { score -= 7; notes.push("coat/puffer in scorching heat"); }
    else if (hasLayers) { score -= 4; notes.push("layering in hot weather"); }
    if (hasLightFabric) { score += 2; notes.push("breathable fabric — heat-smart"); }
    if (hasOpenToe)     { score += 1; notes.push("open-toe footwear — appropriate"); }
  }

  if (isWarm) {
    if (/wool|fleece|velvet/.test(nameblob))   { score -= 4; notes.push("wool/velvet in warm weather"); }
    if (hasHeavyLayer)                          { score -= 3; notes.push("heavy coat in mild warmth"); }
    if (hasLightFabric)                         { score += 1; notes.push("light fabric — good choice"); }
  }

  if (isMild) {
    if (hasLayers)      { score += 1; notes.push("light layer — smart for mild weather"); }
    if (hasHeavyFabric) { score -= 1; notes.push("heavy fabric slightly warm for mild day"); }
  }

  if (isChilly) {
    if (hasMiniOrShort && !hasLayers) { score -= 3; notes.push("mini/shorts with no layer in chill"); }
    if (hasSleeveless && !hasLayers)  { score -= 2; notes.push("sleeveless with no layer in chill"); }
    if (!hasLayers)   { score -= 2; notes.push("no outerwear on a chilly day"); }
    else              { score += 2; notes.push("layered look — right for the chill"); }
  }

  if (isCold) {
    if (!hasLayers && !hasHeavyFabric) { score -= 6; notes.push("no warm layers in cold weather"); }
    if (hasHeavyFabric)   { score += 2; notes.push("appropriate weight fabric for cold"); }
    if (hasBoots)         { score += 1; notes.push("boots — seasonally smart"); }
    if (hasOpenToe)       { score -= 3; notes.push("open-toe in cold weather"); }
  }

  if (isRainy) {
    if (hasSuede)     { score -= 4; notes.push("suede in rain — avoid"); }
    if (hasOpenToe)   { score -= 2; notes.push("open-toe in rain — impractical"); }
    if (hasBoots)     { score += 2; notes.push("boots — practical for rain"); }
    if (/silk|chiffon|organza/.test(nameblob)) { score -= 3; notes.push("delicate fabric in rain"); }
  }

  if (notes.length === 0) {
    notes.push(`outfit appropriate for ${tempC !== null ? tempC + "°C" : "the weather"}`);
  }

  return { score, reason: notes.join("; ") };
}

// ── 4. Occasion Fit ────────────────────────────────────────────────────────────
export function scoreOccasionFit(items = [], occasion = "") {
  const occ = occasion.toLowerCase();
  const nb  = blob(items);
  let score = 0;
  const notes = [];

  const isAthleisure = /gym|athletic|track|training|running|sportswear|jogger|activewear/.test(nb);
  const isBlazer     = /blazer|suit jacket|structured jacket/.test(nb);
  const isFormalBot  = /trouser|slacks|chinos|dress pant|dress trouser/.test(nb);
  const isHeels      = /heel|pump|stiletto|kitten heel/.test(nb);
  const isSneaker    = /sneaker|trainer|running shoe|canvas shoe/.test(nb);
  const isSandal     = /sandal|flip.flop|slide|mule/.test(nb);
  const isBoots      = /boot|chelsea|ankle boot/.test(nb);
  const isLoafer     = /loafer|oxford|derby|moccasin/.test(nb);
  const isDress      = /dress|gown|jumpsuit/.test(nb);
  const isCasualTop  = /\bt.?shirt\b|tee\b/.test(nb);
  const isJeans      = /jeans|denim/.test(nb);
  const isEthnic     = /saree|lehenga|kurta|anarkali|sherwani|bandhgala|jutti|dupatta/.test(nb);
  const isLinen      = /linen|cotton|flowy|breezy|printed/.test(nb);
  const isComfort    = /jogger|sweatpant|track pant/.test(nb);

  if (/(formal|interview|office|workwear|business)/.test(occ)) {
    if (isBlazer)                          { score += 3; notes.push("blazer — office-correct"); }
    if (isFormalBot)                       { score += 2; notes.push("trousers — formal-appropriate"); }
    if (isHeels || isLoafer || isBoots)    { score += 2; notes.push("polished footwear"); }
    if (isAthleisure)                      { score -= 7; notes.push("sportswear — completely wrong for office"); }
    if (isSneaker && !isBlazer)            { score -= 2; notes.push("sneakers too casual for formal"); }
    if (isSandal)                          { score -= 2; notes.push("sandals too relaxed for formal"); }
    if (isCasualTop && !isBlazer)          { score -= 2; notes.push("plain tee without blazer — underdressed"); }
  }

  if (/(date|dinner|night out|cocktail|gala)/.test(occ)) {
    if (isDress)     { score += 4; notes.push("dress — effortlessly elevated for evening"); }
    if (isHeels)     { score += 3; notes.push("heels — evening-ready"); }
    if (isBlazer)    { score += 1; notes.push("blazer adds polish"); }
    if (isAthleisure){ score -= 6; notes.push("sportswear — wrong for date night"); }
    if (isSneaker && !/(smart)/.test(occ)) { score -= 1; notes.push("sneakers slightly casual for evening"); }
  }

  if (/(brunch|casual|day out|shopping|errand|coffee)/.test(occ)) {
    if (isSneaker)   { score += 1; notes.push("sneakers — casual-correct"); }
    if (isJeans)     { score += 1; notes.push("jeans — casual staple"); }
    if (isAthleisure){ score -= 2; notes.push("pure sportswear overdone even for casual"); }
    if (isDress && isLoafer) { score += 1; notes.push("dress + loafer — brunch-chic"); }
  }

  if (/(vacation|resort|beach|holiday)/.test(occ)) {
    if (isSandal)    { score += 2; notes.push("sandals — resort-perfect"); }
    if (isLinen)     { score += 2; notes.push("breezy fabrics — vacation-ready"); }
    if (isBlazer)    { score -= 2; notes.push("blazer too structured for vacation"); }
    if (isAthleisure){ score -= 1; notes.push("activewear slightly off for resort"); }
  }

  if (/(airport|travel)/.test(occ)) {
    if (isSneaker || isBoots || isLoafer) { score += 2; notes.push("practical footwear for travel"); }
    if (isHeels)     { score -= 3; notes.push("heels — impractical for airport"); }
    if (isComfort)   { score += 1; notes.push("comfort layers — airport-smart"); }
  }

  if (/(festive|wedding|ethnic|puja|ceremony)/.test(occ)) {
    if (isEthnic)    { score += 5; notes.push("ethnic wear — festive-perfect"); }
    if (isAthleisure){ score -= 8; notes.push("sportswear — completely wrong for festive"); }
    if (isHeels)     { score += 2; notes.push("heels — festive-appropriate"); }
    if (isDress)     { score += 2; notes.push("dress — festive-acceptable"); }
  }

  if (/(gym|workout|fitness|sport)/.test(occ)) {
    if (isAthleisure){ score += 5; notes.push("activewear — gym-correct"); }
    if (isBlazer || isHeels || isDress) { score -= 6; notes.push("formal wear wrong for gym"); }
    if (isSneaker)   { score += 2; notes.push("sneakers — gym footwear"); }
  }

  return { score, reason: notes.join("; ") || "occasion-appropriate" };
}

// ── 5. Aesthetic Consistency ────────────────────────────────────────────────
const VIBE_KEYWORDS = {
  minimal:    ["white","black","grey","beige","clean","structured","trouser","loafer","turtleneck"],
  streetwear: ["oversized","hoodie","sneaker","baggy","cargo","graphic tee","cap","bucket hat","tracksuit"],
  boho:       ["flowy","floral","linen","maxi","fringe","earthy","tassel","wrap","embroidered"],
  preppy:     ["polo","blazer","chinos","loafer","plaid","stripe","navy","argyle"],
  glamour:    ["satin","sequin","heel","bodycon","metallic","lace","gown","clutch","sparkle"],
  sporty:     ["track","jogger","athletic","sneaker","gym","activewear","zip-up","bomber"],
  romantic:   ["ruffle","floral","pastel","pink","puff sleeve","lace","pearl","midi","cotton candy"],
  edgy:       ["leather","studded","boot","black","chain","dark","grunge","metal","distressed"],
  smart:      ["blazer","trouser","shirt","collar","button","structured","knit","loafer"],
};

export function scoreAestheticConsistency(items = [], vibe = "") {
  const vb = vibe.toLowerCase();
  const nb = blob(items);

  // Score each vibe against the items
  let bestVibe = null;
  let bestHits = 0;
  for (const [vibeName, keywords] of Object.entries(VIBE_KEYWORDS)) {
    const hits = keywords.filter((k) => nb.includes(k)).length;
    if (hits > bestHits) { bestVibe = vibeName; bestHits = hits; }
  }

  // Find if user requested a specific vibe
  let requestedVibe = null;
  for (const vibeName of Object.keys(VIBE_KEYWORDS)) {
    if (vb.includes(vibeName)) { requestedVibe = vibeName; break; }
  }

  if (requestedVibe) {
    const requestedHits = VIBE_KEYWORDS[requestedVibe].filter((k) => nb.includes(k)).length;
    if (requestedHits >= 2 && bestVibe === requestedVibe)
      return { score: 3, reason: `strong ${requestedVibe} aesthetic — matches requested vibe` };
    if (requestedHits >= 1)
      return { score: 1, reason: `hints of ${requestedVibe} vibe` };
    return { score: -1, reason: `items don't align with requested ${requestedVibe} vibe` };
  }

  if (bestHits >= 3) return { score: 2, reason: `coherent ${bestVibe} aesthetic` };
  if (bestHits >= 1) return { score: 1, reason: `subtle ${bestVibe} touches` };
  return { score: 0, reason: "mixed aesthetic — no strong signature" };
}

// ── Master Scorer ────────────────────────────────────────────────────────────
// Weights: color 20%, silhouette 25%, weather 20%, occasion 25%, aesthetic 10%
const WEIGHTS = { color: 0.20, silhouette: 0.25, weather: 0.20, occasion: 0.25, aesthetic: 0.10 };

export function calculateOutfitScore(items = [], ctx = {}) {
  const color     = scoreColorHarmony(items);
  const silhouette = scoreSilhouetteBalance(items);
  const weather   = scoreWeatherFit(items, ctx.weather || "");
  const occasion  = scoreOccasionFit(items, ctx.occasion || "");
  const aesthetic = scoreAestheticConsistency(items, ctx.vibe || "");

  const total = (
    color.score     * WEIGHTS.color +
    silhouette.score * WEIGHTS.silhouette +
    weather.score   * WEIGHTS.weather +
    occasion.score  * WEIGHTS.occasion +
    aesthetic.score * WEIGHTS.aesthetic
  );

  return {
    total: Math.round(total * 100) / 100,
    breakdown: { color, silhouette, weather, occasion, aesthetic },
  };
}
