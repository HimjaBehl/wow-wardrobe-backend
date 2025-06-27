require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, doc, getDoc } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const serviceAccount = require("./serviceAccountKey.json");
const getDislikedReasons = require("./getDislikedReasons");

console.log("🔑 XIMILAR_API_KEY loaded:", !!process.env.XIMILAR_API_KEY);
console.log("🧠 OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

const app = express();
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "wowapp1406.appspot.com",
});
const db = getFirestore();
const bucket = getStorage().bucket();


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
      const rawTags = obj._tags_simple || [];

      const cleanedTags = Array.from(
        new Set(
          rawTags
            .map((tag) => tag.toLowerCase())
            .map((tag) => tag.replace(/^.*\//, ""))
        )
      )
        .slice(0, 6)
        .map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1));

      return {
        image_url,
        name: obj._tags_map?.Subcategory || obj._tags_map?.Category || "TO_BE_DETERMINED",
        category: obj._tags_map?.Category || "TO_BE_DETERMINED",
        color: obj._tags_map?.Color || "TO_BE_DETERMINED",
        tags: cleanedTags, // ✅ Now safely defined above
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
  const uid = req.query.uid;
  console.log("🔍 GET /wardrobe called for uid:", uid);
  if (!uid) return res.status(400).json({ error: "UID is required" });

  try {
    const snapshot = await db.collection("wardrobe").where("uid", "==", uid).get();

    console.log("📦 Firestore docs found:", snapshot.docs.length);
    
    const items = snapshot.docs.map((doc) => {
      console.log("👕 Found item:", doc.data());
      return { id: doc.id, ...doc.data() };
    });
    
res.json(items);
  } catch (err) {
    console.error("❌ Firestore error:", err);
    res.status(500).json({ error: "Failed to fetch wardrobe" });
  }
});



// ✅ Add wardrobe item
app.post("/wardrobe", async (req, res) => {
  try {
    const { uid, image_url, name, category, color, tags } = req.body;
    if (!uid || !image_url) {
      return res.status(400).json({ error: "uid and image_url are required" });
    }

    const docRef = await db.collection("wardrobe").add({
      uid,
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

// ✅ OpenAI call
const callOpenAI = async (prompt) => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `You are a smart, creative personal stylist AI. Always respond in clean JSON.`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {
    console.error("🧠 OpenAI call failed:");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
    throw err; // Pass error up to be caught in your `/suggest-outfit` route
  }
};


const vibeOccasionMap = {
  fun: ["quirky", "casual"],
  elegant: ["formal", "wedding"],
  chill: ["vacation", "casual"],
  bold: ["party", "night out"],
  romantic: ["date", "wedding"],
  powerful: ["work", "formal"],
};

// ✅ Suggest Outfit
app.post("/suggest-outfit", async (req, res) => {
  let { items, occasion, vibe, city, constraints, uid, weather } = req.body;
  let dislikes = [];
  try {
    dislikes = await getUserDislikes(uid);
    console.log("🧠 Retrieved dislikes:", dislikes);
  } catch (err) {
    console.error("🚫 Error fetching dislikes:", err.message);
  }


  if (!occasion && vibe && vibeOccasionMap[vibe]) {
    occasion = vibeOccasionMap[vibe].join(" or ");
    console.log("🎯 Final mapped occasion:", occasion);
    console.log("🧠 Full payload:", { items, occasion, vibe, city, constraints });
  }

  if (!items || items.length === 0 || !uid) return res.json({ outfits: [] });

  try {
    const docRef = doc(db, "preferences", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      constraints = docSnap.data().stylePrefs || "";
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch user constraints:", err.message);
  }

  const prompt = `
  You are a top-tier fashion stylist AI. Based ONLY on the wardrobe provided, create 2 complete outfit suggestions for a "${occasion}" occasion with a "${vibe}" vibe in "${city}". Take into account the current weather in ${city}: "${weather || "N/A"}".


  🧠 Wardrobe:
  ${items.map(item => `- ${item.name || "Unknown"} | ${item.category || "Uncategorized"} | ${item.color || "Colorless"} | ${item.image_url || "NoImage"}`).join("\n")}

  🎯 User Constraints: ${constraints || "None"}

  ✨ Styling Guidelines:
  - Use 3–5 pieces per outfit.
  - Prioritize weather-appropriate choices for ${city}.
  - Avoid items based on user constraints (e.g. avoid heels).
  - Avoid items user dislikes: ${dislikes.join(", ") || "none"}.
  - Match pieces based on styling logic (e.g. top + bottom + shoes + accessory OR dress + outerwear).
  - Ensure the outfit is coherent in color, fit, and vibe.

  📦 Format your response like this:
  {
    "outfits": [
      {
        "style_note": "A cozy layered look with earthy tones.",
        "items": [
          {
            "name": "Beige Trench Coat",
            "category": "Outerwear",
            "color": "Beige",
            "image_url": "..."
          }
        ]
      }
    ]
  }
  `;

  console.log("📨 Final OpenAI Prompt:\n", prompt);

  try {
    console.log("🧠 Payload going into prompt:", { items, occasion, vibe, city, constraints });
    console.log("📨 Final OpenAI Prompt:\n", prompt);
    const output = await callOpenAI(prompt);
    let outfits = [];
    try {
      const parsed = JSON.parse(output);
      outfits = parsed.outfits || parsed;   // handles both formats
    } catch (e) {
      console.warn("⚠️ AI response was not clean JSON.", e.message);
    }
    console.log("👗 AI outfits sent to client:", outfits);
    res.json({ outfits });
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);
    console.error(err.stack); // 👈 This shows the full error
    res.status(500).json({ error: "Failed to generate outfit", message: err.message });
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
