// tools/getTrendInsights.js
import { db } from '../firebase.js';

export default async function getTrendInsights({ query = 'general', limit = 6 } = {}) {
  try {
    // Read latest 30 trends
    const snap = await db.collection('trends').orderBy('updated_at', 'desc').limit(30).get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const q = (query || 'general').toLowerCase();
    // Soft match by keyword / vibes / occasion
    const filtered = all.filter(t => {
      const k = (t.keyword || '').toLowerCase();
      const vibes = (t.vibes || []).map(v => String(v).toLowerCase());
      const occs  = (t.occasion || []).map(o => String(o).toLowerCase());
      return (
        k.includes(q) ||
        vibes.some(v => v.includes(q)) ||
        occs.some(o => o.includes(q)) ||
        q === 'general'
      );
    });

    const ranked = (filtered.length ? filtered : all)
      .sort((a, b) => (b.score ?? 0.5) - (a.score ?? 0.5))
      .slice(0, limit);

    return ranked;
  } catch (e) {
    console.warn('getTrendInsights Firestore fallback:', e.message);
    return [];
  }
}
