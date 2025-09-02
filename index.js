require("dotenv").config();

console.log("🔑 REMOVE_BG_API_KEY =", process.env.REMOVE_BG_API_KEY ? "true" : "undefined");
console.log("🔑 REMOVE_BG_API_KEY =", process.env.REMOVEBG_API_KEY);

const { validateLook } = require("./lib/fashionBrain");
const express = require("express");
const getTrendInsights = require("./tools/getTrendInsights");

const tools = [
  getTrendInsights,
];

const { validateLookAgainstRules } = require("./lib/styleRules");
// 🔮 Load fashion taxonomy
const { taxonomy } = require("./lib/taxonomyUtils");
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

const { isNeutral, dominantPalette,} = require("./lib/colorRules");


// 🔥 STEP 1: Import like this, DON'T destructure yet
const fashionTags = require("./lib/fashionTags");

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

console.log('Loaded fashionTags =>', require('./lib/fashionTags'));

const { harmonious }      = require("./lib/colorRules");
const { calculateStyleScore } = require("./lib/styleScore");
const { styleMoodMap } = require("./styleMoodMap");

console.log("💡 Available moods:", Object.keys(styleMoodMap));


const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { db, storage } = require("./firebase");
const bucket = storage.bucket();

console.log("✅ Firebase initialized with bucket:", bucket.name);


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
  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: "Image URL required" });

  try {
    // 1️⃣ REMOVE BACKGROUND ------------------------------
    const removeRes = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      new URLSearchParams({
        image_url,
        size: "auto",
      }),
      {
        headers: {
          "X-Api-Key": process.env.REMOVE_BG_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        responseType: "arraybuffer",
      }
    );

    if (removeRes.status !== 200 || !removeRes.data) {
      throw new Error("Background removal failed");
    }

    // 2️⃣ Upload cut-out PNG to Firebase Storage
    const cleanedPath = `wardrobe/removed_${Date.now()}.png`;
    await bucket.file(cleanedPath).save(removeRes.data, {
      contentType: "image/png",
      public: true,
      resumable: false,
    });

    // --- after saving cleaned image to Firebase, build cleanedUrl ---
    const cleanedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(cleanedPath)}?alt=media`;

    // --- DEBUG: log cleanedUrl so we can check accessibility ---
    console.log("DEBUG: cleanedUrl ->", cleanedUrl);

    // --- SEND CLEANED IMAGE TO XIMILAR ---
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

    // --- DEBUG: log Ximilar raw response (trimmed so console stays readable) ---
    console.log("DEBUG -> ximilar raw response (first 2000 chars):", JSON.stringify(tagRes.data).slice(0, 2000));


    const objects = tagRes.data?.records?.[0]?._objects || [];

    const detected = objects.map((obj) => {
      const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];

      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) =>
              typeof tag === "string" ? tag.toUpperCase().replace(/^.*\//, "") : null
            )
            .filter(Boolean)
        )
      )
        .slice(0, 6)
        .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

      const nameRaw = obj._tags_map?.Subcategory || obj._tags_map?.Category || "TO_BE_DETERMINED";
      const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);

      const categoryRaw = obj._tags_map?.Category || "TO_BE_DETERMINED";
      const category = categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1);

      const colorRaw = obj._tags_map?.Color || "TO_BE_DETERMINED";
      const color = colorRaw.charAt(0).toUpperCase() + colorRaw.slice(1);

      // 👇 taxonomy lookup
      const { findCategory, getAttributes } = require("./lib/taxonomyUtils");
      const taxonomyMatch = findCategory(nameRaw.toLowerCase());
      const taxonomyAttributes = taxonomyMatch
        ? getAttributes(taxonomyMatch.subCategory) || {}
        : {};

      return {
        image_url: cleanedUrl,
        image_path: cleanedPath,
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
      };

    });

    // 4️⃣ Return cut-out URL + tags
    return res.json({ detected, image_url: cleanedUrl });

  } catch (err) {
    console.error("🔥 Full error stack:", err); // 👈 logs full error to console
    res.status(500).json({
      error: "Auto-tagging failed",
      message: err.message,
      stack: err.stack,  // optional: send stack in Postman for now
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
        const { findCategory, getAttributes } = require("./lib/taxonomyUtils");
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

/* ─── AI Stylist : Suggest outfit ─────────────────────────────────────── */
app.post("/suggest-outfit", async (req, res) => {
  console.log("HIT /suggest-outfit", { ts: new Date().toISOString() });

  const { uid, occasion = "", vibe = "", city = "Delhi", prompt = "" } = req.body || {};
  // Fetch user prefs (dislikes, skinTone, favColors)
  const prefs = await getUserMemory(uid);

  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    // 1️⃣ Fetch wardrobe
    let snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    if (snap.empty) return res.status(400).json({ error: "Wardrobe empty" });

    let wardrobeItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  


    if (wardrobeItems.length < 3) {
      return res.status(400).json({ error: "Need at least 3 wardrobe items." });
    }

    // 🔹 Seasonal fabric filtering using taxonomy attributes
    const season = "summer"; // later auto-detect via getWeather(city)
    wardrobeItems = wardrobeItems.filter(it => {
      if (!it.attributes?.Material) return true;
      const materials = it.attributes.Material.map(m => m.toLowerCase());

      if (season === "summer") {
        return materials.some(m => ["cotton", "linen", "silk"].includes(m));
      }
      if (season === "winter") {
        return materials.some(m => ["wool", "leather", "velvet"].includes(m));
      }
      return true;
    });


    // 3️⃣ Prepare compact wardrobe sample
    const sample = wardrobeItems.slice(0, 50).map((it, idx) => ({
      idx,
      name: it.name || "Unnamed",
      category: it.category || "",
      color: it.color || "",
      taxonomyPath: it.taxonomyPath || "",
      attributes: it.attributes || {},
      fabric: it.fabric || "",
      silhouette: it.silhouette || "",
      image_url: it.image_url || "",
    }));


    const wardrobeLines = sample.map(w => {
      const attrs = Object.entries(w.attributes || {})
        .map(([k, v]) => `${k}:${v}`)
        .join(", ");
      return `${w.idx}|${w.name}|${w.category}|${w.color}|${w.taxonomyPath}|${w.silhouette}|${w.fabric}|${attrs}`;
    }).join("\n");


    // 4️⃣ Build strict JSON prompt
    const finalPrompt = `
