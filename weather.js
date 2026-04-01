
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import axios from "axios";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));

const app = express();
app.use(cors());
app.use(express.json());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// 🔥 POST wardrobe item with Ximilar auto-tagging
app.post("/wardrobe", async (req, res) => {
  try {
    const { image_url, uid } = req.body;
    if (!uid || !image_url) return res.status(400).send("Missing data");

    // 🧠 Get tags from Ximilar
    const ximilarRes = await axios.post(
      "https://api.ximilar.com/detection/fashion/v2/tagging/",
      { records: [{ _url: image_url }] },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
        },
      }
    );

    const tags = ximilarRes.data.records?.[0]?.tags || {};
    const name = tags["item"]?.[0]?.name || "Unnamed";
    const category = tags["item"]?.[0]?.name || "";
    const color = tags["color"]?.[0]?.name || "";

    const item = {
      uid,
      image_url,
      name,
      category,
      color,
      tags,
    };

    await db.collection("wardrobeItems").add(item);
    res.status(200).send("Item uploaded!");
  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).send("Failed to upload item.");
  }
});

// 🧠 AI suggestion route
app.post("/suggest-outfit", async (req, res) => {
  const { items, occasion, vibe, city } = req.body;

  const prompt = `
You are a stylist. Suggest 1–2 outfits for a ${occasion} event with a ${vibe} vibe in ${city}.
Use this wardrobe:
${items.map((item, i) => `${i + 1}. ${item.name}, ${item.category}, ${item.color}, ${item.image_url}`).join("\n")}
Format your response as:
{
  "outfits": [
    {
      "style_note": "...",
      "items": [
        {
          "name": "...",
          "category": "...",
          "color": "...",
          "image_url": "..."
        }
      ]
    }
  ]
}
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

    const reply = response.data.choices[0].message.content;
    const json = JSON.parse(reply);
    res.status(200).json(json);
  } catch (err) {
    console.error("AI error:", err.message);
    res.status(500).send("AI suggestion failed.");
  }
});

app.get("/wardrobe", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).send("Missing user UID");

    const snapshot = await db.collection("wardrobeItems").where("uid", "==", uid).get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (err) {
    res.status(500).send("Fetch failed");
  }
});

app.delete("/wardrobe/:id", async (req, res) => {
  try {
    await db.collection("wardrobeItems").doc(req.params.id).delete();
    res.status(200).send("Item deleted");
  } catch (err) {
    res.status(500).send("Delete failed");
  }
});

app.listen(3000, () => console.log("✅ Backend running on port 3000"));
