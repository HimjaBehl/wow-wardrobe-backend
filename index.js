// ── Global Error Handlers (Prevent Crash Loops) ──
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

import dotenv from "dotenv";
dotenv.config();


import sharp from "sharp";
import OpenAI from "openai";
import { updateTrends } from "./lib/updateTrends.js";

import crypto from "crypto";

// ── Redaction + Safe Debug Logger ──
function redact(obj) {
  try {
    const clone = JSON.parse(JSON.stringify(obj));
    const scrub = (o) => {
      if (!o || typeof o !== "object") return;
      for (const k of Object.keys(o)) {
        const key = k.toLowerCase();
        if (/(uid|user_?id|email|token|apikey|api_key|authorization|auth|bearer)/i.test(key)) {
          o[k] = "[redacted]";
          continue;
        }
        if (/(image_?url|signedurl|signed_url|downloadurl|displayurl|display_url)/i.test(key)) {
          o[k] = "[redacted-url]";
          continue;
        }
        if ((key === "id" || key.endsWith("_id")) && typeof o[k] === "string") {
          const v = o[k];
          o[k] = v.length > 8 ? `[id:…${v.slice(-4)}]` : "[id:redacted]";
          continue;
        }
        if (typeof o[k] === "object") scrub(o[k]);
      }
    };
    scrub(clone);
    return clone;
  } catch {
    return "[unloggable]";
  }
}

const DEBUG_LOGS = process.env.DEBUG_LOGS === "1";
function dlog(...args) {
  if (DEBUG_LOGS) console.log(...args);
}

import fs from "fs";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



import { hydrateWardrobeItem } from "./lib/hydrateWardrobeItem.js";

import { normalizeCategory } from "./lib/normalizeCategory.js";

function mapTaxonomy(category) {
  switch (category) {
    case "Top": return "Clothing/Clothing/Upper";
    case "Bottom": return "Clothing/Clothing/Pants";
    case "Dress": return "Clothing/Clothing/Dresses";
    case "Outerwear": return "Clothing/Clothing/Jackets and Coats";
    case "Footwear": return "Footwear/Footwear";
    case "Accessory": return "Accessories/Accessories";
    default: return "Misc/Misc";
  }
}


import { mapToCoreCategory } from "./lib/categoryMap.js";
import { hasCoreCategories } from "./lib/validateCategories.js";

import { buildFeedbackMemory } from "./lib/feedbackMemory.js";

import { validateLook } from "./lib/fashionBrain.js";
import express from "express";
import cors from "cors";

const app = express();

// Hard lock: do NOT change Tina's picked items at all
const STRICT_ITEMS = true;

// Lock Tina's prose exactly as generated
const PRESERVE_STYLE_TEXT = true;



// ✅ JSON body parser
app.use(express.json({ limit: "5mb" }));

