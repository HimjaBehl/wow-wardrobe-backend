import { db } from "../firebase.js";
import { normalizeCategory } from "../lib/normalizeCategory.js";

async function migrateWardrobe() {
  try {
    const snapshot = await db.collection("wardrobe").get();
    console.log(`📦 Found ${snapshot.size} wardrobe docs`);

    let updatedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const rawCat = data.category || "";
      const rawName = data.name || "";

      const normalizedCategory = normalizeCategory(rawCat, rawName);

      if (normalizedCategory !== rawCat) {
        await doc.ref.update({
          category: normalizedCategory,
          updated_at: new Date().toISOString(),
        });
        console.log(`✅ Updated ${doc.id}: "${rawCat}" → "${normalizedCategory}"`);
        updatedCount++;
      }
    }

    console.log(`🎉 Migration complete. Updated ${updatedCount} docs.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrateWardrobe();
