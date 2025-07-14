require("dotenv").config();

console.log("🔑 REMOVE_BG_API_KEY =", process.env.REMOVE_BG_API_KEY ? "true" : "undefined");
console.log("🔑 REMOVE_BG_API_KEY =", process.env.REMOVEBG_API_KEY);

const express = require("express");
const getTrendInsights = require("./tools/getTrendInsights");

const tools = [
  getTrendInsights,
];

const { validateLookAgainstRules } = require("./lib/styleRules");

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
const setupAgent = require("./agent");
let agent = null;
setupAgent().then((a) => {
  agent = a;
});

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
app.use(express.json());

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

    const cleanedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(cleanedPath)}?alt=media`;

    // 3️⃣ SEND CLEANED IMAGE TO XIMILAR -----------------
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

    const detected = objects.map((obj) => {
      const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];

      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) =>
              typeof tag === "string" ? tag.toLowerCase().replace(/^.*\//, "") : null
            )
            .filter(Boolean)
        )
      )
        .slice(0, 6)
        .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

      const name = obj._tags_map?.Subcategory || obj._tags_map?.Category || "TO_BE_DETERMINED";
      const category = obj._tags_map?.Category || "TO_BE_DETERMINED";
      const color = obj._tags_map?.Color || "TO_BE_DETERMINED";

      return {
        image_url: cleanedUrl,
        image_path: cleanedPath,
        name,
        category,
        color,
        tags: cleanedTags,
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
            return res
              .status(400)
              .json({ error: "Valid uid & image_path are required (image_path was empty or invalid)" });
    }

    const docRef = await db.collection("wardrobe").add({
      uid,
      image_path,
      image_url,
      name,
      category,
      color,
      tags,
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
  const { uid, occasion = "", vibe = "", city = "Delhi", constraints = "", prompt = "", style_mood = "" } = req.body;

  // 🔍 Fetch onboarding memory
  let user_preferences = {};
  try {
    const doc = await db.collection("tina_memory").doc(uid).get();
    if (doc.exists) {
      user_preferences = doc.data();
    }
  } catch (err) {
    console.warn("⚠️ Could not load user preferences", err.message);
  }



  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    /* 0️⃣ wardrobe fetch */
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    if (snap.empty) return res.status(400).json({ error: "Wardrobe empty" });

    let wardrobeItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    /* build public url if missing */
    const bucket = "wowapp1406.appspot.com";
    wardrobeItems = wardrobeItems.map((it) =>
      it.image_url
        ? it
        : { ...it,
            image_url: `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(it.image_path)}?alt=media`
          }
    );

    /* 1️⃣ brutally slim + re-id */
    const MAX = 60;
    const sample = wardrobeItems.slice(0, MAX)
      .map((it, idx) => ({
        idx,                                   // 0-59
        name    : it.name    || "Unnamed",
        category: it.category|| "NoCat",
        color   : it.color   || "NoCol",
      }));

    // build lookup for idx → full wardrobe object
    const uniqueWardrobe = Array.from(
      new Map(wardrobeItems.map(it => [it.image_url, it])).values()
    );
    const idx2item = Object.fromEntries(
      wardrobeItems.slice(0, MAX).map((it, i) => [
        String(i),
        {
          image_url: it.image_url,
          name     : it.name || `Item ${i + 1}`,
          category : it.category || "",
          color    : it.color || "",
          palette  : it.palette || pickPalette(it.color),   //  ← add this line
        },
      ])
    );


    // 🗂  Show which wardrobe indices are available
    console.log("🗂 idx2item keys:", Object.keys(idx2item));


    /* 2️⃣ weather */
    /* 2️⃣ preferences + weather */
    const userStyleSummary = await buildUserStyleSummary(uid);

    const weatherNow = await getWeather(city);
    const userPreferences = await getUserMemory(uid);

    const skinTone = userPreferences.skinTone || "";

    if (skinTone) {
      wardrobeItems = wardrobeItems.filter((it) =>
        isColorGoodForSkinTone(it.color || "", skinTone)
      );
      console.log("🎨 Wardrobe after skin tone filter:", wardrobeItems.length);
    }

    console.log("🧠 User memory:", userPreferences);

    const rejectedColors = wardrobeItems.filter(
      (it) => !isColorGoodForSkinTone(it.color || "", skinTone)
    );
    console.log("❌ Items rejected due to skin tone:", rejectedColors.map(i => i.color));



    const moodStyle = styleMoodMap[style_mood.toLowerCase()] || null;

    console.log("🎈 Mood requested:", style_mood, "→", moodStyle);


    let moodCommentary = "";

    if (moodStyle) {
      moodCommentary = `
    Mood: ${style_mood}
    Palette Suggestions: ${moodStyle.palettes.join(", ")}
    Preferred Silhouettes: ${moodStyle.silhouettes.join(", ")}
    Style Keywords: ${moodStyle.keywords.join(", ")}
    `.trim();
    }


    /* 3️⃣ compact prompt (pipe-delimited) */
    const wardrobeLines = sample
      .map((w) => `${w.idx}|${w.name}|${w.category}|${w.color}`)
      .join("\n");



const finalInput = `
SYSTEM:
You are Tina, an AI stylist.

