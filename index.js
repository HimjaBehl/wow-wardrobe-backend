require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const serviceAccount = require("./serviceAccountKey.json");

console.log("🔑 XIMILAR_API_KEY loaded:", !!process.env.XIMILAR_API_KEY);
console.log("🧠 OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

const app = express();

// ✅ Firebase Init
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "wowapp1406.appspot.com",
});
const db = getFirestore();
const bucket = getStorage().bucket();

app.use(cors());
app.use(express.json());

// ✅ OpenAI using Axios
const callOpenAI = async (prompt) => {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are a helpful fashion stylist AI." },
        { role: "user", content: prompt }
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
};

// ✅ Root
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "🎉 WOW Wardrobe backend is live!",
    timestamp: new Date().toISOString()
  });
});

// ✅ Fetch wardrobe items
app.get("/wardrobe", async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).send("Missing uid");

  try {
    const snapshot = await db.collection("wardrobe").where("uid", "==", uid).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (err) {
    console.error("❌ Firestore fetch error:", err.message);
    res.status(500).send("Failed to fetch wardrobe");
  }
});

// ✅ Save wardrobe item
app.post("/wardrobe", async (req, res) => {
  const { uid, image_url, name, category, color, tags } = req.body;
  if (!uid || !image_url) return res.status(400).send("Missing uid or image_url");

  try {
    const docRef = await db.collection("wardrobe").add({
      uid,
      image_url,
      name,
      category,
      color,
      tags,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error("❌ Error saving wardrobe item:", err.message);
    res.status(500).send("Failed to save wardrobe item");
  }
});

// ✅ Auto-tag with Ximilar
app.post("/auto-tag", async (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.status(400).send("Missing image_url");

  try {
    const tagRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/tags",
      { records: [{ _url: image_url }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const tags = tagRes.data?.records?.[0]?._tags_simple || [];
    const name = tagRes.data?.records?.[0]?._tags_map?.Subcategory || "Unnamed";
    const category = tagRes.data?.records?.[0]?._tags_map?.Category || "";
    const color = tagRes.data?.records?.[0]?._tags_map?.Color || "Unknown";

    res.json({ image_url, name, category, color, tags });
  } catch (err) {
    console.error("❌ Auto-tagging failed:", err.message);
    res.status(500).json({
      error: "Auto-tagging failed (unexpected)",
      message: err.message,
      stack: err.stack,
      ximilar: err.response?.data || "No response from Ximilar",
    });
  }
});

// ✅ AI Outfit Suggestion
app.post("/suggest-outfit", async (req, res) => {
  const { items, occasion, vibe, city } = req.body;

  console.log("🧠 Received items:", items?.length, "occasion:", occasion, "vibe:", vibe);

  if (!items || items.length === 0) {
    return res.json({ outfits: [] });
  }

  const prompt = `
You are a professional fashion stylist. Based on the wardrobe items provided, suggest 2 full outfits for a ${vibe} ${occasion} event in ${city}.
Each outfit should include item names, categories, colors, and a 1-line style note.

Wardrobe:
${items.map(item => `- ${item.name} (${item.category}, ${item.color})`).join("\n")}

Format:
[
  {
    "style_note": "...",
    "items": [
      { "name": "...", "category": "...", "color": "...", "image_url": "..." },
      ...
    ]
  },
  ...
]
`;

  try {
    const output = await callOpenAI(prompt);

    let outfits = [];
    try {
      outfits = JSON.parse(output);
    } catch (err) {
      console.warn("⚠️ AI returned unstructured JSON. Wrapping manually.");
    }

    res.json({ outfits });
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);
    res.status(500).json({
      error: "Failed to generate outfit",
      message: err.message,
      stack: err.stack
    });
  }
});

// 🔧 Error Handling
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled Middleware Error:", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
    stack: err.stack
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
  process.exit(1);
});
