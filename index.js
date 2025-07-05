require("dotenv").config();
const express = require("express");
const { validateLookAgainstRules } = require("./lib/styleRules");
const { guessSilhouette, pickPalette } = require("./lib/fashionTags");
const { harmonious } = require("./lib/colorRules");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const setupAgent = require("./agent");
const { v4: uuidv4 } = require("uuid");
const { db, storage } = require("./firebase");
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





app.use(cors());
app.use(express.json());

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
  if (!image_url) return res.status(400).json({ error: "Image URL is required" });

  try {
    console.log("🚀 Sending image to Ximilar:", image_url);

    const tagRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/detect_tags_all",
      { records: [{ _url: image_url }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Ximilar response:", JSON.stringify(tagRes.data, null, 2));

    const objects = tagRes.data?.records?.[0]?._objects || [];

    // your tagging logic continues...
    const { guessSilhouette, pickPalette } = require("./lib/fashionTags");

    const detected = objects.map((obj) => {
      const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];

      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) =>
              typeof tag === "string"
                ? tag.toLowerCase().replace(/^.*\//, "")
                : null
            )
            .filter((tag) => tag)
        )
      )
        .slice(0, 6)
        .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

      const name = obj._tags_map?.Subcategory || obj._tags_map?.Category || "TO_BE_DETERMINED";
      const category = obj._tags_map?.Category || "TO_BE_DETERMINED";
      const color = obj._tags_map?.Color || "TO_BE_DETERMINED";

      return {
        image_url,
        image_path: `wardrobe/${obj?.file?.name || uuidv4()}`,
        name,
        category,
        color,
        tags: cleanedTags,
        silhouette: guessSilhouette(name + " " + category),
        palette: pickPalette(color),
      };
    });

    res.json({ detected });
  } catch (err) {
    console.error("❌ FULL ERROR OBJECT:", JSON.stringify(err?.response?.data || err.message, null, 2));
    res.status(500).json({
      error: "Auto-tagging failed",
      message: err?.response?.data?.error || err.message,
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


/* ─── AI Stylist : Suggest outfit ─────────────────────────────────────── */
app.post("/suggest-outfit", async (req, res) => {
  const { uid, occasion = "", vibe = "", city = "Delhi",
          constraints = "", prompt = "" } = req.body;

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
      wardrobeItems.slice(0, MAX).map((it, i) => [String(i), {
        image_url: it.image_url,
        name     : it.name || `Item ${i + 1}`,
        category : it.category || "",
        color    : it.color || "",
      }])
    );

    // 🗂  Show which wardrobe indices are available
    console.log("🗂 idx2item keys:", Object.keys(idx2item));


    /* 2️⃣ weather */
    const weatherNow = await getWeather(city);

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
${prompt.trim() ? `Custom Prompt: ${prompt.trim()}` : ""}

Wardrobe:
Each line is in the format idx|name|category|color
${wardrobeLines}
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
      console.error("❌ AGENT CALL FAILED:", e); // full object, not just e.message
      return res.status(500).json({ error: "Agent call failed", message: e.message });
    }


    if (!result || !result.output || !Array.isArray(result.output.looks)) {
      console.error("❌ Agent returned invalid format:", JSON.stringify(result, null, 2));
      return res.status(500).json({ error: "Agent returned invalid or malformed response" });
    }

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
    result.output.looks.forEach((look, li) => {
      look.items = (look.items || [])
        .map((it) => {
          const full = idx2item[it.idx];
          if (!full) {
            console.warn(
              `⚠️  Look ${li + 1}: idx "${it.idx}" not found in wardrobe lookup`
            );
            return null;                              // mark as bad → filtered out
          }

          const hydrated = {
            ...it,
            image_url: full.image_url || "",
            name     : full.name      || "",
            category : full.category  || "",
            color    : full.color     || "",
          };

          if (!hydrated.image_url || !hydrated.name) {
            console.warn(
              `⚠️  Look ${li + 1}: idx "${it.idx}" missing critical fields`,
              hydrated
            );
            return null;
          }

          return hydrated;
        })
        .filter(Boolean); // drop nulls
    });

    

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


    const { harmonious } = require("./lib/colorRules");

    result.output.looks = result.output.looks.filter(l => {
      const palettes = l.items.map(it => it.palette || pickPalette(it.color));
      return harmonious(palettes) && validateLookAgainstRules(l, userRules);
    });

    /* ---------- Apply structural + banned-item filter --- */
    result.output.looks = result.output.looks.filter(l =>
      validateLookAgainstRules(l, userRules)
    );

     
    // Add this:
    if (result.output.looks.length === 0) {
      console.warn("😬 Agent returned no looks at all.");
      return res.status(502).json({ error: "Agent returned no looks", raw: result.output });
    }

    console.log("🕵️‍♀️  Raw agent looks:", JSON.stringify(result.output.looks, null, 2));
    
    

    /* 8️⃣ return final result */
    res.json(result.output);

  } catch (err) {
    console.error("❌ Suggest outfit error:", err.message);
    res.status(500).json({ error: "AI suggestion failed", message: err.message });
  }
});

// ✅ Like (save-as-favourite) outfit
app.post("/like-outfit", async (req, res) => {
  const { uid, outfit } = req.body;
  if (!uid || !outfit) return res.status(400).json({ error: "uid & outfit required" });
  try {
    await db.collection("liked_looks").add({
      uid,
      outfit,
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});