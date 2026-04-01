// lib/feedbackMemory.js
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

/**
 * Build lightweight memory from Firestore `feedback` docs.
 * Shape:
 *   {
 *     likedIds: Set<string>,
 *     dislikedIds: Set<string>,
 *     dislikedColors: Set<string>,
 *     dislikedVibes: Set<string>,
 *     dislikedOccasions: Set<string>
 *   }
 */
export async function buildFeedbackMemory(db, uid) {
  const base = {
    likedIds: new Set(),
    dislikedIds: new Set(),
    dislikedColors: new Set(),
    dislikedVibes: new Set(),
    dislikedOccasions: Set ? new Set() : new Set(), // guard for envs without Set global
  };

  if (!uid) return base;

  try {
    const q = query(
      collection(db, "feedback"),
      where("uid", "==", uid),
      orderBy("timestamp", "desc"),
      limit(200)
    );
    const snap = await getDocs(q);

    snap.forEach(doc => {
      const d = doc.data() || {};
      const ids = Array.isArray(d.outfit_ids) ? d.outfit_ids : [];
      const liked = !!d.liked;
      const reasons = Array.isArray(d.dislike_reasons) ? d.dislike_reasons : [];

      ids.forEach(id => liked ? base.likedIds.add(String(id)) : base.dislikedIds.add(String(id)));

      // very light signals (expand later)
      const vibe = (d.vibe || "").trim().toLowerCase();
      const occ  = (d.occasion || "").trim().toLowerCase();
      if (!liked) {
        if (vibe) base.dislikedVibes.add(vibe);
        if (occ)  base.dislikedOccasions.add(occ);
        reasons.forEach(r => {
          const t = String(r || "").toLowerCase();
          // crude color pick-up if reason contains a color word
          if (/(black|white|blue|red|green|yellow|pink|beige|brown|grey|gray|gold|silver|maroon|purple|orange)/.test(t)) {
            base.dislikedColors.add(t.match(/black|white|blue|red|green|yellow|pink|beige|brown|grey|gray|gold|silver|maroon|purple|orange/)[0]);
          }
        });
      }
    });
  } catch (e) {
    console.warn("buildFeedbackMemory(): fallback to empty due to error:", e?.message || e);
  }

  return base;
}
