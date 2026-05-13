// ── Anchor-Piece Intelligence ────────────────────────────────────────────────
// Classifies the hero item, defines styling rules around it,
// detects visual competition, and scores how well the outfit serves the anchor.

function anchorBlob(item) {
  return `${item.name || ""} ${item.category || ""} ${(item.tags || []).join(" ")} ${item.color || ""}`.toLowerCase();
}

function isLoudBlob(b) {
  // striped?s? and checked? handle adjective forms that break \b on the plain root
  return /\b(floral|printed|pattern|striped?s?|checked?|checkered|plaid|animal|graphic|paisley|geometric|sequin|embroidered?|embroidery|beaded|studded|fringe|metallic|neon|bright|vivid|hot.?pink|lime|cobalt|magenta)\b/.test(b);
}

// ── Anchor Classification ─────────────────────────────────────────────────────
export function classifyAnchorItem(item) {
  if (!item) return null;
  const b = anchorBlob(item);

  const isOuterwear   = /\b(jacket|coat|blazer|cardigan|hoodie|shrug|vest|outer)\b/.test(b);
  const isTop         = /\b(shirt|top|blouse|tee|t-shirt|tank|kurta|bodysuit|crop)\b/.test(b);
  const isBottom      = /\b(pants|trouser|jeans|shorts|skirt|palazzo|leggings|culotte)\b/.test(b);
  const isOnepiece    = /\b(dress|jumpsuit|saree|lehenga|gown|co-ord)\b/.test(b);
  const isFootwear    = /\b(shoe|boot|sandal|heel|sneaker|loafer|jutti|pump|mule)\b/.test(b);

  const isPrinted     = /\b(floral|printed|pattern|stripe|check|plaid|animal|graphic|paisley|tie.dye|geometric|abstract|camo)\b/.test(b);
  const isLoudColor   = /\b(red|orange|yellow|lime|hot.?pink|cobalt|magenta|neon|bright|vivid)\b/.test(b);
  const isEmbellished = /\b(sequin|embroidered|embroidery|beaded|studded|fringe|metallic|glitter|mirror work)\b/.test(b);
  const isOversized   = /\b(oversized|boxy|baggy|relaxed|chunky)\b/.test(b);
  const isTextured    = /\b(velvet|leather|faux leather|suede|lace|tweed|boucle|sherpa)\b/.test(b);
  const isEthnic      = /\b(kurta|saree|lehenga|anarkali|sherwani|bandhgala|kimono|kaftan|dhoti)\b/.test(b);
  const isMinimal     = !isPrinted && !isLoudColor && !isEmbellished && !isOversized && !isTextured && !isEthnic;

  // Classify — most specific first
  let type;
  if      (isEthnic)                             type = "ethnic-statement";
  else if (isEmbellished && isOnepiece)          type = "embellished-dress";
  else if (isEmbellished)                        type = "embellished";
  else if (isPrinted && isOuterwear)             type = "statement-jacket";
  else if (isPrinted && isOnepiece)              type = "printed-dress";
  else if (isPrinted)                            type = "loud-print";
  else if (isLoudColor && isOuterwear)           type = "statement-jacket";
  else if (isLoudColor)                          type = "color-pop";
  else if (isOversized && isOuterwear)           type = "oversized-outer";
  else if (isOversized)                          type = "volume-piece";
  else if (isTextured && isOuterwear)            type = "textured-outer";
  else if (isTextured)                           type = "textured-piece";
  else if (isOuterwear)                          type = "structured-outer";
  else if (isMinimal)                            type = "clean-base";
  else                                           type = "neutral-anchor";

  // One-line styling brief for the system prompt and debug logs
  const briefs = {
    "statement-jacket":  "Inner layers must be simple (plain tee/solid shirt). Clean straight or slim bottom. Restrained footwear (loafers, plain boots, clean sneakers). Nothing else printed or embellished.",
    "loud-print":        "All supporting pieces must be solid neutrals. Neutral footwear (nude/white/black/tan). No competing patterns — let the print breathe.",
    "oversized-outer":   "Slim or straight bottom only — NEVER wide-leg with an oversized outer. Defined-sole footwear (chunky sneakers, structured boots). No additional volume pieces.",
    "volume-piece":      "Fitted or slim counterpart on the opposing half. Structured footwear with visual weight. No second oversized or wide item.",
    "embellished":       "Clean understated pieces only. Simple footwear (plain pumps, loafers, flat sandals). Zero other embellishment, print, or bold color.",
    "embellished-dress": "Minimal accessories only — the dress is enough. Simple heels or strappy sandals. No competing outer layer.",
    "printed-dress":     "Solid-color footwear. Simple belt or bag if needed. No patterned or printed accessories.",
    "color-pop":         "Neutral base pieces (white/black/beige/navy). Footwear neutral or tonal to the pop color. One loud color only — no others.",
    "textured-outer":    "Smooth matte inner pieces. Tailored or slim bottom. No competing textures in other items.",
    "textured-piece":    "Smooth/matte contrast pieces alongside. Clean footwear finish. No second strong texture.",
    "ethnic-statement":  "Ethnic-appropriate accessories only. Footwear: jutti, kolhapuri, heels, or ethnic sandal. Absolutely no casual western footwear (sneakers, flip-flops).",
    "structured-outer":  "Any solid-color inner. Tailored or slim bottom preferred. Smart footwear (loafers, oxford, ankle boots).",
    "clean-base":        "Can support one stronger second piece (interesting jacket, statement shoes, or eye-catching bag). Footwear can be the focal accent here.",
    "neutral-anchor":    "Balanced styling. One piece may make a gentle statement. Let the overall palette be intentional.",
  };

  const brief = briefs[type] || "Support and elevate the hero piece.";
  return { type, brief, isPrinted, isLoudColor, isEmbellished, isOversized, isTextured, isEthnic, isOuterwear, isTop, isBottom, isOnepiece, isFootwear, isMinimal };
}