// ✅ CORS setup
const allowedOrigins = [
  "https://himja.app.n8n.cloud",
  "https://wow-wardrobe-ui-himjabehl.replit.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

// ✅ trust proxy so req.ip is correct on Replit/proxies
app.set("trust proxy", 1);

import rateLimit from "express-rate-limit";

// Helper: send a clean 429
function rateLimitResponse(req, res) {
  return res.status(429).json({
    error: "Too many requests",
    message: "Slow down for a bit and try again in a minute.",
  });
}

// ✅ Gentle limits (tune anytime)
const limiterSuggestOutfit = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 12,                 // 12 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

const limiterAutoTag = rateLimit({
  windowMs: 60 * 1000,
  max: 8,                  // 8 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});





const limiterSearchProduct = rateLimit({
  windowMs: 60 * 1000,
  max: 20,                 // example: 20 searches/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

const limiterWrites = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                 // 60 writes/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});





app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed from this origin: " + origin));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

import getTrendInsights from "./tools/getTrendInsights.js";



import {
  validateLookAgainstRules,
  validateLevel2,
} from "./lib/styleRules.js";


import { isColorGoodForSkinTone } from "./lib/colorRules.js";
// 🔮 Load fashion taxonomy
import { taxonomy, findCategory, getAttributes } from "./lib/taxonomyUtils.js";
import { themeAttributes } from "./lib/themeAttributes.js";

// 🪄 Load fashion basics JSON
let fashionBasics = [];
try {
  fashionBasics =
    JSON.parse(fs.readFileSync("fashionBasics.json", "utf-8")).basics || [];
  console.log("✅ Loaded fashion basics:", fashionBasics.length);
} catch (err) {
  console.error("❌ Could not load fashionBasics.json:", err.message);
}

function getLevel1Basics() {
  return fashionBasics
    .filter((b) => ["Completeness", "Footwear Match"].includes(b.principle))
    .map((b) => `${b.principle}: ${b.rule} Example: ${b.example}`);
}

function getLevel2Basics() {
  return fashionBasics
    .filter((b) =>
      [
        "Completeness",
        "Footwear Match",
        "Color Harmony",
        "Silhouette Balance",
      ].includes(b.principle),
    )
    .map((b) => `${b.principle}: ${b.rule} Example: ${b.example}`);
}

console.log(
  "✅ Loaded fashion taxonomy with top categories:",
  Object.keys(taxonomy),
);

function silhouetteRole(text = "") {
  const t = typeof text === "string" ? text.toLowerCase() : "";
  if (/dress|jumpsuit/.test(t)) return "anchor";
  if (/shirt|top|blouse|t-shirt/.test(t)) return "upper";
  if (/jeans|pants|shorts|skirt|trousers?|bottom/.test(t)) return "lower";
  if (/jacket|coat/.test(t)) return "outer";
  if (/bag|shoe|sandal|boot|jewel|watch|sunglass/.test(t)) return "accessory";
  return "misc";
}

import { isNeutral, dominantPalette, harmonious } from "./lib/colorRules.js";

// 🔥 STEP 1: Import like this, DON'T destructure yet
import fashionTags from "./lib/fashionTags.js";

// 🔥 STEP 2: Log to confirm what's inside
console.log("🧵 FULL FASHION TAGS MODULE:", fashionTags);
console.log("🔍 typeof silhouetteRole:", typeof fashionTags.silhouetteRole);

// 🔥 STEP 3: Use from object, not destructure
const guessSilhouette = fashionTags.guessSilhouette;
const pickPalette = fashionTags.pickPalette;

console.log({
  gs: typeof guessSilhouette,
  pp: typeof pickPalette,
  sr: typeof silhouetteRole,
});

console.log("Loaded fashionTags =>", fashionTags);

import { styleMoodMap } from "./styleMoodMap.js";
import { occasionCategoryMap } from "./lib/occasionMap.js";

console.log("💡 Available moods:", Object.keys(styleMoodMap));

import axios from "axios";
import path from "path";
import multer from "multer";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
}); // 8MB
import { v4 as uuidv4 } from "uuid";
import { db, storage } from "./firebase.js";
const bucket = storage.bucket();

console.log("✅ Firebase initialized with bucket:", bucket.name);

// ===== Enhanced multi-object detection with cropping =====
// Input: imageUrl (public). Output: { detected, image_url, message }
async function autoTagFromImageUrl(imageUrl, cropObjects = false) {
  console.log("🔍 Starting auto-tag analysis for:", imageUrl);
  const cleanedUrl = imageUrl;
  const cleanedPath = null;

  try {
    // 1) Call Ximilar detect_tags_all API
    const tagRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/detect_tags_all",
      { records: [{ _url: cleanedUrl }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const objects = tagRes.data?.records?.[0]?._objects || [];
    console.log(`📦 Detected ${objects.length} objects in image`);

    const detected = await Promise.all(
      objects.map(async (obj, index) => {
        const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];
        const cleanedTags = Array.from(
          new Set(
            rawTags
              .map((tag) =>
                typeof tag === "string"
                  ? tag.toUpperCase().replace(/^.*\//, "")
                  : null,
              )
              .filter(Boolean),
          ),
        )
          .slice(0, 6)
          .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

        const nameRaw =
          obj._tags_map?.Subcategory ||
          obj._tags_map?.Category ||
          "TO_BE_DETERMINED";
        const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
        const categoryRaw = obj._tags_map?.Category || "TO_BE_DETERMINED";
        const category =
          categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1);
        const colorRaw = obj._tags_map?.Color || "TO_BE_DETERMINED";
        const color = colorRaw.charAt(0).toUpperCase() + colorRaw.slice(1);

        const taxonomyMatch = findCategory(nameRaw.toLowerCase());
        const taxonomyAttributes = taxonomyMatch
          ? getAttributes(taxonomyMatch.subCategory) || {}
          : {};

        let croppedImageUrl = cleanedUrl;
        let croppedImagePath = cleanedPath;

        // 2) Handle cropping if requested and bounding box exists
        if (cropObjects && obj._box && objects.length > 1) {
          try {
            console.log(`✂️ Cropping object ${index + 1}: ${name}`);
            const cropResult = await cropAndSaveObject(
              cleanedUrl,
              obj._box,
              `${name}_${index}`,
            );
            if (cropResult.success) {
              croppedImageUrl = cropResult.image_url;
              croppedImagePath = cropResult.image_path;
              console.log(`✅ Cropped image saved: ${croppedImageUrl}`);
            }
          } catch (cropErr) {
            console.warn(
              `⚠️ Cropping failed for object ${index + 1}:`,
              cropErr.message,
            );
          }
        }

        return {
          image_url: croppedImageUrl,
          image_path: croppedImagePath,
          name,
          category,
          color,
          tags: cleanedTags,
          taxonomyPath: taxonomyMatch
            ? `${taxonomyMatch.mainCategory}/${taxonomyMatch.subCategory}`
            : null,
          attributes: taxonomyAttributes,
          silhouette: guessSilhouette(name + " " + category),
          palette: pickPalette(color),
          confidence: obj._probability || 0.8,
          boundingBox: obj._box || null,
        };
      }),
    );

    console.log(`✅ Auto-tag completed: ${detected.length} items processed`);
    return {
      detected,
      image_url: cleanedUrl,
      image_path: cleanedPath,
      message: `Successfully detected ${detected.length} item(s)`,
    };
  } catch (error) {
    console.error("❌ Auto-tag failed:", error.message);
    throw new Error(`Auto-tag processing failed: ${error.message}`);
  }
}

// ===== Object cropping helper function =====
async function cropAndSaveObject(originalImageUrl, boundingBox, objectName) {
  try {
    // Download original image
    const imageResponse = await axios.get(originalImageUrl, {
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Calculate crop dimensions from bounding box
    const { x, y, width, height } = boundingBox;

    // Crop the image using Sharp
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Save cropped image to Firebase
    const croppedPath = `wardrobe/cropped/${uuidv4()}_${objectName}.jpg`;
    const file = bucket.file(croppedPath);

    await file.save(croppedBuffer, {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      },
      public: true,
      resumable: false,
    });

    await file.makePublic();
    const croppedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(croppedPath)}?alt=media`;

    return {
      success: true,
      image_url: croppedUrl,
      image_path: croppedPath,
    };
  } catch (error) {
    console.error("❌ Crop operation failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── WEATHER HELPER ─────────────────────────────────────────────
const OPENWEATHER_URL =
  "https://api.openweathermap.org/data/2.5/weather?units=metric";

async function getWeather(city = "Delhi") {
  try {
    const url = `${OPENWEATHER_URL}&q=${encodeURIComponent(
      city,
    )}&appid=${process.env.OPENWEATHER_API_KEY}`;

    const { data } = await axios.get(url);
    // e.g. "light rain", 31 → "Light rain, 31 °C"
    return `${data.weather?.[0]?.description || "clear sky"}, ${Math.round(
      data.main.temp,
    )}°C`;
  } catch (err) {
    console.warn("⚠️ Weather fetch failed:", err.message);
    return null; // silently continue without weather
  }
}
// ────────────────────────────────────────────────────────────────

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

console.log("🔑 XIMILAR_API_KEY loaded:", !!process.env.XIMILAR_API_KEY);
console.log("🧠 OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);
// 👉 Safe lowercase helper used everywhere
function safeLower(txt) {
  return typeof txt === "string" ? txt.toLowerCase() : "";
}

// 👗 Outfit combination fingerprint
function makeComboFingerprint(items = []) {
  return items
    .map(it => `${safeLower(it.category)}-${safeLower(it.palette)}-${safeLower(it.silhouette)}`)
    .sort()
    .join("|");
}

// ─────────────────────────────────────────────────────────────
// Taste Learning Helpers (Phase B + C)
// ─────────────────────────────────────────────────────────────

async function loadAllFeedbackEvents(db) {
  const out = [];

  // Canonical (Phase A → B)
  try {
    const snap = await db.collection("feedback_events").get();
    snap.docs.forEach(d => out.push({ src: "feedback_events", id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("loadAllFeedbackEvents: feedback_events read failed:", e?.message || e);
  }

  // Legacy (keep for back-compat)
  try {
    const liked = await db.collection("liked_looks").get();
    liked.docs.forEach(d => out.push({ src: "liked_looks", id: d.id, liked: true, ...d.data() }));
  } catch {}

  try {
    const disliked = await db.collection("disliked_looks").get();
    disliked.docs.forEach(d => out.push({ src: "disliked_looks", id: d.id, liked: false, ...d.data() }));
  } catch {}

  // Optional legacy collection name some earlier versions used:
  try {
    const legacy = await db.collection("feedback").get();
    legacy.docs.forEach(d => out.push({ src: "feedback", id: d.id, ...d.data() }));
  } catch {}

  return out;
}

function normalizeFeedbackToLook(ev) {
  const uid = ev?.uid || ev?.user_id || ev?.userId;
  if (!uid) return null;

  const liked =
    (ev?.liked === true) ? true :
    (ev?.liked === false) ? false :
    (ev?.event_type === "like") ? true :
    (ev?.event_type === "dislike") ? false :
    null;

  if (liked === null) return null;
  const delta = liked ? +1 : -1;

  const outfit = ev?.outfit || ev?.look || null;
  const items = outfit?.items || ev?.items || [];
  if (!Array.isArray(items) || items.length === 0) return null;

  return { uid, delta, items };
}

function inc(map, key, by = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + by;
}

function addToMapPruned(map, key, value, maxKeys = 200) {
  if (!key) return;
  map[key] = value;
  const keys = Object.keys(map);
  if (keys.length <= maxKeys) return;

  keys.sort((a, b) => (map[b] || 0) - (map[a] || 0));
  for (const k of keys.slice(maxKeys)) delete map[k];
}

async function getTasteWeights(db, uid) {
  const base = { category: {}, color: {}, tag: {} };
  let userW = base;
  let globalW = base;

  try {
    const u = await db.collection("taste_weights").doc(uid).get();
    if (u.exists && u.data()?.weights) userW = u.data().weights;
  } catch {}

  try {
    const g = await db.collection("taste_weights_global").doc("global").get();
    if (g.exists && g.data()?.weights) globalW = g.data().weights;
  } catch {}

  return { userW, globalW };
}

// ===================
// Outfit Candidate Engine (deterministic cohesion)
// ===================

function getSlot(item) {
  return slotOf(`${item.category || ""} ${item.name || ""}`);
}

function buildSlotPools(wardrobe = []) {
  const pools = { top: [], bottom: [], dress: [], footwear: [], bag: [], outer: [], accessory: [], misc: [] };
  for (const it of wardrobe) {
    const s = getSlot(it);
    if (pools[s]) pools[s].push(it);
    else pools.misc.push(it);
  }

  // accessories bucket (wider)
  pools.accessory = wardrobe.filter(i =>
    /accessor|watch|sunglass|scarf|dupatta|stole|shawl|belt|jewel|bag/i.test((i.category||"") + " " + (i.name||""))
  );

  // outer bucket (wider)
  pools.outer = wardrobe.filter(i =>
    /outer|jacket|coat|blazer|cardigan|shrug/i.test((i.category||"") + " " + (i.name||""))
  );

  // bag bucket (wider)
  pools.bag = wardrobe.filter(i =>
    /bag|handbag|tote|purse/i.test((i.category||"") + " " + (i.name||""))
  );

  return pools;
}

// pick helper (neutral bias optional)
function pickFrom(pool = [], preferNeutral = false) {
  if (!pool.length) return null;
  if (preferNeutral) {
    const neutrals = pool.filter(p => isNeutralColor(p.color));
    if (neutrals.length) return neutrals[Math.floor(Math.random() * neutrals.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// generate many plausible looks, then score deterministically
function generateCandidates(pools, n = 40, opts = {}) {
  const { preferNeutralAcc = true } = opts;
  const looks = [];

  for (let i = 0; i < n; i++) {
    // choose base path: one-piece or separates (weighted)
    const useOnePiece = pools.dress.length > 0 && Math.random() < 0.35;

    let items = [];

    if (useOnePiece) {
      const dress = pickFrom(pools.dress, false);
      const shoes = pickFrom(pools.footwear, true) || pickFrom(pools.footwear, false);
      if (dress) items.push(dress);
      if (shoes) items.push(shoes);

      // add bag/outer/accessory lightly
      const bag = pickFrom(pools.bag, preferNeutralAcc);
      const outer = pickFrom(pools.outer, preferNeutralAcc);
      if (bag && Math.random() < 0.65) items.push(bag);
      if (outer && Math.random() < 0.35) items.push(outer);

      const acc = pickFrom(pools.accessory, true);
      if (acc && Math.random() < 0.25) items.push(acc);

    } else {
      const top = pickFrom(pools.top, true) || pickFrom(pools.top, false);
      const bottom = pickFrom(pools.bottom, true) || pickFrom(pools.bottom, false);
      const shoes = pickFrom(pools.footwear, true) || pickFrom(pools.footwear, false);

      if (top) items.push(top);
      if (bottom) items.push(bottom);
      if (shoes) items.push(shoes);

      const bag = pickFrom(pools.bag, preferNeutralAcc);
      const outer = pickFrom(pools.outer, preferNeutralAcc);
      if (bag && Math.random() < 0.6) items.push(bag);
      if (outer && Math.random() < 0.3) items.push(outer);

      const acc = pickFrom(pools.accessory, true);
      if (acc && Math.random() < 0.2) items.push(acc);
    }

    // de-dupe by id
    const seen = new Set();
    items = items.filter(it => {
      const id = it.id || it.wardrobe_id || it.idx;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    looks.push(items);
  }

  return looks;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function getItemTasteScore(it, userW, globalW) {
  const cat = safeLower(it.category || "");
  const col = safeLower(Array.isArray(it.color) ? (it.color[0] || "") : (it.color || ""));
  const tags = Array.isArray(it.tags) ? it.tags.map(safeLower) : [];

  // prefer user weights; fallback to global
  const wCat = (userW?.category?.[cat] ?? globalW?.category?.[cat] ?? 0);
  const wCol = (userW?.color?.[col] ?? globalW?.color?.[col] ?? 0);

  let wTags = 0;
  for (const t of tags.slice(0, 8)) {
    wTags += (userW?.tag?.[t] ?? globalW?.tag?.[t] ?? 0);
  }

  // tags can dominate—dampen
  wTags = clamp(wTags, -1.2, 1.2);

  // weighted sum
  return (0.55 * wCat) + (0.30 * wCol) + (0.15 * wTags);
}

  function scoreLook(items = [], ctx = {}, taste = null) {
    const userW = taste?.userW || { category:{}, color:{}, tag:{} };
    const globalW = taste?.globalW || { category:{}, color:{}, tag:{} };

  const occasion = (ctx.occasion || "").toLowerCase();

  // 1) completeness (hard-ish)
  const cats = items.map(i => (i.category || "").toLowerCase()).join(" | ");
  const hasTop = /top|shirt|tee|t-?shirt|blouse|kurta/.test(cats);
  const hasBottom = /bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/.test(cats);
  const hasFootwear = /footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(cats);
  const hasOnePiece = /dress|jumpsuit|saree/.test(cats);

  let score = 0;
  if ((hasTop && hasBottom && hasFootwear) || (hasOnePiece && hasFootwear)) score += 3;
  else score -= 4; // missing base

  // 2) palette cohesion (keep to 1–2 non-neutral palettes)
  const palettes = items.map(i => (i.palette || pickPalette(i.color || "") || "").toLowerCase()).filter(Boolean);
  const uniq = Array.from(new Set(palettes));
  const nonNeutral = uniq.filter(p => !["black","white","grey","gray","beige","cream","navy","denim","tan","brown","off-white"].includes(p));
  if (nonNeutral.length <= 1) score += 2;
  else if (nonNeutral.length === 2) score += 1;
  else score -= 2;

  // 3) occasion sanity (simple penalties/bonuses)
  const nameblob = items.map(i => ((i.name||"") + " " + (i.category||"")).toLowerCase()).join(" ");
  const isTee = /tee|t-?shirt/.test(nameblob);
  const isSandal = /sandal|flip/.test(nameblob);
  const isShirt = /shirt|blouse/.test(nameblob);
  const isBlazer = /blazer|suit|jacket/.test(nameblob);
  const isTrouser = /trouser|pants|chinos|slacks/.test(nameblob);
  const isClosedToe = /loafer|oxford|derby|heel|pump|boot|sneaker/.test(nameblob);

  if (/(workwear|formal|interview)/.test(occasion)) {
    if (isShirt) score += 1;
    if (isBlazer) score += 1;
    if (isTrouser) score += 0.5;
    if (isClosedToe) score += 0.5;
    if (isTee) score -= 2;
    if (isSandal) score -= 1.5;
  }

  // 4) neutral accessory preference: if base has color pop, keep bag neutral
  const base = items.filter(i => ["top","bottom","dress"].includes(getSlot(i)));
  const accs = items.filter(i => ["bag","accessory"].includes(getSlot(i)));
  const baseHasPop = base.some(i => !isNeutralColor(i.color));
  const accAllNeutral = accs.length ? accs.every(i => isNeutralColor(i.color)) : true;
  if (baseHasPop && accAllNeutral) score += 0.6;

  // 5) slight reward for 4–6 items
  if (items.length >= 4 && items.length <= 6) score += 0.7;
  if (items.length > 6) score -= 0.7;

  // =========================
  // Penalties (hard-ish rules)
  // =========================

  // Helper: parse "light rain, 24°C" -> 24
  function parseTempC(w) {
    const m = String(w || "").match(/(-?\d+)\s*°\s*c/i);
    return m ? Number(m[1]) : null;
  }

  const weatherStr = ctx.weather || "";
  const tempC = parseTempC(weatherStr);
  const isChilly = tempC !== null && tempC <= 18;

  const hasOuterwear = /blazer|jacket|coat|cardigan|shrug/.test(nameblob);
  const hasShortBottom = /skirt|short|skort/.test(nameblob);
  const hasLightTop = /tank|sleeveless|tube|strapless|crop/.test(nameblob);

  // 1) Weather penalties (if chilly)
  if (isChilly) {
    if (hasShortBottom) score -= 3.0;      // too exposed
    if (hasLightTop) score -= 2.0;         // too exposed
    if (!hasOuterwear) score -= 2.5;       // missing layer
  }

  // 2) Workwear penalties: sportswear / too casual
  const isWork = /(workwear|formal|interview|office)/.test(occasion);
  const isAthleisure =
    /gym|athleisure|track|training|running|sportswear/.test(nameblob);

  if (isWork && isAthleisure) score -= 4.0;

  // 3) Penalize “too many loud palettes”
  // (you already score palette cohesion, this makes it stricter)
  if (nonNeutral.length >= 3) score -= 2.0;

// 4) Encourage using blazer/jacket if wardrobe has it
  // (bonus already handled in occasion scoring above)

  // =========================
  // Adventure occasion rules
  // =========================
  // =========================
  // OCCASION-BASED RERANKING
  // =========================

  // Common detectors
  const hasDress = /dress|gown|maxi|mini|anarkali|lehenga/.test(nameblob);
  const hasHeels = /heel|pump|stiletto|court/.test(nameblob);
  const hasSneakers = /sneaker|trainer|running|walking/.test(nameblob);
  const hasBoots = /boot/.test(nameblob);
  const hasFormalShoes = /loafer|oxford|derby|formal/.test(nameblob);
  const hasSandals = /sandal|slide|flipflop/.test(nameblob);
  const hasAthletic = /gym|sport|track|jogger|athletic/.test(nameblob);
  const hasPants = /pant|trouser|jean|cargo|jogger|legging/.test(nameblob);
  const hasShorts = /short/.test(nameblob);
  const hasTopItem = /top|shirt|tee|blouse|kurta/.test(nameblob);
  const hasLounge = /pyjama|pajama|night|sleep|loungewear/.test(nameblob);

  // =========================
  // Outdoor Adventure / Hiking
  // =========================
  if (/adventure|hiking|outdoor|explore|trek/.test(occasion)) {
    if (hasDress) score -= 45;
    if (hasHeels) score -= 60;
    if (hasSandals) score -= 30;

    if (!hasSneakers && !hasBoots) score -= 30;
    if (!hasPants) score -= 20;
  }

  // =========================
  // Gym / Workout
  // =========================
  if (/gym|workout|fitness/.test(occasion)) {
    if (hasDress) score -= 60;
    if (hasHeels || hasFormalShoes) score -= 70;
    if (!hasAthletic) score -= 40;

    if (hasSneakers) score += 10;
  }

  // =========================
  // Athleisure
  // =========================
  if (/athleisure/.test(occasion)) {
    if (hasHeels) score -= 40;
    if (hasFormalShoes) score -= 30;

    if (hasSneakers) score += 10;
    if (hasAthletic) score += 5;
  }

  // =========================
  // Travel / Airport
  // =========================
  if (/travel|airport/.test(occasion)) {
    if (hasHeels) score -= 45;
    if (hasTightDress = /bodycon|tight/.test(nameblob)) score -= 25;

    if (hasSneakers || hasBoots) score += 10;
    if (hasPants) score += 5;
  }

  // =========================
  // Date Night
  // =========================
  if (/date/.test(occasion)) {
    if (hasAthletic) score -= 40;
    if (hasLounge) score -= 60;

    if (hasDress) score += 15;
    if (hasHeels) score += 10;
  }

  // =========================
  // Wedding / Festive
  // =========================
  if (/wedding|festive|ethnic/.test(occasion)) {
    if (hasAthletic) score -= 70;
    if (hasSneakers) score -= 40;

    if (hasDress) score += 20;
    if (hasHeels || hasSandals) score += 10;
  }

  // =========================
  // Beach / Resort
  // =========================
  if (/beach|resort|vacation/.test(occasion)) {
    if (hasHeels) score -= 40;
    if (hasOuterwear) score -= 20;

    if (hasSandals) score += 10;
    if (hasDress || hasShorts) score += 5;
  }

  // =========================
  // Formal Event / Gala
  // =========================
  if (/formal|gala/.test(occasion)) {
    if (hasSneakers || hasAthletic) score -= 60;
    if (hasLounge) score -= 80;

    if (hasDress) score += 20;
    if (hasHeels || hasFormalShoes) score += 15;
  }

  // =========================
  // Interview / Presentation
  // =========================
  if (/interview|presentation/.test(occasion)) {
    if (hasDress && /party|mini/.test(nameblob)) score -= 40;
    if (hasSneakers || hasSandals) score -= 50;

    if (hasOuterwear) score += 15;
    if (hasFormalShoes) score += 10;
  }

  // =========================
  // Shopping / Errands
  // =========================
  if (/shopping|errand/.test(occasion)) {
    if (hasHeels) score -= 30;

    if (hasSneakers) score += 10;
  }

  // =========================
  // Concert / Festival
  // =========================
  if (/concert|festival/.test(occasion)) {
    if (hasFormalShoes) score -= 30;

    if (hasSneakers || hasBoots) score += 10;
  }

  // =========================
  // Winter Casual / Layered
  // =========================
  if (/winter/.test(occasion)) {
    if (hasSandals) score -= 50;

    if (hasOuterwear) score += 15;
    if (hasBoots) score += 10;
  }

  // =========================
  // Summer Casual / Lightwear
  // =========================
  if (/summer/.test(occasion)) {
    if (hasOuterwear) score -= 20;

    if (hasDress || hasSandals) score += 5;
  }

  // =========================
  // Lounge / Homewear
  // =========================
  if (/lounge|home/.test(occasion)) {
    if (hasHeels || hasFormalShoes) score -= 80;

    if (hasLounge) score += 20;
  }

  // =========================
  // Streetwear / Urban
  // =========================
  if (/streetwear|urban/.test(occasion)) {
    if (hasFormalShoes) score -= 30;

    if (hasSneakers) score += 10;
  }

  // =========================
  // Business Casual
  // =========================
  if (/business/.test(occasion)) {
    if (hasAthletic || hasLounge) score -= 60;
    if (hasHeels && !hasDress) score -= 15;

    if (hasOuterwear) score += 15;
    if (hasFormalShoes || hasLoafers) score += 10;
  }

    // 6) taste-learning boost (Phase C)
    // average item taste score; keep it gentle so it doesn't break basic style rules
    const tasteScores = items.map(it => getItemTasteScore(it, userW, globalW));
    const avgTaste = tasteScores.length
      ? tasteScores.reduce((a,b)=>a+b,0) / tasteScores.length
      : 0;

    score += (avgTaste * 2.2); // tune 1.5–3.0


  return score;
}

async function rerankWithLLM({ candidates = [], wardrobePreview = [], ctx = {} }) {
  // candidates: array of arrays of items (full objects)
  // We pass only idx references to the model, plus lightweight metadata.
  const compact = candidates.slice(0, 12).map((items, i) => ({
    rank_id: i,
    items: items.map(it => ({
      idx: String(it.id || it.wardrobe_id || it.idx),
      name: it.name || "",
      category: it.category || "",
      color: Array.isArray(it.color) ? (it.color[0] || "") : (it.color || ""),
      palette: it.palette || pickPalette(it.color || "") || "",
    }))
  }));

  const sys = {
    role: "system",
    content:
`You are Tina. Choose the most cohesive outfit among candidates.
Rules:
- pick ONE candidate
- respond ONLY JSON: { "outfits":[{ "title": string, "style_note": string, "items":[{"idx":string}, ...]}] }
- title/style_note must reflect actual items (no hallucinations).
- prefer: complete base + color harmony + occasion match.`
  };

  const user = {
    role: "user",
    content: JSON.stringify({
      occasion: ctx.occasion || "",
      vibe: ctx.vibe || "",
      weather: ctx.weather || "",
      candidates: compact
    })
  };

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [sys, user],
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  return resp.choices?.[0]?.message?.content || null;
}

// —— URL normalizer & image→id resolver ——
function normalizeUrlForMatch(u = "") {
  try {
    const url = new URL(u);
    url.search = ""; // drop ?alt=media, tokens, etc.
    // decode firebase paths once
    url.pathname = decodeURIComponent(url.pathname || "");
    return url.toString();
  } catch {
    return (u || "").split("?")[0]; // best effort
  }
}

async function buildUrlToIdMap(uid) {
  const snap = await db.collection("wardrobe").where("uid","==",uid).get();
  const map = new Map();
  snap.docs.forEach(d => {
    const data = d.data() || {};
    const key = normalizeUrlForMatch(data.image_url || "");
    if (key) map.set(key, d.id);
  });
  return map;
}

// ---- Swap helpers (map wardrobe items to a slot we can swap) ----
function slotOf(text = "") {
  const t = (text || "").toLowerCase();
  if (/dress|jumpsuit|saree/.test(t)) return "dress";
  if (/top|tee|t-?shirt|shirt|blouse|kurta/.test(t)) return "top";
  if (/bottom|jeans|pant|trouser|chino|skirt|short|palazzo|salwar/.test(t)) return "bottom";
  if (/footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(t)) return "footwear";
  if (/bag|handbag|tote|purse/.test(t)) return "bag";
  return "misc";
}
// light neutral preference used in picks
const SWAP_NEUTRALS = new Set(["black","white","cream","beige","grey","gray","navy","denim","tan","brown","off-white"]);
const isNeutralSwap = (c="") => {
  const s = Array.isArray(c) ? (c[0] || "") : (typeof c === "string" ? c : "");
  return SWAP_NEUTRALS.has(s.toLowerCase());
};

// ---------------- OUTIFT COMPLETENESS HELPERS ----------------
const NEUTRALS = ["black","white","cream","beige","grey","gray","navy","denim","tan","brown","off-white"];
const cat = (it) => (it.category || "").toLowerCase();
const isNeutralColor = (c = "") => {
  const s = Array.isArray(c) ? (c[0] || "") : (typeof c === "string" ? c : "");
  return NEUTRALS.some(n => s.toLowerCase().includes(n));
};
function pickOne(arr=[], preferNeutral=false){ if(!arr.length)return null; if(preferNeutral){const n=arr.filter(a=>isNeutralColor(a.color)); if(n.length)return n[Math.floor(Math.random()*n.length)];} return arr[Math.floor(Math.random()*arr.length)]; }

  function forceCompleteLook(items=[], pool=[], opts = {}){
     const gender = (opts.gender || "").toLowerCase();  // "female" | "male" | ""
     const occasion = (opts.occasion || "").toLowerCase();

  let hydrated=[...items];
  const tops=pool.filter(i=>/top|shirt|tee|t-?shirt|blouse|kurta/.test(cat(i)));
  const bottoms=pool.filter(i=>/bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/.test(cat(i)));
  const dresses=pool.filter(i=>/dress|jumpsuit|saree/.test(cat(i)));
  const footwears=pool.filter(i=>/footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(cat(i)));
  const outers=pool.filter(i=>/outer|jacket|coat|cardigan|shrug/.test(cat(i)));
    const accs=pool.filter(i=>/accessor|belt|watch|bag|handbag|tote|purse|sunglass|scarf|dupatta|stole|shawl/.test(cat(i)));
       const bags = accs.filter(i => /(bag|handbag|tote|purse)/i.test(i.name || i.category || ""));
      const belts = accs.filter(i => /belt/i.test(i.name || i.category || ""));

  const has=(re)=>hydrated.some(i=>re.test(cat(i))); const add=(x)=>{if(x)hydrated.push(x);};
  if(has(/dress|jumpsuit|saree/)){
    if(!has(/footwear|shoe|sandal|heel|sneaker|jutti|boot/)){ add(pickOne(footwears,true)||pickOne(footwears)); }
    hydrated=hydrated.filter(i=>/dress|jumpsuit|saree|footwear|outer|jacket|coat|dupatta|shawl|stole|accessor/.test(cat(i)));
         // 🎯 gender-aware accessory completion
         if (gender === "female") {
           if (!hydrated.some(i => /(bag|handbag|tote|purse)/i.test((i.name||i.category||"")))) {
             add(pickOne(bags, true) || pickOne(bags) || pickOne(accs, true));
           }
         } else if (gender === "male") {
           // belt only if there's a trouser + dress-shirt/blazer vibe
           const hasTrousers = hydrated.some(i => /pants|trouser|chinos/i.test(i.name||i.category||""));
           const hasShirtish = hydrated.some(i => /shirt|blazer|suit|waistcoat/i.test(i.name||i.category||""));
           if (hasTrousers && hasShirtish && !hydrated.some(i => /belt/i.test(i.name||""))) {
             add(pickOne(belts, true) || pickOne(belts));
           }
         }
         if(hydrated.length<4) add(pickOne(outers.filter(i => isNeutralColor(i.color)))||pickOne(accs,true));
    return hydrated.slice(0,5);
  }
  if(!has(/top|shirt|tee|t-?shirt|blouse|kurta/)) add(pickOne(tops,true)||pickOne(tops));
  if(!has(/bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/)) add(pickOne(bottoms,true)||pickOne(bottoms));
  if(!has(/footwear|shoe|sandal|heel|sneaker|jutti|boot/)) add(pickOne(footwears,true)||pickOne(footwears));
    // 🎯 gender-aware accessory completion for separates
       if (gender === "female") {
         if (!hydrated.some(i => /(bag|handbag|tote|purse)/i.test((i.name||i.category||"")))) {
           add(pickOne(bags, true) || pickOne(bags) || pickOne(accs,true));
         }
       } else if (gender === "male") {
         const hasTrousers = hydrated.some(i => /pants|trouser|chinos/i.test(i.name||i.category||""));
         const hasShirtish = hydrated.some(i => /shirt|blazer|suit|waistcoat/i.test(i.name||i.category||""));
         if (hasTrousers && hasShirtish && !hydrated.some(i => /belt/i.test(i.name||""))) {
           add(pickOne(belts, true) || pickOne(belts));
         }
       }
       if(hydrated.length<4){ const maybe=pickOne(outers.filter(i => isNeutralColor(i.color)))||pickOne(accs,true); if(maybe) add(maybe); }
  return hydrated.slice(0,5);
}
// -------------------------------------------------------------

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    node: process.version,
    env: process.env.NODE_ENV || "dev",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
});



// ✅ Quick Add Staples - Fixed syntax
// This endpoint is handled by the working staples endpoint below

// ✅ Search Product via SerpAPI
// ✅ Search Product via SerpAPI (normalized for frontend)
app.post("/search-product", limiterSearchProduct, async (req, res) => {

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    const serpRes = await axios.get("https://serpapi.com/search.json", {
      params: {
        q: query,
        tbm: "isch", // image search
        api_key: process.env.SERPAPI_KEY,
      },
    });

    // 🔹 Normalize into "products" list (hydrated)
    const products =
      (serpRes.data.images_results || []).slice(0, 6).map((img) => {
        return hydrateWardrobeItem({
          uid: "search-temp",
          name: img?.title || "Unnamed Product",
          image_url: img?.original || img?.thumbnail || "",
          category: "Search",
          color: "Unknown",
          tags: ["Search", img?.title || ""],
        });
      });

    res.json({ success: true, products, items: products });

  } catch (err) {
    console.error("❌ /search-product failed:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});

// ✅ Root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "🎉 WOW Wardrobe backend is live!",
    timestamp: new Date().toISOString(),
  });
});

function safeDocId(s) {
  const raw = String(s || "").trim().toLowerCase();

  const cleaned = raw
    .replace(/[\/\\]/g, "_")      // Firestore disallows /
    .replace(/\s+/g, " ")         // collapse whitespace
    .replace(/[^\w\- ]/g, "")     // remove weird symbols
    .replace(/\s/g, "_");         // spaces -> _

  // Hash keeps uniqueness even after truncation
  const hash = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 8);

  // Firestore doc ids can be long, but long tag strings are risky.
  const base = cleaned.slice(0, 60) || "empty";
  return `${base}_${hash}`;
}


app.post("/admin/recompute-taste", async (req, res) => {
  try {
    // ── Admin auth ─────────────────────────
    const adminKey = req.headers["x-admin-key"];
    if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("🔁 Recomputing taste stats...");

    // ── Load feedback sources ──────────────
    // ── Load feedback sources (canonical) ──
    const events = await loadAllFeedbackEvents(db);

    const global = {};   // { "dim::key": { loves, dislikes, total } }
    const perUser = {};  // { [uid]: { "dim::key": { loves, dislikes, total } } }

    // ── Extract signals from canonical events ──
    for (const ev of events) {
      const norm = normalizeFeedbackToLook(ev);
      if (!norm) continue;

      const { uid, delta, items } = norm;

      items.forEach((it) => {
        bump(global, perUser, uid, "category", it.category, delta);
        bump(global, perUser, uid, "color", it.color, delta);
        (it.tags || []).forEach(tag => bump(global, perUser, uid, "tag", tag, delta));
      });

    }

    function toWeightBucketsFromStore(store) {
      // store: { "dim::key": {loves, dislikes, total} }
      const out = { category: {}, color: {}, tag: {} };

      for (const [k, v] of Object.entries(store)) {
        const sep = k.indexOf("::");
        const dim = sep >= 0 ? k.slice(0, sep) : "unknown";
        const key = sep >= 0 ? k.slice(sep + 2) : k;

        if (!["category", "color", "tag"].includes(dim)) continue;

        const score = (v.loves - v.dislikes) / (v.total + 3);
        const confidence = Math.min(1, v.total / 12);
        const weight = score * confidence;

        // keep it small, stable keys
        out[dim][String(key).trim().toLowerCase()] = weight;
      }

      return out;
    }

    function pruneWeightBuckets(buckets, maxPerDim = 120) {
      const pruned = {};
      for (const dim of Object.keys(buckets)) {
        const entries = Object.entries(buckets[dim] || {});
        entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        pruned[dim] = Object.fromEntries(entries.slice(0, maxPerDim));
      }
      return pruned;
    }

    // ── Write stats + weights ──────────────
    let batch = db.batch();
    let opCount = 0;

    async function commitIfNeeded(force = false) {
      if (opCount >= 450 || force) { // keep buffer under 500
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    function bump(globalStore, perUserStore, uid, dimension, key, delta) {
      if (!dimension || !key) return;

      const k = `${dimension}::${String(key).trim().toLowerCase()}`;

      // global
      if (!globalStore[k]) globalStore[k] = { loves: 0, dislikes: 0, total: 0 };
      if (delta > 0) globalStore[k].loves += 1;
      else globalStore[k].dislikes += 1;
      globalStore[k].total += 1;

      // per user
      if (!perUserStore[uid]) perUserStore[uid] = {};
      if (!perUserStore[uid][k]) perUserStore[uid][k] = { loves: 0, dislikes: 0, total: 0 };
      if (delta > 0) perUserStore[uid][k].loves += 1;
      else perUserStore[uid][k].dislikes += 1;
      perUserStore[uid][k].total += 1;
    }

    

    async function writeStats(baseRef, store) {
      for (const [k, v] of Object.entries(store)) {
        // parse dimension + key safely
        const sep = k.indexOf("::");
        const dimension = sep >= 0 ? k.slice(0, sep) : "unknown";
        const key = sep >= 0 ? k.slice(sep + 2) : k;

        const score = (v.loves - v.dislikes) / (v.total + 3);
        const confidence = Math.min(1, v.total / 12);
        const weight = score * confidence;

        const docId = `${dimension}_${safeDocId(key)}`;

        batch.set(baseRef.doc(docId), {
          dimension,
          key,
          ...v,
          score,
          confidence,
          weight,
          updated_at: new Date().toISOString(),
        });

        opCount++;
        await commitIfNeeded(false);
      }
    }

    // global
    await writeStats(db.collection("taste_stats_global"), global);

    // per user
    for (const [uid, stats] of Object.entries(perUser)) {
      await writeStats(
        db.collection("taste_stats_user").doc(uid).collection("stats"),
        stats
      );
    }

    // final flush
    await commitIfNeeded(true);

    // ✅ ALSO write compact weights maps for fast reads in Phase C
    // global weights
    {
      const globalBuckets = pruneWeightBuckets(toWeightBucketsFromStore(global), 150);
      await db.collection("taste_weights_global").doc("global").set({
        weights: globalBuckets,
        updated_at: new Date().toISOString(),
        version: 1,
      }, { merge: true });
    }

    // per-user weights
    for (const [uid, stats] of Object.entries(perUser)) {
      const userBuckets = pruneWeightBuckets(toWeightBucketsFromStore(stats), 150);
      await db.collection("taste_weights").doc(uid).set({
        weights: userBuckets,
        updated_at: new Date().toISOString(),
        version: 1,
      }, { merge: true });
    }


    console.log("✅ Taste recompute complete");

    res.json({
      ok: true,
      global_keys: Object.keys(global).length,
      users: Object.keys(perUser).length,
    });

  } catch (e) {
    console.error("❌ recompute-taste failed:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ✅ Auto-tagging (normalized keys)
app.post("/auto-tag", limiterAutoTag, async (req, res) => {

  const { image_url } = req.body || {};
  if (!image_url) return res.status(400).json({ error: "Image URL required" });

  try {
    const result = await autoTagFromImageUrl(image_url);

    // Normalize keys to match /auto-tag-upload and keep originals too
    return res.json({
      ...result,
      detectedItems: Array.isArray(result?.detected) ? result.detected : [],
      imageUrl: result?.image_url ?? "",
    });
  } catch (err) {
    console.error("🔥 /auto-tag error:", err);
    res.status(500).json({ error: "Auto-tagging failed", message: err.message });
  }
});


// Accepts multipart/form-data with field name: "file"
app.post("/auto-tag-upload", limiterAutoTag, upload.single("file"), async (req, res) => {

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded (field must be 'file')." });
    }

    // 🔄 AVIF/PNG/HEIC sab ko JPEG me convert + size cap
    const jpegBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();

    // 📤 JPEG ko Firebase me upload karo
    const rawPath = `wardrobe/uploads/${uuidv4()}.jpg`;
    const file = bucket.file(rawPath);

    await file.save(jpegBuffer, {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      },
      public: true,
      resumable: false,
    });

    // Make the file publicly accessible
    await file.makePublic();

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(rawPath)}?alt=media`;
    console.log("📤 Uploaded (JPEG) to:", publicUrl);

    // 🔗 Ab normal pipeline chalao (remove.bg → Ximilar)
    const result = await autoTagFromImageUrl(publicUrl);

    // ✅ CA ko yahi shape chahiye
    return res.json({
      ...result,
      detectedItems: result.detected,
      imageUrl: result.image_url,
      original: { image_url: publicUrl, image_path: rawPath },
    });
  } catch (err) {
    const payload = err?.response?.data || err?.message || String(err);
    console.error("🔥 /auto-tag-upload error:", payload);
    return res.status(500).json({
      error: "Upload auto-tag failed",
      message: typeof payload === "string" ? payload : JSON.stringify(payload),
    });
  }
});

app.get("/admin/taste-sample", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid required" });

    const userSnap = await db
      .collection("taste_stats_user")
      .doc(uid)
      .collection("stats")
      .orderBy("weight", "desc")
      .limit(10)
      .get();

    const globalSnap = await db
      .collection("taste_stats_global")
      .orderBy("weight", "desc")
      .limit(10)
      .get();

    res.json({
      user_top: userSnap.docs.map(d => d.data()),
      global_top: globalSnap.docs.map(d => d.data()),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Fetch wardrobe by user ID (normalized + hydrated)
app.get("/wardrobe", async (req, res) => {
  try {
    let { uid } = req.query;
    uid = (uid || "").trim();

    if (!uid) {
      return res.status(400).json({ error: "UID is required" });
    }

    console.log("📥 Incoming UID:", uid);

    const snapshot = await db
      .collection("wardrobe")
      .where("uid", "==", uid)
      .get();

    if (snapshot.empty) {
      console.log("⚠️ No wardrobe items found for UID:", uid);
      return res.json([]);
    }

    // Helper to normalize display name
    function normalizeName(data) {
      if (data.primaryTag) return data.primaryTag;
      if (data.name?.startsWith("Unknown")) {
        return data.name.replace(/^Unknown\s+/i, "").trim();
      }
      if (data.name?.startsWith("Default")) {
        return data.name.replace(/^Default\s+/i, "").trim();
      }
      return data.name || "Unnamed";
    }

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();

      const normalizedCategory = normalizeCategory(
        data.category || "",
        data.name || "",
      );
      const taxonomyPath = mapTaxonomy(normalizedCategory);

      const hydrated = hydrateWardrobeItem({
        ...data,
        name: normalizeName(data),
        primaryTag: normalizeName(data),
        category: normalizedCategory,
        taxonomyPath,
      });

      // ✅ FORCE ids AFTER hydrate (hydrateWardrobeItem cannot delete these now)
      return {
        ...hydrated,
        id: doc.id,
        wardrobe_id: doc.id,
        idx: doc.id,
      };


    });

    console.log("📦 Normalized wardrobe items:", items.length);
    res.json(Array.isArray(items) ? items : []);

  } catch (err) {
    console.error("❌ Fetch wardrobe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Swap candidates for a single slot (top|bottom|footwear|bag|dress)
app.post("/swap-suggestions", async (req, res) => {
  try {
    const { uid, slot, excludeIds = [], limit = 8, occasion = "", preferNeutral = true } = req.body || {};
    if (!uid || !slot) {
      return res.status(400).json({ error: "uid and slot are required" });
    }

    // Load full wardrobe for the user
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    const all = snap.docs.map(d => {
      const data = d.data() || {};
      return {
        ...data,
        id: d.id,
        wardrobe_id: d.id,
        idx: d.id,
      };
    });


    // Same-slot candidates, excluding currently used ids
    const used = new Set(excludeIds);
    let candidates = all.filter(w =>
      slotOf(w.category || w.name) === slot && !used.has(w.id)
    );

    // Soft occasion nudge (reuse occasionCategoryMap if present)
    const occCats = (occasion && occasionCategoryMap?.[occasion.toLowerCase()]) || [];
    if (occCats.length) {
      candidates = candidates.map(it => {
        const cat = (it.category || "").toLowerCase();
        const name = (it.name || "").toLowerCase();
        const occBoost = occCats.some(c => cat.includes(c.toLowerCase()) || name.includes(c.toLowerCase())) ? 0.25 : 0;
        return { it, score: occBoost + (preferNeutral && isNeutralSwap(it.color) ? 0.2 : 0) + Math.random() * 0.6 };
      }).sort((a,b)=>b.score-a.score).map(x=>x.it);
    } else if (preferNeutral) {
      // simple neutral bias
      candidates = candidates.map(it => ({
        it, score: (isNeutralSwap(it.color) ? 0.2 : 0) + Math.random()*0.8
      })).sort((a,b)=>b.score-a.score).map(x=>x.it);
    } else {
      // randomize
      candidates = candidates.sort(() => Math.random() - 0.5);
    }

    // Hydrate minimal, consistent object like the rest of the API
    const hydrated = candidates.slice(0, limit).map(it => hydrateWardrobeItem({
      wardrobe_id: it.wardrobe_id || it.id,   // ✅ preserve doc id
      id: it.wardrobe_id || it.id,            // ✅ keep compatibility
      ...it,
      category: normalizeCategory(it.category || "", it.name || ""),
      taxonomyPath: it.taxonomyPath || mapTaxonomy(normalizeCategory(it.category || "", it.name || "")),
    }));


    res.json({ success: true, slot, items: hydrated });
  } catch (err) {
    console.error("❌ /swap-suggestions failed:", err.message);
    res.status(500).json({ error: "Swap suggestions failed", message: err.message });
  }
});


// ✅ Debug route to list all wardrobe docs
app.get("/debug-wardrobe", async (req, res) => {
  try {
    const snapshot = await db.collection("wardrobe").get();
    const items = snapshot.docs.map((doc) => ({
      wardrobe_id: doc.id,
      id: doc.id,
      uid: doc.data().uid,
      name: doc.data().name,
      category: doc.data().category,
    }));


    console.log("🧾 DEBUG wardrobe items:", items);
    res.json(items);
  } catch (err) {
    console.error("❌ Debug wardrobe failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Debug uniform wardrobe schema
app.get("/debug-uniform", async (req, res) => {
  try {
    const snapshot = await db.collection("wardrobe").get();
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      category: doc.data().category,
      color: doc.data().color,
      silhouette: doc.data().silhouette || "❌ missing",
      palette: doc.data().palette || "❌ missing",
      taxonomyPath: doc.data().taxonomyPath || "❌ missing",
      source: doc.data().uid === "staples-global" ? "staple" : "wardrobe",
    }));
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Get Staples - from Firestore (v2 collections)
app.get("/staples", async (req, res) => {
  try {
    const gender = String(req.query.gender || "male").toLowerCase();
    const version = String(req.query.version || "v2").toLowerCase();

    const col =
      gender === "female"
        ? (version === "v2" ? "staples_female_v2" : "staples_female")
        : (version === "v2" ? "staples_male_v2" : "staples_male");

    const snap = await db.collection(col).get();

    const staples = snap.docs.map((doc) => {
      const data = doc.data() || {};
      const name = data.name || doc.id;
      const category = data.category || "Staple";
      const color = data.color || "Default";

      const hydrated = hydrateWardrobeItem({
        uid: "staples-global",
        name,
        primaryTag: name,
        category: normalizeCategory(category, name),
        color,
        image_url: data.image_url || "",
        tags: Array.isArray(data.tags) ? data.tags : [name, "Staple"],
        taxonomyPath:
          data.taxonomyPath || mapTaxonomy(normalizeCategory(category, name)),
        silhouette: data.silhouette || guessSilhouette(`${name} ${category}`),
        palette: data.palette || pickPalette(color),

        gender: data.gender || gender,
        version: data.version || version,
      });

      return {
        ...hydrated,
        id: doc.id,
        wardrobe_id: doc.id,
        idx: doc.id,
        source: "staple",
      };
    });

    return res.json({
      success: true,
      staples,
      items: staples,
      count: staples.length,
      collection: col,
    });
  } catch (err) {
    console.error("❌ /staples failed:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});



// ✅ Enhanced Quick Add - Manual item entry with optional image
app.post("/quick-add", async (req, res) => {
  let {
    uid,
    name,
    editedName,
    category = "Staple",
    editedCategory,
    color = "Default",
    editedColor,
    image_url
  } = req.body;

  // Prefer edited values if provided
  name = (editedName ?? name);
  category = (editedCategory ?? category);
  color = (editedColor ?? color);


  // ⚡ Auto-fallback UID for staples
  if (!uid) {
    uid = "staples-global"; // change to real user uid if you want to duplicate into each user’s wardrobe
  }



  console.log("⚡ Quick-add request:", {
    uid,
    name,
    category,
    color,
    has_image: !!image_url,
  });

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Name is required",
    });
  }


  try {
    // Helper function to capitalize words
    function capitalizeWords(str) {
      if (!str) return "";
      return str
        .toLowerCase()
        .split(/[\s-/]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    const capitalizedName = capitalizeWords(name);
    const rawCategory = capitalizeWords(category || "");
    let normalizedCategory;
    try {
      try {
        normalizedCategory = normalizeCategory(rawCategory, capitalizedName);
        if (!normalizedCategory) {
          console.warn("⚠️ normalizeCategory returned empty, forcing Staple");
          normalizedCategory = "Staple";
        }
      } catch (e) {
        console.warn("⚠️ normalizeCategory failed, forcing Staple:", e.message);
        normalizedCategory = "Staple";
      }


    } catch (e) {
      console.warn("⚠️ normalizeCategory failed, falling back:", e.message);
      normalizedCategory = rawCategory || "Staple";
    }


    const capitalizedColor = capitalizeWords(color || "");

    // Create tags array with name, color, and category
    const capitalizedTags = [
      capitalizedName,
      capitalizedColor,
      normalizedCategory || "Staple",
    ].filter(Boolean);


    // Create wardrobe item with simplified structure for quick-add
    


    const taxonomyPath = mapTaxonomy(normalizedCategory);

    const hydrated = hydrateWardrobeItem({
      uid,
      name: capitalizedName,
      primaryTag: capitalizedName,   // keep display name consistent
      category: normalizedCategory,
      color: capitalizedColor,
      image_url,
      tags: capitalizedTags,
      taxonomyPath,
    });


    const docRef = await db.collection("wardrobe").add(hydrated);


    console.log("👟 Saving quick-add staple:", {
      uid,
      name: capitalizedName,
      category: normalizedCategory,
      color: capitalizedColor,
      image_url: image_url || null,
    });

    console.log("✅ Quick-add item saved:", docRef.id);

    return res.json({
      success: true,
      item: { wardrobe_id: docRef.id, id: docRef.id, ...hydrated },
      message: "Item added successfully to wardrobe",
    });

  } catch (err) {
    console.error("❌ Quick-add failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add item to wardrobe",
      error: err.message,
    });
  }
});

// ✅ Add wardrobe item
app.post("/wardrobe", limiterWrites, async (req, res) => {

  try {
    let { uid, image_path, image_url, name, editedName, category, editedCategory, color, editedColor, tags } =
      req.body;

    // Prefer edited values if provided
    name = (editedName ?? name);
    category = (editedCategory ?? category);
    color = (editedColor ?? color);


    if (
      !uid ||
      !image_path ||
      typeof image_path !== "string" ||
      image_path.includes("undefined")
    ) {
      return res.status(400).json({
        error:
          "Valid uid & image_path are required (image_path was empty or invalid)",
      });
    }

    // 🔤 helper: capitalize words cleanly
    function capitalizeWords(str) {
      return str
        .toLowerCase()
        .split(/[\s-/]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    const tagsRaw = tags || [];
    const capitalizedTags = tagsRaw.map(capitalizeWords);
    const capitalizedName = capitalizeWords(name || "Item");
    const capitalizedColor = capitalizeWords(color || "");
    const capitalizedCategory = capitalizeWords(category || "");

    const knownFabrics = [
      "Cotton",
      "Linen",
      "Denim",
      "Silk",
      "Wool",
      "Nylon",
      "Polyester",
      "Chiffon",
    ];
    const fabric =
      capitalizedTags.find((tag) => knownFabrics.includes(tag)) || "Unknown";

    const primaryTag = capitalizedName;

    // 👇 NEW: taxonomy enrichment
    const taxonomyMatch = findCategory(capitalizedName.toLowerCase());
    const taxonomyAttributes = taxonomyMatch
      ? getAttributes(taxonomyMatch.subCategory) || {}
      : {};

    // 👇 Normalize category before saving
    const normalizedCategory = normalizeCategory(
      capitalizedCategory,
      capitalizedName,
    );

    const taxonomyPath = mapTaxonomy(normalizedCategory);

    const hydrated = hydrateWardrobeItem({
      uid,
      name: capitalizedName,
      primaryTag: capitalizedName,   // keep display name consistent
      category: normalizedCategory,
      color: capitalizedColor,
      image_url,
      tags: capitalizedTags,
      taxonomyPath,

      // ✅ Step 3: persist these so reranker/validator is stable
      silhouette: guessSilhouette(`${capitalizedName} ${normalizedCategory}`),
      palette: pickPalette(capitalizedColor),
    });





    const docRef = await db.collection("wardrobe").add(hydrated);

    


    res.status(200).json({
      message: "Item added",
      wardrobe_id: docRef.id,
      id: docRef.id,
      item: { wardrobe_id: docRef.id, id: docRef.id, ...hydrated },
    });


  } catch (err) {
    console.error("❌ Error adding item:", err.message);
    res.status(500).json({ error: "Failed to save wardrobe item" });
  }
});

// ✅ Secure Delete wardrobe item
app.delete("/wardrobe/:id", limiterWrites, async (req, res) => {

  const { id } = req.params;
  const { uid } = req.query;

  // 1️⃣ Validate inputs
  if (!id) {
    return res.status(400).json({ error: "Item ID is required" });
  }
  if (!uid) {
    return res.status(400).json({ error: "uid is required" });
  }

  try {
    const ref = db.collection("wardrobe").doc(id);
    const snap = await ref.get();

    // 2️⃣ Check item exists
    if (!snap.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    const item = snap.data();

    // 3️⃣ Ownership check (THIS IS THE SECURITY FIX)
    if (item.uid !== uid) {
      return res.status(403).json({ error: "Not authorized to delete this item" });
    }

    // 4️⃣ Delete safely
    await ref.delete();

    res.status(200).json({ message: "Item deleted securely", id });
  } catch (err) {
    console.error("❌ Error deleting item:", err.message);
    res.status(500).json({ error: "Failed to delete wardrobe item" });
  }
});


// ✅ Update wardrobe item
app.put("/wardrobe/:id", limiterWrites, async (req, res) => {

  const { id } = req.params;
  let { uid, name, editedName, category, editedCategory, color, editedColor, tags } = req.body;
  name = (editedName ?? name);
  category = (editedCategory ?? category);
  color = (editedColor ?? color);


  if (!id) return res.status(400).json({ error: "Item ID is required" });
  if (!uid) return res.status(400).json({ error: "UID is required" });

  try {
    // First verify the item belongs to the user
    const docRef = db.collection("wardrobe").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    const itemData = doc.data();
    if (itemData.uid !== uid) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this item" });
    }

    // Helper function to capitalize words (same as in POST route)
    function capitalizeWords(str) {
      return str
        .toLowerCase()
        .split(/[\s-/]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      updateData.name = capitalizeWords(name);
      updateData.primaryTag = capitalizeWords(name);
    }
    if (category !== undefined) {
      updateData.category = capitalizeWords(category);
    }
    if (color !== undefined) {
      updateData.color = capitalizeWords(color);
    }
    if (tags !== undefined) {
      const capitalizedTags = Array.isArray(tags)
        ? tags.map(capitalizeWords)
        : [];
      updateData.tags = capitalizedTags;

      // Update fabric if tags include known fabrics
      const knownFabrics = [
        "Cotton",
        "Linen",
        "Denim",
        "Silk",
        "Wool",
        "Nylon",
        "Polyester",
        "Chiffon",
      ];
      const fabric =
        capitalizedTags.find((tag) => knownFabrics.includes(tag)) ||
        itemData.fabric ||
        "Unknown";
      updateData.fabric = fabric;
    }

    // Update taxonomy if name changed
    if (name !== undefined) {
      const taxonomyMatch = findCategory(capitalizeWords(name).toLowerCase());
      if (taxonomyMatch) {
        updateData.taxonomyPath = `${taxonomyMatch.mainCategory}/${taxonomyMatch.subCategory}`;
        updateData.attributes = getAttributes(taxonomyMatch.subCategory) || {};
      }
    }
    // ✅ keep silhouette/palette in sync when core fields change
    const finalName = updateData.name ?? itemData.name ?? "";
    const finalCategory = updateData.category ?? itemData.category ?? "";
    const finalColor = updateData.color ?? itemData.color ?? "";

    if (updateData.name !== undefined || updateData.category !== undefined) {
      updateData.silhouette = guessSilhouette(`${finalName} ${finalCategory}`);
    }
    if (updateData.color !== undefined) {
      updateData.palette = pickPalette(finalColor);
    }

    await docRef.update(updateData);
    res.status(200).json({ message: "Item updated", id });
  } catch (err) {
    console.error("❌ Error updating item:", err.message);
    res.status(500).json({ error: "Failed to update wardrobe item" });
  }
});

// ✅ Bulk delete wardrobe items
  app.post("/wardrobe/bulk-delete", limiterWrites, async (req, res) => {

  const { uid, ids } = req.body;

  if (!uid) return res.status(400).json({ error: "UID is required" });
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res
      .status(400)
      .json({ error: "IDs array is required and must not be empty" });
  }

  try {
    // Verify all items belong to the user before deleting any
    const itemRefs = ids.map((id) => db.collection("wardrobe").doc(id));
    const itemDocs = await Promise.all(itemRefs.map((ref) => ref.get()));

    // Check if all items exist and belong to the user
    const invalidItems = [];
    const validRefs = [];

    itemDocs.forEach((doc, index) => {
      if (!doc.exists) {
        invalidItems.push({ id: ids[index], reason: "not found" });
      } else if (doc.data().uid !== uid) {
        invalidItems.push({ id: ids[index], reason: "not authorized" });
      } else {
        validRefs.push(itemRefs[index]);
      }
    });

    if (invalidItems.length > 0) {
      return res.status(400).json({
        error: "Some items could not be deleted",
        invalidItems,
      });
    }

    // Delete all valid items in a batch
    const batch = db.batch();
    validRefs.forEach((ref) => batch.delete(ref));
    await batch.commit();

    res.status(200).json({
      message: "Bulk delete complete",
      count: validRefs.length,
    });
  } catch (err) {
    console.error("❌ Error bulk deleting items:", err.message);
    res.status(500).json({ error: "Failed to bulk delete wardrobe items" });
  }
});



// ✅ Migration script: hydrate missing fields (one-time use)
app.post("/migrate-wardrobe", async (req, res) => {
  try {
    const snapshot = await db.collection("wardrobe").get();
    const batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Always re-hydrate with new taxonomy
      const hydrated = hydrateWardrobeItem(data);
      batch.update(doc.ref, hydrated);
      count++;
    }

    await batch.commit();
    res.json({ message: `Migrated ${count} wardrobe items` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Normalize wardrobe data (fix names, categories, taxonomy)
app.post("/normalize-wardrobe", async (req, res) => {
  try {
    const snapshot = await db.collection("wardrobe").get();
    const batch = db.batch();
    let count = 0;

    // Helper: capitalize words cleanly
    function capitalizeWords(str) {
      return (str || "")
        .toLowerCase()
        .split(/[\s-/]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 1. Clean name
      let cleanName = (data.name || "")
        .replace(/\.png/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      cleanName = capitalizeWords(cleanName);

      // 2. Normalize category
      const normalizedCategory = normalizeCategory(data.category, cleanName);

      // 3. Hydrate missing fields
      const taxonomyPath = mapTaxonomy(normalizedCategory);

      const hydrated = hydrateWardrobeItem({
        ...data,
        name: cleanName,
        category: normalizedCategory,
        taxonomyPath,
      });

      // Only update if something changed
      const current = JSON.stringify(data);
      const updated = JSON.stringify(hydrated);
      if (current !== updated) {
        batch.update(doc.ref, hydrated);
        count++;
      }
    }

    await batch.commit();
    res.json({ message: `Normalized ${count} wardrobe items` });
  } catch (err) {
    console.error("❌ normalize-wardrobe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Get outfit plan for a given user and date
// ✅ Get outfit plan for a given user and date (ALWAYS 200, never 404)
app.get("/plan-outfit", async (req, res) => {
  const { uid, date } = req.query;

  if (!uid || !date) {
    return res.status(400).json({ success: false, error: "uid and date are required" });
  }

  try {
    const docId = `${uid}_${date}`;
    const docRef = db.collection("outfit_plans").doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // ✅ IMPORTANT: return success true with outfit null (frontend-safe)
      return res.status(200).json({
        success: true,
        outfit: null,
        uid,
        date,
        message: "No outfit plan found for this date."
      });
    }

    const data = docSnap.data() || {};
    // Normalize shape
    return res.status(200).json({
      success: true,
      outfit: data.outfit || null,
      uid: data.uid || uid,
      date: data.date || date
    });
  } catch (err) {
    console.error("❌ Failed to fetch outfit plan:", err.message);
    return res.status(500).json({ success: false, error: "Failed to fetch outfit plan" });
  }
});


// ─── User preference summariser ─────────────────────────────
function buildUserStyleSummary(uid, max = 10) {
  return db
    .collection("liked_looks")
    .where("uid", "==", uid)
    .orderBy("liked_at", "desc")
    .limit(max)
    .get()
    .then((snap) => {
      const items = snap.docs.flatMap((d) => d.data().outfit?.items || []);

      if (!items.length) return "";

      const counts = (prop) =>
        items.reduce((acc, it) => {
          const key = (it[prop] || "").toLowerCase();
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

      const top = (obj) =>
        Object.entries(obj)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k]) => k)
          .join(", ");

      const summary =
        `User often chooses colors: ${top(counts("color"))}. ` +
        `Frequent categories: ${top(counts("category"))}.`;

      return summary;
    })
    .catch(() => ""); // fail-silent
}
// ─────────────────────────────────────────────────────────────

async function getUserMemory(uid) {
  try {
    const doc = await db.collection("tina_memory").doc(uid).get();
    return doc.exists ? doc.data() : {};
  } catch (err) {
    console.error("🧠 Error fetching tina_memory:", err.message);
    return {};
  }
}

// ─── Combo stats tracker ─────────────────────────────
async function logComboEvent(uid, type) {
  try {
    const ref = db.collection("tina_memory").doc(uid);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const prev = doc.exists ? doc.data().combo_stats || {} : {};
      const updated = {
        disliked_fix: prev.disliked_fix || 0,
        disliked_swap: prev.disliked_swap || 0,
        liked_boost: prev.liked_boost || 0,
      };
      if (type === "fix") updated.disliked_fix++;
      if (type === "swap") updated.disliked_swap++;
      if (type === "like") updated.liked_boost++;
      tx.set(ref, { combo_stats: updated }, { merge: true });
    });
  } catch (err) {
    console.error("⚠️ Failed to log combo event:", err.message);
  }
}

// 🧭 Tina emergent learning updater (global, reused by routes)
async function updateLearning(uid, validation, liked = true) {
  try {
    const ref = db.collection("tina_memory").doc(uid);
    const doc = await ref.get();
    const weights = doc.exists ? (doc.data().learning_weights || {}) : {};

    // learning increments
    const delta = liked ? 0.05 : -0.03;
    const bump = (v, d) => Math.min(1, Math.max(0, (v ?? 0.5) + d));

    const updated = {
      colorHarmony: bump(weights.colorHarmony, validation?.valid ? delta : -0.02),
      silhouetteBalance: bump(weights.silhouetteBalance, validation?.valid ? delta : -0.02),
      trendAwareness: bump(weights.trendAwareness, 0.01),       // slow upward nudge
      wardrobeRotation: bump(weights.wardrobeRotation, 0.01),   // slow upward nudge
    };

    await ref.set({ learning_weights: updated }, { merge: true });
    console.log("📈 Updated Tina learning weights:", updated);
  } catch (err) {
    console.error("⚠️ Learning update failed:", err.message);
  }
}


// ✅ Pinterest Analysis via Official API
app.post("/pinterest-analysis", async (req, res) => {
  try {
    const { uid, occasion, weather = "mild", city = "Delhi" } = req.body;
    if (!uid || !occasion) {
      return res.status(400).json({ error: "uid and occasion are required" });
    }

    // 1️⃣ Fetch wardrobe from Firestore
    const snapshot = await db
      .collection("wardrobe")
      .where("uid", "==", uid)
      .get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Wardrobe is empty" });
    }
    const wardrobeItems = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      wardrobe_id: doc.id,
      idx: doc.id,
    }));


    // 2️⃣ Build Pinterest search query
    const searchQuery = `${occasion} ${weather} outfits`;

    // 3️⃣ Call Pinterest API (Pins search endpoint)
    const pinterestRes = await axios.get(
      `https://api.pinterest.com/v5/search/pins`,
      {
        params: { query: searchQuery, page_size: 5 },
        headers: {
          Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}`,
        },
      },
    );

    const pins = pinterestRes.data?.items || [];
    const imageUrls = pins.map((pin) => pin.media.images.originals.url);

    console.log(`📸 Found ${imageUrls.length} Pinterest images`);

    // 4️⃣ Run GPT Vision on top 3–5 images
    let pinterestAnalysis = "No analysis available";
    if (imageUrls.length > 0) {
      try {
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini", // can switch to gpt-4o for richer vision
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze these "${occasion}" outfit images for ${weather} weather. Extract key styling elements:

1. COLOR PALETTE  
2. CLOTHING CATEGORIES  
3. STYLE ELEMENTS (patterns, fits, textures)  
4. LAYERING  
5. ACCESSORIES  
6. WEATHER ADAPTATION  

Summarize clearly.`,
                },
                ...imageUrls.slice(0, 5).map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ],
            },
          ],
        });

        pinterestAnalysis =
          visionResponse.choices?.[0]?.message?.content ||
          "No analysis available";
      } catch (err) {
        console.error("❌ GPT Vision failed:", err.message);
      }
    }

    // 5️⃣ Build outfits using wardrobe
    const outfits = [
      {
        title: `${occasion} Inspired Look 1`,
        style_note: `Based on Pinterest trends and your wardrobe for ${weather} weather.`,
        items: wardrobeItems.slice(0, 3),
        pinterest_inspiration: pinterestAnalysis,
        weather_suitability: weather,
      },
      {
        title: `${occasion} Inspired Look 2`,
        style_note: "Alternative mix balancing comfort and trend.",
        items: wardrobeItems.slice(3, 6),
        pinterest_inspiration: pinterestAnalysis,
        weather_suitability: weather,
      },
    ];

    res.json({
      suggestions: outfits,
      pinterest_analysis: pinterestAnalysis,
      search_query: searchQuery,
      images: imageUrls,
    });
  } catch (err) {
    console.error("❌ Pinterest API error:", err.message);
    res
      .status(500)
      .json({ error: "Pinterest analysis failed", details: err.message });
  }
});

// ✅ Privacy Policy Route
app.get("/privacy", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Privacy Policy - WOW Wardrobe</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px; line-height: 1.6; }
          h1, h2 { color: #b83280; }
        </style>
      </head>
      <body>
        <h1>Privacy Policy for WOW Wardrobe</h1>
        <p><strong>Last updated:</strong> September 2025</p>

        <p>WOW Wardrobe ("we", "our", "us") respects your privacy. This Privacy Policy explains how we
        collect, use, and protect your data when you use our app.</p>

        <h2>Information We Collect</h2>
        <ul>
          <li>Account information (Google Sign-In UID)</li>
          <li>Wardrobe images you upload</li>
          <li>Tags, preferences, and styling data you provide</li>
          <li>Usage data (likes, outfit saves, planner entries)</li>
        </ul>

        <h2>How We Use Your Data</h2>
        <ul>
          <li>To suggest outfits tailored to your wardrobe</li>
          <li>To improve Tina, your personal AI stylist</li>
          <li>To enable features like wardrobe management and outfit planning</li>
        </ul>

        <h2>Data Sharing</h2>
        <p>We do not sell or rent your data. Your data may be processed by trusted services such as
        Firebase, OpenAI, and Ximilar to provide app functionality.</p>

        <h2>Your Rights</h2>
        <p>You can request deletion of your data anytime by contacting us at
        <a href="mailto:support@wowwardrobe.com">support@wowwardrobe.com</a>.</p>

        <h2>Contact</h2>
        <p>If you have questions about this Privacy Policy, contact us at
        <a href="mailto:support@wowwardrobe.com">support@wowwardrobe.com</a>.</p>
      </body>
    </html>
  `);
});

// ✅ Fetch fashion rules (general, complexion, body type, wardrobe)
app.get("/fashion-rules", async (req, res) => {
  try {
    const { category } = req.query; // optional filter
    let query = db.collection("fashion_rules");

    if (category) {
      query = query.where("category", "==", category);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "No rules found" });
    }

    const rules = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, rules });
  } catch (err) {
    console.error("❌ Fetch fashion rules failed:", err.message);
    res.status(500).json({ error: "Failed to fetch fashion rules" });
  }
});

// ── Rich user style context (likes/dislikes + prefs + learning) ─────────────
async function getUserStyleContext(uid) {
  const mem = await getUserMemory(uid).catch(() => ({}));

  // 🎯 Feedback memory: fetch last 10 structured feedbacks
  let feedbackMemory = [];
  try {
    const feedbackSnap = await db
      .collection("feedback")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    feedbackMemory = feedbackSnap.docs.map(d => d.data());
  } catch (err) {
    console.warn("⚠️ feedback memory fetch failed:", err.message);
  }

  const learning = {
    colorHarmony:      mem?.learning_weights?.colorHarmony      ?? 0.5,
    silhouetteBalance: mem?.learning_weights?.silhouetteBalance ?? 0.5,
    trendAwareness:    mem?.learning_weights?.trendAwareness    ?? 0.3,
    wardrobeRotation:  mem?.learning_weights?.wardrobeRotation  ?? 0.4,
  };

  // liked / disliked combo fingerprints
  let likedCombos = [];
  let dislikedCombos = [];
  try {
    const likedSnap = await db.collection("liked_looks").where("uid","==",uid).limit(100).get();
    likedCombos = likedSnap.docs.map(d => d.data().combo).filter(Boolean);

    const dislikedSnap = await db.collection("disliked_looks").where("uid","==",uid).limit(100).get();
    dislikedCombos = dislikedSnap.docs.map(d => d.data().combo).filter(Boolean);
  } catch (e) {
    console.warn("⚠️ styleContext combos fetch failed:", e.message);
  }

  // short style summary (re-uses your helper)
  const summary = await buildUserStyleSummary(uid).catch(() => "");

  // optional “top signals” fallback if summary comes empty
  const likedItems = [];
  try {
    const likedSnap = await db.collection("liked_looks").where("uid","==",uid).orderBy("liked_at","desc").limit(40).get();
    likedSnap.docs.forEach(d => (d.data().outfit?.items || []).forEach(i => likedItems.push(i)));
  } catch {}
  const countBy = (arr, key) =>
    arr.reduce((acc, it) => {
      const k = (it?.[key] || "").toLowerCase();
      if (!k) return acc;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  const top3 = (obj) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
  const topColors = top3(countBy(likedItems, "color"));
  const topCats   = top3(countBy(likedItems, "category"));

  const styleSummary =
    summary ||
    `Prefers colors: ${topColors.join(", ") || "neutral"}; categories: ${topCats.join(", ") || "mixed"}.`;

  return {
    micro_feedback: Array.isArray(mem.micro_feedback) ? mem.micro_feedback : [],
    gender: (mem.gender || "").toLowerCase(),
    bodyShape: (mem.bodyShape || "").toLowerCase(),
    complexion: (mem.complexion || "").toLowerCase(),
    dislikes: Array.isArray(mem.dislikes) ? mem.dislikes : [],
    learning_weights: learning,
    likedCombos,
    dislikedCombos,
    feedbackMemory,
    styleSummary,
    last_served_combo: mem.last_served_combo || null,
  };

}

// ─── Updated /suggest-outfit route: tool-calling agent loop ─────────────────
app.post("/suggest-outfit", limiterSuggestOutfit, async (req, res) => {

  console.log("HIT /suggest-outfit (agent) ", { ts: new Date().toISOString() });

  const {
    uid,
    occasion = "",
    vibe = "",
    city = "Delhi",
    prompt = "",
  } = req.body || {};
  console.log("🟢 /suggest-outfit received UID:", uid);

  if (!uid) return res.status(400).json({ error: "uid is required" });

  // ─────────────────────────────
  // 🧠 Hoisted per-request context (available throughout this handler)
  // ─────────────────────────────
  let prefs = { gender: "", bodyShape: "", complexion: "", dislikes: [] };
  let learning = { colorHarmony: 0.5, silhouetteBalance: 0.5, trendAwareness: 0.3, wardrobeRotation: 0.4 };
  let tinaLevel = "Level 1 (Intern)";
  let likedCombos = [];
  let dislikedCombos = [];
  let styleSummary = "";
  let lastServedCombo = null;
  let microFeedback = []; // <— HOISTED so it’s visible everywhere in this handler
  let userFeedback = [];            // recent raw feedback docs (array)
  let fbSets = null;                // structured sets from buildFeedbackMemory()



  // Prefetch user preferences & a basic wardrobe snapshot (we still expose function to fetch full)
  try {
    // 🔹 Enriched user context
    const userCtx = await getUserStyleContext(uid);
    microFeedback  = userCtx.micro_feedback || [];
    userFeedback   = Array.isArray(userCtx.feedbackMemory) ? userCtx.feedbackMemory : [];

    try {
      fbSets = await buildFeedbackMemory(db, uid); // { likedIds:Set, dislikedIds:Set, ... }
    } catch (e) {
      console.warn("⚠️ buildFeedbackMemory failed:", e?.message || e);
      fbSets = null;
    }





    prefs = {
      gender: userCtx.gender,
      bodyShape: userCtx.bodyShape,
      complexion: userCtx.complexion,
      dislikes: userCtx.dislikes,
    };

    const baseWeights = {
      colorHarmony: 0.5,
      silhouetteBalance: 0.5,
      trendAwareness: 0.3,
      wardrobeRotation: 0.4,
    };
    learning = { ...baseWeights, ...(userCtx?.learning_weights || {}) };

    function getTinaLevel(weights = {}) {
      const vals = Object.values(weights);
      if (!vals.length) return "Level 1 (Intern)";
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg < 0.4) return "Level 1 (Intern)";
      if (avg < 0.7) return "Level 2 (Junior Stylist)";
      return "Level 3 (Confident Stylist)";
    }

    tinaLevel = getTinaLevel(learning);

    likedCombos = userCtx.likedCombos || [];
    dislikedCombos = userCtx.dislikedCombos || [];
    styleSummary = userCtx.styleSummary || "";
    lastServedCombo = userCtx.last_served_combo || null;

  } catch (err) {
    console.warn("⚠️ Could not fetch combo memory:", err.message);
    // keep defaults
  }


  
  // ✅ Fetch fashion rules based on user prefs
  let fashionRules = [];
  let rulesText = ""; // <-- HOISTED so system prompt can safely read it
  try {
    const rulesSnap = await db.collection("fashion_rules").get();
    fashionRules = rulesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Filter by prefs
    const userRules = fashionRules.filter((rule) => {
      if (prefs.complexion && rule.rule_id.includes(prefs.complexion.toLowerCase())) return true;
      if (prefs.bodyShape && rule.rule_id.includes(prefs.bodyShape.toLowerCase())) return true;
      if (rule.category === "general") return true;
      return false;
    });

    fashionRules = userRules;

    // ✅ Build formatted rules for AI prompt AFTER filtering
    rulesText = fashionRules
      .map(r => {
        const p = r.principle ? `• ${r.principle}` : "• Rule";
        const rule = r.rule ? ` — ${r.rule}` : "";
        const ex = r.example ? ` (ex: ${r.example})` : "";
        return `${p}${rule}${ex}`;
      })
      .join("\n");

    console.log(
      "🎯 Loaded fashion rules for user:",
      fashionRules.map((r) => r.rule_id),
    );
  } catch (err) {

    console.error("❌ Failed to fetch fashion rules:", err.message);
    fashionRules = [];
  }

  try {
    // 🔥 fetch wardrobe snapshot FIRST
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();

    console.log("👕 Fetch wardrobe for UID:", uid);
    console.log("📦 Snapshot empty?", snap.empty, "size:", snap.size);

    snap.forEach((doc) => {
      const d = doc.data();
      console.log(
        "➡️ Wardrobe doc:",
        doc.id,
        "| uid:",
        d.uid,
        "| name:",
        d.name,
        "| category:",
        d.category,
      );
    });

    if (snap.empty) {
      console.warn("⚠️ Wardrobe empty, returning test items");
      return res.json({
        outfits: [
          {
            title: "Debug Outfit",
            style_note: "No wardrobe but forced",
            items: [],
          },
        ],
      });
    }

    let rawWardrobe = snap.docs.map((d) => {
      const data = d.data();

      // ✅ Clean category with helper
      const cleanCategory = normalizeCategory(data.category, data.name);

      // ✅ Define cleanName properly
      const cleanName = data.name || "Unnamed";

      return {
        id: d.id,
        ...data,
        name: cleanName,
        category: cleanCategory,
      };
    });

    // 🎯 Occasion-aware filter (strict)
    //if (occasion && occasionCategoryMap[occasion.toLowerCase()]) {

     // const allowedCats = occasionCategoryMap[occasion.toLowerCase()];
    //  rawWardrobe = rawWardrobe.filter((it) => {
      //  const cat = (it.category || "").toLowerCase();
      //  return allowedCats.some((allowed) => {
        //  const a = allowed.toLowerCase();
          //return (
            //cat.includes(a) || // direct contains
            //it.name?.toLowerCase().includes(a) || // also check name
  //          (cat.startsWith("formal") && a.includes("shirt")) || // catch formal shirt
    //        (cat.includes("trouser") && a.includes("pants")) || // pants vs trousers
      //      (cat.includes("heel") && a.includes("shoes")) // heels vs shoes
      //    );
     //   });
    //  });

   //   console.log(
   //     `🎯 Occasion filter applied for "${occasion}", items left:`,
   //     rawWardrobe.length,
   //   );
  //  }

    // 🔍 DEBUG: show wardrobe normalization results
    console.log(
      "🪞 Normalized wardrobe sample (first 5):",
      rawWardrobe.slice(0, 5).map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        color: it.color,
        tags: it.tags,
      })),
    );
    console.log("📊 Total wardrobe items normalized:", rawWardrobe.length);

    // Small helper to map wardrobe to compact sample (idx strings)
    // 🎯 Learning-aware sampling (rotation + color harmony)
    function weightedSample(arr, max, opts = {}) {
      const {
        rotationWeight = learning.wardrobeRotation || 0.4,
        harmonyWeight  = learning.colorHarmony   || 0.5,
        occasionBoost  = (occasion || "").toLowerCase(),
      } = opts;

      const now = Date.now();
      const NEUTRALS = new Set([
        "black","white","cream","beige","grey","gray","navy","denim","tan","brown","off-white"
      ]);

      // 🎯 Occasion-aware hint (soft boost)
      const occasionCats = occasionCategoryMap[occasion.toLowerCase()] || [];
      if (occasionCats.length) {
        arr.forEach(it => {
          const match = occasionCats.some(c =>
            (it.category || "").toLowerCase().includes(c.toLowerCase())
          );
          it._occasionBoost = match ? 0.25 : 0;
        });
      }


      const scored = arr.map((it) => {
        const lw = it.lastWorn ? new Date(it.lastWorn).getTime() : 0;
        const days = lw ? Math.max(1, (now - lw) / (1000*60*60*24)) : 999;
        const colorStr = Array.isArray(it.color) ? (it.color[0] || "") : (typeof it.color === "string" ? it.color : "");
        const neutral = NEUTRALS.has(colorStr.toLowerCase()) ? 1 : 0;

        // occasion-aware nudges
           let occNudge = 0;
            const name = (it.name || "").toLowerCase();
            const catg = (it.category || "").toLowerCase();
            const isTee = /tee|t-?shirt/.test(name) || /t-?shirt/.test(catg);
            const isShirt = /shirt|blouse/.test(name) || /shirt|blouse/.test(catg);
            const isBlazer = /blazer|suit|jacket/.test(name) || /blazer|suit|jacket/.test(catg);
            const isTrouser = /trouser|pants|chinos|slacks/.test(name) || /trouser|pants|chinos|slacks/.test(catg);
            const isSandal = /sandal|flip/.test(name) || /sandal|flip/.test(catg);
            const isClosedToe = /loafer|oxford|derby|heel|pump|boot/.test(name) || /footwear/.test(catg);
        
            if (/(workwear|formal|interview)/.test(occasionBoost)) {
              occNudge += (isShirt ? 0.25 : 0) + (isBlazer ? 0.25 : 0) + (isTrouser ? 0.2 : 0);
              occNudge += (isClosedToe ? 0.15 : 0);
              occNudge -= (isTee ? 0.25 : 0) + (isSandal ? 0.2 : 0);
            }
            if (/dinner|date/.test(occasionBoost)) {
              occNudge += (isBlazer ? 0.15 : 0);
            }
        const _occasionBoostScore = it._occasionBoost || 0;

        const score =
          rotationWeight * Math.min(1, days / 21) +
          harmonyWeight  * neutral +
          occNudge +
          _occasionBoostScore +
          Math.random() * 0.2;

        return { it, score };
      });

      const total = scored.reduce((a,b)=>a+b.score,0) || 1;
      const take  = Math.min(max, scored.length);
      const used  = new Set();
      const picked = [];

      while (picked.length < take && used.size < scored.length) {
        let r = Math.random() * total;
        for (const s of scored) {
          if (used.has(s.it.id)) continue;
          if ((r -= s.score) <= 0) {
            picked.push(s.it);
            used.add(s.it.id);
            break;
          }
        }
      }
      return picked;
    }

      function buildSampleFromList(list = [], max = 50) {
       const subset = weightedSample(list, max, {
          rotationWeight: learning.wardrobeRotation,
          harmonyWeight:  learning.colorHarmony,
          occasionBoost:  occasion,
        });

      return subset.map((it, idx) => {
        const cleanName = it.name || "Unnamed";
        const cleanCat  = it.category || "Misc";
        const silhouetteGuess = it.silhouette || guessSilhouette(`${cleanName} ${cleanCat}`);
        const paletteGuess    = it.palette    || pickPalette(it.color || "");

        const sample = {
          idx: String(it.id),        // ✅ stable key (Firestore doc id)
          id: it.id,                 // keep
          wardrobe_id: it.id,        // also keep for compatibility
          name: cleanName,
          category: cleanCat,
          color: Array.isArray(it.color) ? (it.color[0] || "Unknown") : (it.color || "Unknown"),
          taxonomyPath: it.taxonomyPath || "",
          attributes: it.attributes || {},
          fabric: it.fabric || "Unknown",
          silhouette: silhouetteGuess,
          palette: paletteGuess,
          image_url: it.image_url || "",
          lastWorn: it.lastWorn || null,
        };
        if (idx < 5) console.log("🎽 buildSampleFromList item:", sample);
        return sample;
      });
    }

    // Server-side tool implementations
    async function fn_getWeather({ city: ct }) {
      const weather = await getWeather(ct || city).catch(() => null);
      return { city: ct || city, weather: weather || "unknown" };
    }

    async function fn_getWardrobe({
      uid: toolUid,
      max = 50,
      include_raw = false,
    }) {
      // If tool asked for explicit uid or raw set, obey; otherwise use the prefetched filtered rawWardrobe
      const targetUid = toolUid || uid;
      if (include_raw) {
        // fetch full raw (no prefilter)
        const fullSnap = await db
          .collection("wardrobe")
          .where("uid", "==", targetUid)
          .get();
        const fullList = fullSnap.docs.map((d) => {
          const data = d.data() || {};
          return {
            ...data,
            id: d.id,
            wardrobe_id: d.id,
            idx: d.id,
          };
        });

        return {
          items: buildSampleFromList(fullList, max),
          count: fullList.length,
        };
      }
      return {
        items: buildSampleFromList(rawWardrobe, max),
        count: rawWardrobe.length,
      };
    }

    // ✅ Fetch fashion rules for Tina
    async function fn_getFashionRules({ category = "" }) {
      try {
        let query = db.collection("fashion_rules");
        if (category) {
          query = query.where("category", "==", category);
        }
        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error("❌ Error fetching fashion rules:", err.message);
        return [];
      }
    }

    async function fn_getTrends({
      query = vibe || "general",
      source = "disabled",
      limit = 5,
    } = {}) {
      try {
        const out = await getTrendInsights({ query, source, limit });

        // Option A returns an object { trends:[], disabled:true, ... }
        if (out && typeof out === "object") {
          const trends = Array.isArray(out.trends) ? out.trends : [];
          return {
            query: out.query ?? query,
            source: out.source ?? source,
            trends,
            disabled: !!out.disabled,
            message: out.message || undefined,
          };
        }

        // legacy fallback (if something returns string)
        if (typeof out === "string") {
          return {
            query,
            source,
            trends: out.split("\n").filter(Boolean).map(s => ({ content: s })),
          };
        }

        return { query, source, trends: [], disabled: true };
      } catch (err) {
        return { query, source, trends: [], disabled: true };
      }
    }


    async function fn_validateLook({
      items = [],
      weather: w = city,
      occasion: occ = "",
      prefs: userPrefs = prefs,
    }) {
      const occUsed = occ || occasion; // use request-level 'occasion' when not provided

      try {
        // hydrate minimal structure for validate functions
        const hydrated = items.map((it) => ({
          id: it.id,
          name: it.name,
          category: it.category,
          color: it.color,
          taxonomyPath: it.taxonomyPath,
          attributes: it.attributes,
          fabric: it.fabric,
          silhouette: it.silhouette,
        }));

        const fashionBrainResult = validateLook(hydrated, { weather: w });
        const styleRulesResult = validateLookAgainstRules(
          { items: hydrated },
          {
            bannedItems: userPrefs?.dislikes || [],
            weather: w,
            occasion: occUsed,

            prefs: userPrefs,
          },
        );

        return { fashionBrainResult, styleRulesResult };
      } catch (err) {
        return { error: err?.message || String(err) };
      }
    }

    // function definitions passed to the model (JSON Schema)
    const functions = [
      {
        name: "get_weather",
        description:
          "Return weather string for a city (used to decide fabrics & layers).",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name (e.g., Delhi)" },
          },
          required: [],
        },
      },
      {
        name: "get_wardrobe",
        description: "Return user's wardrobe items. Use idx strings for items.",
        parameters: {
          type: "object",
          properties: {
            uid: { type: "string" },
            max: { type: "number" },
            include_raw: {
              type: "boolean",
              description: "If true, fetch full unfiltered wardrobe",
            },
          },
          required: [],
        },
      },
      {
        name: "get_trends",
        description:
          "Fetch trend inspiration or palette hints for a given query/vibe.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            source: { type: "string" },
            limit: { type: "number" },
          },
          required: [],
        },
      },
      {
        name: "get_fashion_rules",
        description:
          "Fetch fashion knowledge base rules for styling (general, complexion, body type, wardrobe).",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description:
                "Optional filter (general, complexion, body_type, wardrobe)",
            },
          },
          required: [],
        },
      },
      {
        name: "validate_look",
        description:
          "Validate a proposed look (array of items) against style rules and return the structured validation.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { type: "object" },
            },
            weather: { type: "string" },
          },
          required: ["items"],
        },
      },
    ];

    // Build initial messages: system + user with context
    const moodHints = styleMoodMap[vibe?.toLowerCase()] || [];
    const level2Basics = getLevel2Basics();
    

    // 🔥 Force wardrobe fetch before agent loop
    const wardrobeSample =
      rawWardrobe.length > 0 ? buildSampleFromList(rawWardrobe, 50) : [];

    console.log("👕 wardrobeSample built:", wardrobeSample.length, "items");

    // =============================
    // ✅ NEW: Cohesive outfit engine (candidate + score + LLM rerank)
    // Flip with USE_RERANKER=1
    // =============================
    if (process.env.USE_RERANKER === "1") {
      try {
        const pools = buildSlotPools(wardrobeSample);

        // 1) generate candidates
        const rawCandidates = generateCandidates(pools, 60, { preferNeutralAcc: true });

        // 2) score + sort
        const weatherNow = await getWeather(city);

          const taste = await getTasteWeights(db, uid).catch(() => null);

          const scored = rawCandidates
            .map(items => ({
              items,
              score: scoreLook(
                items,
                { occasion, vibe, weather: weatherNow, likedCombos, dislikedCombos, lastServedCombo },
                taste
              )
            }))
            .sort((a,b) => b.score - a.score);

        const top = scored.slice(0, 12).map(x => x.items);

        // 3) hard avoid disliked fingerprints
        const filteredTop = top.filter(items => {
          const fp = makeComboFingerprint(items);
          return !(dislikedCombos || []).includes(fp);
        });

        const finalPool = filteredTop.length ? filteredTop : top;

        // 4) ask LLM to pick best and write title/style_note (but ONLY using idx)
        const llmJson = await rerankWithLLM({
          candidates: finalPool,
          wardrobePreview: wardrobeSample,
          ctx: { occasion, vibe, weather: await getWeather(city) }
        });

        let parsed = null;
        try { parsed = llmJson ? JSON.parse(llmJson) : null; } catch { parsed = null; }

        // fallback if model returns nonsense
        if (!parsed?.outfits?.[0]?.items?.length) {
          const best = finalPool[0] || [];
          parsed = {
            outfits: [{
              title: "Polished Look",
              style_note: "Pulled-together look with balanced pieces and clean palette.",
              items: best.map(it => ({ idx: String(it.id || it.wardrobe_id || it.idx) }))
            }]
          };
        }

        // hydrate idx references back into full objects (like your frontend expects)
        const idx2item = Object.fromEntries((wardrobeSample || []).map(it => [String(it.idx), it]));
        const hydratedOutfits = (parsed.outfits || []).map(o => ({
          title: o.title || "Outfit",
          style_note: o.style_note || "",
          items: (o.items || []).map(x => idx2item[String(x.idx)]).filter(Boolean),
          validation: { styleRules: validateLevel2({ items: (o.items||[]).map(x => idx2item[String(x.idx)]).filter(Boolean) }) }
        }));

        // mirror looks/outfits like your API already does
        return res.json({
          outfits: hydratedOutfits,
          looks: hydratedOutfits,
          note: "reranker_v1"
        });

      } catch (e) {
        console.error("❌ Reranker path failed, falling back to agent:", e.message);
        // fall through to your existing agent logic below
      }
    }


    const FEWSHOTS = [
      { role: "user", content: JSON.stringify({
          task: "example - casual",
          wardrobe_preview: [{idx:"0"},{idx:"1"},{idx:"2"}]
      })},
      { role: "assistant", content: JSON.stringify({
          outfits: [{
            title: "Casual Street Look",
            style_note: "Neutral tee with denim and clean sneakers for easy balance.",
            items: [{idx:"0"},{idx:"1"},{idx:"2"}]
          }]
      })},

      { role: "user", content: JSON.stringify({
          task: "example - dress",
          wardrobe_preview: [{idx:"3"},{idx:"4"}]
      })},
      { role: "assistant", content: JSON.stringify({
          outfits: [{
            title: "Dinner Dress Look",
            style_note: "Navy dress with nude heels; simple silhouette and soft contrast.",
            items: [{idx:"3"},{idx:"4"}]
          }]
      })},

      { role: "user", content: JSON.stringify({
          task: "example - indian",
          wardrobe_preview: [{idx:"5"},{idx:"6"},{idx:"7"}]
      })},
      { role: "assistant", content: JSON.stringify({
          outfits: [{
            title: "Festive Kurta Set",
            style_note: "Pastel kurta + palazzo + juttis; airy fabrics and cohesive palette.",
            items: [{idx:"5"},{idx:"6"},{idx:"7"}]
          }]
      })},

      { role: "user", content: JSON.stringify({
          task: "example - avoid disliked",
          dislikedCombos: ["top-neutral-upper|bottom-bright-lower|footwear-neutral-footwear"],
          wardrobe_preview: [{idx:"8"},{idx:"9"},{idx:"10"}]
      })},
      { role: "assistant", content: JSON.stringify({
          outfits: [{
            title: "Smart-Casual Alt",
            style_note: "Avoided prior disliked combo; chose warm top, tapered chinos, minimal sneakers.",
            items: [{idx:"8"},{idx:"9"},{idx:"10"}]
          }]
      })}
    ];


    
    // 🪞 Adaptive system prompt
    const systemMsg = {
      role: "system",
      content:
    `You are Tina, a ${tinaLevel}.
    You design outfits using only the items provided in the wardrobe preview (addressable strictly by their "idx" values).

    Your current confidence (derived from learning weights):
    - Color harmony: ${(learning.colorHarmony * 100).toFixed(0)}%
    - Silhouette balance: ${(learning.silhouetteBalance * 100).toFixed(0)}%
    - Trend awareness: ${(learning.trendAwareness * 100).toFixed(0)}%
    - Wardrobe rotation: ${(learning.wardrobeRotation * 100).toFixed(0)}%

    STRICT OUTPUT FORMAT:
    - Respond with **only** valid JSON.
    - Top-level key must be **"outfits"** (no prose, no extra keys).
    - Each outfit: { "title": string, "style_note": string, "items": [{ "idx": string }, ...] }
    - Use **only** "idx" to reference items. Never invent items or fields.

    STYLE CONSTRAINTS:
    1) Use ONLY wardrobe_preview items (by idx).
    2) Prefer 4–6 items. Base structure:
   - Separates: Top + Bottom + Footwear + (Bag OR Outerwear) + optional Accessory
   - One-piece: Dress/Jumpsuit + Footwear + (Bag OR Outerwear) + optional Accessory
   Always include Footwear when possible.
    3) Enforce color harmony & silhouette balance at your level.
    4) STRICTLY avoid any combination fingerprints present in "dislikedCombos".
    5) Consider "feedback_memory" — avoid color, vibe, or category patterns the user disliked recently (from structured feedback). Reinforce what they loved.
    6) If your combination is close to any in "likedCombos", prefer it. Mark that in style_note.
    7) If the user provided an occasion or vibe, align names and notes with that context.
    8) **The title and style_note MUST accurately describe the chosen items. DO NOT mention "dress", "heels", etc. unless those categories are actually present in "items". If they would be ideal but missing, write a neutral description (e.g., "polished look with blazer and trousers").
    9) If micro_feedback (e.g. "swap-top", "change-shoes", "lighter-colors") is present, treat as soft constraints when re-styling.
    10) Use weather info (e.g. “light rain, 24 °C”) to prefer seasonally suitable fabrics or layers.


    FASHION KNOWLEDGE BASE (follow if relevant):
    ${rulesText || "• (No additional rules available)"}

    Return only JSON with the 'outfits' key.`
    };


    const userMsg = {
      role: "user",
      content: JSON.stringify({
        task: "Generate 1 polished outfit",
        uid, occasion, vibe,
        vibe_hints: styleMoodMap[vibe?.toLowerCase()] || [],
        city,
        gender: prefs.gender,
        bodyShape: prefs.bodyShape,
        complexion: prefs.complexion,
        dislikes: prefs.dislikes,
        learning_weights: learning,
        feedback_memory_recent: userFeedback,
    feedback_memory_sets: fbSets ? {
      likedIds:        Array.from(fbSets.likedIds || []),
      dislikedIds:     Array.from(fbSets.dislikedIds || []),
      dislikedColors:  Array.from(fbSets.dislikedColors || []),
      dislikedVibes:   Array.from(fbSets.dislikedVibes || []),
      dislikedOccasions: Array.from(fbSets.dislikedOccasions || []),
    } : null,
    style_summary: styleSummary,
    micro_feedback: microFeedback,
    weather: await getWeather(city),
    likedCombos,
    dislikedCombos,
    last_served_combo: lastServedCombo,
    wardrobe_preview: wardrobeSample,
        instructions: [
          "Return **only** JSON with top-level key 'outfits'. No prose.",
          "Reference items strictly by 'idx'; never invent items.",
          "Each outfit should include 4–6 items. Use separates or a one-piece base, plus footwear, and add bag/outerwear/accessory if available.",
          "Prefer color harmony and silhouette balance.",
          "HARD AVOID any fingerprint in dislikedCombos.",
          "If close to likedCombos, prefer that combo and call it out in style_note.",
          ...(lastServedCombo ? [`Avoid repeating this combo fingerprint: ${lastServedCombo}`] : []),
          "3–5 items per outfit; 1 outfit total."
        ],
      }, null, 2),
    };




    // ✅ Build messages array in correct order
    const messages = [
      systemMsg,
      { role:"function", name:"get_wardrobe", content: JSON.stringify({ items: wardrobeSample, count: wardrobeSample.length }) },
      ...FEWSHOTS,
      userMsg,
    ];



    console.log(
      "👜 Forced wardrobe injected into messages:",
      wardrobeSample.length,
      "items"
    );
    


    


    // 🔍 DEBUG: log what Tina is given as input
    dlog("🪞 Tina agent INPUT snapshot >>>");
    console.log("Occasion:", occasion, "| Vibe:", vibe, "| City:", city);
    console.log("Prefs:", JSON.stringify(prefs, null, 2));
    console.log(
      "Wardrobe snapshot (first 5):",
      await fn_getWardrobe({ uid, max: 5 }),
    );
    console.log("🪞 End Tina agent INPUT <<<");

    // Agent loop: model may ask to call a function; execute and feed result back. Limit iterations.
    let finalAssistantContent = null;
    const maxRounds = 4;
    for (let round = 0; round < maxRounds; round++) {
      console.log(`🧭 Agent loop round ${round + 1}`);

      const openaiResp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            functions,
            function_call: "auto",
            temperature: 0.2,
            max_tokens: 1000,
            response_format: { type: "json_object" }, // ✅ Force JSON-only
          }),
        },
      );

      const data = await openaiResp.json();
      const choice = data.choices?.[0];
      if (!choice) {
        console.warn("No choice from OpenAI");
        break;
      }

      const msg = choice.message;
      // If model asked to call a function
      if (msg?.function_call) {
        const fnName = msg.function_call.name;
        const fnArgsRaw = msg.function_call.arguments || "{}";
        let fnArgs;
        try {
          fnArgs = JSON.parse(fnArgsRaw);
        } catch (e) {
          fnArgs = {};
        }

        console.log(`🛠 Model requested function: ${fnName}`, fnArgs);

        // Execute server-side function
        let fnResult;
        try {
          if (fnName === "get_weather") {
            fnResult = await fn_getWeather(fnArgs);
          } else if (fnName === "get_wardrobe") {
            fnResult = await fn_getWardrobe(fnArgs);
          } else if (fnName === "get_trends") {
            fnResult = await fn_getTrends(fnArgs);
          } else if (fnName === "get_fashion_rules") {
            fnResult = await fn_getFashionRules(fnArgs);
          } else if (fnName === "validate_look") {
            fnResult = await fn_validateLook(fnArgs);
          } else {
            fnResult = { error: `Unknown function: ${fnName}` };
          }
        } catch (err) {
          fnResult = { error: err?.message || String(err) };
        }

        // Append model function call and function result as messages
        messages.push({
          role: "assistant",
          content: null,
          function_call: { name: fnName, arguments: JSON.stringify(fnArgs) },
        });

        messages.push({
          role: "function",
          name: fnName,
          content: JSON.stringify(fnResult),
        });

        // Continue to next iteration so model can reason with function result
        continue;
      }

      // If assistant returned content (not a function call) — treat as final candidate
      if (msg?.content) {
        finalAssistantContent = msg.content;
        console.log("🟢 Assistant returned content. Ending loop.");
        break;
      }

      // Otherwise break to avoid infinite loops
      console.log("No function_call & no content - breaking agent loop");
      break;
    } // end for loop

    console.log("📝 Tina raw assistant content:", finalAssistantContent);

    function normalizeOutfitsKey(obj) {
      if (obj && obj.looks && !obj.outfits) {
        obj.outfits = obj.looks;
        delete obj.looks;
      }
    }

    // Enforce strict shape for AI output: { outfits: [ { title, style_note, items:[{idx}] } ] }
    function sanitizeOutfitsPayload(parsed) {
      // Accept either {outfits:[...]} or an array directly; drop everything else.
      const rawOutfits = Array.isArray(parsed?.outfits)
        ? parsed.outfits
        : (Array.isArray(parsed) ? parsed : []);

      const outfits = rawOutfits.map((o) => {
        const title =
          typeof o?.title === "string" && o.title.trim()
            ? o.title.trim()
            : "Untitled Look";

        const style_note =
          typeof o?.style_note === "string" ? o.style_note.trim() : "";

        // Keep ONLY idx references – drop any invented fields
        const items = Array.isArray(o?.items) ? o.items : [];
        const cleanItems = items
          .map((it) => (it && typeof it.idx === "string" ? { idx: it.idx } : null))
          .filter(Boolean);

        return { title, style_note, items: cleanItems };
      });

      return { outfits };
    }

    // Try to parse the final assistant content as JSON (strict)
    let parsed;
    if (!finalAssistantContent) {
      console.warn("⚠️ No assistant content received. Using fallback.");
      parsed = null;
    } else {
      try {
        parsed = JSON.parse(finalAssistantContent);

        normalizeOutfitsKey(parsed);

        if (parsed && parsed.looks && !parsed.outfits) {
          console.warn("⚠️ Normalizing 'looks' → 'outfits'");
          parsed.outfits = parsed.looks;
          delete parsed.looks;
        }

        // ✅ Enforce clean structure now
        parsed = sanitizeOutfitsPayload(parsed);
        console.log("🧼 Sanitized AI payload (head):", JSON.stringify(parsed).slice(0, 400));

      } catch (err) {
        console.warn("⚠️ Raw content not valid JSON, attempting recovery");
        let recovered = null;

        const jsonMatch = finalAssistantContent && finalAssistantContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            recovered = JSON.parse(jsonMatch[0]);
            normalizeOutfitsKey(recovered);
            recovered = sanitizeOutfitsPayload(recovered);
            console.log("🧼 Sanitized (recovered) AI payload (head):", JSON.stringify(recovered).slice(0, 400));
          } catch (e2) {
            console.error("❌ JSON recovery failed:", e2.message);
            recovered = null;
          }
        }

        if (recovered) {
          parsed = recovered;
        } else {
          dlog("⚠️ Could not parse assistant JSON. Returning weighted fallback.");
          const pool = (wardrobeSample && wardrobeSample.length >= 6)
            ? wardrobeSample
            : buildSampleFromList(rawWardrobe, 10);

          parsed = sanitizeOutfitsPayload({
            outfits: [
              {
                title: "Auto-Fallback 1",
                style_note: "",
                items: pool.slice(0, 3).map((it) => ({ idx: String(it.idx) })),
              },
              {
                title: "Auto-Fallback 2",
                style_note: "",
                items: pool.slice(3, 6).map((it) => ({ idx: String(it.idx) })),
              },
            ],
          });
        }
      }

    

    // Hydrate parsed.outfits items into full item objects using the available wardrobe (prefer filtered rawWardrobe)
    const idx2item = Object.fromEntries(
      (wardrobeSample || []).map((it) => [String(it.idx), it]),
    );


    // 👗 Combo validation (soft block disliked)
    function getCombo(items = []) {
      return makeComboFingerprint(items);
    }

    parsed.outfits = await Promise.all((parsed.outfits || []).map(async (look, i) => {
      // 🛑 If Tina gave no items
      if (!look.items || look.items.length === 0) {
        if (!STRICT_ITEMS) {
          console.warn(`⚠️ Look ${i + 1} had no items, applying fallback.`);
          const fallbackItems = buildSampleFromList(rawWardrobe, 3);
          look.items = fallbackItems.map((it) => ({ idx: it.idx }));
          look.style_note = look.style_note || "";
        } else {
          // keep as-is in strict mode (empty look allowed)
          look.items = [];
        }
      }


      let hydrated = (look.items || [])
        .map((it) => {
          // Primary: check if idx exists in idx2item
          if (it.idx && idx2item[it.idx]) {
            return { ...idx2item[it.idx] };
          }

          // 🔄 fallback: try to match by name if Tina mistakenly outputs names
          if (it.name) {
            const match = rawWardrobe.find(
              (r) => (r.name || "").toLowerCase() === it.name.toLowerCase(),
            );
            if (match) return { ...match };
          }

          // 🔄 fallback: try to match by id
          if (it.id) {
            const match = rawWardrobe.find((r) => r.id === it.id);
            if (match) return { ...match };
          }

          // 🚫 Drop hallucinated items that can't be matched
          console.warn("❌ Dropping hallucinated item:", it);
          return null;
        })
        .filter(Boolean);

      // 🚫 STRICT: stop here — return exactly what Tina picked (hydrated) without any mutations
      if (STRICT_ITEMS) {
        return {
          title: look.title || `Untitled Look ${i + 1}`,
          style_note: look.style_note || "",
          items: hydrated,
          validation: {} // keep shape, no blocking
        };
      }


      // 🔍 Debug logs
      console.log(`🔍 Hydrated look #${i + 1}:`, hydrated);

      // 🛡️ Enforce completeness BEFORE validation
      const pool = buildSampleFromList(rawWardrobe, 80);
      if (!STRICT_ITEMS) {
        hydrated = forceCompleteLook(hydrated, pool, { gender: prefs.gender, occasion });
      }


      // If it’s a one-piece path, keep only relevant categories and DO NOT re-force to separates.
      const catsLower = hydrated.map(h => (h.category || "").toLowerCase());
      if (!STRICT_ITEMS) {
        if (catsLower.some(c => /dress|jumpsuit|saree/.test(c))) {
          hydrated = hydrated.filter(it =>
            /dress|jumpsuit|saree|footwear|outer|jacket|coat|dupatta|shawl|stole|accessor/.test((it.category || "").toLowerCase())
          );
        }
      }



      // ✅ Combo preference memory check
      const combo = makeComboFingerprint(hydrated);

      // 🛑 If Tina repeats a disliked combo (mutations only when not strict)
      if (!STRICT_ITEMS && dislikedCombos.includes(combo)) {
        console.warn("⚠️ This combo matches a previously disliked look.");
        if (!PRESERVE_STYLE_TEXT) {
          look.style_note = (look.style_note || "") + " ⚠️ Similar to a previously disliked combination.";
        }
      }

      // 💖 If Tina repeats a liked combo → boost note (note only when not preserving text)
      // (keeping as-is is fine; but avoid altering items in strict mode)
      if (!STRICT_ITEMS && likedCombos.includes(combo)) {
        console.log("❤️ This combo matches a previously liked look!");
        if (!PRESERVE_STYLE_TEXT) {
          look.style_note = (look.style_note || "") + " ❤️ Based on your favorites!";
        }
      }


      // --- Reconcile title/style_note with actual items ---
      // Keep Tina's title & style_note as-is. Compute cats for validation only.
      const cats = (hydrated || []).map(h =>
        (h.category || "").toLowerCase()
      );
      const has = (re) => cats.some(c => re.test(c));
      // DO NOT modify look.title or look.style_note here.


      // 🔥 Level 2 validation
      // Level 2 validation (color + silhouette checks)
      let validationRules = validateLevel2({ items: hydrated });

      // 🧠 log a positive learning step when validation passes
      await updateLearning(uid, { valid: !!validationRules?.valid }, !!validationRules?.valid);


      // Level 2: Color Harmony
      const palettes = hydrated
        .map((it) => (it.palette || "").toLowerCase())
        .filter(Boolean);
      const uniquePalettes = [...new Set(palettes)];
      const neutralColors = [
        "black",
        "white",
        "grey",
        "beige",
        "denim",
        "navy",
      ];
      const filteredPalettes = uniquePalettes.filter(
        (p) => !neutralColors.includes(p),
      );
      
      // Level 2: Silhouette Balance
      const uppers = hydrated.filter((it) => it.silhouette === "upper");
      const lowers = hydrated.filter((it) => it.silhouette === "lower");
      if (uppers.length && lowers.length) {
        const bothFitted =
          uppers.every((it) => /fitted/.test(it.silhouette || "")) &&
          lowers.every((it) => /fitted/.test(it.silhouette || ""));
        const bothLoose =
          uppers.every((it) => /loose|oversize/.test(it.silhouette || "")) &&
          lowers.every((it) => /loose|oversize/.test(it.silhouette || ""));
        if (bothFitted || bothLoose) {
          // ❗ Don’t fail – just warn
          validationRules.errors.push(
            "Silhouette imbalance: try mixing fitted with loose for harmony.",
          );
        }
      }

      console.log(`🧪 Validation for look #${i + 1}:`, validationRules);

      // 🔥 New beginner stylist rule
      // 🔥 Basic completeness check (keep separate from imported validateLevel1)
      function basicCompletenessCheck(look) {
        const cats = look.items.map((it) => (it.category || "").toLowerCase());

        // Path A: Top + Bottom + Footwear
        const hasTop = cats.some(c => /top|shirt|tee|t-?shirt|blouse|kurta/.test(c));
        const hasBottom = cats.some(c => /bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/.test(c));
        const hasFootwear = cats.some(c => /footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(c));
        const hasOnePiece = cats.some(c => /dress|jumpsuit|saree/.test(c));
        
        const onlyAccessories = cats.every(c => /accessor|sunglass|watch|bag|belt|scarf|dupatta|stole|shawl/.test(c));
        
      const pathA = hasTop && hasBottom && hasFootwear;
       const pathB = hasOnePiece && hasFootwear;
        return !onlyAccessories && (pathA || pathB);
         }


      if (!STRICT_ITEMS) {
        if (!basicCompletenessCheck({ items: hydrated })) {
          const cats = hydrated.map(h => (h.category || "").toLowerCase());
          const isOnePiecePath = cats.some(c => /dress|jumpsuit|saree/.test(c));
          
          if (!isOnePiecePath) {
            hydrated = forceCompleteLook(hydrated, pool, { gender: prefs.gender, occasion });
          }
        }
      }


      console.log(`🧪 Validation for look #${i + 1}:`, { validationRules });

      // 🔁 One-shot self-heal if invalid (skip in STRICT mode)
      let reasons = [...(validationRules?.errors || [])];
      const isInvalid = !validationRules?.valid || reasons.length;

      if (!STRICT_ITEMS && isInvalid) {
        console.log("⚠️ Look validation failed - self-healing disabled in this mode");
        // Self-healing can be added here if needed
      }


      const changedCategories = (() => {
        const before = (look.items || []).map(it => (it.category || "").toLowerCase()).sort().join(",");
        const after  = hydrated.map(it => (it.category || "").toLowerCase()).sort().join(",");
        return before !== after;
      })();

      let finalNote = look.style_note || "";
      // keep Tina's note verbatim; no auto-append text

      
      return {
        title: look.title || `Untitled Look ${i + 1}`,
        style_note: finalNote,
        items: hydrated,
        validation: { styleRules: validationRules },
      };

    }));
  

    // Final filter: keep looks, even if invalid — just warn
    parsed.outfits = parsed.outfits.map((l) => {
      if (!l.validation?.styleRules?.valid) {
        const errs = (l.validation?.styleRules?.errors || []).join("; ");
        console.warn("❌ Look failed validation, asking Tina to retry:", errs);

        messages.push({
          role: "function",
          name: "validate_look",
          content: JSON.stringify(l.validation),
        });

        messages.push({
          role: "user",
          content: `Your last outfit failed validation: ${errs}. Please fix and retry with a new outfit using only wardrobe items.`,
        });
      }

      return l;
    });

