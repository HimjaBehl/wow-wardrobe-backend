// ─── Silhouette helpers ─────────────────────────
function guessSilhouette(text = "") {
  const t = typeof text === "string" ? text.toLowerCase() : "";
  if (/dress/.test(t)) return "fit-and-flare";
  if (/wide|baggy|flare/.test(t)) return "wide-leg";
  if (/slim|skinny|legging/.test(t)) return "slim";
  if (/shirt|top|blouse/.test(t)) return /oversize/.test(t) ? "boxy" : "slim";
  if (/jacket|coat/.test(t)) return "structured";
  return "regular";
}

function pickPalette(color = "") {
  const c = typeof color === "string" ? color.toLowerCase() : "";
  if (/white|black|grey|cream|beige|khaki|nude/.test(c)) return "neutral";
  if (/red|orange|yellow|maroon/.test(c)) return "warm";
  if (/blue|green|teal|purple/.test(c)) return "cool";
  return "unknown";
}

function getSilhouetteRole(text = "") {
  const t = typeof text === "string" ? text.toLowerCase() : "";
  if (/dress|jumpsuit/.test(t)) return "anchor";
  if (/shirt|top|blouse|t-shirt/.test(t)) return "upper";
  if (/jeans|pants|shorts|skirt|trousers?|bottom/.test(t)) return "lower";
  if (/jacket|coat/.test(t)) return "outer";
  if (/bag|shoe|sandal|boot|jewel|watch|sunglass/.test(t)) return "accessory";
  return "misc";
}

module.exports = {
  guessSilhouette,
  pickPalette,
  getSilhouetteRole
};