You are Tina, an expert fashion stylist.

TASK: From the wardrobe list, create 2 stylish, weather-appropriate looks.
- Each look must have 3–5 items.
- Use taxonomy info (category, silhouette, fabric, attributes) to balance the outfit.
- Always combine at least: 1 upper/top + 1 lower/bottom (pants/skirt) OR 1 dress/jumpsuit as anchor.
- Optionally add 1 outerwear, and 1–2 accessories or footwear.
- Avoid repeating the same silhouette role twice (e.g., 2 outers).
- Consider fabrics and seasonal relevance (wool/velvet → winter, linen/cotton → summer).
- Respect user dislikes, skin tone, and favorite colors (already filtered above).
- User dislikes (must avoid): ${prefs?.dislikes?.join(", ") || "none"}.
- Skin tone: ${prefs?.skinTone || "unknown"}.
- Fav colors: ${prefs?.favColors?.join(", ") || "none"}.
- Add a "style_note" explaining why the look works (e.g. color balance, silhouette, occasion match).
- ❗ STRICT RULE: A valid outfit = (top + bottom + footwear) OR (dress/jumpsuit + footwear). Never return invalid outfits.

Respond ONLY in strict JSON. No text, no markdown.

{
  "looks": [
    {
      "title": "Look 1",
      "style_note": "Balanced casual summer look with cotton shirt and linen trousers.",
      "items": [ { "idx": "0" }, { "idx": "1" }, { "idx": "2" } ]
    },
    {
      "title": "Look 2",
      "style_note": "Elegant evening outfit with silk dress and heels.",
      "items": [ { "idx": "3" }, { "idx": "4" }, { "idx": "5" } ]
    }
  ]
}

Occasion: ${occasion}
Vibe: ${vibe}
City: ${city}
${prompt ? `Extra request: ${prompt}` : ""}

