import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import axios from "axios";
import { db } from "./firebase.js"; // already exists in your project
import { validateLook } from "./lib/fashionBrain.js";
import { validateLookAgainstRules } from "./lib/styleRules.js";
import { styleMoodMap } from "./styleMoodMap.js";

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.6,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/* ─── Tools ─── */
const wardrobeTool = new DynamicTool({
  name: "wardrobe",
  description: "Fetch wardrobe for a given uid",
  func: async (uid) => {
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    return JSON.stringify(snap.docs.map((d) => d.data()));
  },
});

const weatherTool = new DynamicTool({
  name: "weather",
  description: "Get current weather for a city",
  func: async (city) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?units=metric&q=${encodeURIComponent(
      city
    )}&appid=${process.env.OPENWEATHER_API_KEY}`;
    const { data } = await axios.get(url);
    return `${data.weather?.[0]?.description}, ${Math.round(data.main.temp)}°C`;
  },
});

const moodTool = new DynamicTool({
  name: "mood",
  description: "Map style mood to fashion guidance (colors, silhouettes, vibe)",
  func: async (mood) => JSON.stringify(styleMoodMap[mood.toLowerCase()] || {}),
});

const validateTool = new DynamicTool({
  name: "validate",
  description: "Validate an outfit with fashion rules",
  func: async (outfitJson) => {
    const outfit = JSON.parse(outfitJson);
    const fb = validateLook(outfit);
    const rules = validateLookAgainstRules({ items: outfit });
    return JSON.stringify({ fb, rules });
  },
});

/* ─── Executor ─── */
export async function runTina({ uid, city, mood, occasion }) {
  const executor = await initializeAgentExecutorWithOptions(
    [wardrobeTool, weatherTool, moodTool, validateTool],
    llm,
    {
      agentType: "openai-functions",
      verbose: true,
    }
  );

  const input = `
You are Tina, a fashion stylist.

Steps you must follow:
1. Fetch wardrobe(uid).
2. Fetch weather(city).
3. Fetch mood(mood).
4. Suggest 2 outfits (3–5 items each).
   - Always include footwear.
   - Explain why each look works (color theory, silhouette, balance).
5. Validate outfits using validate(outfit).

Return JSON with {looks: [{title, style_note, items[]}]}.
`;

  const result = await executor.call({ input });
  return result.output;
}
