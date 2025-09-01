require("dotenv").config();
const { db } = require("../firebase"); // adjust path if needed
const { findCategory, getAttributes } = require("../lib/taxonomyUtils");

async function migrateWardrobeTaxonomy() {
  try {
    console.log("🚀 Starting wardrobe taxonomy migration...");

    const snapshot = await db.collection("wardrobe").get();
    console.log(`📦 Found ${snapshot.size} wardrobe items.`);

    let updatedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const name = (data.name || "").toLowerCase();

      const taxonomyMatch = findCategory(name);
      const taxonomyAttributes = taxonomyMatch
        ? getAttributes(taxonomyMatch.subCategory) || {}
        : {};

      await doc.ref.update({
        taxonomyPath: taxonomyMatch
          ? `${taxonomyMatch.mainCategory}/${taxonomyMatch.subCategory}`
          : null,
        attributes: taxonomyAttributes,
        migrated_at: new Date().toISOString(),
      });

      updatedCount++;
      console.log(`✅ Updated: ${doc.id} → ${taxonomyMatch ? taxonomyMatch.subCategory : "no match"}`);
    }

    console.log(`🎉 Migration complete. ${updatedCount} items updated.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message, err.stack);
    process.exit(1);
  }
}

migrateWardrobeTaxonomy();