// ── Visual Competition Detector ───────────────────────────────────────────────
// Penalises outfits where multiple items fight for attention.
export function detectVisualCompetition(items = [], anchorItem = null) {
  const anchorId = anchorItem
    ? String(anchorItem.idx || anchorItem.id || anchorItem.name || "")
    : null;

  const tagged = items.map((it) => {
    const b  = anchorBlob(it);
    const id = String(it.idx || it.id || it.name || "");
    return {
      b, id,
      isAnchor:    !!(anchorId && id === anchorId),
      isStatement: isLoudBlob(b),
      isVolume:    /\b(oversized|boxy|baggy|wide.leg|palazzo|puffer)\b/.test(b),
      isTop:       /\b(shirt|top|blouse|tee|t-shirt|tank|kurta|bodysuit)\b/.test(b),
      isOuter:     /\b(jacket|coat|blazer)\b/.test(b),
      isBottom:    /\b(pants|trouser|jeans|skirt|shorts|palazzo|bottom)\b/.test(b),
      isFootwear:  /\b(shoe|boot|sandal|heel|sneaker|loafer|jutti|pump)\b/.test(b),
    };
  });

  let penalty = 0;
  const reasons = [];

  // Competing statements among non-anchor items
  const nonAnchorStatements = tagged.filter((t) => !t.isAnchor && t.isStatement);

  if (nonAnchorStatements.length >= 2) {
    penalty -= 7 * (nonAnchorStatements.length - 1);
    reasons.push(`${nonAnchorStatements.length} statement pieces — no single focal point`);
  } else if (nonAnchorStatements.length === 1 && anchorId) {
    const anchorAnalysis = anchorItem ? classifyAnchorItem(anchorItem) : null;
    const anchorIsStatement = anchorAnalysis
      && ["statement-jacket","loud-print","embellished","embellished-dress","printed-dress","color-pop"].includes(anchorAnalysis.type);
    if (anchorIsStatement) {
      penalty -= 5;
      reasons.push("one supporting item competes with hero — weakens focal point");
    }
  }

  // Specific loud combos that create visual noise
  const loudTop    = tagged.some((t) => t.isTop     && t.isStatement);
  const loudOuter  = tagged.some((t) => t.isOuter   && t.isStatement);
  const loudBottom = tagged.some((t) => t.isBottom  && t.isStatement);
  const loudShoe   = tagged.some((t) => t.isFootwear && t.isStatement);
  const volTop     = tagged.some((t) => t.isTop     && t.isVolume);
  const volOuter   = tagged.some((t) => t.isOuter   && t.isVolume);
  const volBottom  = tagged.some((t) => t.isBottom  && t.isVolume);

  if (loudTop    && loudShoe)              { penalty -= 6; reasons.push("loud top + loud shoes — two focal points fighting"); }
  if (loudOuter  && loudBottom)            { penalty -= 8; reasons.push("printed outer + printed pants — pattern overload"); }
  if (loudTop    && loudBottom && !loudOuter) { penalty -= 7; reasons.push("loud top + loud bottom — no visual rest zone"); }
  if (volTop     && volBottom  && volOuter)  { penalty -= 5; reasons.push("triple volume — outfit has no point of restraint"); }

  if (penalty < 0) {
    console.log(`[VisualComp] penalty:${penalty} | ${reasons.join(" | ")}`);
  }

  return { penalty, reasons };
}

