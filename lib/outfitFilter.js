// ── Outfit Filter + Ranking Engine ─────────────────────────────────────────
// Post-processes GPT-generated candidates: scores, hard-filters, diversifies,
// and returns only the strongest N outfits.
// This file is the selection brain — it runs after GPT generates candidates.

import { calculateOutfitScore } from "./outfitScoring.js";
import { classifyAnchorItem, detectVisualCompetition, scoreAnchorFit } from "./anchorIntelligence.js";
import { scoreTasteMatch } from "./tasteProfile.js";

// ── Constants ────────────────────────────────────────────────────────────────
export const MINIMUM_SCORE = 0.4;

// ── Helpers ──────────────────────────────────────────────────────────────────
function itemBlob(items = []) {
  return items
    .map((it) => `${it.name || ""} ${it.category || ""} ${(it.tags || []).join(" ")}`)
    .join(" ")
    .toLowerCase();
}

// ── Aesthetic Inference ───────────────────────────────────────────────────────
const AESTHETIC_SIGNALS = {
  monochrome:     null, // handled via color analysis
  minimal:        /\b(white|beige|cream|ivory|trouser|loafer|structured|turtleneck|clean line)\b/,
  streetwear:     /\b(oversized|hoodie|sneaker|baggy|cargo|graphic|cap|bucket hat|tracksuit|jogger)\b/,
  boho:           /\b(flowy|floral|linen|maxi|fringe|earthy|tassel|wrap|embroidered|crochet|peasant)\b/,
  preppy:         /\b(polo|blazer|chinos|chino|plaid|stripe|argyle|cable knit)\b/,
  glamour:        /\b(satin|sequin|heel|bodycon|metallic|lace|gown|clutch|silk)\b/,
  sporty:         /\b(track|jogger|athletic|activewear|zip.up|bomber|training)\b/,
  romantic:       /\b(ruffle|floral|pastel|pink|puff sleeve|lace|pearl|midi|ribbon)\b/,
  edgy:           /\b(leather|studded|black|chain|grunge|distressed|boot|chain bag|moto)\b/,
  "smart casual": /\b(blazer|trouser|button.up|oxford|loafer|chino|polo shirt)\b/,
  resort:         /\b(linen|cotton|sandal|printed|breezy|tropical|vacation|kaftan)\b/,
  "elevated casual": /\b(silk|cashmere|tailored|clean|neutral|minimal|crisp)\b/,
};

export function inferOutfitAesthetic(items = []) {
  const nb  = itemBlob(items);
  const colors = items.map((it) => (it.color || "").toLowerCase()).filter(Boolean);

  // Monochrome: all items from same color family
  const neutralFamilies = ["black", "white", "grey", "beige", "cream", "tan", "navy", "brown"];
  const nonNeutral = colors.filter((c) => !neutralFamilies.some((n) => c.includes(n)));
  const neutralOnly = nonNeutral.length === 0 && colors.length >= 2;
  if (neutralOnly) return "monochrome";

  // Tone-based: single accent
  if (nonNeutral.length === 1 && colors.length >= 2) return "elevated casual";

  let best = { name: "mixed", hits: 0 };
  for (const [name, pattern] of Object.entries(AESTHETIC_SIGNALS)) {
    if (!pattern) continue;
    const hits = (nb.match(new RegExp(pattern.source, "gi")) || []).length;
    if (hits > best.hits) best = { name, hits };
  }

  return best.name;
}

