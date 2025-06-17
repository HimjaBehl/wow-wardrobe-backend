require("dotenv").config();
console.log(
  "c18c7777bcbd1744dc0e1d7f65841c98ff135c7f",
  process.env.XIMILAR_API_KEY,
);
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
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
    const snapshot = await db
      .collection("wardrobe")
      .where("uid", "==", uid)
      .get();
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
            content:
              "You are a fashion stylist. Based on occasion, vibe, and weather in a city, return 1–2 complete outfit suggestions using items the user owns. Respond as a JSON object: { style_note: string, outfits: [ { items: [ { name, category, color, image_url } ] } ] }",
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
      },
    );

    const text = openaiRes.data.choices?.[0]?.message?.content;
    res.send(text);
  } catch (err) {
    console.error("❌ OpenAI error:", err.message);
    res.status(500).send("Outfit suggestion failed");
  }
});

// Auto-tag with Ximilar + Cleaned Upload

app.post("/auto-tag", async (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.status(400).send("Missing image_url");

  try {
    // Step 1: Background Removal
    const bgRes = await axios.post(
      "https://api.ximilar.com/removebg/precise/removebg",
      { records: [{ _url: image_url }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const cleanedUrl = bgRes.data?.records?.[0]?.output?._url;
    if (!cleanedUrl) throw new Error("No cleaned image returned from Ximilar");

    // Step 2: Fetch cleaned image buffer from Ximilar
    const cleanedImageRes = await axios.get(cleanedUrl, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(cleanedImageRes.data, "binary");

    // Step 3: Upload cleaned image to Firebase Storage
    const fileName = `cleaned/${uuidv4()}.png`;
    const file = bucket.file(fileName);
    await file.save(buffer, {
      metadata: { contentType: "image/png" },
    });

    const firebaseImageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    // Step 4: Send cleaned image to Ximilar tagger
    const tagRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/tags",
      { records: [{ _url: firebaseImageUrl }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const record = tagRes.data?.records?.[0];
    const tags = record?._tags_simple || [];
    const name = record?._tags_map?.Subcategory || "Unnamed";
    const category = record?._tags_map?.Category || "";
    const color = record?._tags_map?.Color || "";

    // Step 5: Return cleaned Firebase URL + tags
    res.json({ image_url: firebaseImageUrl, name, category, color, tags });
  } catch (err) {
    console.error("❌ Auto-tag failed:", err.message);
    if (err.response?.data) {
      console.error("❌ Response details:", JSON.stringify(err.response.data, null, 2));
    }
    res.status(500).send("Auto-tagging failed");
  }
});



const PORT = process.env.PORT || 3000;
app
  .listen(PORT, "0.0.0.0", () => {
    console.log(`API running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
  });
