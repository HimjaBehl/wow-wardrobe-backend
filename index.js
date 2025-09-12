import sharp from "sharp";
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


import dotenv from "dotenv";
dotenv.config();



import { validateLook } from "./lib/fashionBrain.js";
import express from "express";
import getTrendInsights from "./tools/getTrendInsights.js";


import { validateLookAgainstRules } from "./lib/styleRules.js";
// 🔮 Load fashion taxonomy
import { taxonomy, findCategory, getAttributes } from "./lib/taxonomyUtils.js";
import { themeAttributes } from "./lib/themeAttributes.js";
console.log("✅ Loaded fashion taxonomy with top categories:", Object.keys(taxonomy));





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

console.log('Loaded fashionTags =>', fashionTags);


import { styleMoodMap } from "./styleMoodMap.js";

console.log("💡 Available moods:", Object.keys(styleMoodMap));


import cors from "cors";
import axios from "axios";
import path from "path";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB
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
      }
    );

    const objects = tagRes.data?.records?.[0]?._objects || [];
    console.log(`📦 Detected ${objects.length} objects in image`);

    const detected = await Promise.all(objects.map(async (obj, index) => {
      const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];
      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) =>
              typeof tag === "string"
                ? tag.toUpperCase().replace(/^.*\//, "")
                : null
            )
            .filter(Boolean)
        )
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
          const cropResult = await cropAndSaveObject(cleanedUrl, obj._box, `${name}_${index}`);
          if (cropResult.success) {
            croppedImageUrl = cropResult.image_url;
            croppedImagePath = cropResult.image_path;
            console.log(`✅ Cropped image saved: ${croppedImageUrl}`);
          }
        } catch (cropErr) {
          console.warn(`⚠️ Cropping failed for object ${index + 1}:`, cropErr.message);
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
    }));

    console.log(`✅ Auto-tag completed: ${detected.length} items processed`);
    return { 
      detected, 
      image_url: cleanedUrl, 
      image_path: cleanedPath,
      message: `Successfully detected ${detected.length} item(s)`
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
      responseType: 'arraybuffer' 
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
        height: Math.round(height)
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
      image_path: croppedPath
    };

  } catch (error) {
    console.error("❌ Crop operation failed:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}




// ─── WEATHER HELPER ─────────────────────────────────────────────
const OPENWEATHER_URL =
  "https://api.openweathermap.org/data/2.5/weather?units=metric";

async function getWeather(city = "Delhi") {
  try {
    const url = `${OPENWEATHER_URL}&q=${encodeURIComponent(
      city
    )}&appid=${process.env.OPENWEATHER_API_KEY}`;

    const { data } = await axios.get(url);
    // e.g. "light rain", 31 → "Light rain, 31 °C"
    return `${data.weather?.[0]?.description || "clear sky"}, ${Math.round(
      data.main.temp
    )}°C`;
  } catch (err) {
    console.warn("⚠️ Weather fetch failed:", err.message);
    return null; // silently continue without weather
  }
}
// ────────────────────────────────────────────────────────────────

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const app = express(); // 👈 this was missing
// manual CORS headers (no extra packages)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow any origin
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

console.log("🔑 XIMILAR_API_KEY loaded:", !!process.env.XIMILAR_API_KEY);
console.log("🧠 OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);
// 👉 Safe lowercase helper used everywhere
function safeLower(txt) {
  return typeof txt === "string" ? txt.toLowerCase() : "";
}

function isColorGoodForSkinTone(color = "", skinTone = "") {
  const warmTones = ["olive", "mustard", "rust", "coral", "maroon", "gold", "peach", "warm beige"];
  const coolTones = ["icy blue", "lavender", "mint", "grey", "neon green", "silver", "lilac"];

  const clr = safeLower(color);
  const tone = safeLower(skinTone);

  if (!clr || !tone) return true; // no filtering

  if (tone.includes("warm")) {
    return !coolTones.some((ct) => clr.includes(ct));
  }

  if (tone.includes("cool")) {
    return !warmTones.some((wt) => clr.includes(wt));
  }

  return true; // neutral or unknown tone
}





app.use(cors());
app.use(express.json({ limit: "2mb" })); // keep your existing call, or replace with this

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    node: process.version,
    env: process.env.NODE_ENV || "dev",
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  });
});

