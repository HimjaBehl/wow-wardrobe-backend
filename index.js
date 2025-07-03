require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const setupAgent = require("./agent");
const { v4: uuidv4 } = require("uuid");
const { db, storage } = require("./firebase");
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

/* ─── AI Stylist: Suggest outfit ─── */
app.post("/suggest-outfit", async (req, res) => {
  const { uid, occasion = "casual", vibe = "fun" } = req.body;
  // ✅ Clean defaults to avoid crash on
  const occasionFormatted = occasion ? typeof occasion === "string" ? safeLower(occasion) : "" : "";
  const vibeFormatted = vibe ? typeof vibe === "string" ? safeLower(vibe) : "" : "";

  if (!uid) return res.status(400).json({ error: "uid is required" });

  try {
    const agent = await setupAgent();

    console.log("📩 Calling agent with:", { uid, occasion, vibe });
    
                                       const result = await agent.call({ input: `You are a fashion stylist. You must respond ONLY in strict JSON format. Do not include any explanation.

      Suggest a complete outfit for a "${occasion}" occasion with a "${vibe}" vibe for user ${uid}. Here is the format to follow:

      {
        "outfit": [
          { "name": "White Shirt", "image_url": "https://example.com/shirt.jpg" },
          { "name": "Blue Jeans", "image_url": "https://example.com/jeans.jpg" }
        ]
      }
      Return only valid JSON. Do not include any other text.`,


    });
    console.log("🧠 RAW result from agent:", result);
    console.log("🧪 Agent raw output before parse:", JSON.stringify(result, null, 2));

    return res.json(result.output);
    

    } catch (err) {
      console.error("🔥 JSON Parse Failed", err);
      return res.status(500).json({
        error: "Agent failed",
        message: "Failed to parse AI output. " + err.message,
      });
    }


  } catch (err) {
    console.error("🔥 Agent error:", err);
    res.status(500).json({ error: "Agent failed", message: err.message });
  }
});
/* ─── End suggest-outfit ─── */




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