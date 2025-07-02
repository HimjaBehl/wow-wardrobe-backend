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
        image_url,         // preview thumbnail
        imagePath: `wardrobe/${file.name}`,   // add this line
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
            content: "You are a smart, creative personal stylist AI. Always respond in clean JSON."
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
    throw err; // Pass error up to be caught in your /suggest-outfit route
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

// ✅ Weather type to tag mappings
const weatherTagMap = {
  hot: ["sleeveless", "cotton", "light", "linen"],
  rainy: ["waterproof", "jacket", "boots", "hooded"],
  cold: ["wool", "layers", "sweater", "fleece", "coat"]
};

// ✅ Helper to detect weather type from text
function getWeatherType(description = "") {
  const desc = description.toLowerCase();
  if (desc.includes("rain") || desc.includes("storm")) return "rainy";
  if (desc.includes("cold") || desc.includes("snow") || desc.includes("chill")) return "cold";
  if (desc.includes("hot") || desc.includes("sun") || desc.includes("clear")) return "hot";
  return "hot"; // default fallback
}

// ---------- give AI a stable id it can refer to ----------
 // wid = wardrobe-id

// generateOutfitPrompt.js  (or inside the route)

/**
 * Build the textual prompt we send to GPT.
 * ────────────────────────────────────────────────
 * @param {Array}  list         – wardrobe items AFTER all filters
 * @param {String} occasion     – “casual”, “formal” … (may be mapped from vibe)
 * @param {String} vibe         – “fun”, “elegant”, …
 * @param {String} city         – user-supplied city (for weather call)
 * @param {String} constraints  – free-text style prefs (“no black”, “no heels”…)
 * @param {String} weatherType  – “hot” | “cold” | “rainy”  (derived from wttr.in)
 */
function generateOutfitPrompt(list, occasion, vibe, city, constraints, weatherType){
  const wardrobeLines = list
    .map((it)=>`#${it.wid}: ${it.name} | ${it.category} | ${it.color}`)
    .join('\n');

  return `
You are a top–tier fashion stylist AI. Create exactly **2 structured outfits** for a "${occasion}" "${vibe}" event in ${city}.

Choose from the wardrobe list below. Use only the wid numbers to refer to items.

Each outfit must follow **one of these valid formats**:
- Format A: top + bottom + shoes + (optional accessory or outerwear)
- Format B: dress + shoes + (optional outerwear or accessory)

Outfit rules:
- 3 to 5 total pieces per outfit.
- Each item must have a unique wid. No repeats.
- Never mix dress with top/bottom in the same look.
- Prioritize weather-appropriate choices for ${city} (${weatherType}).
- Obey user constraints: ${constraints || "none"}
- List the pieces in this order when you answer:
1. upper-wear (top *or* dress)
2. bottom (skip if dress used)
3. bag (optional but before shoes)
4. shoes
5. accessories / outerwear (optional)


Return this JSON:
{
  "outfits": [
    {
      "style_note": "...",
      "items": [ { "wid": 1 }, { "wid": 4 }, ... ]
    },
    ...
  ]
  }
`;
}


function normaliseCategory(cat = "") {
  return cat.toLowerCase()
            .replace(/[^a-z]/g, "")        // keep letters only
            .replace(/(wear|es|s)$/, "");   // jeans -> jean, dresses -> dress
}

const BUCKETS = {
  upperwear : ["shirt","blouse","kurta","tee","cardigan","tshirt","top"],
  bottomwear: ["pant","pants","trouser","trousers","jean","jeans","skirt","short","shorts"],
  dress     : ["dress","jumpsuit"],
  outerwear : ["jacket","blazer","coat","shrug"],
  footwear  : ["sneaker","heel","sandal","boot","shoe"],
  accessory : ["bag","belt","scarf","jewellery","eyewear","sunglass"]
};

function getBucket(cat){
  const key = normaliseCategory(cat);
  return Object.keys(BUCKETS).find(b => BUCKETS[b].some(k => key.includes(k)));
}

/* ──── BEGIN SLOT_MAP block ──── */
const SLOT_MAP = {
  top: ["top","shirt","t-shirt","tee","blouse","kurta","cardigan","sweater"],
  bottom: ["pant","pants","trouser","trousers","jean","jeans",
           "skirt","short","shorts"],
  dress: ["dress","dresses","jumpsuit"],
  shoes: ["sneaker","sneakers","heel","heels","boot","boots",
          "shoe","sandals","loafer"],
  bag: ["bag","handbag","tote","crossbody","sling"],
  outerwear: ["jacket","coat","blazer","shrug","trench"],
  accessory: ["belt","scarf","earring","bracelet","jewellery",
              "sunglass","sunglasses","watch"]
};

const ORDER = [
  "top",          // or dress (comes next)
  "dress",
  "bottom",
  "bag",
  "shoes",
  "outerwear",
  "accessory"
];

function detectSlot(name = "", category = "") {
  const txt = `${name} ${category}`.toLowerCase();
  return Object.entries(SLOT_MAP)
               .find(([slot, keys]) => keys.some(k => txt.includes(k)))
               ?.[0];
}
/* ──── END SLOT_MAP block ──── */



