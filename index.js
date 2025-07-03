require("dotenv").config();
const express = require("express");
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

    const objects = tagRes.data?.records?.[0]?._objects || [];

    const detected = objects.map((obj) => {
      const rawTags = Array.isArray(obj._tags_simple) ? obj._tags_simple : [];

      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) =>
              typeof tag === "string"
              ? (typeof tag === "string" ? safeLower(tag).replace(/^.*\//, "") : "")
                : null
            )
            .filter((tag) => tag)
        )
      )
        .slice(0, 6)
        .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

      return {
        image_url,
        imagePath: `wardrobe/${obj?.file?.name || uuidv4()}`, // fallback name
        name:
          obj._tags_map?.Subcategory ||
          obj._tags_map?.Category ||
          "TO_BE_DETERMINED",
        category: obj._tags_map?.Category || "TO_BE_DETERMINED",
        color: obj._tags_map?.Color || "TO_BE_DETERMINED",
        tags: cleanedTags,
      };
    });


    res.json({ detected });
  } catch (err) {
    console.error("❌ Auto-tagging error:", err.message);
    res.status(500).json({ error: "Auto-tagging failed", message: err.message });
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
    const { uid, image_path, name, category, color, tags } = req.body;
      if (!uid || !image_path) {
        return res.status(400).json({ error: "uid and image_path are required" });
    }

    const docRef = await db.collection("wardrobe").add({
      uid,
      image_path,
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
    const docRef = db.collection("outfit_plans").doc(`${uid}_${date}`);
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
  const {
    uid,
    occasion    = "",
    vibe        = "",
    city        = "Delhi",
    constraints = "",
    prompt      = "" // free-text box from the UI
  } = req.body;

  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    /* 0️⃣  Pull the user’s wardrobe from Firestore */
    const snap = await db.collection("wardrobe")
      .where("uid", "==", uid)
      .get();

    const wardrobeItems = snap.docs.map(d => d.data());

    // Nicely formatted bulleted list the LLM can read
    const wardrobeText = wardrobeItems.length
      ? wardrobeItems.map(it =>
          `• ${it.name || "Unnamed item"} (${it.category || "No category"})`
        ).join("\n")
      : "(user wardrobe is empty)";

    /* 1️⃣  Weather summary */
    const weatherNow = await getWeather(city); // e.g. “light rain, 23 °C”

    /* 2️⃣  Compose the final prompt sent to the agent */
    const finalInput = prompt.trim()
      ? `User styling query: "${prompt.trim()}".
         Current weather in ${city}: ${weatherNow || "N/A"}.
         Here is the user's wardrobe:\n${wardrobeText}
         Respond in this exact JSON format:
         {
           "looks": [
             {
               "title": "Look 1",
               "items": [
                 { "name": "Item Name", "image": "https://..." }
               ]
             }
           ]
         }
         Only use items from the user's wardrobe. Do NOT make up new items.`
      : `Generate a stylish outfit with these parameters:
         • Occasion : "${occasion}"
         • Vibe     : "${vibe}"
         • Weather  : "${weatherNow || "N/A"}"
         • Extra    : "${constraints}"
         Use only the following wardrobe items:\n${wardrobeText}
         Respond in this exact JSON format:
{
  "looks": [
    {
      "title": "Look 1",
      "items": [
        { "name": "Item Name", "image": "https://..." }
      ]
    }
  ]
}
Do not wrap your response in triple backticks or code fences.

         Only use items from the user's wardrobe. Do NOT make up new items.`.replace(/[ \t]+\n/g, "\n");

    /* 3️⃣  Call the agent / LLM */
    const result = await agent.call({ input: finalInput });
       console.log("🧾 Raw agent output:", JSON.stringify(result, null, 2));
    
        /* 4️⃣ sanity-check */
        if (!Array.isArray(result.output?.looks) || !result.output.looks.length) {
          return res
            .status(502)
            .json({ error: "Agent returned no looks", raw: result.output });
        }
    
        /* 5️⃣  Ship clean JSON */
        res.json(result.output);


  } catch (err) {
    console.error("❌  Failed to suggest outfit:", err);
    res.status(500).json({ error: "Failed to suggest outfit", message: err.message });
  }
});
/* ─── End suggest-outfit ─────────────────────────────────────────────── */








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
    const planRef = db.collection("outfit_plans").doc(`${uid}_${date}`);
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
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});