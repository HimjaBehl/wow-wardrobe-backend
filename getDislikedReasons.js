const { getFirestore } = require("firebase-admin/firestore");

async function getDislikedReasons(uid, limit = 5) {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection("outfitFeedback")
      .where("uid", "==", uid)
      .where("liked", "==", false)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const allReasons = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (Array.isArray(data.reasons)) {
        allReasons.push(...data.reasons);
      }
    });

    const counts = {};
    allReasons.forEach(reason => {
      counts[reason] = (counts[reason] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason]) => reason);

    return sorted;
  } catch (err) {
    console.error("🔥 Error fetching dislikes:", err);
    return [];
  }
}

module.exports = getDislikedReasons;
