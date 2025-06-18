require("dotenv").config();
console.log(
  "c18c7777bcbd1744dc0e1d7f65841c98ff135c7f",
  process.env.XIMILAR_API_KEY,
);

const express = require("express");
const app = express(); // ✅ define app FIRST
app.get("/", (req, res) => {
  res.send("🎉 WOW Wardrobe backend is live!");
});
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

// ✅ Firebase Init
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "wowapp1406.appspot.com",
});
const db = getFirestore();
const bucket = getStorage().bucket();

app.use(cors());
app.use(express.json());

// ... (your routes remain unchanged)
// ✅ Fetch wardrobe items for a specific user
app.get("/wardrobe", async (req, res) => {
  console.log("🔥 /wardrobe GET hit. UID:", req.query.uid);

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
    console.error("❌ Firestore fetch error:", err.message);
    res.status(500).send("Failed to fetch wardrobe");
  }
});

// ✅ /auto-tag route — stays the same as you shared
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
      },
    );

    const cleanedUrl = bgRes.data?.records?.[0]?.output?._url;
    if (!cleanedUrl) throw new Error("Background removal failed.");

    // Step 2: Download cleaned image
    const imageRes = await fetch(cleanedUrl);
    const buffer = await imageRes.buffer();
    const fileName = `wardrobe/cleaned_${uuidv4()}.png`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: {
        contentType: "image/png",
      },
    });

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    // Step 3: Auto-tag the Firebase-hosted image
    const tagRes = await axios.post(
      "https://api.ximilar.com/tagging/fashion/v2/tags",
      { records: [{ _url: signedUrl }] },
      {
        headers: {
          Authorization: `Token ${process.env.XIMILAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const tags = tagRes.data?.records?.[0]?._tags_simple || [];
    const name = tagRes.data?.records?.[0]?._tags_map?.Subcategory || "Unnamed";
    const category = tagRes.data?.records?.[0]?._tags_map?.Category || "";
    const color = tagRes.data?.records?.[0]?._tags_map?.Color || "Unknown";

    res.json({ image_url: signedUrl, name, category, color, tags });
  } catch (err) {
    console.error("❌ Ximilar tagging error:", err.message);
    console.error("❌ Stack trace:", err.stack); // full line + file + error
    if (err.response?.data) {
      console.error("❌ Full Ximilar error response:", JSON.stringify(err.response.data, null, 2));
    console.error("❌ Full stack:", err.stack); // shows exact line number
    if (err.response?.data) {
      console.error(
        "❌ Full response body:",
        JSON.stringify(err.response.data, null, 2),
      );
    }
  res.status(500).send("Auto-tagging failed");
        } // ← this closes the catch block
      }; // ← this closes the app.post("/auto-tag") route

const PORT = process.env.PORT || 3000;
app
  .listen(PORT, "0.0.0.0", () => {
    console.log(`API running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Server failed to start:", err);
    process.exit(1);
    });
    });