// ── Footwear Impact Score ─────────────────────────────────────────────────────
export function scoreFootwearImpact(items = [], occasion = "", vibe = "") {
  const nb  = itemBlob(items);
  const occ = occasion.toLowerCase();
  const vb  = vibe.toLowerCase();

  const hasFootwear     = /footwear|shoe|boot|sandal|heel|sneaker|loafer|jutti|pump/.test(nb);
  if (!hasFootwear) return { score: -10, reason: "no footwear — critically incomplete" };

  let score = 0;
  const notes = [];

  const isHeels   = /\b(heel|pump|stiletto|kitten heel|court shoe)\b/.test(nb);
  const isSneaker = /\b(sneaker|trainer|canvas shoe|running shoe)\b/.test(nb);
  const isBoots   = /\b(boot|ankle boot|chelsea|combat boot|knee.high)\b/.test(nb);
  const isLoafer  = /\b(loafer|oxford|derby|moccasin|brogues)\b/.test(nb);
  const isSandal  = /\b(sandal|slide|mule|flip.flop|thong sandal)\b/.test(nb);
  const isJutti   = /\b(jutti|kolhapuri|mojari|ethnic footwear)\b/.test(nb);
  const isChunky  = /\b(chunky|platform|wedge|thick sole)\b/.test(nb);

  // Occasion alignment — strong signals
  if (/(formal|interview|office|workwear|business)/.test(occ)) {
    if (isHeels || isLoafer)       { score += 4; notes.push("heels/loafers — office-polished"); }
    if (isSneaker)                  { score -= 3; notes.push("sneakers — too casual for office"); }
    if (isSandal)                   { score -= 3; notes.push("sandals — wrong for formal"); }
    if (isBoots)                    { score += 1; notes.push("boots — acceptable for smart office"); }
  }

  if (/(date|dinner|cocktail|night out|gala|anniversary)/.test(occ)) {
    if (isHeels)                    { score += 5; notes.push("heels — evening-perfect"); }
    if (isBoots)                    { score += 2; notes.push("ankle boots — stylish evening choice"); }
    if (isLoafer)                   { score += 2; notes.push("loafers — smart-chic for dinner"); }
    if (isSneaker)                  { score -= 2; notes.push("sneakers — casual for date night"); }
  }

  if (/(brunch|casual|coffee|day out|shopping|errand|park)/.test(occ) || /(relaxed|casual)/.test(vb)) {
    if (isSneaker)                  { score += 3; notes.push("sneakers — casual-perfect"); }
    if (isLoafer)                   { score += 2; notes.push("loafers — smart-casual elevation"); }
    if (isSandal)                   { score += 1; notes.push("sandals — easy casual"); }
    if (isHeels)                    { score -= 1; notes.push("heels slightly overdressed for casual"); }
  }

  if (/(streetwear|urban|hype)/.test(occ) || /(streetwear|hypebeast)/.test(vb)) {
    if (isSneaker)                  { score += 5; notes.push("sneakers — streetwear essential"); }
    if (isChunky)                   { score += 3; notes.push("chunky sole — on-trend silhouette weight"); }
    if (isLoafer)                   { score -= 1; notes.push("loafers — too preppy for streetwear"); }
    if (isHeels)                    { score -= 3; notes.push("heels — wrong energy for street"); }
  }

  if (/(vacation|resort|beach|pool)/.test(occ)) {
    if (isSandal)                   { score += 5; notes.push("sandals — resort-perfect"); }
    if (isHeels)                    { score -= 3; notes.push("heels — impractical for resort"); }
    if (isSneaker)                  { score += 1; notes.push("sneakers — casual resort ok"); }
  }

  if (/(airport|travel|commute)/.test(occ)) {
    if (isSneaker || isLoafer)      { score += 4; notes.push("comfortable footwear for travel"); }
    if (isHeels)                    { score -= 4; notes.push("heels — impractical for airport"); }
  }

  if (/(festive|wedding|ethnic|puja|ceremony|diwali|eid)/.test(occ)) {
    if (isJutti)                    { score += 6; notes.push("jutti — ethnic footwear perfection"); }
    if (isHeels)                    { score += 3; notes.push("heels — festive-appropriate"); }
    if (isSneaker)                  { score -= 4; notes.push("sneakers — wrong for festive"); }
  }

  if (/(gym|workout|fitness|sport|yoga)/.test(occ)) {
    if (isSneaker)                  { score += 5; notes.push("sneakers — gym essential"); }
    if (isHeels || isLoafer)        { score -= 5; notes.push("formal footwear — wrong for gym"); }
  }

  // Silhouette contribution
  if (isChunky) notes.push("chunky sole adds visual weight at base");
  if (isBoots)  notes.push("boots anchor and extend the leg line");

  if (notes.length === 0) notes.push("footwear-appropriate for occasion");
  return { score, reason: notes.join("; ") };
}