// ── Anchor Fit Scorer ─────────────────────────────────────────────────────────
// Scores HOW WELL the supporting cast serves the hero piece.
export function scoreAnchorFit(items = [], anchorItem = null) {
  if (!anchorItem) return { score: 0, reason: "no anchor", debug: {} };

  const anchorId = String(anchorItem.idx || anchorItem.id || anchorItem.name || "");
  const inOutfit = items.some((it) => String(it.idx || it.id || it.name || "") === anchorId);
  // Anchor presence/absence is handled by applyRewardSignals — this scorer focuses on styling quality
  if (!inOutfit) return { score: 0, reason: "anchor absent (penalised elsewhere)", debug: {} };

  const analysis   = classifyAnchorItem(anchorItem);
  const support    = items.filter((it) => String(it.idx || it.id || it.name || "") !== anchorId);
  const supBlobs   = support.map(anchorBlob);
  const supBlob    = supBlobs.join(" ");

  let score = 0;
  const notes = [];

  // ── Statement anchors: support crew must step back ───────────────────────
  const statementAnchorTypes = [
    "statement-jacket","loud-print","embellished","embellished-dress","printed-dress","color-pop",
  ];
  if (statementAnchorTypes.includes(analysis.type)) {
    const loudCount = supBlobs.filter(isLoudBlob).length;
    if (loudCount === 0) {
      score += 5; notes.push(`neutral support lets ${analysis.type} own the look`);
    } else if (loudCount === 1) {
      score -= 4; notes.push("one competing piece dilutes hero's impact");
    } else {
      score -= 9; notes.push(`${loudCount} competing pieces — hero is buried`);
    }
    // Restrained footwear bonus for statement anchors
    const footwearBlobs = supBlobs.filter((b) => /\b(shoe|boot|sandal|heel|sneaker|loafer|jutti|pump)\b/.test(b));
    if (footwearBlobs.length) {
      if (footwearBlobs.some(isLoudBlob)) {
        score -= 4; notes.push("loud footwear steals focus from hero piece");
      } else {
        score += 2; notes.push("restrained footwear keeps hero as focal point");
      }
    }
  }

  // ── Oversized anchors: slim counterpart required ─────────────────────────
  if (analysis.type === "oversized-outer" || analysis.type === "volume-piece") {
    const slimBottom =
      /\b(slim|skinny|straight|fitted|tapered)\b/.test(supBlob) &&
      /\b(jean|pant|trouser|legging)\b/.test(supBlob);
    const wideBottom = /\b(wide.leg|palazzo|flared|baggy)\b/.test(supBlob);
    if (slimBottom) { score += 4; notes.push("slim bottom counterbalances oversized anchor"); }
    if (wideBottom) { score -= 5; notes.push("wide bottom doubles volume — proportion conflict"); }
  }

  // ── Ethnic anchors: footwear must match formality ────────────────────────
  if (analysis.type === "ethnic-statement") {
    const ethnicFw  = /\b(jutti|kolhapuri|mojari|ethnic sandal)\b/.test(supBlob);
    const casualFw  = /\b(sneaker|trainer|flip.flop|running shoe|canvas shoe)\b/.test(supBlob);
    if (ethnicFw)  { score += 5; notes.push("ethnic footwear completes the ethnic hero"); }
    if (casualFw)  { score -= 7; notes.push("casual western footwear clashes with ethnic anchor"); }
  }

  // ── Clean-base anchor: one accent piece is the right move ────────────────
  if (analysis.type === "clean-base") {
    const hasAccent = /\b(boot|blazer|structured jacket|loafer|heel|statement)\b/.test(supBlob);
    if (hasAccent) { score += 2; notes.push("clean base correctly elevated by a stronger accent"); }
  }

  // ── Structured outer: check the inner layer is calm ─────────────────────
  if (analysis.type === "structured-outer") {
    const innerBlobs = supBlobs.filter((b) => /\b(shirt|top|blouse|tee|t-shirt)\b/.test(b));
    const loudInner  = innerBlobs.some(isLoudBlob);
    if (!loudInner && innerBlobs.length) {
      score += 2; notes.push("plain inner layer lets structured outer lead");
    } else if (loudInner) {
      score -= 3; notes.push("busy inner layer competes with structured outer");
    }
  }

  const reason = notes.join("; ") || "outfit appropriately supports anchor";
  console.log(`[AnchorScore] type:${analysis.type} | score:${score} | ${reason}`);
  return {
    score,
    reason,
    debug: { anchorType: analysis.type, anchorId, supportCount: support.length },
  };
}
