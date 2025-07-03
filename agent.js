/* ─── agent.js ─────────────────────────────────────────────────────────
   Light-weight stylist agent that expects ONE JSON object:

   {
     "looks": [
       {
         "title": "Look 1",
         "items": [
           { "name": "...", "image": "https://..." }
         ]
       }
     ]
   }
   ------------------------------------------------------------------- */

const { ChatOpenAI } = require("@langchain/openai");

/* Small helper: robust JSON extraction  ------------------------------ */
function safeJson(text = "") {
  if (!text) return null;

  // strip ```json … ``` wrappers if the model added them
  const cleaned = text
    .replace(/```json\s*([\s\S]*?)```/i, "$1")   // fenced block
    .trim();

  try   { return JSON.parse(cleaned); }
  catch { return { looks: [] }; }
}

/* Fix old storage domain in returned URLs --------------------------- */
function patchImages(json = { looks: [] }) {   // ← default arg
  json.looks.forEach(look =>
    look.items?.forEach(it => {
      if (typeof it.image === "string") {
        it.image = it.image.replace(
          "firebasestorage.app",
          "firebasestorage.googleapis.com"
        );
      }
    })
  );
  return json;
}

/* MAIN exported factory --------------------------------------------- */
async function setupAgent() {
  const model = new ChatOpenAI({
    temperature : 0.7,
    modelName   : "gpt-3.5-turbo",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  return {
    call: async ({ input }) => {
      /* ––– Build the prompt ––– */
      const prompt = `
You are a professional fashion stylist AI.
Respond **only** with valid JSON and nothing else.

Expected schema:
{
  "looks": [
    {
      "title": "<short label>",
      "items": [
        { "name": "<item name>", "image": "<image URL>" }
      ]
    }
  ]
}

${input}`.trim();

      /* ––– Call LLM ––– */
      const response = await model.invoke([
        { role: "system", content: "You are a fashion stylist AI." },
        { role: "user",   content: prompt }
      ]);

      /* ––– Parse and patch ––– */
      const parsed = patchImages(safeJson(response.content));

      /* never let the caller see undefined */
          if (!Array.isArray(parsed.looks)) parsed.looks = [];

      return { output: parsed };
    }
  };
}

module.exports = setupAgent;
