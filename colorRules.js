// ─── COLOR RULES ───────────────────────────────

// Normalize color string
function safeColor(c) {
  return (c || "").toLowerCase().trim();
}

// ─── COMPLEMENTARY ───────────────────────────────
// Opposite sides of color wheel
function areComplementary(c1, c2) {
  const pairs = [
    ["red", "green"],
    ["blue", "orange"],
    ["yellow", "purple"],
    ["pink", "teal"],
  ];
  return pairs.some(([a, b]) =>
    (safeColor(c1).includes(a) && safeColor(c2).includes(b)) ||
    (safeColor(c1).includes(b) && safeColor(c2).includes(a))
  );
}

// ─── MONOCHROME ───────────────────────────────
// Same color family (different shades/tints)
function isMonochrome(colors) {
  if (!colors.length) return false;
  const base = safeColor(colors[0]);
  return colors.every(c => safeColor(c).includes(base));
}

// ─── ANALOGOUS ───────────────────────────────
// Neighboring colors on wheel (soft harmony)
function isAnalogous(c1, c2) {
  const groups = [
    ["red", "orange", "pink"],
    ["blue", "teal", "green"],
    ["yellow", "lime", "green"],
    ["purple", "violet", "pink"],
  ];
  return groups.some(group =>
    group.some(g => safeColor(c1).includes(g)) &&
    group.some(g => safeColor(c2).includes(g))
  );
}

// ─── TRIADIC ───────────────────────────────
// Three distinct equidistant hues
function isTriadic(colors) {
  const set = colors.map(c => safeColor(c));
  return (
    set.some(c => c.includes("red")) &&
    set.some(c => c.includes("blue")) &&
    set.some(c => c.includes("yellow"))
  );
}

// ─── HARMONY MASTER ───────────────────────────────
function harmonious(colors = []) {
  if (colors.length < 2) return true;

  // Pair checks
  if (colors.length === 2) {
    const [c1, c2] = colors;
    return (
      areComplementary(c1, c2) ||
      isAnalogous(c1, c2) ||
      isMonochrome(colors)
    );
  }

  // Multi-color checks
  return (
    isMonochrome(colors) ||
    isTriadic(colors)
  );
}

module.exports = {
  harmonious,
  areComplementary,
  isMonochrome,
  isAnalogous,
  isTriadic,
};
