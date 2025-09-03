import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import axios from "axios";
import { db } from "./firebase.js";
import { validateLook } from "./lib/fashionBrain.js";
import { validateLookAgainstRules } from "./lib/styleRules.js";
import { styleMoodMap } from "./styleMoodMap.js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/* ─── Supabase ─── */
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY env vars are required");
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
} catch (error) {
  console.error("Failed to initialize Supabase client:", error.message);
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.6,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/* ─── Tools ─── */
const wardrobeTool = new DynamicTool({
  name: "wardrobe",
  description: "Fetch wardrobe for a given uid",
  func: async (input) => {
    try {
      const uid = input.trim();
      const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
      return JSON.stringify(snap.docs.map((d) => d.data()));
    } catch (err) {
      return `Error in wardrobe tool: ${err.message}`;
    }
  },
});

const weatherTool = new DynamicTool({
  name: "weather",
  description: "Get current weather for a city",
  func: async (input) => {
    try {
      const city = input.trim();
      const url = `https://api.openweathermap.org/data/2.5/weather?units=metric&q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}`;
      const { data } = await axios.get(url);
      return `${data.weather?.[0]?.description}, ${Math.round(data.main.temp)}°C`;
    } catch (err) {
      return `Error in weather tool: ${err.message}`;
    }
  },
});

const moodTool = new DynamicTool({
  name: "mood",
  description: "Map style mood to fashion guidance",
  func: async (input) => {
    const mood = input.trim().toLowerCase();
    return JSON.stringify(styleMoodMap[mood] || {});
  },
});

const validateTool = new DynamicTool({
  name: "validate",
  description: "Validate an outfit with fashion rules",
  func: async (input) => {
    try {
      const outfit = JSON.parse(input);
      const fb = validateLook(outfit);
      const rules = validateLookAgainstRules({ items: outfit });
      return JSON.stringify({ fb, rules });
    } catch (err) {
      return `Error in validate tool: ${err.message}`;
    }
  },
});

const trendTool = new DynamicTool({
  name: "getTrendInsights",
  description: "Fetch top fashion trends related to wardrobe",
  func: async (input) => {
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input,
      });
      const embedding = embeddingResponse.data[0].embedding;

      const { data, error } = await supabase.rpc("match_trends", {
        query_embedding: embedding,
        match_count: 3,
      });

      if (error) {
        console.error("🔴 [trendTool] Supabase error:", error);
        return "Error fetching trends";
      }

      return JSON.stringify(data);
    } catch (err) {
      console.error("🔴 [trendTool] Exception:", err);
      return `Error in trend tool: ${err.message}`;
    }
  },
});

/* ─── Executor ─── */
export async function runTina({
  uid,
  city,
  mood,
  occasion,
  vibe,
  prompt,
  wardrobe = [],
}) {
  const executor = await initializeAgentExecutorWithOptions(
    [wardrobeTool, weatherTool, moodTool, validateTool, trendTool],
    llm,
    { agentType: "openai-functions", verbose: true },
  );

  const wardrobeJson = JSON.stringify(
    wardrobe.map((it) => ({
      id: String(it.id || ""),
      name: it.name || "",
      category: it.category || "",
      color: it.color || "",
      image_url: it.image_url || "",
      tags: it.tags || [],
    }))
  );

  const input = `
  You are Tina, a world-class AI stylist.

  CONTEXT:
  - UID: ${uid}
  - City: ${city}
  - Mood: ${mood}
  - Occasion: ${occasion}
  - Vibe: ${vibe}
  - Wardrobe JSON: ${wardrobeJson}

  TASK:
  1. Suggest **2–3 complete looks** (3–5 items each). Use wardrobe.id to reference items.
  2. Always include footwear if available.
  3. Each look MUST have:
     - "title"
     - "style_note"
     - "items" (list of { "id": "..." })
     - "trends_used" (list, can be empty)
  4. If unsure, STILL return at least 1 look.
  5. ⚠️ Do NOT ever return { "looks":[] }.

  Return ONLY valid JSON matching this schema:
  {
    "looks": [
      {
        "title": "Look 1",
        "style_note": "Why this outfit works",
        "items": [ { "idx": "0" } ],
        "trends_used": []
      }
    ]
  }
  `;

  console.log("🟢 TinaAgent input prompt:", input);

  const result = await executor.call({ input });
  console.log("🟠 TinaAgent executor raw result:", JSON.stringify(result, null, 2));

  let output = result.output || result.returnValues?.output || result.returnValues;

  // Try parsing if string
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch (err) {
      console.error("❌ JSON parse error:", err.message, output);
      return { looks: [], error: "Bad Tina output" };
    }
  }

  // If wrapped inside .raw
  if (output?.raw && typeof output.raw === "string") {
    try {
      output = JSON.parse(output.raw);
    } catch (err) {
      console.error("❌ Could not parse raw:", output.raw);
      return { looks: [], error: "Invalid Tina raw output" };
    }
  }

  // 🚨 Force fallback prevention
  if (!output?.looks || !Array.isArray(output.looks) || output.looks.length === 0) {
    console.warn("⚠️ Tina returned empty. Forcing 1 look.");
    output = {
      looks: [
        {
          title: "Emergency Look",
          style_note: "Auto-generated because Tina gave empty.",
          items: wardrobe.slice(0, 3).map(it => ({ id: String(it.id) })),
          trends_used: [],
        },
      ],
    };
  }

  return output;
}
