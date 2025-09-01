const taxonomy = require("./fashionTaxonomy.json");

// 🔍 Find which category/subcategory a term belongs to
function findCategory(term) {
  const lowerTerm = term.toLowerCase();
  for (const [mainCategory, subCategories] of Object.entries(taxonomy)) {
    for (const [subCat, details] of Object.entries(subCategories)) {
      if (subCat.toLowerCase().includes(lowerTerm)) {
        return { mainCategory, subCategory: subCat };
      }
      if (details.Subcategory) {
        if (details.Subcategory.some(sc => sc.toLowerCase().includes(lowerTerm))) {
          return { mainCategory, subCategory: subCat };
        }
      }
    }
  }
  return null;
}

// 🧵 Get attributes for a category path (e.g. "Clothing/Dresses")
function getAttributes(categoryPath) {
  const parts = categoryPath.split("/");
  let node = taxonomy;
  for (const part of parts) {
    const match = Object.keys(node).find(k => k.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    node = node[match];
  }
  return node;
}

module.exports = { findCategory, getAttributes, taxonomy };