// ── Hard Penalties ────────────────────────────────────────────────────────────
export function applyHardPenalties(items = [], ctx = {}) {
  const nb        = itemBlob(items);
  const occasion  = (ctx.occasion || "").toLowerCase();
  let   penalty   = 0;
  const reasons   = [];

  // Structural violations ─────────────────────────────────────────────────
  const tops    = items.filter((it) => /\b(top|shirt|blouse|tee|t-shirt|tank|kurta|bodysuit)\b/i.test(`${it.name || ""} ${it.category || ""}`));
  const bottoms = items.filter((it) => /\b(bottom|pants|trouser|jeans|shorts|skirt|palazzo|leggings|salwar)\b/i.test(`${it.name || ""} ${it.category || ""}`));
  const dresses = items.filter((it) => /\b(dress|jumpsuit|saree|gown)\b/i.test(`${it.name || ""} ${it.category || ""}`));

  if (dresses.length > 0 && (tops.length > 0 || bottoms.length > 0)) {
    penalty -= 20; reasons.push("HARD: dress/jumpsuit + separate top/bottom — structural conflict");
  }
  if (tops.length > 1)    { penalty -= 12; reasons.push("HARD: 2+ tops — can't layer two tops as equal pieces"); }
  if (bottoms.length > 1) { penalty -= 12; reasons.push("HARD: 2+ bottoms — structural impossibility"); }

  // Volume overload ────────────────────────────────────────────────────────
  const isTopBulky    = /\b(oversized|boxy|baggy|puffer top|chunky knit|heavy sweater)\b/.test(nb);
  const isBottomBulky = /\b(wide.leg|palazzo|cargo|baggy jean|flared pant)\b/.test(nb);
  const isOuterBulky  = /\b(oversized (jacket|coat|blazer)|puffer (coat|jacket)|padded coat)\b/.test(nb);

  if (isTopBulky && isBottomBulky && isOuterBulky) {
    penalty -= 16; reasons.push("HARD: triple volume (bulky top + bulky bottom + bulky outer) — unwearable");
  } else if (isTopBulky && isBottomBulky) {
    penalty -= 8;  reasons.push("bulky top + wide-leg — both sides add volume, looks misshapen");
  }

  // Lounge/sleepwear in wrong context ──────────────────────────────────────
  const isLounge = /\b(pyjama|pajama|night suit|loungewear|sleepwear|nightgown)\b/.test(nb);
  if (isLounge && /(formal|office|interview|date|dinner|festive)/.test(occasion)) {
    penalty -= 18; reasons.push("HARD: lounge/sleepwear for formal/elevated occasion");
  }

  // Gymwear in wrong context ───────────────────────────────────────────────
  const isGym = /\b(gym shorts|sports bra|compression|running tight|activewear)\b/.test(nb);
  if (isGym && /(formal|office|date|dinner|festive|wedding)/.test(occasion)) {
    penalty -= 14; reasons.push("HARD: activewear for formal/elevated occasion");
  }

  // Weather HARD penalties ──────────────────────────────────────────────────
  const weatherStr = (ctx.weather || "").toLowerCase();
  const tempMatchW = weatherStr.match(/(-?\d+)\s*°?\s*c/i);
  const tempCW     = tempMatchW ? Number(tempMatchW[1]) : null;

  if (tempCW !== null) {
    const nbHoodie = /\bhoodie\b|\bsweatshirt\b|\bpullover\b/.test(nb);
    const nbJacket = /\b(jacket|coat|blazer|puffer)\b/.test(nb);
    const nbPuffer = /\b(puffer|down jacket|padded coat|parka)\b/.test(nb);
    const nbWool   = /\b(wool|fleece|sherpa|heavy knit)\b/.test(nb);
    const dblLayer = nbHoodie && nbJacket;

    if (tempCW >= 26 && dblLayer) {
      penalty -= 20;
      reasons.push(`HARD: hoodie + jacket double-layer at ${tempCW}°C — heat trap, auto-reject`);
    }
    if (tempCW >= 30 && nbHoodie && !dblLayer) {
      penalty -= 15;
      reasons.push(`HARD: hoodie/sweatshirt at ${tempCW}°C — completely inappropriate for heat`);
    }
    if (tempCW >= 26 && nbPuffer) {
      penalty -= 15;
      reasons.push(`HARD: puffer/heavy coat at ${tempCW}°C — thermally impossible`);
    }
    if (tempCW >= 28 && nbWool) {
      penalty -= 12;
      reasons.push(`HARD: wool/fleece at ${tempCW}°C — overheating risk`);
    }

    console.log(`[HardPenalty] 🌡️ ${tempCW}°C | hoodie:${nbHoodie} jacket:${nbJacket} dblLayer:${dblLayer} puffer:${nbPuffer} wool:${nbWool}`);
  }

  // Too many items ─────────────────────────────────────────────────────────
  if (items.length > 6) {
    penalty -= 4; reasons.push(`${items.length} items — over-styled, edit to max 6`);
  }

  // Single-item (not an emergency fallback) ────────────────────────────────
  if (items.length === 1) {
    penalty -= 10; reasons.push("HARD: single-item outfit is incomplete");
  }

  return { penalty, reasons };
}