console.log("🔑 REMOVE_BG_API_KEY =", process.env.REMOVE_BG_API_KEY);

// ✅ Quick Add Staples - Fixed syntax
// This endpoint is handled by the working staples endpoint below

// ✅ Search Product via SerpAPI
// ✅ Search Product via SerpAPI (normalized for frontend)
app.post("/search-product", async (req, res) => {
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

    // 🔹 Normalize into "products" list
    const products =
      serpRes.data.images_results?.slice(0, 6).map((img) => ({
        name: img.title || "Unnamed Product",
        image_url: img.original || img.thumbnail,
        thumbnail: img.thumbnail,
        category: "Search", // fallback
        color: "Unknown",   // fallback
        source: img.link || null,
      })) || [];

    res.json({ success: true, products });
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

// ✅ Auto-tagging
app.post("/auto-tag", async (req, res) => {
  const { image_url } = req.body || {};
  if (!image_url) return res.status(400).json({ error: "Image URL required" });
  try {
    const result = await autoTagFromImageUrl(image_url);
    return res.json(result);


  } catch (err) {
    console.error("🔥 /auto-tag error:", err);
    res.status(500).json({ error: "Auto-tagging failed", message: err.message });
  }
});

// Accepts multipart/form-data with field name: "file"
app.post("/auto-tag-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field must be 'file')." });
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


// ✅ Fetch wardrobe by user ID
app.get("/wardrobe", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "UID is required" });

  try {
    const snapshot = await db.collection("wardrobe").where("uid", "==", uid).get();

    console.log("📦 Docs found:", snapshot.size);
    snapshot.forEach((doc) => {
      console.log("➡️ Doc:", doc.id, doc.data());
    });

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (err) {
    console.error("❌ Fetch wardrobe error:", err.message);
    res.status(500).json({ error: "Failed to fetch wardrobe", message: err.message });
  }
});



