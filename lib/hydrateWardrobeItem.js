import { normalizeCategory } from "./normalizeCategory.js";
import { findCategory, getAttributes } from "./taxonomyUtils.js";
import fashionTags from "./fashionTags.js";

const guessSilhouette = fashionTags.guessSilhouette;
const pickPalette = fashionTags.pickPalette;

export function hydrateWardrobeItem({
  uid,
  name,
  category,
  color,
  image_url,
  tags = [],
}) {
  function capitalizeWords(str) {
    return (str || "")
      .toLowerCase()
      .split(/[\s-/]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  const cleanName = capitalizeWords(name || "Unnamed");
  const cleanCategory = normalizeCategory(category || "Misc", cleanName);
  const cleanColor = capitalizeWords(color || "Unknown");
  const cleanTags = tags.map(capitalizeWords);

  // Fabric guess
  const knownFabrics = [
    "Cotton", "Linen", "Denim", "Silk", "Wool",
    "Nylon", "Polyester", "Chiffon"
  ];
  const fabric = cleanTags.find((t) => knownFabrics.includes(t)) || "Unknown";

  // ✅ Taxonomy fix: use both name + category to improve matches
  const taxonomyMatch = findCategory(
    (cleanName + " " + cleanCategory).toLowerCase()
  );
  const taxonomyAttributes = taxonomyMatch
    ? getAttributes(taxonomyMatch.subCategory) || {}
    : {};

  return {
    uid,
    name: cleanName,
    category: cleanCategory,
    color: cleanColor,
    image_url: image_url || null,
    tags: cleanTags.length ? cleanTags : [cleanName, cleanCategory],
    primaryTag: cleanName,
    fabric,
    silhouette: guessSilhouette(cleanName + " " + cleanCategory),
    palette: pickPalette(cleanColor),
    taxonomyPath: taxonomyMatch
      ? `${taxonomyMatch.mainCategory}/${taxonomyMatch.subCategory}`
      : "Misc/Other",
    attributes: taxonomyAttributes,
    usage_count: 0,
    last_used: null,
    created_at: new Date().toISOString(),
  };
}
