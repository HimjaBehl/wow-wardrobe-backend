  // ── Global Error Handlers (Prevent Crash Loops) ──
  process.on("uncaughtException", (err) => {
    console.error("❌ UNCAUGHT EXCEPTION:", err);
    console.error("Stack:", err.stack);
    // Don't exit - keep server running
  });
  
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ UNHANDLED REJECTION at:", promise);
    console.error("Reason:", reason);
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
          if (
            /(uid|user_?id|email|token|apikey|api_key|authorization|auth|bearer)/i.test(
              key,
            )
          ) {
            o[k] = "[redacted]";
            continue;
          }
          if (
            /(image_?url|signedurl|signed_url|downloadurl|displayurl|display_url)/i.test(
              key,
            )
          ) {
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
      case "Top":
        return "Clothing/Clothing/Upper";
      case "Bottom":
        return "Clothing/Clothing/Pants";
      case "Dress":
        return "Clothing/Clothing/Dresses";
      case "Outerwear":
        return "Clothing/Clothing/Jackets and Coats";
      case "Footwear":
        return "Footwear/Footwear";
      case "Accessory":
        return "Accessories/Accessories";
      default:
        return "Misc/Misc";
    }
  }
  
  import { mapToCoreCategory } from "./lib/categoryMap.js";
  import { hasCoreCategories } from "./lib/validateCategories.js";
  
  import { buildFeedbackMemory } from "./lib/feedbackMemory.js";
  
  import { validateLook } from "./lib/fashionBrain.js";
  import express from "express";
  import cors from "cors";
  
  const app = express();
  
  app.use(
    cors({
      origin: [
        "https://wow-wardrobe-ui-himjabehl.replit.app",
        "http://localhost:5173",
        "http://localhost:3000",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  
  app.options("{*path}", cors());
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
    windowMs: 60 * 1000, // 1 minute
    max: 12, // 12 requests/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitResponse,
  });
  
  const limiterAutoTag = rateLimit({
    windowMs: 60 * 1000,
    max: 8, // 8 requests/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitResponse,
  });
  
  const limiterSearchProduct = rateLimit({
    windowMs: 60 * 1000,
    max: 20, // example: 20 searches/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitResponse,
  });
  
  const limiterWrites = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // 60 writes/min per IP
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
  
  import { validateLookAgainstRules, validateLevel2 } from "./lib/styleRules.js";
  
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
  
      // ✅ Crop the image using Sharp (fixed)
      let left, top, cropW, cropH;
  
      if ("x" in boundingBox) {
        ({ x: left, y: top, width: cropW, height: cropH } = boundingBox);
      } else if ("xmin" in boundingBox) {
        left = boundingBox.xmin;
        top = boundingBox.ymin;
        cropW = boundingBox.xmax - boundingBox.xmin;
        cropH = boundingBox.ymax - boundingBox.ymin;
      } else {
        throw new Error("Unknown boundingBox format");
      }
  
      // ✅ Clamp crop region to image bounds (prevents Sharp extract errors)
      const meta = await sharp(imageBuffer).metadata();
      const imgW = meta.width || 0;
      const imgH = meta.height || 0;
  
      left = Math.max(0, Math.min(Math.round(left), Math.max(0, imgW - 1)));
      top = Math.max(0, Math.min(Math.round(top), Math.max(0, imgH - 1)));
  
      cropW = Math.max(1, Math.min(Math.round(cropW), imgW - left));
      cropH = Math.max(1, Math.min(Math.round(cropH), imgH - top));
  
      const croppedBuffer = await sharp(imageBuffer)
        .extract({ left, top, width: cropW, height: cropH })
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
      .map(
        (it) =>
          `${safeLower(it.category)}-${safeLower(it.palette)}-${safeLower(it.silhouette)}`,
      )
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
      snap.docs.forEach((d) =>
        out.push({ src: "feedback_events", id: d.id, ...d.data() }),
      );
    } catch (e) {
      console.warn(
        "loadAllFeedbackEvents: feedback_events read failed:",
        e?.message || e,
      );
    }
  
    // Legacy (keep for back-compat)
    try {
      const liked = await db.collection("liked_looks").get();
      liked.docs.forEach((d) =>
        out.push({ src: "liked_looks", id: d.id, liked: true, ...d.data() }),
      );
    } catch {}
  
    try {
      const disliked = await db.collection("disliked_looks").get();
      disliked.docs.forEach((d) =>
        out.push({ src: "disliked_looks", id: d.id, liked: false, ...d.data() }),
      );
    } catch {}
  
    // Optional legacy collection name some earlier versions used:
    try {
      const legacy = await db.collection("feedback").get();
      legacy.docs.forEach((d) =>
        out.push({ src: "feedback", id: d.id, ...d.data() }),
      );
    } catch {}
  
    return out;
  }
  
  function normalizeFeedbackToLook(ev) {
    const uid = ev?.uid || ev?.user_id || ev?.userId;
    if (!uid) return null;
  
    const liked =
      ev?.liked === true
        ? true
        : ev?.liked === false
          ? false
          : ev?.event_type === "like"
            ? true
            : ev?.event_type === "dislike"
              ? false
              : null;
  
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
    const pools = {
      top: [],
      bottom: [],
      dress: [],
      footwear: [],
      bag: [],
      outer: [],
      accessory: [],
      misc: [],
    };
    for (const it of wardrobe) {
      const s = getSlot(it);
      if (pools[s]) pools[s].push(it);
      else pools.misc.push(it);
    }
  
    // accessories bucket (wider)
    pools.accessory = wardrobe.filter((i) =>
      /accessor|watch|sunglass|scarf|dupatta|stole|shawl|belt|jewel|bag/i.test(
        (i.category || "") + " " + (i.name || ""),
      ),
    );
  
    // outer bucket (wider)
    pools.outer = wardrobe.filter((i) =>
      /outer|jacket|coat|blazer|cardigan|shrug/i.test(
        (i.category || "") + " " + (i.name || ""),
      ),
    );
  
    // bag bucket (wider)
    pools.bag = wardrobe.filter((i) =>
      /bag|handbag|tote|purse/i.test((i.category || "") + " " + (i.name || "")),
    );
  
    return pools;
  }
  
  // pick helper (neutral bias optional)
  function pickFrom(pool = [], preferNeutral = false) {
    if (!pool.length) return null;
    if (preferNeutral) {
      const neutrals = pool.filter((p) => isNeutralColor(p.color));
      if (neutrals.length)
        return neutrals[Math.floor(Math.random() * neutrals.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  // generate many plausible looks, then score deterministically
  function generateCandidates(pools, n = 40, opts = {}) {
    const { preferNeutralAcc = true } = opts;
    const looks = [];
  
    for (let i = 0; i < n; i++) {
      // choose base path: one-piece or separates (weighted)
      const useOnePiece = pools.onepiece.length > 0 && Math.random() < 0.35;
  
      let items = [];
  
      if (useOnePiece) {
        const dress = pickFrom(pools.onepiece, false);
        const shoes =
          pickFrom(pools.footwear, true) || pickFrom(pools.footwear, false);
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
        const bottom =
          pickFrom(pools.bottom, true) || pickFrom(pools.bottom, false);
        const shoes =
          pickFrom(pools.footwear, true) || pickFrom(pools.footwear, false);
  
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
      items = items.filter((it) => {
        const id = it.id || it.wardrobe_id || it.idx;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  
      looks.push(items);
    }
  
    return looks;
  }
  
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }
  
  function getItemTasteScore(it, userW, globalW) {
    const cat = safeLower(it.category || "");
    const col = safeLower(
      Array.isArray(it.color) ? it.color[0] || "" : it.color || "",
    );
    const tags = Array.isArray(it.tags) ? it.tags.map(safeLower) : [];
  
    // prefer user weights; fallback to global
    const wCat = userW?.category?.[cat] ?? globalW?.category?.[cat] ?? 0;
    const wCol = userW?.color?.[col] ?? globalW?.color?.[col] ?? 0;
  
    let wTags = 0;
    for (const t of tags.slice(0, 8)) {
      wTags += userW?.tag?.[t] ?? globalW?.tag?.[t] ?? 0;
    }
  
    // tags can dominate—dampen
    wTags = clamp(wTags, -1.2, 1.2);
  
    // weighted sum
    return 0.55 * wCat + 0.3 * wCol + 0.15 * wTags;
  }
  
  function scoreLook(items = [], ctx = {}, taste = null) {
    const userW = taste?.userW || { category: {}, color: {}, tag: {} };
    const globalW = taste?.globalW || { category: {}, color: {}, tag: {} };
    const gender = (ctx.gender || "").toLowerCase(); // "male" | "female" | ""
  
    const occasion = (ctx.occasion || "").toLowerCase();
  
    const anchorItem = ctx.anchorItem || null;
    const anchorRequired = !!ctx.anchorItem;
  
    const detectSlotSafe = (it) =>
      typeof detectSlotFromItem === "function" ? detectSlotFromItem(it) : "misc";
  
    const anchorSlot = anchorItem ? detectSlotSafe(anchorItem) : null;
    // 1) completeness (hard-ish)
    const cats = items.map((i) => (i.category || "").toLowerCase()).join(" | ");
    const hasTop = /top|shirt|tee|t-?shirt|blouse|kurta/.test(cats);
    const hasBottom =
      /bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/.test(cats);
    const hasFootwear = /footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(cats);
    const hasOnePiece = /dress|jumpsuit|saree/.test(cats);
  
    let score = 0;
  
    // =========================
    // Anchor-aware scoring
    // =========================
    if (anchorRequired && anchorItem) {
      const anchorId = String(
        anchorItem.id || anchorItem.wardrobe_id || anchorItem.idx || ""
      );
  
      const includesAnchor = items.some((it) => {
        const id = String(it.id || it.wardrobe_id || it.idx || "");
        return id === anchorId;
      });
  
      if (includesAnchor) score += 6;
      else score -= 20;
  
      const nonAnchorItems = items.filter((it) => {
        const id = String(it.id || it.wardrobe_id || it.idx || "");
        return id !== anchorId;
      });
  
      const nonAnchorSlots = nonAnchorItems.map((it) => detectSlotSafe(it));
  
      if (anchorSlot === "top" && nonAnchorSlots.includes("top")) score -= 12;
      if (anchorSlot === "bottom" && nonAnchorSlots.includes("bottom")) score -= 12;
      if (anchorSlot === "footwear" && nonAnchorSlots.includes("footwear")) score -= 12;
      if (anchorSlot === "outer" && nonAnchorSlots.includes("outer")) score -= 10;
      if (anchorSlot === "bag" && nonAnchorSlots.includes("bag")) score -= 8;
  
      if (anchorSlot === "onepiece") {
        if (nonAnchorSlots.includes("onepiece")) score -= 15;
        if (nonAnchorSlots.includes("top")) score -= 15;
        if (nonAnchorSlots.includes("bottom")) score -= 15;
        if (nonAnchorSlots.includes("footwear")) score += 2;
        if (
          nonAnchorSlots.includes("bag") ||
          nonAnchorSlots.includes("accessory") ||
          nonAnchorSlots.includes("outer")
        ) {
          score += 2;
        }
      }
  
      if (anchorSlot === "top") {
        if (nonAnchorSlots.includes("bottom")) score += 3;
        if (nonAnchorSlots.includes("footwear")) score += 2;
      }
  
      if (anchorSlot === "bottom") {
        if (nonAnchorSlots.includes("top")) score += 3;
        if (nonAnchorSlots.includes("footwear")) score += 2;
      }
  
      if (anchorSlot === "footwear") {
        if (nonAnchorSlots.includes("top")) score += 2;
        if (nonAnchorSlots.includes("bottom") || nonAnchorSlots.includes("onepiece")) score += 3;
      }
  
      if (anchorSlot === "outer") {
        if (nonAnchorSlots.includes("top") || nonAnchorSlots.includes("onepiece")) score += 2;
        if (nonAnchorSlots.includes("footwear")) score += 1.5;
      }
  
      if (anchorSlot === "bag" || anchorSlot === "accessory") {
        if (
          nonAnchorSlots.includes("top") ||
          nonAnchorSlots.includes("bottom") ||
          nonAnchorSlots.includes("onepiece")
        ) {
          score += 2;
        }
      }
    }
    if ((hasTop && hasBottom && hasFootwear) || (hasOnePiece && hasFootwear))
      score += 3;
    else score -= 4; // missing base
  
    // 2) palette cohesion (keep to 1–2 non-neutral palettes)
    const palettes = items
      .map((i) => (i.palette || pickPalette(i.color || "") || "").toLowerCase())
      .filter(Boolean);
    const uniq = Array.from(new Set(palettes));
    const nonNeutral = uniq.filter(
      (p) =>
        ![
          "black",
          "white",
          "grey",
          "gray",
          "beige",
          "cream",
          "navy",
          "denim",
          "tan",
          "brown",
          "off-white",
        ].includes(p),
    );
    if (nonNeutral.length <= 1) score += 2;
    else if (nonNeutral.length === 2) score += 1;
    else score -= 2;
  
    // 3) occasion sanity (simple penalties/bonuses)
    const nameblob = items
      .map((i) => ((i.name || "") + " " + (i.category || "")).toLowerCase())
      .join(" ");
    const isTee = /tee|t-?shirt/.test(nameblob);
    const isSandal = /sandal|flip/.test(nameblob);
    const isShirt = /shirt|blouse/.test(nameblob);
    const isBlazer = /blazer|suit|jacket/.test(nameblob);
    const isTrouser = /trouser|pants|chinos|slacks/.test(nameblob);
    const isClosedToe = /loafer|oxford|derby|heel|pump|boot|sneaker/.test(
      nameblob,
    );
  
    if (/(workwear|formal|interview)/.test(occasion)) {
      if (isShirt) score += 1;
      if (isBlazer) score += 1;
      if (isTrouser) score += 0.5;
      if (isClosedToe) score += 0.5;
      if (isTee) score -= 2;
      if (isSandal) score -= 1.5;
    }
  
    // 4) neutral accessory preference: if base has color pop, keep bag neutral
    const base = items.filter((i) => {
      const slot = detectSlotSafe(i);
      return ["top", "bottom", "onepiece"].includes(slot);
    });
    const accs = items.filter((i) => {
      const slot = detectSlotSafe(i);
      return ["bag", "accessory"].includes(slot);
    });
    const baseHasPop = base.some((i) => !isNeutralColor(i.color));
    const accAllNeutral = accs.length
      ? accs.every((i) => isNeutralColor(i.color))
      : true;
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
    const isWarm = tempC !== null && tempC >= 24;
    const isHot = tempC !== null && tempC >= 30;
    
    const hasOuterwear = /blazer|jacket|coat|cardigan|shrug/.test(nameblob);
    const hasShortBottom = /skirt|short|skort/.test(nameblob);
    const hasLightTop = /tank|sleeveless|tube|strapless|crop/.test(nameblob);
  
    // 1) Weather penalties (if chilly)
    if (isChilly) {
      if (hasShortBottom) score -= 3.0;
      if (hasLightTop) score -= 2.0;
      if (!hasOuterwear) score -= 2.5;
    }
  
    if (isWarm) {
      if (/sweater|hoodie|cardigan|pullover|jumper|knitwear/.test(nameblob)) {
        score -= 10;
      }
      if (/coat|jacket|blazer|trench|parka/.test(nameblob)) {
        score -= 7;
      }
    }
  
    if (isHot) {
      if (/sweater|hoodie|cardigan|pullover|jumper|knitwear/.test(nameblob)) {
        score -= 16;
      }
      if (/coat|jacket|blazer|trench|parka/.test(nameblob)) {
        score -= 12;
      }
      if (/wool|fleece|heavy knit/.test(nameblob)) {
        score -= 14;
      }
    }
    
    // 2) Workwear penalties: sportswear / too casual
    const isWork = /(workwear|formal|interview|office)/.test(occasion);
    const isAthleisure = /gym|athleisure|track|training|running|sportswear/.test(
      nameblob,
    );
  
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
    // OCCASION-BASED RERANKING (gender-aware)
    // =========================
  
    // Common detectors
    const hasDress = /dress|gown|maxi|mini|bodycon|anarkali|lehenga/.test(
      nameblob,
    );
    const hasSaree = /saree|sari/.test(nameblob);
    const hasHeels = /heel|pump|stiletto|court/.test(nameblob);
    const hasSneakers = /sneaker|trainer|running|walking/.test(nameblob);
    const hasBoots = /boot/.test(nameblob);
    const hasLoafers = /loafer/.test(nameblob);
    const hasFormalShoes =
      /oxford|derby|brogue|formal/.test(nameblob) || hasLoafers;
  
    const hasSandals = /sandal|slide|flipflop/.test(nameblob);
    const hasAthletic = /gym|sport|track|jogger|athletic|training/.test(nameblob);
    const hasPants = /pant|trouser|jean|cargo|chino|slack/.test(nameblob);
    const hasShorts = /short/.test(nameblob);
    const hasLounge = /pyjama|pajama|night|sleep|loungewear/.test(nameblob);
  
    const hasTightDress = /bodycon|tight/.test(nameblob); // ✅ FIX: no assignment
  
    // ✅ Gender gating (soft/hard)
    // If user is male, strongly penalize traditionally feminine items.
    // If user is female, do NOT penalize these.
    if (gender === "male") {
      if (hasDress || hasSaree || /lehenga|anarkali/.test(nameblob)) score -= 120; // hard veto territory
      if (hasHeels) score -= 120;
    }
  
    // =========================
    // Outdoor Adventure / Hiking
    // =========================
    if (/adventure|hiking|outdoor|explore|trek/.test(occasion)) {
      if (hasDress || hasSaree) score -= 45;
      if (hasHeels) score -= 60;
      if (hasSandals) score -= 30;
  
      if (!hasSneakers && !hasBoots) score -= 30;
      if (!hasPants) score -= 20;
    }
  
    // =========================
    // Gym / Workout
    // =========================
    if (/gym|workout|fitness/.test(occasion)) {
      if (hasDress || hasSaree) score -= 60;
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
      if (hasTightDress) score -= 25;
  
      if (hasSneakers || hasBoots) score += 10;
      if (hasPants) score += 5;
    }
  
    // =========================
    // Date Night
    // =========================
    if (/date/.test(occasion)) {
      if (hasAthletic) score -= 40;
      if (hasLounge) score -= 60;
  
      // female-coded boosts
      if (gender === "female") {
        if (hasDress) score += 15;
        if (hasHeels) score += 10;
      }
  
      // male-coded boosts
      if (gender === "male") {
        if (hasFormalShoes) score += 10;
        if (/blazer|jacket|suit/.test(nameblob)) score += 10;
      }
    }
  
    // =========================
    // Wedding / Festive
    // =========================
    if (/wedding|festive|ethnic/.test(occasion)) {
      if (hasAthletic) score -= 70;
      if (hasSneakers) score -= 40;
  
      // female boosts: saree/lehenga/anarkali
      if (gender === "female") {
        if (hasDress || hasSaree || /lehenga|anarkali/.test(nameblob))
          score += 20;
        if (hasHeels || hasSandals) score += 10;
      }
  
      // male boosts: kurta/sherwani/bandhgala + formal shoes/loafers
      if (gender === "male") {
        if (/kurta|sherwani|bandhgala|nehru|waistcoat/.test(nameblob))
          score += 25;
        if (hasFormalShoes) score += 12;
      }
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
  
      if (gender === "female") {
        if (hasDress) score += 20;
        if (hasHeels) score += 15;
      }
  
      if (gender === "male") {
        if (/suit|blazer|tux|formal/.test(nameblob)) score += 20;
        if (hasFormalShoes) score += 15;
      }
    }
  
    // =========================
    // Interview / Presentation
    // =========================
    if (/interview|presentation/.test(occasion)) {
      if (hasDress && /party|mini/.test(nameblob)) score -= 40;
      if (hasSneakers || hasSandals) score -= 50;
  
      if (hasOuterwear) score += 15;
      if (hasFormalShoes) score += 10;
  
      // gender-specific extra strictness
      if (gender === "male" && (hasHeels || hasDress || hasSaree)) score -= 120;
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
      if (hasFormalShoes) score -= 25;
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
      if (gender === "female" && hasHeels && !hasDress) score -= 15;
  
      if (hasOuterwear) score += 15;
      if (hasFormalShoes) score += 10;
    }
  
    // 6) taste-learning boost (Phase C)
    // average item taste score; keep it gentle so it doesn't break basic style rules
    const tasteScores = items.map((it) => getItemTasteScore(it, userW, globalW));
    const avgTaste = tasteScores.length
      ? tasteScores.reduce((a, b) => a + b, 0) / tasteScores.length
      : 0;
  
    score += avgTaste * 2.2; // tune 1.5–3.0
  
    return score;
  }
  
  async function rerankWithLLM({
    candidates = [],
    wardrobePreview = [],
    ctx = {},
  }) {
    // candidates: array of arrays of items (full objects)
    // We pass only idx references to the model, plus lightweight metadata.
    const compact = candidates.slice(0, 12).map((items, i) => ({
      rank_id: i,
      items: items.map((it) => ({
        idx: String(it.id || it.wardrobe_id || it.idx),
        name: it.name || "",
        category: it.category || "",
        color: Array.isArray(it.color) ? it.color[0] || "" : it.color || "",
        palette: it.palette || pickPalette(it.color || "") || "",
      })),
    }));
  
    const sys = {
      role: "system",
      content: `You are Tina. Choose the most cohesive outfit among candidates.
      Rules:
      - pick ONE candidate
      - respond ONLY JSON: { "outfits":[{ "title": string, "style_note": string, "items":[{"idx":string}, ...]}] }
      - title/style_note must reflect actual items (no hallucinations).
      - prefer: complete base + color harmony + occasion match.
      - choose the highest-quality look from the full available pool.
      - the pool may include wardrobe items, staple items, and an uploaded anchor item.
      - do not favor a piece just because of its source; favor overall outfit quality.
      - penalize candidates with obviously poor occasion fit, placeholder-looking items, or unnecessary extras.
      - if an anchor item is present, treat it as the hero piece and choose the look that styles around it best.
      - do not choose looks where the anchor clashes with same-slot body items.
      - if the anchor is a onepiece, prefer footwear + outer/bag/accessory support, not separate top/bottom.
      - if the anchor is a top, prefer bottom + footwear support.
      - if the anchor is a bottom, prefer top + footwear support.
      - if the anchor is footwear, build the outfit around the shoes.
      - if the anchor is outerwear, ensure the base outfit underneath is coherent.
      - if the anchor is bag/accessory, choose a base outfit that the anchor elevates.`,
    };
    const user = {
      role: "user",
      content: JSON.stringify({
        occasion: ctx.occasion || "",
        vibe: ctx.vibe || "",
        weather: ctx.weather || "",
        anchor_item: ctx.anchorItem
          ? {
              idx: String(
                ctx.anchorItem.id ||
                  ctx.anchorItem.wardrobe_id ||
                  ctx.anchorItem.idx ||
                  ""
              ),
              name: ctx.anchorItem.name || "",
              category: ctx.anchorItem.category || "",
              color: Array.isArray(ctx.anchorItem.color)
                ? ctx.anchorItem.color[0] || ""
                : ctx.anchorItem.color || "",
              slot:
                typeof detectSlotFromItem === "function"
                  ? detectSlotFromItem(ctx.anchorItem)
                  : "misc",
            }
          : null,
        candidates: compact,
      }),
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
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    const map = new Map();
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const key = normalizeUrlForMatch(data.image_url || "");
      if (key) map.set(key, d.id);
    });
    return map;
  }
  
  // ---- Swap helpers (map wardrobe items to a slot we can swap) ----
  function slotOf(text = "") {
    const t = (text || "").toLowerCase();
    if (/dress|jumpsuit|saree/.test(t)) return "onepiece";
    if (/top|tee|t-?shirt|shirt|blouse|kurta/.test(t)) return "top";
    if (/bottom|jeans|pant|trouser|chino|skirt|short|palazzo|salwar/.test(t))
      return "bottom";
    if (/footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(t)) return "footwear";
    if (/bag|handbag|tote|purse/.test(t)) return "bag";
    return "misc";
  }
  // light neutral preference used in picks
  const SWAP_NEUTRALS = new Set([
    "black",
    "white",
    "cream",
    "beige",
    "grey",
    "gray",
    "navy",
    "denim",
    "tan",
    "brown",
    "off-white",
  ]);
  const isNeutralSwap = (c = "") => {
    const s = Array.isArray(c) ? c[0] || "" : typeof c === "string" ? c : "";
    return SWAP_NEUTRALS.has(s.toLowerCase());
  };
  
  // ---------------- OUTIFT COMPLETENESS HELPERS ----------------
  const NEUTRALS = [
    "black",
    "white",
    "cream",
    "beige",
    "grey",
    "gray",
    "navy",
    "denim",
    "tan",
    "brown",
    "off-white",
  ];
  const cat = (it) => (it.category || "").toLowerCase();
  const isNeutralColor = (c = "") => {
    const s = Array.isArray(c) ? c[0] || "" : typeof c === "string" ? c : "";
    return NEUTRALS.some((n) => s.toLowerCase().includes(n));
  };
  function pickOne(arr = [], preferNeutral = false) {
    if (!arr.length) return null;
    if (preferNeutral) {
      const n = arr.filter((a) => isNeutralColor(a.color));
      if (n.length) return n[Math.floor(Math.random() * n.length)];
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  function forceCompleteLook(items = [], pool = [], opts = {}) {
    const gender = (opts.gender || "").toLowerCase(); // "female" | "male" | ""
    const occasion = (opts.occasion || "").toLowerCase();
  
    let hydrated = [...items];
    const tops = pool.filter((i) =>
      /top|shirt|tee|t-?shirt|blouse|kurta/.test(cat(i)),
    );
    const bottoms = pool.filter((i) =>
      /bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/.test(cat(i)),
    );
    const dresses = pool.filter((i) => /dress|jumpsuit|saree/.test(cat(i)));
    const footwears = pool.filter((i) =>
      /footwear|shoe|sandal|heel|sneaker|jutti|boot/.test(cat(i)),
    );
    const outers = pool.filter((i) =>
      /outer|jacket|coat|cardigan|shrug/.test(cat(i)),
    );
    const accs = pool.filter((i) =>
      /accessor|belt|watch|bag|handbag|tote|purse|sunglass|scarf|dupatta|stole|shawl/.test(
        cat(i),
      ),
    );
    const bags = accs.filter((i) =>
      /(bag|handbag|tote|purse)/i.test(i.name || i.category || ""),
    );
    const belts = accs.filter((i) => /belt/i.test(i.name || i.category || ""));
  
    const has = (re) => hydrated.some((i) => re.test(cat(i)));
    const add = (x) => {
      if (x) hydrated.push(x);
    };
    if (has(/dress|jumpsuit|saree/)) {
      if (!has(/footwear|shoe|sandal|heel|sneaker|jutti|boot/)) {
        add(pickOne(footwears, true) || pickOne(footwears));
      }
      hydrated = hydrated.filter((i) =>
        /dress|jumpsuit|saree|footwear|outer|jacket|coat|dupatta|shawl|stole|accessor/.test(
          cat(i),
        ),
      );
      // 🎯 gender-aware accessory completion
      if (gender === "female") {
        if (
          !hydrated.some((i) =>
            /(bag|handbag|tote|purse)/i.test(i.name || i.category || ""),
          )
        ) {
          add(pickOne(bags, true) || pickOne(bags) || pickOne(accs, true));
        }
      } else if (gender === "male") {
        // belt only if there's a trouser + dress-shirt/blazer vibe
        const hasTrousers = hydrated.some((i) =>
          /pants|trouser|chinos/i.test(i.name || i.category || ""),
        );
        const hasShirtish = hydrated.some((i) =>
          /shirt|blazer|suit|waistcoat/i.test(i.name || i.category || ""),
        );
        if (
          hasTrousers &&
          hasShirtish &&
          !hydrated.some((i) => /belt/i.test(i.name || ""))
        ) {
          add(pickOne(belts, true) || pickOne(belts));
        }
      }
      if (hydrated.length < 4)
        add(
          pickOne(outers.filter((i) => isNeutralColor(i.color))) ||
            pickOne(accs, true),
        );
      return hydrated.slice(0, 5);
    }
    if (!has(/top|shirt|tee|t-?shirt|blouse|kurta/))
      add(pickOne(tops, true) || pickOne(tops));
    if (!has(/bottom|jeans|pants|trouser|skirt|shorts|palazzo|salwar/))
      add(pickOne(bottoms, true) || pickOne(bottoms));
    if (!has(/footwear|shoe|sandal|heel|sneaker|jutti|boot/))
      add(pickOne(footwears, true) || pickOne(footwears));
    // 🎯 gender-aware accessory completion for separates
    if (gender === "female") {
      if (
        !hydrated.some((i) =>
          /(bag|handbag|tote|purse)/i.test(i.name || i.category || ""),
        )
      ) {
        add(pickOne(bags, true) || pickOne(bags) || pickOne(accs, true));
      }
    } else if (gender === "male") {
      const hasTrousers = hydrated.some((i) =>
        /pants|trouser|chinos/i.test(i.name || i.category || ""),
      );
      const hasShirtish = hydrated.some((i) =>
        /shirt|blazer|suit|waistcoat/i.test(i.name || i.category || ""),
      );
      if (
        hasTrousers &&
        hasShirtish &&
        !hydrated.some((i) => /belt/i.test(i.name || ""))
      ) {
        add(pickOne(belts, true) || pickOne(belts));
      }
    }
    if (hydrated.length < 4) {
      const maybe =
        pickOne(outers.filter((i) => isNeutralColor(i.color))) ||
        pickOne(accs, true);
      if (maybe) add(maybe);
    }
    return hydrated.slice(0, 5);
  }
  // -------------------------------------------------------------
  
  // ==========================================================
  // STYLE-PIECE HELPERS (anchor-item styling pivot)
  // ==========================================================
  
  function normalizeText(v = "") {
    return String(v || "")
      .trim()
      .toLowerCase();
  }
  
  function safeArray(v) {
    return Array.isArray(v) ? v : [];
  }
  
  function detectSlotFromItem(item = {}) {
    const text = [
      item?.category || "",
      item?.subcategory || "",
      item?.name || "",
      ...safeArray(item.tags),
    ]
      .join(" ")
      .toLowerCase();
  
    if (
      /dress|gown|jumpsuit|romper|playsuit|dungaree|overalls|overall|saree|kurta set|co-ord|coord/.test(
        text
      )
    ) {
      return "onepiece";
    }
  
    if (
      /top|shirt|tee|t-shirt|blouse|kurta|sweater|tank|camisole|crop top/.test(
        text
      )
    ) {
      return "top";
    }
  
    if (
      /bottom|jeans|pants|trouser|trousers|skirt|shorts|palazzo|leggings|salwar|jogger/.test(
        text
      )
    ) {
      return "bottom";
    }
  
    if (/jacket|coat|blazer|cardigan|shrug|outerwear/.test(text)) return "outer";
    if (/shoe|sneaker|heel|sandal|boot|loafer|footwear|jutti/.test(text))
      return "footwear";
    if (/bag|handbag|tote|purse|sling|bucket bag|clutch/.test(text)) return "bag";
  
    if (
      /watch|belt|scarf|dupatta|stole|jewelry|jewellery|sunglass|sunglasses|cap|hat|accessory/.test(
        text
      )
    ) {
      return "accessory";
    }
  
    return "misc";
  }
  
  function colorToOptions(color = "") {
    const c = normalizeText(color);
  
    if (!c) return [];
    if (c.includes("white")) return ["White", "Off-white", "Cream"];
    if (c.includes("black")) return ["Black", "Charcoal", "Dark grey"];
    if (c.includes("blue")) return ["Blue", "Navy", "Light blue"];
    if (c.includes("beige")) return ["Beige", "Tan", "Cream"];
    if (c.includes("brown")) return ["Brown", "Tan", "Camel"];
    if (c.includes("grey") || c.includes("gray"))
      return ["Grey", "Charcoal", "Light grey"];
  
    return [color];
  }
  
  function buildStapleCollectionName(gender = "female", version = "v2") {
    const g = String(gender || "female").toLowerCase();
    const v = String(version || "v2").toLowerCase();
  
    if (g === "male") {
      return v === "v2" ? "staples_male_v2" : "staples_male";
    }
    return v === "v2" ? "staples_female_v2" : "staples_female";
  }
  
  function filterStaplesForOccasion(items = [], occasion = "") {
    const occ = String(occasion || "").toLowerCase();
    if (!occ) return items;
  
    return items.filter((it) => {
      const text = `${it.name || ""} ${it.category || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
  
      if (/(workwear|formal|interview|office|business)/.test(occ)) {
        return !/sportswear|gym|skirt|sandal|flipflop|beach/.test(text);
      }
  
      if (/date/.test(occ)) {
        return !/gym|training/.test(text);
      }
  
      return true;
    });
  }
  async function fetchStaplesForStyling({
    gender = "female",
    version = "v2",
  } = {}) {
    const col = buildStapleCollectionName(gender, version);
    console.log("📦 fetchStaplesForStyling: querying collection:", col);
    const snap = await db.collection(col).get();
    console.log("📦 fetchStaplesForStyling: found", snap.size, "docs in", col);
  
    return snap.docs.map((doc) => {
      const data = doc.data() || {};
      const name = data.name || doc.id;
      const category = data.category || "Staple";
      const color = data.color || "Default";
  
      return {
        ...hydrateWardrobeItem({
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
        }),
        id: doc.id,
        wardrobe_id: doc.id,
        idx: doc.id,
        source: "staple",
        in_closet: false,
      };
    });
  }
  
  async function fetchWardrobeForStyling(uid) {
    console.log(
      "👕 fetchWardrobeForStyling: querying wardrobe for uid:",
      JSON.stringify(uid),
    );
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    console.log(
      "👕 fetchWardrobeForStyling: found",
      snap.size,
      "docs for uid:",
      uid,
    );
  
    return snap.docs.map((doc) => {
      const data = doc.data() || {};
      const normalizedCategory = normalizeCategory(
        data.category || "",
        data.name || "",
      );
      const taxonomyPath = mapTaxonomy(normalizedCategory);
  
      return {
        ...hydrateWardrobeItem({
          ...data,
          name: data.name || "Unnamed",
          primaryTag: data.primaryTag || data.name || "Unnamed",
          category: normalizedCategory,
          taxonomyPath,
        }),
        id: doc.id,
        wardrobe_id: doc.id,
        idx: doc.id,
        source: "wardrobe",
        in_closet: true,
      };
    });
  }
  
  function itemMatchesAnchorContext(item = {}, anchor = {}) {
    const itemColor = normalizeText(item.color);
    const anchorColor = normalizeText(anchor.color);
    const itemPalette = normalizeText(item.palette);
    const anchorPalette = normalizeText(anchor.palette);
    const itemSlot = detectSlotFromItem(item);
    const anchorSlot = detectSlotFromItem(anchor);
  
    if (itemSlot === anchorSlot && !["accessory", "bag"].includes(itemSlot)) {
      return false;
    }
  
    let score = 0;
  
    if (itemColor && anchorColor && itemColor === anchorColor) score += 2;
    if (itemPalette && anchorPalette && itemPalette === anchorPalette) score += 2;
  
    if (isNeutralColor(item.color)) score += 1.5;
  
    const text =
      `${item.name || ""} ${item.category || ""} ${safeArray(item.tags).join(" ")}`.toLowerCase();
    if (/classic|basic|staple|minimal|essential/.test(text)) score += 1;
  
    return score >= 1.5;
  }
  
    function groupCandidatesBySlot(items = [], anchor = {}, occasion = "") {
    const grouped = {
      top: [],
      bottom: [],
      outer: [],
      footwear: [],
      bag: [],
      accessory: [],
      onepiece: [],
      misc: [],
    };
  
    for (const item of items) {
      const slot = detectSlotFromItem(item);
      if (!grouped[slot]) grouped[slot] = [];
      grouped[slot].push(item);
    }
  
    Object.keys(grouped).forEach((slot) => {
      grouped[slot] = grouped[slot].sort((a, b) => {
        let aScore = itemMatchesAnchorContext(a, anchor) ? 2 : 0;
        let bScore = itemMatchesAnchorContext(b, anchor) ? 2 : 0;
  
        if (a.in_closet) aScore += 1;
        if (b.in_closet) bScore += 1;
  
        if (isClearlyFormalFriendly(a, occasion)) aScore += 0.5;
        if (isClearlyFormalFriendly(b, occasion)) bScore += 0.5;
  
        return bScore - aScore;
      });
    });
  
    return grouped;
  }
  
  function buildAnchorPieceContext(anchorItem = {}) {
    return {
      name: anchorItem.name || "Uploaded item",
      category: anchorItem.category || "",
      color: anchorItem.color || "",
      palette: anchorItem.palette || pickPalette(anchorItem.color || ""),
      silhouette:
        anchorItem.silhouette ||
        guessSilhouette(`${anchorItem.name || ""} ${anchorItem.category || ""}`),
      tags: safeArray(anchorItem.tags),
      slot: detectSlotFromItem(anchorItem),
      image_url: anchorItem.image_url || "",
      source: "uploaded_item",
      in_closet: true,
      color_options: colorToOptions(anchorItem.color || ""),
    };
  }
  
  function getItemIdSafe(it = {}) {
    return String(it.id || it.wardrobe_id || it.idx || "");
  }
  
  function uniqueById(items = []) {
    const seen = new Set();
    return items.filter((it) => {
      const id = getItemIdSafe(it);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  function pickBestFromSlot(items = [], anchor = {}, opts = {}) {
    const {
      preferNeutral = false,
      excludeIds = new Set(),
      occasion = "",
    } = opts;
  
    const filtered = (items || []).filter((it) => {
      const id = getItemIdSafe(it);
      return id && !excludeIds.has(id);
    });
  
    if (!filtered.length) return null;
  
    const scored = filtered
    .map((it) => {
      let score = 0;
  
      if (itemMatchesAnchorContext(it, anchor)) score += 4;
      if (it.in_closet) score += 2;
      if (preferNeutral && isNeutralColor(it.color)) score += 1.5;
  
      const text =
        `${it.name || ""} ${it.category || ""} ${(it.tags || []).join(" ")}`.toLowerCase();
  
      const imageUrl = String(it.image_url || "").toLowerCase();
      const occ = String(occasion || "").toLowerCase();
  
      if (/classic|basic|staple|minimal|essential/.test(text)) score += 1;
  
      // soft penalty for weak / placeholder-ish assets
      if (/default|placeholder/.test(text) || /default|placeholder/.test(imageUrl)) {
        score -= 2;
      }
  
      // soft penalty for bad occasion fit
      if (/(workwear|formal|interview|office|business)/.test(occ)) {
        if (/sportswear|gym|athletic|running|training/.test(text)) score -= 5;
        if (/skirt/.test(text)) score -= 3;
        if (/sandal|flipflop|slide/.test(text)) score -= 4;
        if (/bucket bag/.test(text)) score -= 2;
      }
  
      if (/date|dinner|night out|cocktail/.test(occ)) {
        if (/sportswear|gym|athletic|training/.test(text)) score -= 4;
        if (/bucket bag/.test(text)) score -= 1.5;
      }
  
      if (/summer|beach|resort|vacation/.test(occ)) {
        if (/coat|jacket|blazer|cardigan|hoodie|sweater/.test(text)) score -= 3;
      }
  
      score += Math.random() * 1.25;
  
      return { it, score };
    })
    .sort((a, b) => b.score - a.score);
  
    const topBand = scored.slice(0, Math.min(3, scored.length));
    return topBand[Math.floor(Math.random() * topBand.length)]?.it || null;
  }
  
  function buildAnchorAwareCandidates(pool = [], anchor = {}, opts = {}) {
    const {
      gender = "",
      occasion = "",
      count = 24,
    } = opts;
  
    const grouped = groupCandidatesBySlot(pool, anchor, occasion);
    const anchorSlot = detectSlotFromItem(anchor);
    const looks = [];
  
    function addOptional(baseItems, excludeIds) {
      const out = [...baseItems];
      const occ = String(occasion || "").toLowerCase();
  
      const shouldAddOuter =
        !/summer|beach|resort|vacation/.test(occ) &&
        (/(workwear|formal|interview|office|business)/.test(occ) || Math.random() < 0.2);
  
      const shouldAddBag =
        /(date|dinner|night out|cocktail|workwear|formal|interview|office|business)/.test(occ) ||
        Math.random() < 0.35;
  
      const shouldAddAccessory =
        /(date|dinner|cocktail|festive|wedding)/.test(occ) ||
        Math.random() < 0.2;
  
      const maybeOuter =
        shouldAddOuter && anchorSlot !== "outer"
          ? pickBestFromSlot(grouped.outer, anchor, {
              excludeIds,
              preferNeutral: true,
              occasion,
            })
          : null;
  
      const maybeBag =
        shouldAddBag && anchorSlot !== "bag"
          ? pickBestFromSlot(grouped.bag, anchor, {
              excludeIds,
              preferNeutral: true,
              occasion,
            })
          : null;
  
      const maybeAccessory =
        shouldAddAccessory && anchorSlot !== "accessory"
          ? pickBestFromSlot(grouped.accessory, anchor, {
              excludeIds,
              preferNeutral: true,
              occasion,
            })
          : null;
  
      if (maybeOuter) {
        out.push(maybeOuter);
        excludeIds.add(getItemIdSafe(maybeOuter));
      }
      if (maybeBag) {
        out.push(maybeBag);
        excludeIds.add(getItemIdSafe(maybeBag));
      }
      if (maybeAccessory) {
        out.push(maybeAccessory);
        excludeIds.add(getItemIdSafe(maybeAccessory));
      }
  
      return out;
    }
    for (let i = 0; i < count; i++) {
      const excludeIds = new Set([getItemIdSafe(anchor)]);
      let items = [anchor];
  
      if (anchorSlot === "top") {
        const bottom = pickBestFromSlot(grouped.bottom, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (bottom) {
          items.push(bottom);
          excludeIds.add(getItemIdSafe(bottom));
        }
  
        const footwear = pickBestFromSlot(grouped.footwear, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (footwear) {
          items.push(footwear);
          excludeIds.add(getItemIdSafe(footwear));
        }
  
        items = addOptional(items, excludeIds);
      }
  
      else if (anchorSlot === "bottom") {
        const top = pickBestFromSlot(grouped.top, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (top) {
          items.push(top);
          excludeIds.add(getItemIdSafe(top));
        }
  
        const footwear = pickBestFromSlot(grouped.footwear, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (footwear) {
          items.push(footwear);
          excludeIds.add(getItemIdSafe(footwear));
        }
  
        items = addOptional(items, excludeIds);
      }
  
      else if (anchorSlot === "onepiece") {
        const footwear = pickBestFromSlot(grouped.footwear, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (footwear) {
          items.push(footwear);
          excludeIds.add(getItemIdSafe(footwear));
        }
  
        items = addOptional(items, excludeIds);
      }
  
      else if (anchorSlot === "footwear") {
        const useOnePiece = grouped.onepiece.length > 0 && Math.random() < 0.35;
  
        if (useOnePiece) {
          const onepiece = pickBestFromSlot(grouped.onepiece, anchor, {   excludeIds,   occasion, });
          if (onepiece) {
            items.push(onepiece);
            excludeIds.add(getItemIdSafe(onepiece));
          }
        } else {
          const top = pickBestFromSlot(grouped.top, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (top) {
            items.push(top);
            excludeIds.add(getItemIdSafe(top));
          }
  
          const bottom = pickBestFromSlot(grouped.bottom, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (bottom) {
            items.push(bottom);
            excludeIds.add(getItemIdSafe(bottom));
          }
        }
  
        items = addOptional(items, excludeIds);
      }
  
      else if (anchorSlot === "outer") {
        const top = pickBestFromSlot(grouped.top, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (top) {
          items.push(top);
          excludeIds.add(getItemIdSafe(top));
        }
  
        const bottom = pickBestFromSlot(grouped.bottom, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (bottom) {
          items.push(bottom);
          excludeIds.add(getItemIdSafe(bottom));
        }
  
        const footwear = pickBestFromSlot(grouped.footwear, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (footwear) {
          items.push(footwear);
          excludeIds.add(getItemIdSafe(footwear));
        }
  
        const bag = pickBestFromSlot(grouped.bag, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (bag) items.push(bag);
      }
  
      else if (anchorSlot === "bag" || anchorSlot === "accessory") {
        const useOnePiece = grouped.onepiece.length > 0 && Math.random() < 0.35;
  
        if (useOnePiece) {
          const onepiece = pickBestFromSlot(grouped.onepiece, anchor, {   excludeIds,   occasion, });
          if (onepiece) {
            items.push(onepiece);
            excludeIds.add(getItemIdSafe(onepiece));
          }
        } else {
          const top = pickBestFromSlot(grouped.top, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (top) {
            items.push(top);
            excludeIds.add(getItemIdSafe(top));
          }
  
          const bottom = pickBestFromSlot(grouped.bottom, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (bottom) {
            items.push(bottom);
            excludeIds.add(getItemIdSafe(bottom));
          }
        }
  
        const footwear = pickBestFromSlot(grouped.footwear, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
        if (footwear) {
          items.push(footwear);
          excludeIds.add(getItemIdSafe(footwear));
        }
  
        if (anchorSlot === "bag") {
          const accessory = pickBestFromSlot(grouped.accessory, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (accessory) items.push(accessory);
        } else {
          const bag = pickBestFromSlot(grouped.bag, anchor, {   excludeIds,   preferNeutral: true,   occasion, });
          if (bag) items.push(bag);
        }
      }
  
      items = uniqueById(items);
      items = forceCompleteLook(items, pool, { gender, occasion });
  
      const hasOnepiece = items.some((it) => detectSlotFromItem(it) === "onepiece");
      if (hasOnepiece) {
        items = items.filter((it) => {
          const slot = detectSlotFromItem(it);
          return slot !== "top" && slot !== "bottom";
        });
      }
  
      items = uniqueById(items);
      looks.push(items);
    }
  
    return looks;
  }
  function compactItemsForPrompt(items = [], limit = 60) {
    return items.slice(0, limit).map((it) => ({
      idx: String(it.idx || it.id || it.wardrobe_id || ""),
      name: it.name || "",
      category: it.category || "",
      color: Array.isArray(it.color) ? it.color[0] || "" : it.color || "",
      palette: it.palette || pickPalette(it.color || ""),
      silhouette:
        it.silhouette || guessSilhouette(`${it.name || ""} ${it.category || ""}`),
      source: it.source || "wardrobe",
      in_closet: !!it.in_closet,
      slot: detectSlotFromItem(it),
      tags: safeArray(it.tags).slice(0, 6),
      color_options: colorToOptions(it.color || ""),
    }));
  }
  
  function getItemId(it) {
    return String(it?.id || it?.wardrobe_id || it?.idx || "");
  }
  
  function slotMap(items = []) {
    const map = {};
    for (const it of items) {
      const slot = detectSlotFromItem(it);
      map[slot] = getItemId(it);
    }
    return map;
  }
  
  function overlapCount(a = [], b = []) {
    const aIds = new Set(a.map(getItemId).filter(Boolean));
    const bIds = new Set(b.map(getItemId).filter(Boolean));
    let count = 0;
    for (const id of aIds) {
      if (bIds.has(id)) count++;
    }
    return count;
  }
  
  function sameCoreCombo(a = [], b = []) {
    const sa = slotMap(a);
    const sb = slotMap(b);
  
    const keys = ["top", "bottom", "footwear", "onepiece"];
    let same = 0;
  
    for (const key of keys) {
      if (sa[key] && sb[key] && sa[key] === sb[key]) same++;
    }
  
    if (sa.onepiece && sb.onepiece && sa.onepiece === sb.onepiece) return true;
    return same >= 2;
  }
  
  function pickDiverseLooks(scoredLooks = [], limit = 20) {
    const picked = [];
  
    for (const candidate of scoredLooks) {
      const items = candidate.items || [];
  
      const tooSimilar = picked.some((prev) => {
        const prevItems = prev.items || [];
        return (
          sameCoreCombo(items, prevItems) ||
          overlapCount(items, prevItems) >= 3
        );
      });
  
      if (!tooSimilar) picked.push(candidate);
      if (picked.length >= limit) break;
    }
  
    if (picked.length < limit) {
      for (const candidate of scoredLooks) {
        if (picked.includes(candidate)) continue;
        picked.push(candidate);
        if (picked.length >= limit) break;
      }
    }
  
    return picked;
  }
  
  function nonAnchorOverlapCount(a = [], b = []) {
    const aIds = new Set(getNonAnchorItems(a).map(getItemId).filter(Boolean));
    const bIds = new Set(getNonAnchorItems(b).map(getItemId).filter(Boolean));
  
    let count = 0;
    for (const id of aIds) {
      if (bIds.has(id)) count++;
    }
    return count;
  }
  
  function pieceSignatureFromItems(items = []) {
    return getNonAnchorItems(items)
      .map((it) => `${detectSlotFromItem(it)}:${getItemId(it)}`)
      .sort()
      .join("|");
  }
  
  function pickDiverseLooksStrict(scoredLooks = [], limit = 20) {
    const picked = [];
    const usedSignatures = new Set();
  
    for (const candidate of scoredLooks) {
      const items = candidate.items || [];
      const signature = pieceSignatureFromItems(items);
  
      if (!signature || usedSignatures.has(signature)) continue;
  
      const tooSimilar = picked.some((prev) => {
        const overlap = nonAnchorOverlapCount(items, prev.items || []);
        return overlap >= 2;
      });
  
      if (tooSimilar) continue;
  
      picked.push(candidate);
      usedSignatures.add(signature);
  
      if (picked.length >= limit) break;
    }
  
    if (picked.length < limit) {
      for (const candidate of scoredLooks) {
        const items = candidate.items || [];
        const signature = pieceSignatureFromItems(items);
        if (!signature || usedSignatures.has(signature)) continue;
  
        picked.push(candidate);
        usedSignatures.add(signature);
  
        if (picked.length >= limit) break;
      }
    }
  
    return picked;
  }
  
  function diversifyFinalLooks(looks = []) {
    const out = [];
    const usedSignatures = new Set();
  
    for (const look of looks) {
      const pieces = look?.pieces || [];
      const signature = pieces
        .filter((p) => p.source !== "uploaded_item")
        .map((p) => `${String(p.role || "")}:${String(p.idx || p.name || "")}`)
        .sort()
        .join("|");
  
      if (!signature || usedSignatures.has(signature)) continue;
  
      const tooSimilar = out.some((prev) => {
        const prevIds = new Set(
          (prev.pieces || [])
            .filter((p) => p.source !== "uploaded_item")
            .map((p) => String(p.idx || p.name || ""))
        );
  
        const currIds = (pieces || [])
          .filter((p) => p.source !== "uploaded_item")
          .map((p) => String(p.idx || p.name || ""));
  
        let overlap = 0;
        for (const id of currIds) {
          if (prevIds.has(id)) overlap++;
        }
  
        return overlap >= 2;
      });
  
      if (tooSimilar) continue;
  
      out.push(look);
      usedSignatures.add(signature);
  
      if (out.length >= 3) break;
    }
  
    return out;
  }
  
  async function generateTinaCoreLooks({
    wardrobe = [],
    uid = "",
    occasion = "",
    vibe = "",
    city = "Delhi",
    gender = "",
    likedCombos = [],
    dislikedCombos = [],
    lastServedCombo = null,
    anchorItem = null,
    requireAnchor = false,
    count = 3,
  }) {
  
    console.log("🧠 generateTinaCoreLooks called:", {
      wardrobeCount: wardrobe.length,
      uid: !!uid,
      occasion,
      vibe,
      city,
      gender,
      hasAnchor: !!anchorItem,
      requireAnchor,
      count,
    });
    const weatherNow = await getWeather(city).catch(() => null);
    const taste = uid ? await getTasteWeights(db, uid).catch(() => null) : null;
  
    let workingWardrobe = [...wardrobe];
  
    if (anchorItem && requireAnchor) {
      const anchorId = String(
        anchorItem.id || anchorItem.wardrobe_id || anchorItem.idx || ""
      );
  
      workingWardrobe = [
        anchorItem,
        ...workingWardrobe.filter(
          (it) =>
            String(it.id || it.wardrobe_id || it.idx || "") !== anchorId
        ),
      ];
    }
  
    let rawCandidates = [];
  
    if (anchorItem && requireAnchor) {
      rawCandidates = buildAnchorAwareCandidates(workingWardrobe, anchorItem, {
        gender,
        occasion,
        count: 120,
      })
        .filter((items) => candidateIncludesAnchor(items, anchorItem))
        .filter((items) => !hasConflictingSilhouette(items))
        .filter((items) => !hasAnchorSlotConflict(items, anchorItem))
        .map((items) => {
          const hasOnepiece = items.some(
            (it) => detectSlotFromItem(it) === "onepiece"
          );
          if (!hasOnepiece) return items;
          return items.filter((it) => {
            const slot = detectSlotFromItem(it);
            return slot !== "top" && slot !== "bottom";
          });
        })
        .map((items) =>
          uniqueById(
            forceCompleteLook(items, workingWardrobe, {
              gender,
              occasion,
            })
          )
        );
    } else {
      const pools = buildSlotPools(workingWardrobe);
      rawCandidates = generateCandidates(pools, 120, {
        preferNeutralAcc: true,
      }).map((items) =>
        uniqueById(
          forceCompleteLook(items, workingWardrobe, {
            gender,
            occasion,
          })
        )
      );
    }
  
    const scored = rawCandidates
      .map((items) => ({
        items,
        score: scoreLook(
          items,
          {
            occasion,
            vibe,
            weather: weatherNow,
            likedCombos,
            dislikedCombos,
            lastServedCombo,
            gender,
            anchorItem,
          },
          taste
        ),
      }))
      .sort((a, b) => b.score - a.score);
  
    const diverseScored = pickDiverseLooks(scored, 40);
    const topCandidates = diverseScored.map((x) => x.items);
  
    let llmPicked = null;
    try {
      llmPicked = await rerankWithLLM({
        candidates: topCandidates,
        wardrobePreview: workingWardrobe,
        ctx: { occasion, vibe, weather: weatherNow, gender, anchorItem },
      });
    } catch (e) {
      console.warn("⚠️ generateTinaCoreLooks rerank failed:", e.message);
    }
  
    let finalLooks = [];
  
    if (llmPicked) {
      try {
        const parsed = JSON.parse(llmPicked);
        const picked = Array.isArray(parsed?.outfits) ? parsed.outfits : [];
  
        finalLooks = picked
          .map((look) => {
            const items = (look.items || [])
              .map((ref) => {
                const rid = String(ref.idx || "");
                return workingWardrobe.find(
                  (it) =>
                    String(it.id || it.wardrobe_id || it.idx || "") === rid
                );
              })
              .filter(Boolean);
  
            if (!items.length) return null;
  
            const ensured =
              anchorItem && requireAnchor && !candidateIncludesAnchor(items, anchorItem)
                ? [anchorItem, ...items]
                : items;
  
            return uniqueById(ensured);
          })
          .filter(Boolean);
      } catch (e) {
        console.warn("⚠️ generateTinaCoreLooks parse failed:", e.message);
      }
    }
  
    if (finalLooks.length < count) {
      const fallback = diverseScored
        .map((x) => uniqueById(x.items || []))
        .filter((items) => items.length > 0);
  
      for (const items of fallback) {
        const sig = items
          .map((it) => `${detectSlotFromItem(it)}:${String(it.id || it.idx || "")}`)
          .sort()
          .join("|");
  
        const already = finalLooks.some((f) => {
          const fsig = f
            .map((it) => `${detectSlotFromItem(it)}:${String(it.id || it.idx || "")}`)
            .sort()
            .join("|");
          return fsig === sig;
        });
  
        if (!already) finalLooks.push(items);
        if (finalLooks.length >= count) break;
      }
    }
  
    return finalLooks.slice(0, count);
  }
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
      const products = (serpRes.data.images_results || [])
        .slice(0, 6)
        .map((img) => {
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
    const raw = String(s || "")
      .trim()
      .toLowerCase();
  
    const cleaned = raw
      .replace(/[\/\\]/g, "_") // Firestore disallows /
      .replace(/\s+/g, " ") // collapse whitespace
      .replace(/[^\w\- ]/g, "") // remove weird symbols
      .replace(/\s/g, "_"); // spaces -> _
  
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
  
      const global = {}; // { "dim::key": { loves, dislikes, total } }
      const perUser = {}; // { [uid]: { "dim::key": { loves, dislikes, total } } }
  
      // ── Extract signals from canonical events ──
      for (const ev of events) {
        const norm = normalizeFeedbackToLook(ev);
        if (!norm) continue;
  
        const { uid, delta, items } = norm;
  
        items.forEach((it) => {
          bump(global, perUser, uid, "category", it.category, delta);
          bump(global, perUser, uid, "color", it.color, delta);
          (it.tags || []).forEach((tag) =>
            bump(global, perUser, uid, "tag", tag, delta),
          );
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
        if (opCount >= 450 || force) {
          // keep buffer under 500
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
        if (!perUserStore[uid][k])
          perUserStore[uid][k] = { loves: 0, dislikes: 0, total: 0 };
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
          stats,
        );
      }
  
      // final flush
      await commitIfNeeded(true);
  
      // ✅ ALSO write compact weights maps for fast reads in Phase C
      // global weights
      {
        const globalBuckets = pruneWeightBuckets(
          toWeightBucketsFromStore(global),
          150,
        );
        await db.collection("taste_weights_global").doc("global").set(
          {
            weights: globalBuckets,
            updated_at: new Date().toISOString(),
            version: 1,
          },
          { merge: true },
        );
      }
  
      // per-user weights
      for (const [uid, stats] of Object.entries(perUser)) {
        const userBuckets = pruneWeightBuckets(
          toWeightBucketsFromStore(stats),
          150,
        );
        await db.collection("taste_weights").doc(uid).set(
          {
            weights: userBuckets,
            updated_at: new Date().toISOString(),
            version: 1,
          },
          { merge: true },
        );
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
      res
        .status(500)
        .json({ error: "Auto-tagging failed", message: err.message });
    }
  });
  
  // Accepts multipart/form-data with field name: "file"
  app.post(
    "/auto-tag-upload",
    limiterAutoTag,
    upload.single("file"),
    async (req, res) => {
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
          message:
            typeof payload === "string" ? payload : JSON.stringify(payload),
        });
      }
    },
  );
  
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
        user_top: userSnap.docs.map((d) => d.data()),
        global_top: globalSnap.docs.map((d) => d.data()),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // ✅ Fetch wardrobe by user ID (normalized + hydrated)
  app.get("/wardrobe", async (req, res) => {
    const includeStaples = String(req.query.include_staples || "0") === "1";
    const staplesGender = String(req.query.gender || "male").toLowerCase();
    const staplesVersion = String(req.query.version || "v2").toLowerCase();
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
  
      let items = snapshot.docs.map((doc) => {
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
  
      // ✅ Optionally merge staples into wardrobe response (frontend can render both)
      if (includeStaples) {
        const col =
          staplesGender === "female"
            ? staplesVersion === "v2"
              ? "staples_female_v2"
              : "staples_female"
            : staplesVersion === "v2"
              ? "staples_male_v2"
              : "staples_male";
  
        const stapleSnap = await db.collection(col).get();
  
        const staples = stapleSnap.docs.map((doc) => {
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
            gender: data.gender || staplesGender,
            version: data.version || staplesVersion,
          });
  
          return {
            ...hydrated,
            id: doc.id,
            wardrobe_id: doc.id,
            idx: doc.id,
            source: "staple",
          };
        });
  
        items = [...items, ...staples];
      }
  
      console.log("📦 Normalized wardrobe items:", items.length);
      return res.json(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error("❌ Fetch wardrobe error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
  
  // ✅ Swap candidates for a single slot (top|bottom|footwear|bag|dress)
  app.post("/swap-suggestions", async (req, res) => {
    try {
      const {
        uid,
        slot,
        excludeIds = [],
        limit = 8,
        occasion = "",
        preferNeutral = true,
      } = req.body || {};
      if (!uid || !slot) {
        return res.status(400).json({ error: "uid and slot are required" });
      }
  
      // Load full wardrobe for the user
      const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
      const all = snap.docs.map((d) => {
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
      let candidates = all.filter(
        (w) => slotOf(w.category || w.name) === slot && !used.has(w.id),
      );
  
      // Soft occasion nudge (reuse occasionCategoryMap if present)
      const occCats =
        (occasion && occasionCategoryMap?.[occasion.toLowerCase()]) || [];
      if (occCats.length) {
        candidates = candidates
          .map((it) => {
            const cat = (it.category || "").toLowerCase();
            const name = (it.name || "").toLowerCase();
            const occBoost = occCats.some(
              (c) =>
                cat.includes(c.toLowerCase()) || name.includes(c.toLowerCase()),
            )
              ? 0.25
              : 0;
            return {
              it,
              score:
                occBoost +
                (preferNeutral && isNeutralSwap(it.color) ? 0.2 : 0) +
                Math.random() * 0.6,
            };
          })
          .sort((a, b) => b.score - a.score)
          .map((x) => x.it);
      } else if (preferNeutral) {
        // simple neutral bias
        candidates = candidates
          .map((it) => ({
            it,
            score: (isNeutralSwap(it.color) ? 0.2 : 0) + Math.random() * 0.8,
          }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.it);
      } else {
        // randomize
        candidates = candidates.sort(() => Math.random() - 0.5);
      }
  
      // Hydrate minimal, consistent object like the rest of the API
      const hydrated = candidates.slice(0, limit).map((it) =>
        hydrateWardrobeItem({
          wardrobe_id: it.wardrobe_id || it.id, // ✅ preserve doc id
          id: it.wardrobe_id || it.id, // ✅ keep compatibility
          ...it,
          category: normalizeCategory(it.category || "", it.name || ""),
          taxonomyPath:
            it.taxonomyPath ||
            mapTaxonomy(normalizeCategory(it.category || "", it.name || "")),
        }),
      );
  
      res.json({ success: true, slot, items: hydrated });
    } catch (err) {
      console.error("❌ /swap-suggestions failed:", err.message);
      res
        .status(500)
        .json({ error: "Swap suggestions failed", message: err.message });
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
          ? version === "v2"
            ? "staples_female_v2"
            : "staples_female"
          : version === "v2"
            ? "staples_male_v2"
            : "staples_male";
  
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
      image_url,
      save_to_staples = false,
      gender = "male",
      version = "v2",
    } = req.body;
  
    // Prefer edited values if provided
    name = editedName ?? name;
    category = editedCategory ?? category;
    color = editedColor ?? color;
  
    // ✅ Do NOT silently default uid (prevents cross-user mixing)
    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "uid is required",
      });
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
        primaryTag: capitalizedName, // keep display name consistent
        category: normalizedCategory,
        color: capitalizedColor,
        image_url,
        tags: capitalizedTags,
        taxonomyPath,
      });
  
      // ✅ If saving as a staple, write into staples_* collection instead of wardrobe
      if (save_to_staples) {
        const g = String(gender || "male").toLowerCase();
        const v = String(version || "v2").toLowerCase();
  
        const col =
          g === "female"
            ? v === "v2"
              ? "staples_female_v2"
              : "staples_female"
            : v === "v2"
              ? "staples_male_v2"
              : "staples_male";
  
        const stapleDocId = safeDocId(
          `${capitalizedName}_${capitalizedColor}_${normalizedCategory}`,
        );
        await db
          .collection(col)
          .doc(stapleDocId)
          .set(
            {
              ...hydrated,
              name: capitalizedName,
              category: normalizedCategory,
              color: capitalizedColor,
              image_url: image_url || "",
              gender: g,
              version: v,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
  
        return res.json({
          success: true,
          item: {
            wardrobe_id: stapleDocId,
            id: stapleDocId,
            ...hydrated,
            source: "staple",
          },
          message: "Staple saved successfully",
          collection: col,
        });
      }
  
      // Default: normal wardrobe add
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
      let {
        uid,
        image_path,
        image_url,
        name,
        editedName,
        category,
        editedCategory,
        color,
        editedColor,
        tags,
        save_to_staples = false,
        gender = "female",
        version = "v2",
      } = req.body;
  
      // Prefer edited values if provided
      name = editedName ?? name;
      category = editedCategory ?? category;
      color = editedColor ?? color;
  
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
        primaryTag: capitalizedName, // keep display name consistent
        category: normalizedCategory,
        color: capitalizedColor,
        image_url,
        tags: capitalizedTags,
        taxonomyPath,
  
        // ✅ Step 3: persist these so reranker/validator is stable
        silhouette: guessSilhouette(`${capitalizedName} ${normalizedCategory}`),
        palette: pickPalette(capitalizedColor),
      });
  
      // ✅ If saving as a staple, write into staples_* collection instead of wardrobe
      if (save_to_staples) {
        const g = String(gender || "male").toLowerCase();
        const v = String(version || "v2").toLowerCase();
  
        const col =
          g === "female"
            ? v === "v2"
              ? "staples_female_v2"
              : "staples_female"
            : v === "v2"
              ? "staples_male_v2"
              : "staples_male";
  
        const stapleDocId = safeDocId(
          `${capitalizedName}_${capitalizedColor}_${normalizedCategory}`,
        );
        await db
          .collection(col)
          .doc(stapleDocId)
          .set(
            {
              ...hydrated,
              name: capitalizedName,
              category: normalizedCategory,
              color: capitalizedColor,
              image_url: image_url || "",
              gender: g,
              version: v,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
          );
  
        return res.json({
          success: true,
          item: {
            wardrobe_id: stapleDocId,
            id: stapleDocId,
            ...hydrated,
            source: "staple",
          },
          message: "Staple saved successfully",
          collection: col,
        });
      }
  
      // Default: normal wardrobe add
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
        return res
          .status(403)
          .json({ error: "Not authorized to delete this item" });
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
    let {
      uid,
      name,
      editedName,
      category,
      editedCategory,
      color,
      editedColor,
      tags,
    } = req.body;
    name = editedName ?? name;
    category = editedCategory ?? category;
    color = editedColor ?? color;
  
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
      return res
        .status(400)
        .json({ success: false, error: "uid and date are required" });
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
          message: "No outfit plan found for this date.",
        });
      }
  
      const data = docSnap.data() || {};
      // Normalize shape
      return res.status(200).json({
        success: true,
        outfit: data.outfit || null,
        uid: data.uid || uid,
        date: data.date || date,
      });
    } catch (err) {
      console.error("❌ Failed to fetch outfit plan:", err.message);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch outfit plan" });
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
      const weights = doc.exists ? doc.data().learning_weights || {} : {};
  
      // learning increments
      const delta = liked ? 0.05 : -0.03;
      const bump = (v, d) => Math.min(1, Math.max(0, (v ?? 0.5) + d));
  
      const updated = {
        colorHarmony: bump(
          weights.colorHarmony,
          validation?.valid ? delta : -0.02,
        ),
        silhouetteBalance: bump(
          weights.silhouetteBalance,
          validation?.valid ? delta : -0.02,
        ),
        trendAwareness: bump(weights.trendAwareness, 0.01), // slow upward nudge
        wardrobeRotation: bump(weights.wardrobeRotation, 0.01), // slow upward nudge
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
      feedbackMemory = feedbackSnap.docs.map((d) => d.data());
    } catch (err) {
      console.warn("⚠️ feedback memory fetch failed:", err.message);
    }
  
    const learning = {
      colorHarmony: mem?.learning_weights?.colorHarmony ?? 0.5,
      silhouetteBalance: mem?.learning_weights?.silhouetteBalance ?? 0.5,
      trendAwareness: mem?.learning_weights?.trendAwareness ?? 0.3,
      wardrobeRotation: mem?.learning_weights?.wardrobeRotation ?? 0.4,
    };
  
    // liked / disliked combo fingerprints
    let likedCombos = [];
    let dislikedCombos = [];
    try {
      const likedSnap = await db
        .collection("liked_looks")
        .where("uid", "==", uid)
        .limit(100)
        .get();
      likedCombos = likedSnap.docs.map((d) => d.data().combo).filter(Boolean);
  
      const dislikedSnap = await db
        .collection("disliked_looks")
        .where("uid", "==", uid)
        .limit(100)
        .get();
      dislikedCombos = dislikedSnap.docs
        .map((d) => d.data().combo)
        .filter(Boolean);
    } catch (e) {
      console.warn("⚠️ styleContext combos fetch failed:", e.message);
    }
  
    // short style summary (re-uses your helper)
    const summary = await buildUserStyleSummary(uid).catch(() => "");
  
    // optional “top signals” fallback if summary comes empty
    const likedItems = [];
    try {
      const likedSnap = await db
        .collection("liked_looks")
        .where("uid", "==", uid)
        .orderBy("liked_at", "desc")
        .limit(40)
        .get();
      likedSnap.docs.forEach((d) =>
        (d.data().outfit?.items || []).forEach((i) => likedItems.push(i)),
      );
    } catch {}
    const countBy = (arr, key) =>
      arr.reduce((acc, it) => {
        const k = (it?.[key] || "").toLowerCase();
        if (!k) return acc;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
    const top3 = (obj) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);
    const topColors = top3(countBy(likedItems, "color"));
    const topCats = top3(countBy(likedItems, "category"));
  
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
  
  function anchorIdOf(anchor = {}) {
    return String(
      anchor.id || anchor.wardrobe_id || anchor.idx || "anchor_uploaded",
    );
  }
  
  function candidateIncludesAnchor(items = [], anchor = {}) {
    const aid = anchorIdOf(anchor);
    return items.some((it) => {
      const id = String(it.id || it.wardrobe_id || it.idx || "");
      const sameId = id === aid;
      const sameUrl =
        !!anchor.image_url &&
        !!it.image_url &&
        normalizeUrlForMatch(anchor.image_url) ===
          normalizeUrlForMatch(it.image_url);
      const sameName =
        normalizeText(it.name || "") === normalizeText(anchor.name || "");
      return sameId || sameUrl || sameName;
    });
  }
  
  function mapLookItemsToStylePiecePieces(items = [], anchorHydrated = {}) {
    return items.map((it) => {
      const isAnchor =
        it.is_anchor ||
        it.source === "uploaded_item" ||
        String(it.id || it.wardrobe_id || it.idx || "") ===
          String(anchorHydrated.id || "");
  
      const slot = detectSlotFromItem(it);
  
      return {
        role: isAnchor ? "anchor" : slot,
        source: isAnchor ? "uploaded_item" : it.source || "wardrobe",
        idx: String(it.id || it.wardrobe_id || it.idx || ""),
        name: it.name || "Unnamed",
        category: it.category || "",
        color: Array.isArray(it.color) ? it.color[0] || "" : it.color || "",
        in_closet: it.in_closet !== false,
        color_options: colorToOptions(it.color || ""),
      };
    });
  }
  
  
  function hasConflictingSilhouette(items = []) {
    let topCount = 0;
    let bottomCount = 0;
    let onepieceCount = 0;
  
    for (const item of items) {
      const slot = detectSlotFromItem(item);
  
      if (slot === "top") topCount += 1;
      if (slot === "bottom") bottomCount += 1;
      if (slot === "onepiece") onepieceCount += 1;
    }
  
    if (topCount > 1) return true;
    if (bottomCount > 1) return true;
    if (onepieceCount > 1) return true;
  
    if (onepieceCount > 0 && topCount > 0) return true;
    if (onepieceCount > 0 && bottomCount > 0) return true;
  
    return false;
  }
  
  function getNonAnchorItems(items = []) {
    return (items || []).filter(
      (it) => !it?.is_anchor && it?.source !== "uploaded_item"
    );
  }
  
  function detectAnchorSlot(anchorItem) {
    return detectSlotFromItem(anchorItem);
  }
  
  function hasAnchorSlotConflict(items = [], anchorItem) {
    const anchorSlot = detectAnchorSlot(anchorItem);
    const otherSlots = getNonAnchorItems(items).map((it) =>
      detectSlotFromItem(it)
    );
  
    if (anchorSlot === "top") return otherSlots.includes("top");
    if (anchorSlot === "bottom") return otherSlots.includes("bottom");
    if (anchorSlot === "footwear") return otherSlots.includes("footwear");
    if (anchorSlot === "bag") return otherSlots.includes("bag");
    if (anchorSlot === "outer") return otherSlots.includes("outer");
  
    if (anchorSlot === "onepiece") {
      return otherSlots.some(
        (slot) => slot === "top" || slot === "bottom" || slot === "onepiece"
      );
    }
  
    return false;
  }
  
  function isClearlyFormalFriendly(item = {}, occasion = "") {
    const text = `${item.name || ""} ${item.category || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    const occ = String(occasion || "").toLowerCase();
  
    if (!/(workwear|formal|interview|office|business)/.test(occ)) return true;
  
    if (/sportswear|gym|athletic|running|training/.test(text)) return false;
    if (/skirt/.test(text)) return false;
    if (/sandal|flipflop|slide/.test(text)) return false;
    if (/beach|resort|party/.test(text)) return false;
  
    return true;
  }



async function buildTinaRequestContext({
  uid = "",
  occasion = "",
  vibe = "",
  city = "Delhi",
  explicitGender = "",
}) {
  let prefs = { gender: "", bodyShape: "", complexion: "", dislikes: [] };
  let learning = {
    colorHarmony: 0.5,
    silhouetteBalance: 0.5,
    trendAwareness: 0.3,
    wardrobeRotation: 0.4,
  };
  let tinaLevel = "Level 1 (Intern)";
  let likedCombos = [];
  let dislikedCombos = [];
  let styleSummary = "";
  let lastServedCombo = null;
  let microFeedback = [];
  let userFeedback = [];
  let fbSets = null;
  let rulesText = "";

  if (uid) {
    try {
      const userCtx = await getUserStyleContext(uid);

      microFeedback = userCtx.micro_feedback || [];
      userFeedback = Array.isArray(userCtx.feedbackMemory)
        ? userCtx.feedbackMemory
        : [];

      prefs = {
        gender: userCtx.gender,
        bodyShape: userCtx.bodyShape,
        complexion: userCtx.complexion,
        dislikes: userCtx.dislikes,
      };

      learning = {
        ...learning,
        ...(userCtx.learning_weights || {}),
      };

      likedCombos = userCtx.likedCombos || [];
      dislikedCombos = userCtx.dislikedCombos || [];
      styleSummary = userCtx.styleSummary || "";
      lastServedCombo = userCtx.last_served_combo || null;

      try {
        fbSets = await buildFeedbackMemory(db, uid);
      } catch (e) {
        console.warn("⚠️ buildFeedbackMemory failed:", e?.message || e);
        fbSets = null;
      }

      const vals = Object.values(learning);
      const avg = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : 0.4;

      if (avg < 0.4) tinaLevel = "Level 1 (Intern)";
      else if (avg < 0.7) tinaLevel = "Level 2 (Junior Stylist)";
      else tinaLevel = "Level 3 (Confident Stylist)";
    } catch (err) {
      console.warn("⚠️ Could not fetch Tina request context:", err.message);
    }
  }

  try {
    const rulesSnap = await db.collection("fashion_rules").get();
    let fashionRules = rulesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    fashionRules = fashionRules.filter((rule) => {
      if (
        prefs.complexion &&
        rule.rule_id?.includes?.(prefs.complexion.toLowerCase())
      ) {
        return true;
      }
      if (
        prefs.bodyShape &&
        rule.rule_id?.includes?.(prefs.bodyShape.toLowerCase())
      ) {
        return true;
      }
      if (rule.category === "general") return true;
      return false;
    });

    rulesText = fashionRules
      .map((r) => {
        const p = r.principle ? `• ${r.principle}` : "• Rule";
        const rule = r.rule ? ` — ${r.rule}` : "";
        const ex = r.example ? ` (ex: ${r.example})` : "";
        return `${p}${rule}${ex}`;
      })
      .join("\n");
  } catch (err) {
    console.warn("⚠️ Failed to fetch fashion rules:", err.message);
  }

  const effectiveGender = String(
    explicitGender || prefs.gender || "female"
  ).toLowerCase();

  const weather = await getWeather(city).catch(() => null);

  return {
    prefs,
    learning,
    tinaLevel,
    likedCombos,
    dislikedCombos,
    styleSummary,
    lastServedCombo,
    microFeedback,
    userFeedback,
    fbSets,
    rulesText,
    effectiveGender,
    weather,
  };
}

async function buildTinaWardrobePreview({
  uid = "",
  occasion = "",
  vibe = "",
  includeWardrobe = true,
  includeStaples = false,
  staplesVersion = "v2",
  effectiveGender = "female",
  anchorItem = null,
}) {
  
  let wardrobeItems = [];
  const tunnel = resolveStyleTunnel({
    occasion,
    vibe,
    gender: effectiveGender,
  });
  if (uid && includeWardrobe) {
    wardrobeItems = await fetchWardrobeForStyling(uid);
  }

  let stapleItems = [];
  if (includeStaples) {
    stapleItems = await fetchStaplesForStyling({
      gender: effectiveGender,
      version: staplesVersion,
    });
    stapleItems = filterStaplesForOccasion(stapleItems, occasion);
  }

  const combined = [
    ...(includeWardrobe ? wardrobeItems : []),
    ...(includeStaples ? stapleItems : []),
  ]
    .filter((it) => itemPassesTunnel(it, tunnel))
    .sort((a, b) => scoreItemForTunnel(b, tunnel) - scoreItemForTunnel(a, tunnel));

  const anchorId = anchorItem
    ? String(anchorItem.id || anchorItem.wardrobe_id || anchorItem.idx || "")
    : null;

  const deduped = anchorItem
    ? [
        anchorItem,
        ...combined.filter((it) => {
          const id = String(it.id || it.wardrobe_id || it.idx || "");
          return id !== anchorId;
        }),
      ]
    : combined;

  const wardrobePreview = compactItemsForPrompt(deduped, 100);

  return {
    wardrobeItems,
    stapleItems,
    wardrobePreview,
  };
}

function sanitizeTinaOutfitsPayload(parsed) {
  const rawOutfits = Array.isArray(parsed?.outfits)
    ? parsed.outfits
    : Array.isArray(parsed)
      ? parsed
      : [];

  const outfits = rawOutfits.map((o) => {
    const title =
      typeof o?.title === "string" && o.title.trim()
        ? o.title.trim()
        : "Untitled Look";

    const style_note =
      typeof o?.style_note === "string" ? o.style_note.trim() : "";

    const items = Array.isArray(o?.items) ? o.items : [];
    const cleanItems = items
      .map((it) =>
        it && typeof it.idx === "string" ? { idx: it.idx } : null
      )
      .filter(Boolean);

    return { title, style_note, items: cleanItems };
  });

  return { outfits };
}

async function runTinaStylist({
  uid = "",
  occasion = "",
  vibe = "",
  city = "Delhi",
  prompt = "",
  anchorItem = null,
  includeWardrobe = true,
  includeStaples = false,
  staplesVersion = "v2",
  explicitGender = "",
  lookCount = 3,
}) {
  const ctx = await buildTinaRequestContext({
    uid,
    occasion,
    vibe,
    city,
    explicitGender,
  });

  const {
    prefs,
    learning,
    tinaLevel,
    likedCombos,
    dislikedCombos,
    styleSummary,
    lastServedCombo,
    microFeedback,
    userFeedback,
    fbSets,
    rulesText,
    effectiveGender,
    weather,
  } = ctx;

  const { wardrobeItems, stapleItems, wardrobePreview } =
    await buildTinaWardrobePreview({
      uid,
      occasion,
      vibe,
      includeWardrobe,
      includeStaples,
      staplesVersion,
      effectiveGender,
      anchorItem,
    });

  const systemMsg = {
    role: "system",
    content: `You are Tina, a ${tinaLevel}.
You design outfits using only the items provided in wardrobe_preview (strictly by idx).

STRICT OUTPUT FORMAT:
- Respond with only valid JSON
- Top-level key must be "outfits"
- Return up to ${lookCount} outfits
- Each outfit:
  {
    "title": string,
    "style_note": string,
    "items": [{ "idx": string }, ...]
  }

GLOBAL RULES:
1) Use ONLY wardrobe_preview items.
2) Never invent items.
3) Titles and style_notes must match actual selected items.
4) Respect occasion, vibe, weather, dislikes, memory, combo history, and style_tunnel.
5) Avoid previously disliked combinations.
6) Prefer liked combo patterns when suitable.
7) Prefer coherent, wearable looks.
8) Treat style_tunnel as hard guidance for occasion fit.
9) Do not pick items that clearly violate the tunnel intent.

BASE STRUCTURE:
- Separates: Top + Bottom + Footwear + optional Bag/Outerwear/Accessory
- One-piece: Onepiece + Footwear + optional Bag/Outerwear/Accessory

ANCHOR RULES:
${
  anchorItem
    ? `- Anchor item is REQUIRED in every outfit.
- If anchor is top: support with bottom + footwear.
- If anchor is bottom: support with top + footwear.
- If anchor is onepiece: do not add separate top/bottom.
- If anchor is footwear: build full outfit around the shoes.
- If anchor is outer: ensure a coherent base underneath.
- If anchor is bag/accessory: choose a strong base outfit it elevates.`
    : `- No anchor item for this request.`
}

FASHION KNOWLEDGE BASE:
${rulesText || "• (No additional rules available)"}

Return only JSON.`,
  };

  const userPayload = {
    task: anchorItem
      ? `Generate ${lookCount} anchor-based outfits`
      : `Generate ${lookCount} polished outfits`,
    uid,
    occasion,
    vibe,
    prompt,
    city,
    weather,
    gender: effectiveGender,
    bodyShape: prefs.bodyShape,
    complexion: prefs.complexion,
    dislikes: prefs.dislikes,
    learning_weights: learning,
    feedback_memory_recent: userFeedback,
    feedback_memory_sets: fbSets
      ? {
          likedIds: Array.from(fbSets.likedIds || []),
          dislikedIds: Array.from(fbSets.dislikedIds || []),
          dislikedColors: Array.from(fbSets.dislikedColors || []),
          dislikedVibes: Array.from(fbSets.dislikedVibes || []),
          dislikedOccasions: Array.from(fbSets.dislikedOccasions || []),
        }
      : null,
    style_summary: styleSummary,
    micro_feedback: microFeedback,
    likedCombos,
    dislikedCombos,
    last_served_combo: lastServedCombo,
    wardrobe_preview: wardrobePreview,
    style_tunnel: resolveStyleTunnel({
      occasion,
      vibe,
      gender: effectiveGender,
    }),
    instructions: [
      "Return only JSON with top-level key 'outfits'.",
      "Reference items strictly by idx.",
      `Return up to ${lookCount} outfits.`,
    ],
  };

  if (anchorItem) {
    userPayload.anchor_item = {
      idx: String(anchorItem.idx || anchorItem.id || ""),
      name: anchorItem.name || "",
      category: anchorItem.category || "",
      color: Array.isArray(anchorItem.color)
        ? anchorItem.color[0] || ""
        : anchorItem.color || "",
      slot: detectSlotFromItem(anchorItem),
      source: anchorItem.source || "uploaded_item",
    };
  }

  const userMsg = {
    role: "user",
    content: JSON.stringify(userPayload, null, 2),
  };

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemMsg, userMsg],
    temperature: 0.2,
    response_format: { type: "json_object" },
    max_tokens: 1600,
  });

  const raw = resp.choices?.[0]?.message?.content || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("⚠️ runTinaStylist JSON parse failed:", err.message);
    parsed = { outfits: [] };
  }

  parsed = sanitizeTinaOutfitsPayload(parsed);

  const idx2item = Object.fromEntries(
    wardrobePreview.map((it) => [String(it.idx), it])
  );

  const anchorId = anchorItem
    ? String(anchorItem.idx || anchorItem.id || "")
    : null;

  let outfits = (parsed.outfits || [])
    .map((look, i) => {
      let items = (look.items || [])
        .map((ref) => idx2item[String(ref.idx || "")])
        .filter(Boolean);

      if (anchorItem) {
        const includesAnchor = items.some(
          (it) => String(it.idx || it.id || "") === anchorId
        );
        if (!includesAnchor) {
          items = [anchorItem, ...items];
        }
      }

      items = uniqueById(items);

      return {
        id: `look_${i + 1}`,
        title: look.title || `Look ${i + 1}`,
        style_note: look.style_note || "",
        items,
      };
    })
    .filter((look) => Array.isArray(look.items) && look.items.length > 0);

  if (!outfits.length && anchorItem) {
    outfits = [
      {
        id: "look_1",
        title: "Anchor Look 1",
        style_note: "Styled around your selected piece.",
        items: [anchorItem],
      },
    ];
  }

  return {
    outfits: outfits.slice(0, lookCount),
    debug: {
      wardrobePoolCount: wardrobeItems.length,
      staplesPoolCount: stapleItems.length,
      previewCount: wardrobePreview.length,
      effectiveGender,
      usedAnchor: !!anchorItem,
    },
  };
}

  // ✅ New pivot route: style one uploaded piece into 3 complete looks
app.post("/style-piece", limiterSuggestOutfit, async (req, res) => {
  try {
    const {
      uid,
      anchor_item,
      occasion = "",
      vibe = "",
      city = "Delhi",
      gender = "",
      staples_version = "v2",
    } = req.body || {};

    const includeWardrobe =
      req.body.include_wardrobe === undefined
        ? true
        : req.body.include_wardrobe === true;

    const includeStaples =
      req.body.include_staples === undefined
        ? true
        : req.body.include_staples === true;

    if (!includeWardrobe && !includeStaples) {
      return res.status(400).json({
        success: false,
        error:
          "No styling sources enabled. Set include_wardrobe or include_staples to true.",
      });
    }

    if (!anchor_item || !anchor_item.name) {
      return res.status(400).json({
        success: false,
        error: "anchor_item is required and must include at least name",
      });
    }

    const normalizedCategory = normalizeCategory(
      anchor_item.category || "",
      anchor_item.name || "",
    );

    const anchorHydrated = {
      ...hydrateWardrobeItem({
        uid: uid || "style-piece",
        name: anchor_item.name || "Uploaded item",
        primaryTag: anchor_item.name || "Uploaded item",
        category: normalizedCategory,
        color: anchor_item.color || "",
        image_url: anchor_item.image_url || "",
        tags: Array.isArray(anchor_item.tags) ? anchor_item.tags : [],
        taxonomyPath: mapTaxonomy(normalizedCategory),
        silhouette:
          anchor_item.silhouette ||
          guessSilhouette(`${anchor_item.name || ""} ${normalizedCategory}`),
        palette: anchor_item.palette || pickPalette(anchor_item.color || ""),
      }),
      id: anchorIdOf(anchor_item),
      wardrobe_id: anchorIdOf(anchor_item),
      idx: anchorIdOf(anchor_item),
      source: "uploaded_item",
      in_closet: true,
      is_anchor: true,
    };

    const result = await runTinaStylist({
      uid,
      occasion,
      vibe,
      city,
      anchorItem: anchorHydrated,
      includeWardrobe,
      includeStaples,
      staplesVersion: staples_version,
      explicitGender: gender,
      lookCount: 3,
    });

    const outfits = (result.outfits || []).map((look) => ({
      id: look.id,
      title: look.title,
      direction: "anchor_styled",
      occasion_fit: occasion || "Styled for your context",
      why_it_works: look.style_note || "Styled around your selected piece.",
      pieces: mapLookItemsToStylePiecePieces(look.items || [], anchorHydrated),
      styling_tips: [],
    }));

    return res.json({
      success: true,
      flow: "style-piece-shared-brain",
      anchor_item: {
        name: anchorHydrated.name,
        category: anchorHydrated.category,
        color: anchorHydrated.color,
        image_url: anchorHydrated.image_url || "",
        slot: detectSlotFromItem(anchorHydrated),
      },
      context: {
        occasion,
        vibe,
        city,
        gender: gender || "",
      },
      outfits,
      debug: {
        includeWardrobe,
        includeStaples,
        styleTunnel: resolveStyleTunnel({
          occasion,
          vibe,
          gender: gender || "",
        }),
        ...(result.debug || {}),
        routeVersion: "style_piece_shared_brain_v2",
      },
    });
  } catch (err) {
    console.error("❌ /style-piece failed:", err);
    return res.status(500).json({
      success: false,
      error: "style-piece failed",
      message: err?.message || String(err),
    });
  }
});

function resolveStyleTunnel({ occasion = "", vibe = "", gender = "" }) {
  const occ = String(occasion || "").toLowerCase();
  const vb = String(vibe || "").toLowerCase();
  const g = String(gender || "").toLowerCase();

  const base = {
    mode: "general",
    allowSlots: ["top", "bottom", "onepiece", "outer", "footwear", "bag", "accessory"],
    rejectTerms: [],
    preferTerms: [],
    avoidTerms: [],
    preferNeutralFootwear: false,
    preferStructured: false,
  };

  if (/(workwear|formal|office|interview|business)/.test(occ)) {
    return {
      ...base,
      mode: "formalish",
      rejectTerms: [
        "gym",
        "sportswear",
        "athletic",
        "running",
        "training",
        "track",
        "jogger",
        "flipflop",
        "beach",
        "resort",
      ],
      avoidTerms: [
        "bucket bag",
        "trainer",
        "sneaker",
        "shorts",
        "mini skirt",
      ],
      preferTerms: [
        "trouser",
        "pants",
        "slacks",
        "shirt",
        "blouse",
        "blazer",
        "structured jacket",
        "loafer",
        "pump",
        "heel",
        "dress",
      ],
      preferNeutralFootwear: true,
      preferStructured: true,
    };
  }

  if (/(date|dinner|cocktail|night out)/.test(occ)) {
    return {
      ...base,
      mode: "elevated",
      rejectTerms: ["gym", "training", "track"],
      avoidTerms: ["bucket bag"],
      preferTerms: ["boot", "heel", "dress", "sleek", "structured"],
      preferStructured: true,
    };
  }

  if (/(travel|airport)/.test(occ)) {
    return {
      ...base,
      mode: "comfort_smart",
      rejectTerms: [],
      avoidTerms: ["heel", "bodycon"],
      preferTerms: ["sneaker", "boot", "relaxed", "layer"],
      preferNeutralFootwear: true,
    };
  }

  if (/(gym|workout|fitness)/.test(occ)) {
    return {
      ...base,
      mode: "athletic",
      rejectTerms: ["heel", "loafer", "blazer", "dress", "saree"],
      avoidTerms: [],
      preferTerms: ["gym", "athletic", "training", "running", "track"],
      preferNeutralFootwear: false,
      preferStructured: false,
    };
  }

  if (/(festive|wedding|ethnic)/.test(occ)) {
    return {
      ...base,
      mode: "festive",
      rejectTerms: ["gym", "athletic", "training"],
      avoidTerms: ["running shoe", "trainer"],
      preferTerms:
        g === "male"
          ? ["kurta", "bandhgala", "sherwani", "loafer", "jutti", "waistcoat"]
          : ["dress", "saree", "lehenga", "anarkali", "heel", "jutti", "clutch"],
      preferStructured: true,
    };
  }

  if (/(casual|brunch|day out|shopping|errand)/.test(occ) || /(relaxed|smart casual)/.test(vb)) {
    return {
      ...base,
      mode: "casual",
      rejectTerms: ["gym", "training"],
      avoidTerms: [],
      preferTerms: ["jeans", "top", "shirt", "sneaker", "bag"],
    };
  }

  return base;
}

function itemPassesTunnel(item = {}, tunnel = {}) {
  const text =
    `${item.name || ""} ${item.category || ""} ${(item.tags || []).join(" ")}`
      .toLowerCase();

  const slot = detectSlotFromItem(item);
  if (Array.isArray(tunnel.allowSlots) && !tunnel.allowSlots.includes(slot)) {
    return false;
  }

  if ((tunnel.rejectTerms || []).some((term) => text.includes(term))) {
    return false;
  }

  return true;
}

function scoreItemForTunnel(item = {}, tunnel = {}) {
  const text =
    `${item.name || ""} ${item.category || ""} ${(item.tags || []).join(" ")}`
      .toLowerCase();

  let score = 0;

  if ((tunnel.preferTerms || []).some((term) => text.includes(term))) score += 3;
  if ((tunnel.avoidTerms || []).some((term) => text.includes(term))) score -= 2;

  if (item.in_closet) score += 1;
  if (isNeutralColor(item.color)) score += 0.5;

  if (tunnel.preferStructured && /structured|blazer|coat|shirt|trouser|slacks|loafer|pump/.test(text)) {
    score += 1.5;
  }

  if (tunnel.preferNeutralFootwear) {
    const slot = detectSlotFromItem(item);
    if (slot === "footwear" && isNeutralColor(item.color)) score += 1.5;
  }

  return score;
}
app.post("/suggest-outfit", limiterSuggestOutfit, async (req, res) => {
  try {
    const {
      uid,
      occasion = "",
      vibe = "",
      city = "Delhi",
      prompt = "",
    } = req.body || {};

    if (!uid) {
      return res.status(400).json({ error: "uid is required" });
    }

    const result = await runTinaStylist({
      uid,
      occasion,
      vibe,
      city,
      prompt,
      anchorItem: null,
      includeWardrobe: true,
      includeStaples: false,
      staplesVersion: "v2",
      explicitGender: "",
      lookCount: 3,
    });

    const looksArr = (result.outfits || []).map((look) => ({
      title: look.title,
      style_note: look.style_note || "",
      items: look.items || [],
      validation: {},
    }));

    return res.json({
      outfits: looksArr,
      looks: looksArr,
      note: "tina_shared_brain_v1",
      debug: result.debug || {},
    });
  } catch (err) {
    console.error("❌ /suggest-outfit error:", err);
    return res.status(500).json({
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
        event_type, // "like" | "dislike"
        outfit, // { items: [...] }  ← REQUIRED
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
        event_type === "like" ? true : event_type === "dislike" ? false : null;
  
      if (liked === null) {
        return res
          .status(400)
          .json({ error: "event_type must be like or dislike" });
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
          items: outfit.items.map((it) => ({
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
        combo, // ✅ store fingerprint
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
            {
              micro_feedback: microHints,
              updated_at: new Date().toISOString(),
            },
            { merge: true },
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
      return res
        .status(400)
        .json({ success: false, error: "uid, date, and outfit are required" });
    }
  
    try {
      const docId = `${uid}_${date}`;
      const planRef = db.collection("outfit_plans").doc(docId);
  
      const payload = { uid, date, outfit, updated_at: new Date().toISOString() };
      await planRef.set(payload, { merge: true });
  
      return res.status(200).json({
        success: true,
        message: "Outfit plan saved successfully",
        ...payload,
      });
    } catch (err) {
      console.error("❌ Failed to save outfit plan:", err.message);
      return res
        .status(500)
        .json({ success: false, error: "Failed to save outfit plan" });
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
      await db.collection("tina_memory").doc(uid).set(
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
  
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
      const filtered = all.filter((t) => {
        const k = String(t.keyword || "").toLowerCase();
        const vibes = Array.isArray(t.vibes)
          ? t.vibes.map((v) => String(v).toLowerCase())
          : [];
        const occs = Array.isArray(t.occasion)
          ? t.occasion.map((o) => String(o).toLowerCase())
          : [];
        return (
          q === "general" ||
          k.includes(q) ||
          vibes.some((v) => v.includes(q)) ||
          occs.some((o) => o.includes(q))
        );
      });
  
      const ranked = (filtered.length ? filtered : all)
        .sort((a, b) => Number(b.score ?? 0.5) - Number(a.score ?? 0.5))
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
      build: "tina-core-anchor-fix-v4",
      entry: "index.js",
      time: new Date().toISOString(),
    });
  });
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
  