You help users pick outfits from their wardrobe. Each item has an index, name, category, and color. You must return exactly 2 stylish, weather-appropriate looks based on their vibe, occasion, and style preferences.
If the wardrobe does not have enough variety, still try to create a look using whatever is available.
Do NOT leave the looks list empty.


Rules:
You must follow these rules when generating looks:
- Each look must have at least 3 items.
- Prefer full outfits that include one item each from:
  - Topwear (T-shirts, shirts, blouses)
  - Bottomwear (jeans, shorts, skirts)
  - Footwear
- If user has a dress, that can replace top+bottom.
- Add 1–2 accessories (optional) like bags, jewelry, sunglasses.
- Avoid repeating the same item in different looks.

Silhouette & Colour guidance:
- Aim for visual balance: match loose/baggy bottoms with slim tops and vice versa.
- Prefer full outfits with one main color family and up to two accents (neutrals don’t count).
- Avoid clashing colors unless neutrals can anchor the look.

- Output strictly in JSON like below:
⚠️ IMPORTANT: You must respond ONLY with valid JSON (no markdown, no comments, no apologies).

{
 "looks":[
   { "title":"Look 1", "items":[ { "idx":"3" }, { "idx":"7" }, { "idx":"12" } ] },
   { "title":"Look 2", "items":[ { "idx":"5" }, { "idx":"2" }, { "idx":"11" } ] }
 ]
}

User Input:
Occasion: ${occasion}
Vibe: ${vibe}
Weather: ${weatherNow || "N/A"}
Constraints: ${constraints || "none"}
${style_mood ? `Style Mood: ${style_mood}` : ""}
${moodCommentary ? `\n\nStyle Guidance:\n${moodCommentary}` : ""}
${prompt.trim() ? `Custom Prompt: ${prompt.trim()}` : ""}
${userStyleSummary ? `\n\nUSER STYLE INSIGHTS:\n${userStyleSummary}` : ""}
${Object.keys(userPreferences || {}).length ? `
USER PREFERENCES:
${JSON.stringify(userPreferences)}

Skin tone guidance:
If the user has a warm skin tone (like 'fair warm'), prefer earthy, rich, and warm colors like olive, mustard, rust, coral, maroon, gold.
Avoid cool tones like icy blue, greyish lilac, or neon green.

` : ""}






Wardrobe:
Each line is in the format idx|name|category|color
${wardrobeLines}

