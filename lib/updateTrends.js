// updateTrends.js
import 'dotenv/config';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { db } from '../firebase.js'; // <-- Admin SDK firestore (no client imports)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Lightweight RSS → headlines
async function readFeedTitles(url, take = 8) {
  try {
    const xml = await fetch(url, { timeout: 15000 }).then(r => r.text());
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/gis)]
      .map(m => m[1])
      .filter(t => t && !/^\s*(rss|feed|channel)\s*$/i.test(t))
      .slice(0, take);
    return titles;
  } catch (e) {
    console.log('feed fail:', url, e.message);
    return [];
  }
}

function slug(s) {
  return (s || 'trend')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export async function updateTrends() {
  const feeds = [
    'https://www.vogue.in/feed/fashion.xml',
    'https://www.elle.com/rss/fashion.xml',
    'https://www.gq.com/about/fashion/rss',
    'https://wwd.com/fashion/feed/',
    'https://www.harpersbazaar.com/rss/all.xml',
  ];

  // 1) Pull headlines
  const allTitles = (await Promise.all(feeds.map(u => readFeedTitles(u)))).flat().slice(0, 40);
  if (!allTitles.length) {
    console.log('No headlines pulled. Exiting.');
    return;
  }

  // 2) Summarize into trend cards
  const prompt = `
You are a fashion editor. Based on these current fashion headlines, extract 6–10 concise actionable trend cards as strict JSON.

Headlines:
${allTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY JSON, no prose, in this exact schema:
[
  {
    "keyword": "Metallic Heels",
    "content": "Metallic footwear (silver, chrome) used to lift neutrals; pairs well with denim, suiting, and cocktail minis.",
    "vibes": ["party","evening","festive"],
    "occasion": ["cocktail","wedding","night out"],
    "season": "AW25",
    "score": 0.72
  }
]
- Use Indian dressing vocabulary when relevant (saree blouses, juttis, lehenga, kurta sets).
- Keep "keyword" punchy (2–3 words).
- "content" <= 240 chars.
- "season" like "AW25" or "SS26"; else "current".
  `;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  });

  let trends = [];
  try {
    const raw = resp.choices?.[0]?.message?.content || '[]';
    const parsed = JSON.parse(raw);
    trends = Array.isArray(parsed) ? parsed : (parsed.trends || []);
  } catch (e) {
    console.log('Parse fail, falling back to empty:', e.message);
    trends = [];
  }
  if (!trends.length) {
    console.log('No trends parsed. Exiting.');
    return;
  }

  // 3) Save/update to Firestore (Admin SDK)
  const now = new Date().toISOString();
  const trendsRef = db.collection('trends');
  const batch = db.batch();

  for (const t of trends) {
    const id = slug(t.keyword || 'trend');
    const ref = trendsRef.doc(id);
    batch.set(ref, {
      ...t,
      last_seen: now,
      headlines_sample: allTitles.slice(0, 8),
      source: 'auto-ai',
      updated_at: now,
    }, { merge: true });
  }
  await batch.commit();

  // Optional: daily audit bucket
  await db.collection('trend_runs').doc(now.slice(0, 10)).set({
    count: trends.length,
    updated_at: now,
    feeds,
  }, { merge: true });

  console.log(`✅ Updated ${trends.length} trends.`);
}

// Function is now exported as named export above (line 33)
// and used as API endpoint in index.js
