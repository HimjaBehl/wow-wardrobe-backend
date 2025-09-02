
// lib/styleRules.js
const onePiece    = /dress|jumpsuit|one-piece/i;
const topwear     = /shirt|blouse|tee|kurta|sweater/i;
const bottomwear  = /jeans|pants|trouser|skirt|shorts/i;

function classify(cat="") {
  if (onePiece.test(cat))   return "onePiece";
  if (topwear.test(cat))    return "top";
  if (bottomwear.test(cat)) return "bottom";
  return "other";
}

function isValidCombo(items=[]) {
  let hasDress = false, hasTop = false, hasBottom = false;
  items.forEach(i => {
    const t = classify(i.category);
    if (t==="onePiece") hasDress  = true;
    if (t==="top")      hasTop    = true;
    if (t==="bottom")   hasBottom = true;
  });
  if (hasDress && (hasTop || hasBottom)) return false;
  if (!hasDress && (!hasTop || !hasBottom)) return false;
  return true;
}

function bansHeels(prefs={}) {
  return (prefs.dislikes||[]).some(d => /heel/i.test(d));
}

function needsLayer(items=[], weather="") {
  return /cold|rain|snow/i.test(weather) && !items.some(i=>/jacket|coat/i.test(i.category));
}

function validateLookAgainstRules(look, rules = {}) {
  const bannedItems = (rules.bannedItems || []).map(x => x.toLowerCase());

  const violatesBan = look.items.some(item => {
    const name = (item.name || "").toLowerCase();
    return bannedItems.some(ban => name.includes(ban));
  });

  return !violatesBan;
}

export { 
  classify,
  isValidCombo,
  bansHeels,
  needsLayer,
  validateLookAgainstRules 
};
