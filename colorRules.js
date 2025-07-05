function harmonious(palettes = []) {
  const unique = [...new Set(palettes)];
  const nonNeutral = unique.filter(p => p !== "neutral");
  return nonNeutral.length <= 2; // max 2 non-neutral palettes
}
module.exports = { harmonious };