// ── Reward Signals ────────────────────────────────────────────────────────────
export function applyRewardSignals(items = [], ctx = {}) {
  const nb       = itemBlob(items);
  const colors   = items.map((it) => (it.color || "").toLowerCase()).filter(Boolean);
  const occasion = (ctx.occasion || "").toLowerCase();
  const weatherStr = ctx.weather || "";
  let   reward   = 0;
  const reasons  = [];

  // Perfect silhouette contrast ────────────────────────────────────────────
  const topOversized  = /\b(oversized|boxy|baggy)\b/.test(nb) && /\b(top|shirt|hoodie|sweatshirt|tee)\b/.test(nb);
  const botSlim       = /\b(skinny|slim|straight|fitted|tapered)\b/.test(nb) && /\b(jeans|pant|trouser|legging)\b/.test(nb);
  const botWide       = /\b(wide.leg|palazzo|flared)\b/.test(nb);
  const topFitted     = /\b(fitted|crop|bodycon|tucked)\b/.test(nb) && /\b(top|shirt|blouse)\b/.test(nb);

  if (topOversized && botSlim) { reward += 6; reasons.push("perfect balance: oversized top + slim bottom"); }
  if (botWide && topFitted)    { reward += 6; reasons.push("editorial balance: wide-leg + fitted top"); }

  // Color harmony signals ──────────────────────────────────────────────────
  const neutralColors = colors.filter((c) => /black|white|grey|gray|beige|cream|tan|navy|brown|khaki|camel/.test(c));
  const accentColors  = colors.filter((c) => !/black|white|grey|gray|beige|cream|tan|navy|brown|khaki|camel/.test(c));

  if (neutralColors.length >= 2 && accentColors.length === 1) {
    reward += 5; reasons.push(`neutral base + one accent (${accentColors[0]}) — polished`);
  }
  if (accentColors.length === 0 && colors.length >= 2) {
    reward += 4; reasons.push("clean monochrome/neutral palette — effortlessly chic");
  }

  // Strong footwear match ──────────────────────────────────────────────────
  const strongFootwear = /\b(heel|loafer|boot|jutti|oxford)\b/.test(nb);
  if (strongFootwear) { reward += 2; reasons.push("intentional footwear choice"); }

  // Smart layering ─────────────────────────────────────────────────────────
  const hasLayer = /\b(blazer|jacket|cardigan|coat|shrug)\b/.test(nb);
  const tempMatch = weatherStr.match(/(-?\d+).*°/);
  const tempC = tempMatch ? Number(tempMatch[1]) : null;
  if (hasLayer && tempC !== null && tempC < 22) {
    reward += 3; reasons.push("smart outerwear choice for the temperature");
  }
  if (hasLayer && /(formal|office|smart|dinner|date)/.test(occasion)) {
    reward += 3; reasons.push("structured layer elevates the occasion");
  }

  // Anchor item present ────────────────────────────────────────────────────
  if (ctx.anchorItem) {
    const anchorId = String(ctx.anchorItem.idx || ctx.anchorItem.id || "");
    const hasAnchor = items.some((it) => String(it.idx || it.id || "") === anchorId);
    if (hasAnchor)  { reward += 8; reasons.push("anchor piece correctly included"); }
    else            { reward -= 12; reasons.push("CRITICAL: anchor piece missing from outfit"); }
  }

  // Modern proven combinations ─────────────────────────────────────────────
  if (/blazer/.test(nb) && /jeans/.test(nb))    { reward += 3; reasons.push("blazer + jeans — modern smart casual classic"); }
  if (/boot/.test(nb)   && /dress/.test(nb))    { reward += 3; reasons.push("boots + dress — fashion-forward editorial"); }
  if (/boot/.test(nb)   && /skirt/.test(nb))    { reward += 3; reasons.push("boots + skirt — textbook styling combo"); }
  if (/loafer/.test(nb) && /straight/.test(nb)) { reward += 2; reasons.push("loafer + straight leg — clean modern pairing"); }

  // Staple-as-support (not staple-heavy) ───────────────────────────────────
  const wardrobeCount = items.filter((it) => it.source !== "staple").length;
  const stapleCount   = items.filter((it) => it.source === "staple").length;
  if (wardrobeCount >= 2 && stapleCount <= 2) {
    reward += 2; reasons.push("wardrobe-led styling (staples as support)");
  }
  if (stapleCount > wardrobeCount && items.length >= 3) {
    reward -= 3; reasons.push("staple-heavy outfit — user's own pieces under-utilised");
  }

  return { reward, reasons };
}