// ✅ Suggest Outfit
app.post("/suggest-outfit", async (req, res) => {
  let { items, occasion, vibe, city, constraints, uid } = req.body;
  
  // ----------  variables we’ll mutate ----------
  let weatherType   = "hot";      // default until we fetch wttr.in
    let preferredTags = [];         // maps to hot / cold / rainy
    let usableItems   = items;      // will shrink with filters

  try {
    console.log("🛬 /suggest-outfit called with body:", req.body);
    const response = await fetch(`https://wttr.in/${city}?format=%C`);
    const weatherDescription = await response.text();
    weatherType = getWeatherType(weatherDescription);
    preferredTags = weatherTagMap[weatherType] || [];
    console.log("🌦️ Weather:", weatherDescription, "→", weatherType);

  } catch (err) {
    console.warn("⚠️ Failed to fetch weather info:", err.message);
  }

  // ----------  WEATHER FILTER  ----------
  const filteredItems = items.filter(it => {
     const tags = (it.tags || []).map(t => t.toLowerCase());
     return preferredTags.some(tag => tags.includes(tag));
   });
  
  // 2️⃣ keep the filter only if it still leaves us ≥ 5 options
  // only accept the weather filter if we still have some breadth
  usableItems = filteredItems.length >= 5 ? filteredItems : items;
  console.log(
    "👚 Items kept after weather filter:",
    `${filteredItems.length}/${items.length}`
  );
  // --------------------------------------

  // ✅ FILTER OUT ITEMS BASED ON USER CONSTRAINTS
  if (constraints && constraints.toLowerCase().includes("no")) {
    const blockedTerms = constraints
      .toLowerCase()
      .split("no")
      .map((term) => term.trim())
      .filter(Boolean); // remove empty strings

    usableItems = usableItems.filter((item) => {
      const itemTags = [
        item.name?.toLowerCase() || "",
        item.category?.toLowerCase() || "",
        item.color?.toLowerCase()    || "",   
        ...(item.tags || []).map((tag) => tag.toLowerCase())
      ];

      return !blockedTerms.some((blocked) =>
        itemTags.some((tag) => tag.includes(blocked))
      );
    });

    console.log("⛔ Removed items matching constraints:", blockedTerms);
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
      const saved = docSnap.data().stylePrefs || "";
      constraints = [saved, constraints].filter(Boolean).join(" ").trim(); // keep both
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch user constraints:", err.message);
  }

  // 🚫 HARD LIMIT – only send the first 40 items to keep token count safe
  if (usableItems.length > 40) {
    console.warn(`✂️  Trimming wardrobe from ${usableItems.length} to 40 items`);
    usableItems = usableItems.slice(0, 40);
  }

  //give every surviving piece a unique wid\
  usableItems = usableItems.map((it, idx) => ({ ...it, wid: idx }));
  const prompt = generateOutfitPrompt(usableItems, occasion, vibe, city, constraints, weatherType);


  console.log("📨 Final OpenAI Prompt:\n", prompt);

  try {
      console.log("🧠 Payload into prompt:", { usableItems, occasion, vibe, city, constraints });
      console.log("📨 Prompt text:\n", prompt);
  
      // ----------  CALL OPENAI ----------
      const output = await callOpenAI(prompt);   // <-- real call
      console.log("🧠 Raw model output:", output);


    // safe parse + fallback
    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch (e) {
      console.error("🧠 GPT response parsing failed:", output);
      return res.json({ outfits: [] });
    }

    // ✅ Skip remapping if usableItems or wid match fails
    // ✅ Skip remapping if usableItems or wid match fails
    if (!parsed.outfits || !Array.isArray(parsed.outfits)) {
      return res.json({ outfits: [] });
    }

      /* ──── BEGIN slot-aware resolver (paste this) ──── */
      const resolvedOutfits = parsed.outfits.map(raw => {
        const usedSlots = new Set();
        const items = [];

        for (const ref of raw.items) {
          const it = ("wid" in ref) ? usableItems[ref.wid] : ref;
          const slot = detectSlot(it.name, it.category) || "accessory";

          // ── hard guards ───────────────────────────────
          if (slot === "dress" && (usedSlots.has("top") || usedSlots.has("bottom")))
            continue; // no tops/bottoms if dress picked

          if ((slot === "top" || slot === "bottom") && usedSlots.has("dress"))
            continue; // don't add top/bottom after dress

          if (usedSlots.has(slot)) continue; // one per slot
          // ─────────────────────────────────────────────

          usedSlots.add(slot);
          items.push({ ...it, _slot: slot });
        }

        // validity check: need shoes AND (dress OR (top+bottom))
        const valid =
          usedSlots.has("shoes") &&
          (usedSlots.has("dress") ||
           (usedSlots.has("top") && usedSlots.has("bottom")));

        if (!valid) return null; // drop the outfit completely

        // pretty order for your front-end
        items.sort((a, b) => ORDER.indexOf(a._slot) - ORDER.indexOf(b._slot));

        return { style_note: raw.style_note, items };
      }).filter(Boolean); // removes any nulls
      /* ──── END slot-aware resolver ──── */

    });

      

    res.json({ outfits: resolvedOutfits });

  

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