// ✅ Get Staples - Load directly from Firebase Storage
app.get("/staples", async (req, res) => {
  try {
    console.log("📋 Fetching wardrobe staples from Firebase");

    // List all files inside the "staples/" folder in Firebase
    const [files] = await bucket.getFiles({ prefix: "staples/" });

    if (!files.length) {
      return res.json({ success: true, staples: {}, message: "No staples found" });
    }

    const staples = {};

    for (const file of files) {
      const fileName = file.name.split("/").pop(); // e.g. tshirt_white.jpg
      if (!fileName) continue;

      const [base, color] = fileName.replace(/\.[^/.]+$/, "").split("_"); // "tshirt_white" → ["tshirt","white"]
      const prettyName = base.charAt(0).toUpperCase() + base.slice(1);
      const prettyColor = color ? color.charAt(0).toUpperCase() + color.slice(1) : "Default";

      // Public URL
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

      if (!staples[prettyName]) {
        staples[prettyName] = { category: prettyName, variants: [] };
      }

      staples[prettyName].variants.push({
        color: prettyColor,
        image_url: url
      });
    }

    console.log(`✅ Found staples:`, Object.keys(staples));
    res.json({ success: true, staples });
  } catch (err) {
    console.error("❌ Failed to fetch staples:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ Enhanced Quick Add - Manual item entry with optional image
app.post("/quick-add", async (req, res) => {
  const { uid, name, category, color, image_url } = req.body;
  
  console.log("⚡ Quick-add request:", { uid, name, category, color, has_image: !!image_url });
  
  if (!uid || !name) {
    return res.status(400).json({
      success: false,
      message: "UID and name are required"
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
    const capitalizedCategory = capitalizeWords(category || "");
    const capitalizedColor = capitalizeWords(color || "");

    // Create tags array with name, color, and category
    const tags = [capitalizedName, capitalizedColor, capitalizedCategory].filter(Boolean);

    // Create wardrobe item with simplified structure for quick-add
    const itemData = {
      uid,
      name: capitalizedName,
      category: capitalizedCategory,
      color: capitalizedColor,
      image_url: image_url || null,
      tags,
      created_at: new Date().toISOString(),
    };

    const docRef = await db.collection("wardrobe").add(itemData);

    console.log("✅ Quick-add item saved:", docRef.id);

    return res.json({
      success: true,
      item: {
        id: docRef.id,
        ...itemData
      },
      message: "Item added successfully to wardrobe"
    });

  } catch (err) {
    console.error("❌ Quick-add failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to add item to wardrobe",
      error: err.message
    });
  }
});




    // ✅ Add wardrobe item
    app.post("/wardrobe", async (req, res) => {
      try {
        const { uid, image_path, image_url, name, category, color, tags } = req.body;

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

        const docRef = await db.collection("wardrobe").add({
          uid,
          image_path,
          image_url,
          name: capitalizedName,
          category: capitalizedCategory,
          color: capitalizedColor,
          tags: capitalizedTags,
          primaryTag,
          fabric,
          taxonomyPath: taxonomyMatch
            ? `${taxonomyMatch.mainCategory}/${taxonomyMatch.subCategory}`
            : null,
          attributes: taxonomyAttributes,
          created_at: new Date().toISOString(),
        });

        res.status(200).json({ message: "Item added", id: docRef.id });
      } catch (err) {
        console.error("❌ Error adding item:", err.message);
        res.status(500).json({ error: "Failed to save wardrobe item" });
      }
    });

// ✅ Delete wardrobe item
app.delete("/wardrobe/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Item ID is required" });

  try {
    await db.collection("wardrobe").doc(id).delete();
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting item:", err.message);
    res.status(500).json({ error: "Failed to delete wardrobe item" });
  }
});

// ✅ Update wardrobe item
app.put("/wardrobe/:id", async (req, res) => {
  const { id } = req.params;
  const { uid, name, category, color, tags } = req.body;
  
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
      return res.status(403).json({ error: "Not authorized to update this item" });
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
      const capitalizedTags = Array.isArray(tags) ? tags.map(capitalizeWords) : [];
      updateData.tags = capitalizedTags;
      
      // Update fabric if tags include known fabrics
      const knownFabrics = [
        "Cotton", "Linen", "Denim", "Silk", "Wool", 
        "Nylon", "Polyester", "Chiffon",
      ];
      const fabric = capitalizedTags.find((tag) => knownFabrics.includes(tag)) || itemData.fabric || "Unknown";
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

    await docRef.update(updateData);
    res.status(200).json({ message: "Item updated", id });
  } catch (err) {
    console.error("❌ Error updating item:", err.message);
    res.status(500).json({ error: "Failed to update wardrobe item" });
  }
});

// ✅ Bulk delete wardrobe items
app.post("/wardrobe/bulk-delete", async (req, res) => {
  const { uid, ids } = req.body;
  
  if (!uid) return res.status(400).json({ error: "UID is required" });
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "IDs array is required and must not be empty" });
  }

  try {
    // Verify all items belong to the user before deleting any
    const itemRefs = ids.map(id => db.collection("wardrobe").doc(id));
    const itemDocs = await Promise.all(itemRefs.map(ref => ref.get()));
    
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
        invalidItems 
      });
    }

    // Delete all valid items in a batch
    const batch = db.batch();
    validRefs.forEach(ref => batch.delete(ref));
    await batch.commit();

    res.status(200).json({ 
      message: "Bulk delete complete", 
      count: validRefs.length 
    });
  } catch (err) {
    console.error("❌ Error bulk deleting items:", err.message);
    res.status(500).json({ error: "Failed to bulk delete wardrobe items" });
  }
});