// ── Full Outfit Score ─────────────────────────────────────────────────────────
export function fullOutfitScore(items = [], ctx = {}) {
  const base        = calculateOutfitScore(items, ctx);
  const footwear    = scoreFootwearImpact(items, ctx.occasion || "", ctx.vibe || "");
  const penalties   = applyHardPenalties(items, ctx);
  const rewards     = applyRewardSignals(items, ctx);
  const aesthetic   = inferOutfitAesthetic(items);
  const anchor      = scoreAnchorFit(items, ctx.anchorItem || null);
  const competition = detectVisualCompetition(items, ctx.anchorItem || null);
  const taste       = scoreTasteMatch(items, ctx.tasteProfile || null);

  const total =
    base.total +
    footwear.score    * 0.4 +
    penalties.penalty +
    rewards.reward    +
    anchor.score      +
    competition.penalty +
    taste.score;

  const hasHardFail = penalties.reasons.some((r) => r.startsWith("HARD:"));

  return {
    total: Math.round(total * 100) / 100,
    aesthetic,
    accepted: !hasHardFail && total >= MINIMUM_SCORE,
    breakdown: {
      base: base.breakdown,
      footwear,
      penalties,
      rewards,
      anchor,
      competition,
      taste,
    },
  };
}

// ── Structural Validation ─────────────────────────────────────────────────────
export function validateOutfitStructure(items = []) {
  if (!items || items.length === 0) return { valid: false, reason: "empty outfit" };

  const nb       = itemBlob(items);
  const hasFw    = /footwear|shoe|boot|sandal|heel|sneaker|loafer|jutti|pump/.test(nb);
  const hasDress = /\b(dress|jumpsuit|saree|gown)\b/.test(nb);
  const hasTop   = /\b(shirt|top|blouse|tee|t-shirt|tank|kurta)\b/.test(nb);
  const hasBot   = /\b(pants|trouser|jeans|shorts|skirt|palazzo|bottom)\b/.test(nb);
  const hasOuter = /\b(blazer|jacket|coat|hoodie|sweatshirt|cardigan)\b/.test(nb);

  if (!hasFw && items.length >= 2)
    return { valid: false, reason: "no footwear" };

  if (hasDress && (hasTop || hasBot))
    return { valid: false, reason: "dress + separate top/bottom — structural conflict" };

  // Must have at least clothing (not just footwear + bag)
  if (!hasDress && !hasTop && !hasBot && !hasOuter)
    return { valid: false, reason: "outfit has no clothing pieces" };

  return { valid: true, reason: "ok" };
}

// ── Outfit Fingerprint (for diversity check) ──────────────────────────────────
function getFingerprint(items = []) {
  const nb = itemBlob(items);

  const silhouette =
    /\b(oversized|boxy|baggy)\b/.test(nb) ? "volume"
    : /\b(wide.leg|palazzo|flared)\b/.test(nb) ? "wide"
    : /\b(slim|fitted|skinny|tapered)\b/.test(nb) ? "slim"
    : /\b(dress|jumpsuit|saree)\b/.test(nb) ? "onepiece"
    : "balanced";

  const footwearType =
    /\b(sneaker|trainer)\b/.test(nb) ? "sneaker"
    : /\b(boot|chelsea|ankle boot)\b/.test(nb) ? "boot"
    : /\b(heel|pump|stiletto)\b/.test(nb) ? "heel"
    : /\b(sandal|slide|mule)\b/.test(nb) ? "sandal"
    : /\b(loafer|oxford|derby)\b/.test(nb) ? "loafer"
    : /\b(jutti|kolhapuri)\b/.test(nb) ? "jutti"
    : "other";

  const hasLayer = /\b(blazer|jacket|coat|cardigan|shrug)\b/.test(nb);

  return { silhouette, footwearType, hasLayer };
}

