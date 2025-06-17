require("dotenv").config();
console.log("c18c7777bcbd1744dc0e1d7f65841c98ff135c7f", process.env.XIMILAR_API_KEY);
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const serviceAccount = require("./serviceAccountKey.json");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase init
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "wowapp1406.appspot.com",
});
const db = getFirestore();
const bucket = getStorage().bucket();

// Root
app.get("/", (req, res) => {
  res.send("Hello from WowWardrobe backend!");
});

// Get wardrobe items
app.get("/wardrobe", async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).send("Missing uid");

  try {
    const snapshot = await db.collection("wardrobe").where("uid", "==", uid).get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (err) {
    console.error("Error fetching wardrobe items:", err);
    res.status(500).send("Failed to fetch wardrobe");
  }
});

// Add wardrobe item
app.post("/wardrobe", async (req, res) => {
  const { image_url, uid, name, category, color, tags } = req.body;
  if (!image_url || !uid) return res.status(400).send("Missing fields");

  try {
    const docRef = await db.collection("wardrobe").add({
      image_url,
      uid,
      name: name || "",
      category: category || "",
      color: color || "",
      tags: tags || [],
    });
    res.json({ id: docRef.id });
  } catch (err) {
    console.error("Error adding wardrobe item:", err);
    res.status(500).send("Failed to add item");
  }
});

// Delete wardrobe item
app.delete("/wardrobe/:id", async (req, res) => {
  try {
    await db.collection("wardrobe").doc(req.params.id).delete();
    res.sendStatus(200);
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).send("Failed to delete");
  }
});

// AI outfit suggestion route
app.post("/suggest-outfit", async (req, res) => {
  const { items, occasion, vibe, city } = req.body;

  try {
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a fashion stylist. Based on occasion, vibe, and weather in a city, return 1–2 complete outfit suggestions using items the user owns. Respond as a JSON object: { style_note: string, outfits: [ { items: [ { name, category, color, image_url } ] } ] }",
          },
          {
            role: "user",
            content: `My wardrobe: ${JSON.stringify(items)}. Occasion: ${occasion}, Vibe: ${vibe}, City: ${city}. Suggest outfits.`,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const text = openaiRes.data.choices?.[0]?.message?.content;
    res.send(text);
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);
    res.status(500).send("Outfit suggestion failed");
  }
});

// Auto-tag with Ximilar
app.post("/auto-tag", async (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.status(400).send("Missing image_url");

  try {
    const ximilarRes = await axios.post(
      "https://api.ximilar.com/fashion/v2/tagging/",
      { records: [{ _url: image_url }],
      },
      {
        "Authorization": `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json"
        },
      }
    );

    const tags = ximilarRes.data?.objects?.[0]?.tags || [];
    const name = tags.find((t) => t.name === "product")?.value || "Unnamed";
    const category = tags.find((t) => t.name === "category")?.value || "";
    const color = tags.find((t) => t.name === "color")?.value || "";

    res.json({ name, category, color, tags: tags.map((t) => t.value) });
  } catch (err) {
    console.error("❌ Ximilar error:", err.message);
    res.status(500).send("Ximilar tagging failed.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