Wardrobe (each line = idx|name|category|color|taxonomyPath|silhouette|fabric|attributes):
${wardrobeLines}
    `.trim();


    // 5️⃣ Call OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: finalPrompt }],
        response_format: { type: "json_object" }, // 🔑 ensures valid JSON
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    console.log("🟢 Raw LLM Output:", raw);
    let parsed;
    try {
      parsed = JSON.parse(raw);
      console.log("🔎 Parsed JSON draft:", JSON.stringify(parsed, null, 2));



    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ JSON parse failed:", err.message, raw);
      return res.status(200).json({
        looks: [
          { title: "Fallback Look 1", items: wardrobeItems.slice(0, 3) },
          { title: "Fallback Look 2", items: wardrobeItems.slice(3, 6) }
        ],
        note: "Returned fallback look because Tina’s JSON failed",
      });
    }

    // 6️⃣ Hydrate indices with wardrobe items
      const idx2item = Object.fromEntries(
        wardrobeItems.map((it, i) => [
          String(i),
          {
            id: it.id,
            name: it.name || "Unnamed",
            category: it.category || "",
            color: it.color || "",
            image_url: it.image_url || "",
            tags: it.tags || [],
            taxonomyPath: it.taxonomyPath || "",
            attributes: it.attributes || {},
            fabric: it.fabric || "",
            silhouette: it.silhouette || "",
            idx: String(i),
          }
        ])
      );




    if (parsed.looks && Array.isArray(parsed.looks)) {
      parsed.looks = parsed.looks.map(look => {
        let hydratedItems = (look.items || []).map(it => ({
          ...idx2item[it.idx],
          idx: it.idx,
        }));

        // 🧹 Cleanup rules before validation
        // ❌ Remove duplicate bags
        const bags = hydratedItems.filter(it => (it.category || "").toLowerCase().includes("bag"));
        if (bags.length > 1) {
          hydratedItems = hydratedItems.filter(it => !(it.category || "").toLowerCase().includes("bag"));
          hydratedItems.push(bags[0]); // keep only one bag
        }

        // ❌ Remove bottoms if a dress/jumpsuit is present
        const hasDress = hydratedItems.some(it => (it.category || "").toLowerCase().includes("dress") || (it.category || "").toLowerCase().includes("jumpsuit"));
        if (hasDress) {
          hydratedItems = hydratedItems.filter(it => {
            const c = (it.category || "").toLowerCase();
            return !(c.includes("pants") || c.includes("jeans") || c.includes("trousers") || c.includes("skirt") || c.includes("shorts"));
          });
        }

        // ❌ Ensure footwear exists (fallback: add first available footwear)
        const hasFootwear = hydratedItems.some(it => (it.category || "").toLowerCase().includes("footwear") || (it.category || "").toLowerCase().includes("shoe"));
        if (!hasFootwear) {
          const footwear = wardrobeItems.find(it => (it.category || "").toLowerCase().includes("footwear") || (it.category || "").toLowerCase().includes("shoe"));
          if (footwear) hydratedItems.push(footwear);
        }

        // ✅ Run validations
        const validationFB = validateLook(hydratedItems, { weather: city });
        const validationRules = validateLookAgainstRules(
          { items: hydratedItems },
          {
            bannedItems: (prefs?.dislikes || []),
            weather: city
          }
        );

        return {
          title: look.title,
          style_note: look.style_note || "Suggested look",
          items: hydratedItems,
          validation: {
            fashionBrain: validationFB,
            styleRules: validationRules,
          },
        };
      });


      // 🔎 Keep only looks that passed strict styleRules
      parsed.looks.forEach(l => {
        if (!l.validation.styleRules.valid) {
          console.log("🚫 Look failed rules:", l.title, l.validation.styleRules.errors);
        }
      });

      parsed.looks = parsed.looks.filter(l => {
        if (l.validation?.styleRules?.valid) return true;

        // allow looks with <=2 errors
        return (l.validation?.styleRules?.errors || []).length <= 2;
      });



      // 🚑 Fallback if nothing survived
      if (!parsed.looks.length) {
        console.warn("⚠️ Fallback triggered: No valid looks survived Tina’s rules");

        const fallbackItems = wardrobeItems.map((it, i) => ({

          id: it.id,
          name: it.name,
          category: it.category,
          color: it.color,
          image_url: it.image_url,
          tags: it.tags || [],
          taxonomyPath: it.taxonomyPath || "",
          attributes: it.attributes || {},
          fabric: it.fabric || "",
          silhouette: it.silhouette || "",
          idx: String(i),
        }));

        parsed.looks = [
          { title: "Fallback Look 1", items: fallbackItems.slice(0, 3) },
          { title: "Fallback Look 2", items: fallbackItems.slice(3, 6) }
        ];
        parsed.note = "Fallback triggered: Tina’s suggestions failed validation rules.";
      }






    console.log("🎨 Hydrated looks:", JSON.stringify(parsed, null, 2));
    res.json(parsed);

    }

  } catch (err) {
    console.error("❌ Error in suggest-outfit:", err);
    res.status(500).json({ error: "AI suggestion failed", message: err.message });
  }
});

// ✅ Build Tina's Style DNA
app.post("/build-style-dna", async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "uid is required" });
  }

  try {
    // Fetch wardrobe items
    const snap = await db.collection("wardrobe")
      .where("uid", "==", uid)
      .get();

    const wardrobeItems = snap.docs.map(d => d.data());

    // Fetch preferences
    const memDoc = await db.collection("tina_memory").doc(uid).get();
    const preferences = memDoc.exists ? memDoc.data() : {};

    // Create a condensed summary string
    const wardrobeList = wardrobeItems.map(i => `${i.name || "unnamed"} (${i.category})`).join(", ");
    const prompt = `
Analyze this user’s style based on their wardrobe and preferences.
Summarize it in one sentence.
Wardrobe: ${wardrobeList}
Preferences: ${JSON.stringify(preferences)}
Output just the sentence. Example: “Boho-street with bold color pops.”
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "Authorization" : `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a fashion stylist AI." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const json = await response.json();
    const reply = json.choices?.[0]?.message?.content || "No style detected.";

    // Save it to memory
    await db.collection("tina_memory").doc(uid).set(
      { style_dna: reply }, { merge: true }
    );

    res.status(200).json({ style_dna: reply });

  } catch (err) {
    console.error("❌ Failed to build style DNA:", err.message);
    res.status(500).json({ error: "Failed to generate style DNA" });
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



// ✅ Error handling middleware
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Middleware Error:", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
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
const PORT = process.env.PORT || 3000
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