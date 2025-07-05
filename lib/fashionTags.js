
exports.guessSilhouette = (text = "") => {
  const t = text.toLowerCase();
  if (/dress/.test(t)) return "fit-and-flare";
  if (/wide|baggy|flare/.test(t)) return "wide-leg";
  if (/slim|skinny|legging/.test(t)) return /oversize/.test(t) ? "boxy" : "slim";
  if (/shirt|top|blouse/.test(t)) return /oversize/.test(t) ? "boxy" : "slim";
  if (/jacket|coat/.test(t)) return "structured";
  return "regular";
};

exports.pickPalette = (color = "") => {
  const c = color.toLowerCase();
  if (/white|black|grey|cream|beige|khaki|nude/.test(c)) return "neutral";
  if (/red|orange|yellow|maroon/.test(c)) return "warm";
  if (/blue|green|teal|purple/.test(c)) return "cool";
  return "unknown";
};
