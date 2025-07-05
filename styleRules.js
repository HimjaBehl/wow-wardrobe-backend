function validateLookAgainstRules(look, userRules = {}) {
  const items = look.items || [];
  const banned = userRules.bannedItems || [];

  if (items.length < 3) return false;

  let hasTop = false;
  let hasBottom = false;
  let hasFootwear = false;
  let isDress = false;

  for (const item of items) {
    const category = (item.category || "").toLowerCase();
    const name = (item.name || "").toLowerCase();

    if (["t-shirt", "shirt", "top", "blouse", "tank"].some(k => name.includes(k) || category.includes(k))) {
      hasTop = true;
    }

    if (["jeans", "shorts", "pants", "trousers", "skirt"].some(k => name.includes(k) || category.includes(k))) {
      hasBottom = true;
    }

    if (["footwear", "shoes", "heels", "sneakers", "sandals", "boots"].some(k => name.includes(k) || category.includes(k))) {
      hasFootwear = true;
    }

    if (["dress", "jumpsuit", "gown"].some(k => name.includes(k) || category.includes(k))) {
      isDress = true;
    }

    for (const ban of banned) {
      if (name.includes(ban) || category.includes(ban)) return false;
    }
  }

  const fullSet = hasTop && hasBottom && hasFootwear;
  const onePieceSet = isDress && hasFootwear;

  return fullSet || onePieceSet;
}

module.exports = { validateLookAgainstRules };