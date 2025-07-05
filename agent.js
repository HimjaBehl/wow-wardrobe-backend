/* lib/agent.js
   ultra-small wrapper around OpenAI chat – no undefined vars */

require("dotenv").config();
const { ChatOpenAI } = require("@langchain/openai");

/* ---------- helper: strip ``` fences & parse ------------------------- */
function safeJson(text = "") {
  const cleaned = text.replace(/```json\s*([\s\S]*?)```/i, "$1").trim();
  try { return JSON.parse(cleaned); }
  catch {
    console.warn("⚠️  LLM returned invalid JSON:\n" + text);
    return { looks: [], error: "Invalid JSON from LLM" };
  }
}

/* ---------- exported factory ---------------------------------------- */
async function setupAgent() {
  const model = new ChatOpenAI({
    temperature : 0.7,
    modelName   : "gpt-3.5-turbo",
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  return {
    call: async ({ input }) => {
      try {
        /* 1️⃣ ask the model */
        const response = await model.invoke([
          { role: "system", content: "You are a fashion stylist AI." },
          { role: "user",   content: input }          // <-- use finalInput
        ]);

        console.log("📝 Raw LLM text:", response.content);

        /* 2️⃣ parse */
        const parsed = safeJson(response.content);
        if (!Array.isArray(parsed.looks)) parsed.looks = [];

        console.log("✅ Parsed JSON:", JSON.stringify(parsed, null, 2));
        return { output: parsed };

      } catch (err) {
        console.error("💥 Agent crashed:", err);
        return { output: { looks: [], error: "Agent call failed" } };
      }
    }
  };
}

module.exports = setupAgent;