Here are their style preferences:
${JSON.stringify(user_preferences)}
`.trim();


    /* 4️⃣ debug prompt length */
    console.log("🧠 prompt length (chars):", finalInput.length);

    console.log("📤 Sending to agent with prompt:", finalInput);

    // 5️⃣ call agent
    const agent = await setupAgent();
    let result;

    try {
      result = await agent.call({ input: finalInput });

      if (result.output?.error) {
        console.error("🚨 Agent error:", result.output.error);
        return res.status(502).json({ error: result.output.error });
      }
    } catch (e) {
      console.error("❌ AGENT CALL FAILED:", e);
      return res.status(500).json({ error: "Agent call failed", message: e.message });
    }

    console.log("🔍 FULL RAW OUTPUT:", JSON.stringify(result, null, 2));

    // 🛑 If Tina didn’t give valid JSON…
    if (!result || !result.output || !Array.isArray(result.output.looks)) {
      console.error("❌ Agent returned invalid format:", JSON.stringify(result, null, 2));

      const raw = result?.output || result || "(no output)";
      const rawText = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);

      return res.status(502).json({
        error        : "Invalid JSON from LLM",
        prompt_length: finalInput.length,
        wardrobe_sample: sample, // max 60 items
        style_mood   : style_mood || "none",
        raw_output   : rawText   // send raw LLM response to Postman
      });
    }

    const rawText = JSON.stringify(result.output, null, 2);
    console.error("⚠️ Raw LLM output:", rawText);

      // ⬇️ NEW quick-out guard – paste right below the block above
    if (!result.output.looks || result.output.looks.length === 0) {
      console.warn("😬 Agent returned zero looks. Dumping full response...");
      console.warn(JSON.stringify(result, null, 2));

      return res.status(502).json({
        error: "Stylist agent returned no looks.",
        debug: result.output || {},
        message: "Try removing vibe/occasion or check if wardrobe has topwear + bottomwear + footwear"
      });
    }



    /* 🔥 6️⃣  ── HYDRATE & CLEAN ───────────────────────────────── */
    // 🧠 Group items into meaningful looks using silhouette roles
    function buildCleanLook(allItems = []) {


      /* ── 1. Palette check ───────────────────────── */
      const palettes = allItems.map(it => it.palette || pickPalette(it.color));

      if (!harmonious(palettes)) {
        console.warn("⚠️ Mild palette clash — allowing look through anyway:", palettes);
        // return null; // ← disable this strict rejection
      }
      /* ── 2. Remove same-category duplicates ─────── */
      const seenCategories = new Set();
      allItems = allItems.filter(it => {
        const cat = (it.category || "").toLowerCase();
        if (seenCategories.has(cat)) return false;
        seenCategories.add(cat);
        return true;
      });

      /* ── 3. Silhouette pairing logic ────────────── */
      const role = txt => silhouetteRole(txt.name || txt.category);

      const anchor     = allItems.find(it => role(it) === "anchor");
      const upper      = allItems.find(it => role(it) === "upper");
      const lower      = allItems.find(it => role(it) === "lower");
      const outer      = allItems.find(it => role(it) === "outer");
      const accessories = allItems.filter(it => role(it) === "accessory");

      if (anchor) {
        return [anchor, outer, ...accessories.slice(0, 2)].filter(Boolean);
      }

      if (upper && lower) {
        return [upper, lower, outer, ...accessories.slice(0, 1)].filter(Boolean);
      }

      if (upper || lower) {
        return [upper || lower, outer, ...accessories.slice(0, 2)].filter(Boolean);
      }

      return allItems.slice(0, 4);
    }


    console.log("🔎 Looks before hydration:", JSON.stringify(result.output.looks, null, 2));

    // 🧪 Apply silhouette filtering
    result.output.looks = result.output.looks
    .map((look) => {
      // 🌊 1. hydrate each { idx } with full wardrobe data
      const hydratedItems = (look.items || []).map((it) => ({
        idx: it.idx,
        ...(idx2item[it.idx] || {}),   // inject name, category, color, palette, image_url
      }));

      // 🌊 2. run silhouette & color logic
      const cleaned = buildCleanLook(hydratedItems);

      // 🏅 add a styleScore (0‒10)
      const score = calculateStyleScore(cleaned);

      return { ...look, items: cleaned, score };

    })
    // 🌊 3. drop any null/empty or 1-piece looks
    .filter((l) => Array.isArray(l.items) && l.items.length >= 2);

    /* ── keep only the top-2 looks by score ─────────────────────── */
    result.output.looks = result.output.looks
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2);
    /* ───────────────────────────────────────────────────────────── */

  // drop null / empty





    /* ---------- Build user-specific rules ------------- */
    function parseConstraints(text = "") {
      const bans = [];
      text
        .toLowerCase()
        .split(",")
        .map(s => s.trim())
        .forEach(t => {
          if (t.startsWith("no ")) bans.push(t.replace("no ", "").trim());
        });
      return { bannedItems: bans };
    }

    const userRules = parseConstraints(constraints);

    console.log("🎯 Constraints parsed:", userRules);
    console.log("🎯 Looks BEFORE validation:", JSON.stringify(result.output.looks, null, 2));

    result.output.looks = result.output.looks.filter(l => {
      const palettes = l.items.map(it => it.palette || pickPalette(it.color));
      return harmonious(palettes) && validateLookAgainstRules(l, userRules);
    });

    /* ---------- Apply structural + banned-item filter --- */
    const { isValidCombo, needsLayer } = require("./lib/styleRules");

    result.output.looks = result.output.looks.filter(l => {
      const items = l.items;

      const passesBanCheck = validateLookAgainstRules(l, userRules);
      const passesStructure = isValidCombo(items);
      const passesWeather = !needsLayer(items, weatherNow);

      if (!passesBanCheck) console.warn("❌ Banned item detected");
      if (!passesStructure) console.warn("❌ Invalid top/bottom structure");
      if (!passesWeather) console.warn("❌ Missing layer for weather");

      return passesBanCheck && passesStructure && passesWeather;
    });


    const rejected = [];

    result.output.looks = result.output.looks.filter(l => {
      const items = l.items;

      const fails = [];

      if (!validateLookAgainstRules(l, userRules)) fails.push("banned item");
      if (!isValidCombo(items)) fails.push("invalid outfit combo");
      if (needsLayer(items, weatherNow)) fails.push("missing layer for weather");

      if (fails.length) {
        rejected.push({ title: l.title, reasons: fails });
        return false;
      }
      return true;
    });

    if (result.output.looks.length === 0) {
      return res.status(502).json({
        error: "No valid looks generated",
        rejected_reasons: rejected
      });
    }


    // Add this:
    if (result.output.looks.length === 0) {
      console.warn("😬 Agent returned no looks at all.");
      return res.status(502).json({ error: "Agent returned no looks", raw: result.output });
    }

    console.log("🕵️‍♀️  Raw agent looks:", JSON.stringify(result.output.looks, null, 2));



    /* 8️⃣ return final result */
    res.json(result.output);

  } catch (err) {
    console.error("❌ FULL ERROR in suggest-outfit:", err);
    res.status(500).json({
      error: "AI suggestion failed",
      name: err.name || "unknown",
      message: err.message || "No message",
      stack: err.stack || "No stack trace",
    });
  }

});

// ✅ Build Tina’s Style DNA
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

  if (!uid) {
    return res.status(400).json({ error: "uid is required" });
  }

  try {
    await db.collection("tina_memory").doc(uid).set({
      dislikes,
      bodyType,
      skinTone,
      favColors,
      updated_at: new Date().toISOString(),
    });

    res.status(200).json({ message: "Preferences saved successfully" });
  } catch (err) {
    console.error("❌ Failed to save onboarding:", err.message);
    res.status(500).json({ error: "Failed to save onboarding preferences" });

    // ✅ Fetch onboarding preferences
    app.get("/onboarding", async (req, res) => {
      const { uid } = req.query;

      if (!uid) {
        return res.status(400).json({ error: "uid is required" });
      }

      try {
        const doc = await db.collection("tina_memory").doc(uid).get();
        if (doc.exists) {
          res.status(200).json(doc.data());
        } else {
          res.status(404).json({ error: "No preferences found for this user" });
        }
      } catch (err) {
        console.error("❌ Failed to fetch onboarding:", err.message);
        res.status(500).json({ error: "Failed to fetch onboarding preferences" });
      }
    });
    // ✅ Generate and store Style DNA
    app.post("/build-style-dna", async (req, res) => {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: "uid is required" });

      try {
        // 1. Fetch wardrobe items
        const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
        const wardrobe = snap.docs.map((doc) => doc.data());

        // 2. Fetch styling memory
        const memDoc = await db.collection("tina_memory").doc(uid).get();
        const memory = memDoc.exists ? memDoc.data() : {};

        // 3. Build prompt
        const wardrobeList = wardrobe
          .map(it => `• ${it.name || "Unnamed"} (${it.category || "unknown"}) - ${it.color || "no color"}`)
          .join("\n");

        const prompt = `
    Based on this user's wardrobe and styling preferences, describe their personal fashion vibe in 1 punchy sentence.

    Wardrobe:
    ${wardrobeList || "(No wardrobe items)"}

    Preferences:
    ${JSON.stringify(memory)}

    Focus on silhouette, color, accessories, and layering style. Avoid generic terms. 
    Only return the sentence, no explanation or formatting.
    `;

        // 4. Call OpenAI
        if (!agent) return res.status(503).json({ error: "Agent not ready yet" });

        const { output } = await agent.call({ input: prompt });
        const dna = output?.description || output?.style_dna || output?.text || "Modern casual chic"; // fallback


        // 5. Save to memory
        await db.collection("tina_memory").doc(uid).set({
          ...memory,
          style_dna: styleDNA
        });

        res.status(200).json({ style_dna: styleDNA });
      } catch (err) {
        console.error("❌ Failed to build style DNA:", err);
        res.status(500).json({ error: "Failed to build style DNA" });
      }
    });

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


// ✅ Fetch onboarding preferences
app.get("/onboarding", async (req, res) => {
  const { uid } = req.query;

  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    const doc = await db.collection("tina_memory").doc(uid).get();
    if (doc.exists) {
      res.status(200).json(doc.data());
    } else {
      res.status(404).json({ error: "No preferences found for this user" });
    }
  } catch (err) {
    console.error("❌ Failed to fetch onboarding:", err.message);
    res.status(500).json({ error: "Failed to fetch onboarding preferences" });
  }
});


// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});