// Always allow looks to pass even if missing perfect balance
parsed.outfits = (parsed.outfits || []).map((look) => {
  if (!look.items || look.items.length < 1) {
    if (!STRICT_ITEMS) {
      look.items = buildSampleFromList(rawWardrobe, 3);
      if (!PRESERVE_STYLE_TEXT) {
        look.style_note += " | ⚠️ Auto-filled due to missing items.";
      }
    } else {
      look.items = look.items || [];
      look.style_note = look.style_note || "";
    }
  }
  return look;
});


    // If none survived, fallback to simple combinations
    if (!parsed.outfits || parsed.outfits.length === 0) {
      console.warn(
        "⚠️ No valid looks after validation — building fallback looks",
      );
      const fallbackItems = buildSampleFromList(rawWardrobe, 10);
      parsed.outfits = [
        {
          title: "Fallback Look 1",
          style_note: "Auto fallback",
          items: fallbackItems.slice(0, 3),
        },
        {
          title: "Fallback Look 2",
          style_note: "Auto fallback",
          items: fallbackItems.slice(3, 6),
        },
      ];
      parsed.note = parsed.note
        ? parsed.note + " | All looks failed validation. Fallback used."
        : "All looks failed validation. Fallback used.";
    }

    console.log("🎨 Final parsed looks:", JSON.stringify(parsed, null, 2));

    // 🔮 Optionally prefix occasion in the TITLE only; do NOT touch style_note
    if (occasion) {
      parsed.outfits = (parsed.outfits || []).map((look) => {
        const lowerOccasion = occasion.toLowerCase();
        if (!look.title?.toLowerCase().includes(lowerOccasion)) {
          look.title = `${occasion} Look – ${look.title || "Untitled Look"}`;
        }
        if (!PRESERVE_STYLE_TEXT) {
          if (!look.style_note?.toLowerCase().includes(lowerOccasion)) {
            look.style_note = `${look.style_note || ""} Styled for ${occasion}.`.trim();
          }
        }
        return look;
      });
    }

    // ✅ Normalize Tina output so frontend always gets { outfits: [...] }
    if (Array.isArray(parsed)) {
      parsed = { outfits: parsed };
    }

    if (parsed && parsed.looks && !parsed.outfits) {
      console.warn("⚠️ Normalizing 'looks' → 'outfits'");
      parsed.outfits = parsed.looks;
      delete parsed.looks;
    }

      if (!parsed.outfits && parsed.looks) {
        parsed.outfits = parsed.looks;
      }
      if (!parsed.outfits) {
        console.warn("⚠️ Tina returned no outfits, forcing empty array");
        parsed.outfits = [];
        parsed.note = parsed.note || "No outfits parsed";
      }
      parsed.outfits = (parsed.outfits || []).map((look, i) => {

  if (!look.items || look.items.length === 0) {
    if (!STRICT_ITEMS) {
      console.warn(`⚠️ Look ${i + 1} had no items. Adding fallback.`);
      look.items = buildSampleFromList(rawWardrobe, 3);
      if (!PRESERVE_STYLE_TEXT) {
        look.style_note = (look.style_note || "") + " | Auto-filled.";
      }
    } else {
      look.items = look.items || [];
      look.style_note = look.style_note || "";
    }
  }
  return look;
});

    // ✅ Final normalization: return BOTH shapes to keep old UIs working
    const looksArr = Array.isArray(parsed?.looks)
      ? parsed.looks
      : (Array.isArray(parsed?.outfits) ? parsed.outfits : []);

    const response = {
      ...parsed,
      looks: looksArr,
      outfits: looksArr,            // mirror for older UIs
      note: parsed?.note || undefined
    };

    console.log("🎯 Sending outfits:", (response.outfits || []).map(o => o.items?.length));
    return res.json(response);

  }  // Close the try block
  } catch (err) {
    console.error("❌ /suggest-outfit (agent) error:", err);
    return res
      .status(500)
      .json({
        error: "Tina agent failed",
        message: err?.message || String(err),
      });
  }
});
// ───────────────────────────────────────────────────────────────────────────

