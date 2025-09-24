// ✅ Check if outfit contains the correct core categories
export function hasCoreCategories(items = []) {
  const cats = items.map(i => i.category);

  const hasTop = cats.includes("Top");
  const hasBottom = cats.includes("Bottom");
  const hasDress = cats.includes("Dress");
  const hasShoes = cats.includes("Footwear");

  // Rule: (Top + Bottom + Shoes) OR (Dress + Shoes)
  return (hasTop && hasBottom && hasShoes) || (hasDress && hasShoes);
}
