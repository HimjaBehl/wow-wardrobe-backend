
import { getFirestore } from "firebase-admin/firestore";
const db = getFirestore();

/**
 * Returns an array like: ['heels', 'leather jacket', 'too formal']
 */
export default async function getDislikedReasons(uid, limit = 30) {
  if (!uid) return [];

  const snapshot = await db
    .collection("outfitFeedback")
    .where("uid", "==", uid)
    .where("liked", "==", false)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  const avoid = [];

  snapshot.forEach((doc) => {
    const data = doc.data();

    // ✅ Add item names
    if (Array.isArray(data.outfit?.items)) {
      data.outfit.items.forEach((item) => {
        if (item?.name) avoid.push(item.name.toLowerCase());
      });
    }

    // ✅ Add free-text reasons
    if (Array.isArray(data.reasons)) {
      data.reasons.forEach((r) => avoid.push(r.toLowerCase()));
    }
  });

  // ✅ Deduplicate
  return [...new Set(avoid)];
}