// ✅ Toggle wardrobe favorite
app.post("/toggle-favorite", async (req, res) => {
  const { uid, itemId, isFavorite } = req.body;
  if (!uid || !itemId) {
    return res.status(400).json({ error: "uid and itemId are required" });
  }

  try {
    await db.collection("wardrobe").doc(itemId).update({
      isFavorite: !!isFavorite,
      updated_at: new Date().toISOString(),
    });
    res.json({ message: "Favorite updated" });
  } catch (err) {
    console.error("❌ toggle-favorite failed:", err.message);
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

// ✅ Mark wardrobe item as worn
app.post("/mark-worn", async (req, res) => {
  const { uid, itemId, lastWorn } = req.body;
  if (!uid || !itemId || !lastWorn) {
    return res
      .status(400)
      .json({ error: "uid, itemId, lastWorn are required" });
  }

  try {
    await db.collection("wardrobe").doc(itemId).update({
      lastWorn,
      updated_at: new Date().toISOString(),
    });
    res.json({ message: "Item marked as worn" });
  } catch (err) {
    console.error("❌ mark-worn failed:", err.message);
    res.status(500).json({ error: "Failed to mark item as worn" });
  }
});

// ✅ Structured Feedback endpoints (❤️ + ❌)
app.post("/feedback", limiterWrites, async (req, res) => {
  try {
    const {
      uid,
      event_type,          // "like" | "dislike"
      outfit,              // { items: [...] }  ← REQUIRED
      vibe = "",
      occasion = "",
      city = "",
      weather = "",
      reason = "",
    } = req.body || {};

    if (!uid || !event_type || !outfit?.items?.length) {
      return res.status(400).json({
        error: "uid, event_type, and outfit.items[] are required",
      });
    }

    const liked =
      event_type === "like" ? true :
      event_type === "dislike" ? false :
      null;

    if (liked === null) {
      return res.status(400).json({ error: "event_type must be like or dislike" });
    }

    // Build combo fingerprint (VERY important for ranking memory)
    const combo = makeComboFingerprint(outfit.items);

    const feedbackEvent = {
      uid,
      event_type,
      liked,
      combo,

      // 👇 THIS is the canonical payload Phase B needs
      outfit: {
        items: outfit.items.map(it => ({
          id: it.id || it.idx || null,
          category: it.category || "",
          color: it.color || "",
          tags: it.tags || [],
          name: it.name || "",
        })),
      },

      ctx: {
        vibe,
        occasion,
        city,
        weather,
      },

      reason,
      created_at: new Date().toISOString(),
      version: 1,
    };

    await db.collection("feedback_events").add(feedbackEvent);

    res.json({ ok: true, message: "Feedback recorded" });
  } catch (err) {
    console.error("❌ feedback failed:", err);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// ✅ Dislike outfit (save reason for learning Tina’s preferences)
app.post("/dislike-outfit", async (req, res) => {
  const { uid, outfit, reason = "Not my style" } = req.body;

  if (!uid || !outfit) {
    return res.status(400).json({ error: "uid & outfit required" });
  }

  try {
    const combo = makeComboFingerprint(outfit.items || []);

    await db.collection("disliked_looks").add({
      uid,
      outfit,
      combo,   // ✅ store fingerprint
      reason,
      disliked_at: new Date().toISOString(),
    });

    // 🪄 Micro-feedback capture
    if (reason) {
      const microHints = [];
      const lower = reason.toLowerCase();
      if (/swap|change|replace.*top/.test(lower)) microHints.push("swap-top");
      if (/shoe|footwear/.test(lower)) microHints.push("change-shoes");
      if (/light|brighter/.test(lower)) microHints.push("lighter-colors");

      if (microHints.length) {
        await db.collection("tina_memory").doc(uid).set(
          { micro_feedback: microHints, updated_at: new Date().toISOString() },
          { merge: true }
        );
        console.log("🧩 Stored micro-feedback:", microHints);
      }
    }


    // 🧠 reinforce negative learning on explicit dislike
    await updateLearning(uid, { valid: false }, false);

    res.json({ message: "Look disliked!", combo });

  } catch (e) {
    console.error("❌ dislike-outfit failed:", e.message);
    res.status(500).json({ error: "Could not save dislike" });
  }
});


// ✅ Save outfit plan for a date
// ✅ Save outfit plan for a date (returns saved payload)
app.post("/plan-outfit", async (req, res) => {
  const { uid, date, outfit } = req.body || {};
  if (!uid || !date || !outfit) {
    return res.status(400).json({ success: false, error: "uid, date, and outfit are required" });
  }

  try {
    const docId = `${uid}_${date}`;
    const planRef = db.collection("outfit_plans").doc(docId);

    const payload = { uid, date, outfit, updated_at: new Date().toISOString() };
    await planRef.set(payload, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Outfit plan saved successfully",
      ...payload
    });
  } catch (err) {
    console.error("❌ Failed to save outfit plan:", err.message);
    return res.status(500).json({ success: false, error: "Failed to save outfit plan" });
  }
});


// ✅ Save onboarding preferences
app.post("/onboarding", async (req, res) => {
  const {
    uid,
    gender = "",
    bodyShape = "",
    complexion = "",
    dislikes = [],
  } = req.body;

  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    await db
      .collection("tina_memory")
      .doc(uid)
      .set(
        {
          gender,
          bodyShape,
          complexion,
          dislikes,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      );

    res.status(200).json({ message: "Preferences saved successfully" });
  } catch (err) {
    console.error("❌ Failed to save onboarding:", err.message);
    res.status(500).json({ error: "Failed to save onboarding preferences" });
  }
});

// ✅ Fetch onboarding preferences
app.get("/onboarding", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    const doc = await db.collection("tina_memory").doc(uid).get();
    if (doc.exists) return res.status(200).json(doc.data());
    res.status(404).json({ error: "No preferences found for this user" });
  } catch (err) {
    console.error("❌ Failed to fetch onboarding:", err.message);
    res.status(500).json({ error: "Failed to fetch onboarding preferences" });
  }
});

// ✅ Build Tina’s Style DNA
app.post("/build-style-dna", async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    // 1) wardrobe
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    const wardrobe = snap.docs.map((d) => d.data());
    const wardrobeList = wardrobe
      .map((it) => `${it.name || "Unnamed"} (${it.category || "unknown"})`)
      .join(", ");

    // 2) preferences
    const memDoc = await db.collection("tina_memory").doc(uid).get();
    const preferences = memDoc.exists ? memDoc.data() : {};

    // 3) prompt
    const prompt = `
Analyze this user’s style based on their wardrobe and preferences.
Summarize it in one punchy sentence (no extra words).
Wardrobe: ${wardrobeList}
Preferences: ${JSON.stringify(preferences)}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a fashion stylist AI." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    const json = await response.json();
    const dna =
      json.choices?.[0]?.message?.content?.trim() || "Modern casual chic";

    await db
      .collection("tina_memory")
      .doc(uid)
      .set({ style_dna: dna }, { merge: true });

    res.status(200).json({ style_dna: dna });
  } catch (err) {
    console.error("❌ Failed to build style DNA:", err.message);
    res.status(500).json({ error: "Failed to build style DNA" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;

// ✅ Debug: verify important routes exist on deployed build
app.get("/routes", (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((m) => {
      if (m.route && m.route.path) {
        const methods = Object.keys(m.route.methods || {}).filter(Boolean);
        routes.push({ path: m.route.path, methods });
      }
    });
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: "Could not list routes" });
  }
});


// GET /trends?limit=8&query=cocktail
app.get("/trends", async (req, res) => {
  const limit = Number(req.query.limit || 8);
  const q = String(req.query.query || "general").toLowerCase();

  try {
    const snap = await db
      .collection("trends")
      .orderBy("updated_at", "desc")
      .limit(50)
      .get();

    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const filtered = all.filter(t => {
      const k = String(t.keyword || "").toLowerCase();
      const vibes = Array.isArray(t.vibes) ? t.vibes.map(v => String(v).toLowerCase()) : [];
      const occs  = Array.isArray(t.occasion) ? t.occasion.map(o => String(o).toLowerCase()) : [];
      return (
        q === "general" ||
        k.includes(q) ||
        vibes.some(v => v.includes(q)) ||
        occs.some(o => o.includes(q))
      );
    });

    const ranked = (filtered.length ? filtered : all)
      .sort((a, b) => (Number(b.score ?? 0.5) - Number(a.score ?? 0.5)))
      .slice(0, limit);

    res.json({ success: true, count: ranked.length, trends: ranked });
  } catch (e) {
    console.error("❌ /trends failed:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});





// ——— AUTO TREND REFRESH ENDPOINT ———
app.get("/run-trends", async (req, res) => {
  const key = req.query.key;
  if (key !== process.env.CRON_SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    await updateTrends();
    res.json({ success: true, message: "Trends updated successfully" });
  } catch (e) {
    console.error("Trend update error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ✅ Debug route: fetch Tina's combo stats for a user
app.get("/debug-combo-stats", async (req, res) => {
  const { uid } = req.query;
  if (!uid) {
    return res.status(400).json({ error: "uid is required" });
  }

  try {
    const doc = await db.collection("tina_memory").doc(uid).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "No memory found for this user" });
    }

    const data = doc.data();
    res.json({ uid, combo_stats: data.combo_stats || {} });
  } catch (err) {
    console.error("❌ Failed to fetch combo stats:", err.message);
    res.status(500).json({ error: "Failed to fetch combo stats" });
  }
});
app.get("/version", (req, res) => {
  res.json({
    build: "PLANOUTFIT_FIX_v1",
    entry: "index.js",
    time: new Date().toISOString()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
