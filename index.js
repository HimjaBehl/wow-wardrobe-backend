require("dotenv").config(); // ✅ Load .env variables first
const express = require("express");
const cors = require("cors");
const axios = require("axios");
// Weather Fetcher Function
const fetchWeatherFromCity = async (cityName) => {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`;

    const res = await axios.get(url);
    const temp = res.data.main.temp;
    const condition = res.data.weather[0].main.toLowerCase(); // e.g., "rain", "clear", etc.

    if (temp < 15) return "cold";
    else if (temp >= 15 && temp <= 28) return "moderate";
    else return "hot";
  } catch (err) {
    console.error("🌦️ Weather API Error:", err.response?.data || err.message);
    return "moderate"; // fallback
  }
};

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");
const { getWeatherByCity } = require("./weather"); 
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Firebase init
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Hello from WowWardrobe backend!");
});

// ✅ Fetch all wardrobe items
app.get("/wardrobe", async (req, res) => {
  try {
    const snapshot = await db.collection("wardrobeItems").get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (err) {
    console.error("❌ Error fetching items:", err);
    res.status(500).send("Error fetching items.");
  }
});

// ✅ Add item manually
app.post("/wardrobe", async (req, res) => {
  try {
    await db.collection("wardrobeItems").add(req.body);
    res.status(200).send("Item added!");
  } catch (err) {
    console.error("❌ Error adding item:", err);
    res.status(500).send("Error adding item.");
  }
});

// ✅ Update item
app.put("/wardrobe/:id", async (req, res) => {
  try {
    await db.collection("wardrobeItems").doc(req.params.id).update(req.body);
    res.status(200).send("Item updated!");
  } catch (err) {
    console.error("❌ Error updating item:", err);
    res.status(500).send("Error updating item.");
  }
});

// ✅ Delete item
app.delete("/wardrobe/:id", async (req, res) => {
  try {
    await db.collection("wardrobeItems").doc(req.params.id).delete();
    res.status(200).send("Item deleted!");
  } catch (err) {
    console.error("❌ Error deleting item:", err);
    res.status(500).send("Error deleting item.");
  }
});

// ✅ Auto-tag item using Ximilar
app.post("/wardrobe-auto", async (req, res) => {
  const { name, image_url } = req.body;
  if (!image_url || !name) return res.status(400).send("Missing name or image_url.");

  try {
    const ximilarRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/tags",
      { records: [{ _url: image_url }] },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Token c18c7777bcbd1744dc0e1d7f65841c98ff135c7f",
        },
      }
    );

    const tagsMap = ximilarRes.data?.records?.[0]?._tags_map || {};

    const newItem = {
      name,
      image_url,
      created_at: new Date().toISOString(),
      category: tagsMap.Category || tagsMap["Top Category"] || "Unknown",
      color: tagsMap.Color || "Unknown",
      tags: Object.values(tagsMap),
    };

    await db.collection("wardrobeItems").add(newItem);
    res.status(200).send("Item auto-tagged and added!");
  } catch (err) {
    console.error("🔥 Ximilar Error:", err.response?.data || err.message);
    res.status(500).send("Error auto-tagging item.");
  }
});

// ✅ AI Outfit Suggestion (Moodboard Style)
app.post("/suggest-outfit", async (req, res) => {
  const { items, occasion = "casual", vibe = "fun", city = "Delhi" } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).send("No wardrobe items provided.");
  }

  // 🔁 Get live weather
  const weather = await getWeatherByCity(city);

  // 🧠 AI prompt with weather
  const prompt = `
  You are a fashion stylist. Based on this wardrobe (each item includes its image URL), suggest 1–2 stylish outfits for a ${occasion} occasion with a ${vibe} vibe.

  Ensure that the outfits are suitable for ${weather} weather conditions.

  Return a JSON array of outfits like this:
  [
    {
      "items": [
        { "name": "White Shirt", "category": "Topwear", "image_url": "..." },
        { "name": "Denim Skirt", "category": "Bottomwear", "image_url": "..." }
      ]
    },
    ...
  ]

  Wardrobe:
  ${items.map((item, i) => 
    `${i + 1}. ${item.name} - ${item.category}, ${item.color}, tags: ${item.tags?.join(", ")}, image: ${item.image_url}`
  ).join("\n")}
  `;


  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiReply = response.data.choices?.[0]?.message?.content;
    const outfits = JSON.parse(aiReply); // 🪄 Parse structured JSON from AI
    res.status(200).json({ outfits });
  } catch (err) {
    console.error("🧠 OpenAI Error:", err.response?.data || err.message);
    res.status(500).send("Error generating outfit suggestions.");
  }
});
// ✅ Start server
app.listen(3000, () => console.log("🚀 Server running on port 3000"));