function isTooSimilar(a = [], b = []) {
  // Item overlap: if they share 2+ non-footwear items, they're too similar
  const fwRe = /footwear|shoe|boot|sandal|heel|sneaker|loafer|jutti/i;
  const aCore = a.filter((it) => !fwRe.test(`${it.category || ""} ${it.name || ""}`));
  const bCore = b.filter((it) => !fwRe.test(`${it.category || ""} ${it.name || ""}`));

  const aIds = new Set(aCore.map((it) => String(it.idx || it.id || it.name || "")));
  const bIds = new Set(bCore.map((it) => String(it.idx || it.id || it.name || "")));

  let shared = 0;
  for (const id of aIds) if (bIds.has(id)) shared++;
  if (shared >= 2 && aIds.size >= 2) return true;

  // Fingerprint: same silhouette + same footwear type + same layering = boring duplicate
  const fa = getFingerprint(a);
  const fb = getFingerprint(b);
  return fa.silhouette === fb.silhouette
    && fa.footwearType === fb.footwearType
    && fa.hasLayer     === fb.hasLayer;
}

// ── Main: Filter + Rank + Diversify ──────────────────────────────────────────
export function filterAndRankOutfits(outfits = [], ctx = {}, options = {}) {
  const { count = 3 } = options;

  console.log(`\n${"─".repeat(60)}`);
  console.log(`🧠 OUTFIT FILTER — evaluating ${outfits.length} candidates`);
  if (ctx.tasteProfile?.styleIdentity && ctx.tasteProfile.styleIdentityConfidence > 0.1) {
    console.log(`  👤 User identity: "${ctx.tasteProfile.styleIdentity}" (conf:${ctx.tasteProfile.styleIdentityConfidence}) | signals:${ctx.tasteProfile.tasteWeights?.totalSignals || 0}`);
  }
  console.log(`${"─".repeat(60)}`);

  // Step 1: Structural check + full scoring ─────────────────────────────────
  const scored = outfits.map((look, i) => {
    const items = look.items || [];
    const struct = validateOutfitStructure(items);

    if (!struct.valid) {
      console.log(`\n🚫 OUTFIT ${i + 1} "${look.title}" — STRUCTURAL REJECT: ${struct.reason}`);
      return { ...look, _score: -999, _accepted: false, _aesthetic: "invalid", _rejectReason: struct.reason };
    }

    const scoreResult = fullOutfitScore(items, ctx);
    const status = scoreResult.accepted ? "✅ PASS" : "🚫 FAIL";

    console.log(`\n${status} OUTFIT ${i + 1} "${look.title || "Untitled"}" | score: ${scoreResult.total} | aesthetic: ${scoreResult.aesthetic}`);
    if (scoreResult.breakdown.base.color)      console.log(`  🎨 color:      ${scoreResult.breakdown.base.color.reason}`);
    if (scoreResult.breakdown.base.silhouette) console.log(`  📐 silhouette: ${scoreResult.breakdown.base.silhouette.reason}`);
    if (scoreResult.breakdown.base.weather)    console.log(`  🌤 weather:    ${scoreResult.breakdown.base.weather.reason}`);
    if (scoreResult.breakdown.base.occasion)   console.log(`  🎯 occasion:   ${scoreResult.breakdown.base.occasion.reason}`);
    if (scoreResult.breakdown.footwear)        console.log(`  👞 footwear:   ${scoreResult.breakdown.footwear.reason}`);
    if (scoreResult.breakdown.penalties.reasons.length)
      console.log(`  ⛔ penalties:  ${scoreResult.breakdown.penalties.reasons.join(" | ")}`);
    if (scoreResult.breakdown.rewards.reasons.length)
      console.log(`  ⭐ rewards:    ${scoreResult.breakdown.rewards.reasons.join(" | ")}`);
    if (scoreResult.breakdown.anchor?.score !== 0 && scoreResult.breakdown.anchor?.reason)
      console.log(`  🎯 anchor:     [${scoreResult.breakdown.anchor.debug?.anchorType || "?"}] ${scoreResult.breakdown.anchor.reason} (${scoreResult.breakdown.anchor.score > 0 ? "+" : ""}${scoreResult.breakdown.anchor.score})`);
    if (scoreResult.breakdown.competition?.reasons?.length)
      console.log(`  👁 competition:${scoreResult.breakdown.competition.reasons.join(" | ")} (${scoreResult.breakdown.competition.penalty})`);
    if (scoreResult.breakdown.taste?.score !== 0 && scoreResult.breakdown.taste?.reason !== "taste profile still developing")
      console.log(`  👤 taste:      ${scoreResult.breakdown.taste.reason} (${scoreResult.breakdown.taste.score >= 0 ? "+" : ""}${scoreResult.breakdown.taste.score})`);

    return {
      ...look,
      _score:       scoreResult.total,
      _accepted:    scoreResult.accepted,
      _aesthetic:   scoreResult.aesthetic,
      _fingerprint: getFingerprint(items),
      _rejectReason: scoreResult.accepted ? null : `score ${scoreResult.total} < threshold ${MINIMUM_SCORE}`,
    };
  });

  // Step 2: Keep only accepted ───────────────────────────────────────────────
  const accepted = scored.filter((look) => look._accepted);
  const rejected = scored.filter((look) => !look._accepted);

  console.log(`\n📊 Filter result: ${accepted.length} passed, ${rejected.length} failed`);
  if (rejected.length) {
    console.log(`  Rejected: ${rejected.map((r) => `"${r.title}" (${r._rejectReason})`).join(", ")}`);
  }

  // Step 3: Sort by score ───────────────────────────────────────────────────
  accepted.sort((a, b) => (b._score || 0) - (a._score || 0));

  // Step 4: Diversity selection ─────────────────────────────────────────────
  const selected = [];
  const skipped  = [];

  // First pass: strict diversity
  for (const look of accepted) {
    if (selected.length >= count) break;

    const similar = selected.find((s) => isTooSimilar(s.items || [], look.items || []));
    if (similar) {
      console.log(`  ⏭ SKIP (too similar to "${similar.title}"): "${look.title}"`);
      skipped.push(look);
      continue;
    }

    // Soft diversity: avoid same fingerprint (silhouette + footwear + layer)
    const fp = look._fingerprint || {};
    const sameEnergy = selected.filter((s) => {
      const sfp = s._fingerprint || {};
      return sfp.silhouette === fp.silhouette && sfp.footwearType === fp.footwearType;
    }).length;

    if (sameEnergy >= 1 && selected.length >= 1) {
      console.log(`  ⏭ SKIP (same styling energy — ${fp.silhouette}/${fp.footwearType}): "${look.title}"`);
      skipped.push(look);
      continue;
    }

    selected.push(look);
    console.log(`  ✔ SELECT: "${look.title}" (score: ${look._score}, aesthetic: ${look._aesthetic})`);
  }

  // Second pass: fill if diversity was too strict (use skipped outfits)
  if (selected.length < count) {
    for (const look of [...skipped, ...accepted]) {
      if (selected.length >= count) break;
      if (selected.includes(look)) continue;
      const tooSim = selected.some((s) => isTooSimilar(s.items || [], look.items || []));
      if (!tooSim) {
        selected.push(look);
        console.log(`  ✔ SELECT (diversity-relaxed): "${look.title}" (score: ${look._score})`);
      }
    }
  }

  // Third pass: absolute minimum fill — accept anything remaining
  if (selected.length < count) {
    for (const look of accepted) {
      if (selected.length >= count) break;
      if (!selected.includes(look)) {
        selected.push(look);
        console.log(`  ✔ SELECT (min-fill): "${look.title}" (score: ${look._score})`);
      }
    }
  }

  console.log(`\n🎯 Final selection: ${selected.length} outfits from ${outfits.length} candidates`);
  console.log(`${"─".repeat(60)}\n`);

  // Clean internal props before returning
  return selected.slice(0, count).map(({ _score, _accepted, _aesthetic, _fingerprint, _rejectReason, ...look }) => ({
    ...look,
    score: _score,
    aesthetic: _aesthetic,
  }));
}