// ✅ Get outfit plan for a given user and date
app.get("/plan-outfit", async (req, res) => {
  const { uid, date } = req.query;
  if (!uid || !date) {
    return res.status(400).json({ error: "uid and date are required" });
  }

  try {
    const docRef = db.collection("outfit_plans").doc(uid + "_" + date);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      res.json(docSnap.data());
    } else {
      res.status(404).json({ message: "No outfit plan found for this date." });
    }
  } catch (err) {
    console.error("❌ Failed to fetch outfit plan:", err.message);
    res.status(500).json({ error: "Failed to fetch outfit plan" });
  }
});


// ─── User preference summariser ─────────────────────────────
function buildUserStyleSummary(uid, max = 10) {
  return db.collection("liked_looks")
    .where("uid", "==", uid)
    .orderBy("liked_at", "desc")
    .limit(max)
    .get()
    .then(snap => {
      const items = snap.docs
        .flatMap(d => (d.data().outfit?.items || []));

      if (!items.length) return "";

      const counts = (prop) => items.reduce((acc, it) => {
        const key = (it[prop] || "").toLowerCase();
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const top = (obj) => Object.entries(obj)
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

// ✅ Pinterest Analysis via Official API
app.post("/pinterest-analysis", async (req, res) => {
  try {
    const { uid, theme, weather = "mild", city = "Delhi" } = req.body;

    if (!uid || !theme) {
      return res.status(400).json({ error: "uid and theme are required" });
    }

    // 1️⃣ Fetch wardrobe from Firestore
    const snapshot = await db.collection("wardrobe").where("uid", "==", uid).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "Wardrobe is empty" });
    }
    const wardrobeItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2️⃣ Build Pinterest search query
    const searchQuery = `${theme} ${weather} outfits`;

    // 3️⃣ Call Pinterest API (Pins search endpoint)
    const pinterestRes = await axios.get(
      `https://api.pinterest.com/v5/search/pins`,
      {
        params: { query: searchQuery, page_size: 5 },
        headers: { Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN}` }
      }
    );

    const pins = pinterestRes.data?.items || [];
    const imageUrls = pins.map(pin => pin.media.images.originals.url);

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
                  text: `Analyze these "${theme}" outfit images for ${weather} weather. Extract key styling elements:

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
          visionResponse.choices?.[0]?.message?.content || "No analysis available";
      } catch (err) {
        console.error("❌ GPT Vision failed:", err.message);
      }
    }

    // 5️⃣ Build outfits using wardrobe
    const outfits = [
      {
        title: `${theme} Inspired Look 1`,
        style_note: `Based on Pinterest trends and your wardrobe for ${weather} weather.`,
        items: wardrobeItems.slice(0, 3),
        pinterest_inspiration: pinterestAnalysis,
        weather_suitability: weather,
      },
      {
        title: `${theme} Inspired Look 2`,
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
    res.status(500).json({ error: "Pinterest analysis failed", details: err.message });
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


// ─── Updated /suggest-outfit route: tool-calling agent loop ─────────────────
app.post("/suggest-outfit", async (req, res) => {
  console.log("HIT /suggest-outfit (agent) ", { ts: new Date().toISOString() });

  const { uid, occasion = "", vibe = "", city = "Delhi", prompt = "" } = req.body || {};
  console.log("🟢 /suggest-outfit received UID:", uid);

  if (!uid) return res.status(400).json({ error: "uid is required" });

  


  // Prefetch user preferences & a basic wardrobe snapshot (we still expose function to fetch full)
  const prefs = await getUserMemory(uid).catch(() => ({}));

    try {
      // 🔥 fetch wardrobe snapshot FIRST
      const snap = await db.collection("wardrobe").where("uid", "==", uid).get();

      console.log("👕 Fetch wardrobe for UID:", uid);
      console.log("📦 Wardrobe size (snapshot):", snap.size);

      snap.forEach((doc) => {
        console.log("➡️ Wardrobe item:", doc.id, doc.data().name, "uid=", doc.data().uid);
      });

      if (snap.empty) {
        console.warn("⚠️ Wardrobe empty, returning test items");
        return res.json({
          looks: [
            { title: "Debug Look", style_note: "No wardrobe but forced", items: [] }
          ]
        });
      }


    let rawWardrobe = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Prefilter based on dislikes (so Tina never sees banned items unless she explicitly asked for full)
    if (prefs?.dislikes?.length) {
      const bans = prefs.dislikes.map(b => b.toLowerCase());
      rawWardrobe = rawWardrobe.filter(it => {
        const n = (it.name || "").toLowerCase();
        const c = (it.category || "").toLowerCase();
        const col = (it.color || "").toLowerCase();
        return !bans.some(b => n.includes(b) || c.includes(b) || col.includes(b));
      });
    }

    // Small helper to map wardrobe to compact sample (idx strings)
      function buildSampleFromList(list = [], max = 50) {
        return list.slice(0, max).map((it, idx) => {
          const rawName = it.name || "";
          const rawCategory = it.category || "";

          // 🔑 Normalize category into stylist-friendly buckets
          let cleanCategory = rawCategory.replace(/^Clothing\//i, ""); // e.g. Clothing/Upper → Upper
          const lcCat = cleanCategory.toLowerCase();

          if (lcCat.includes("upper") || lcCat.includes("top") || lcCat.includes("shirt") || lcCat.includes("blouse")) {
            cleanCategory = "Top";
          } else if (lcCat.includes("lower") || lcCat.includes("pants") || lcCat.includes("trouser") || lcCat.includes("skirt") || lcCat.includes("jeans")) {
            cleanCategory = "Bottom";
          } else if (lcCat.includes("dress") || lcCat.includes("jumpsuit") || lcCat.includes("overall")) {
            cleanCategory = "Dress";
          } else if (lcCat.includes("shoe") || lcCat.includes("boot") || lcCat.includes("sandal") || lcCat.includes("heel")) {
            cleanCategory = "Footwear";
          } else if (lcCat === "search" || lcCat.includes("bag") || lcCat.includes("accessor")) {
            cleanCategory = "Accessory";
          } else {
            cleanCategory = "Misc";
          }

          // Normalize name → avoid “Clothing/Upper” type junk
          let cleanName = rawName;
          if (/clothing\/upper/i.test(cleanName)) cleanName = "Top";
          if (/clothing\/lower/i.test(cleanName)) cleanName = "Bottom";
          if (/clothing\/dresses?/i.test(cleanName)) cleanName = "Dress";

          const silhouetteGuess = it.silhouette || guessSilhouette(cleanName + " " + cleanCategory);
          const paletteGuess = it.palette || pickPalette(it.color || "");

          const sample = {
            idx: String(idx),
            id: it.id,
            name: cleanName || "Unnamed",
            category: cleanCategory,
            color: it.color || "Unknown",
            taxonomyPath: it.taxonomyPath || "",
            attributes: it.attributes || {},
            fabric: it.fabric || "Unknown",
            silhouette: silhouetteGuess,
            palette: paletteGuess,
            image_url: it.image_url || "",
          };

          console.log("🧵 Hydrated wardrobe item:", sample);
          return sample;
        });
      }





    // Server-side tool implementations
    async function fn_getWeather({ city: ct }) {
      const weather = await getWeather(ct || city).catch(() => null);
      return { city: ct || city, weather: weather || "unknown" };
    }

    async function fn_getWardrobe({ uid: toolUid, max = 50, include_raw = false }) {
      // If tool asked for explicit uid or raw set, obey; otherwise use the prefetched filtered rawWardrobe
      const targetUid = toolUid || uid;
      if (include_raw) {
        // fetch full raw (no prefilter)
        const fullSnap = await db.collection("wardrobe").where("uid", "==", targetUid).get();
        const fullList = fullSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { items: buildSampleFromList(fullList, max), count: fullList.length };
      }
      return { items: buildSampleFromList(rawWardrobe, max), count: rawWardrobe.length };
    }

    async function fn_getTrends({ query = vibe || "general", source = "pinterest", limit = 5 }) {
      try {
        // getTrendInsights is a tool you already imported. If it expects args adjust accordingly.
        const trends = await getTrendInsights({ query, source, limit }).catch(e => null);
        // normalize response
        return { query, source, trends: trends || [] };
      } catch (err) {
        return { query, source, trends: [] };
      }
    }

    async function fn_validateLook({ items = [], weather: w = city }) {
      try {
        // hydrate minimal structure for validate functions
        const hydrated = items.map(it => ({
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
        const styleRulesResult = validateLookAgainstRules({ items: hydrated }, { bannedItems: (prefs?.dislikes || []), weather: w });
        return { fashionBrainResult, styleRulesResult };
      } catch (err) {
        return { error: err?.message || String(err) };
      }
    }

    // function definitions passed to the model (JSON Schema)
    const functions = [
      {
        name: "get_weather",
        description: "Return weather string for a city (used to decide fabrics & layers).",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name (e.g., Delhi)" }
          },
          required: []
        }
      },
      {
        name: "get_wardrobe",
        description: "Return user's wardrobe items. Use idx strings for items.",
        parameters: {
          type: "object",
          properties: {
            uid: { type: "string" },
            max: { type: "number" },
            include_raw: { type: "boolean", description: "If true, fetch full unfiltered wardrobe" }
          },
          required: []
        }
      },
      {
        name: "get_trends",
        description: "Fetch trend inspiration or palette hints for a given query/vibe.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            source: { type: "string" },
            limit: { type: "number" }
          },
          required: []
        }
      },
      {
        name: "validate_look",
        description: "Validate a proposed look (array of items) against style rules and return the structured validation.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { type: "object" }
            },
            weather: { type: "string" }
          },
          required: ["items"]
        }
      }
    ];

    // Build initial messages: system + user with context
    const moodHints = styleMoodMap[vibe?.toLowerCase()] || [];
      const systemMsg = {
        role: "system",
        content:
          "You are Tina, an autonomous AI stylist. You can call tools to get wardrobe, weather, trends or validate your drafts. " +
          "Your ONLY valid way to reference clothing is via the wardrobe idx values returned by get_wardrobe. " +
          "STRICT RULE: Every outfit must use idx values only (example: {\"idx\":\"0\"}). " +
          "If you cannot find enough items, still output idx for whatever exists and explain the limitation in style_note. " +
          "Never return empty items arrays."
      };


    const userMsg = {
      role: "user",
      content: JSON.stringify({
        task: "Generate 2 polished outfits",
        uid,
        occasion,
        vibe,
        vibe_hints: moodHints,
        weather_hint: city,
        prefs,
        instructions: [
          "You MUST ONLY use wardrobe items provided by the get_wardrobe tool.",
          "Every outfit item MUST be referenced by its `idx` string. Example: { \"idx\": \"0\" }",
          "Do NOT output item names, categories, or ids directly — only use idx.",
          "Valid outfit structure: (Top + Bottom + Footwear) OR (Dress/Jumpsuit + Footwear).",
          "Each outfit must have 3–5 items, complete, no missing pieces.",
          "If the wardrobe is too small, still output JSON with looks but explain in style_note."
        ],

        response_format: {
          type: "json",
          schema: {
            looks: [
              {
                title: "string",
                style_note: "string",
                items: [{ idx: "string" }]
              }
            ]
          }
        }
      }, null, 2)
    };

    // Initialize message stream
    const messages = [systemMsg, userMsg];

    // Agent loop: model may ask to call a function; execute and feed result back. Limit iterations.
    let finalAssistantContent = null;
    const maxRounds = 4;
    for (let round = 0; round < maxRounds; round++) {
      console.log(`🧭 Agent loop round ${round + 1}`);

      const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
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
          temperature: 0.25,
          max_tokens: 1000,
        }),
      });

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

    // Try to parse the final assistant content as JSON (strict)
    let parsed;
    if (!finalAssistantContent) {
      console.warn("⚠️ Agent returned nothing. Using fallback simple looks.");
      // fallback simple looks using first items
      const fallbackItems = buildSampleFromList(rawWardrobe, 10);
      parsed = {
        looks: [
          { title: "Fallback Look 1", style_note: "Auto fallback: insufficient agent output", items: fallbackItems.slice(0, 3).map(it => ({ idx: it.idx })) },
          { title: "Fallback Look 2", style_note: "Auto fallback", items: fallbackItems.slice(3, 6).map(it => ({ idx: it.idx })) }
        ],
        note: "Agent did not produce final JSON, fallback applied."
      };
    } else {
      try {
        parsed = JSON.parse(finalAssistantContent);
      } catch (err) {
        // attempt to extract JSON object substring
        const jsonMatch = finalAssistantContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            parsed = null;
          }
        } else {
          parsed = null;
        }
      }

      if (!parsed) {
        console.warn("⚠️ Could not parse assistant JSON. Returning fallback.");
        const fallbackItems = buildSampleFromList(rawWardrobe, 10);
        parsed = {
          looks: [
            { title: "Fallback Look 1", style_note: "Fallback because parsing failed", items: fallbackItems.slice(0, 3).map(it => ({ idx: it.idx })) },
            { title: "Fallback Look 2", style_note: "Fallback because parsing failed", items: fallbackItems.slice(3, 6).map(it => ({ idx: it.idx })) }
          ],
          note: "Fallback: Tina's response couldn't be parsed as JSON."
        };
      }
    }

    // Hydrate parsed.looks items into full item objects using the available wardrobe (prefer filtered rawWardrobe)
    const idx2item = Object.fromEntries(
      buildSampleFromList(rawWardrobe, 100).map((it) => [String(it.idx), it])
    );

      parsed.looks = (parsed.looks || []).map((look, i) => {
        // 🛑 Fallback: if Tina gave no items, inject random sample
        if (!look.items || look.items.length === 0) {
          console.warn(`⚠️ Look ${i+1} had no items, applying fallback.`);
          const fallbackItems = buildSampleFromList(rawWardrobe, 3);
          look.items = fallbackItems.map(it => ({ idx: it.idx }));
          look.style_note = (look.style_note || "") + " | Fallback items auto-inserted.";
        }

        const hydrated = (look.items || []).map((it) => {
          if (it.idx && idx2item[it.idx]) return { ...idx2item[it.idx] };

          // 🔄 fallback: try to match by name if Tina mistakenly outputs names
          if (it.name) {
            const match = rawWardrobe.find(r =>
              (r.name || "").toLowerCase() === it.name.toLowerCase()
            );
            if (match) return { ...match };
          }

          if (it.id) {
            const match = rawWardrobe.find(r => r.id === it.id);
            if (match) return { ...match };
          }

          return { id: it.id || it.idx || "unknown", name: it.name || "Unknown Item" };
        });

        // 🔍 Debug logs
        console.log(`🔍 Hydrated look #${i + 1}:`, hydrated);

        const validationFB = validateLook(hydrated, { weather: city });
        const validationRules = validateLookAgainstRules(
          { items: hydrated },
          { bannedItems: (prefs?.dislikes || []), weather: city }
        );

        console.log(`🧪 Validation for look #${i + 1}:`, { validationFB, validationRules });

        return {
          title: look.title || `Untitled Look ${i + 1}`,
          style_note: look.style_note || "",
          items: hydrated,
          validation: { fashionBrain: validationFB, styleRules: validationRules }
        };
      });



      // Final filter: keep looks, even if invalid — just warn
      parsed.looks = parsed.looks.map(l => {
        if (!l.validation?.styleRules?.valid) {
          l.style_note += " | ⚠️ This look may not follow all rules.";
        }
        return l;
      });

      // Always allow looks to pass even if missing perfect balance
      parsed.looks = (parsed.looks || []).map(look => {
        if (!look.items || look.items.length < 2) {
          // auto-fill with first wardrobe items if too small
          look.items = buildSampleFromList(rawWardrobe, 3);
          look.style_note += " | ⚠️ Auto-filled due to missing items.";
        }
        return look;
      });

    // If none survived, fallback to simple combinations
    if (!parsed.looks || parsed.looks.length === 0) {
      console.warn("⚠️ No valid looks after validation — building fallback looks");
      const fallbackItems = buildSampleFromList(rawWardrobe, 10);
      parsed.looks = [
        { title: "Fallback Look 1", style_note: "Auto fallback", items: fallbackItems.slice(0, 3) },
        { title: "Fallback Look 2", style_note: "Auto fallback", items: fallbackItems.slice(3, 6) }
      ];
      parsed.note = parsed.note ? parsed.note + " | All looks failed validation. Fallback used." : "All looks failed validation. Fallback used.";
    }

    console.log("🎨 Final parsed looks:", JSON.stringify(parsed, null, 2));
    return res.json(parsed);

  } catch (err) {
    console.error("❌ /suggest-outfit (agent) error:", err);
    return res.status(500).json({ error: "Tina agent failed", message: err?.message || String(err) });
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
    return res.status(400).json({ error: "uid, itemId, lastWorn are required" });
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


// ✅ Like (save-as-favourite) outfit
app.post("/like-outfit", async (req, res) => {
  const { uid, outfit, context = {} } = req.body;

   console.log("✅ /like-outfit HIT", { uid, itemCount: outfit?.items?.length });

  if (!uid || !outfit) {
    return res.status(400).json({ error: "uid & outfit required" });
  }

  try {
    await db.collection("liked_looks").add({
      uid,
      outfit,
      context,
      liked_at: new Date().toISOString(),
    });

    res.json({ message: "Look liked!" });
  } catch (e) {
    res.status(500).json({ error: "Could not save like" });
  }
});



// ✅ Save outfit plan for a date
app.post("/plan-outfit", async (req, res) => {
  const { uid, date, outfit } = req.body;
  if (!uid || !date || !outfit) {
    return res.status(400).json({ error: "uid, date, and outfit are required" });
  }

  try {
    const planRef = db.collection("outfit_plans").doc(uid + "_" + date);
    await planRef.set({ uid, date, outfit });
    res.status(200).json({ message: "Outfit plan saved successfully" });
  } catch (err) {
    console.error("❌ Failed to save outfit plan:", err.message);
    res.status(500).json({ error: "Failed to save outfit plan" });
  }
});

// ✅ Save onboarding preferences
app.post("/onboarding", async (req, res) => {
  const { uid, dislikes = [], bodyType = "", skinTone = "", favColors = [] } = req.body;
  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    await db.collection("tina_memory").doc(uid).set(
      { dislikes, bodyType, skinTone, favColors, updated_at: new Date().toISOString() },
      { merge: true }
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
    const wardrobe = snap.docs.map(d => d.data());
    const wardrobeList = wardrobe
      .map(it => `${it.name || "Unnamed"} (${it.category || "unknown"})`)
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
        temperature: 0.7,
      }),
    });

    const json = await response.json();
    const dna = json.choices?.[0]?.message?.content?.trim() || "Modern casual chic";

    await db.collection("tina_memory").doc(uid).set({ style_dna: dna }, { merge: true });

    res.status(200).json({ style_dna: dna });
  } catch (err) {
    console.error("❌ Failed to build style DNA:", err.message);
    res.status(500).json({ error: "Failed to build style DNA" });
  }
});





// ✅ Global error handlers
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});


// ✅ Start server
const PORT = process.env.PORT || 3000;

app.get("/ping", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Middleware Error:", err);
  res.status(500).json({ error: "Internal server error", message: err?.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});