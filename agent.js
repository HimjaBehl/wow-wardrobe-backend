
/* lib/agent.js – Reasoning version */

import dotenv from "dotenv";
dotenv.config();
import { execSync } from 'child_process';

async function getTrendInsights(query) {
  try {
    const command = `python3 trend_insight_tool.py "${query}"`;
    const output = execSync(command).toString();
    return output.trim();
  } catch (err) {
    console.error("❌ Trend tool error:", err.message);
    return "Sorry, I couldn't fetch the latest trends right now.";
  }
}

import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";

/* ---------- helper: strip ``` fences & parse ------------------------- */
function safeJson(text = "") {
  const cleaned = text.replace(/```json\s*([\s\S]*?)```/i, "$1").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn("⚠️  LLM returned invalid JSON:\n" + text);
    return { looks: [], error: "Invalid JSON from LLM" };
  }
}

/* ---------- exported factory ---------------------------------------- */
async function setupAgent() {
  const model = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-3.5-turbo",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const reasoningChain = RunnableSequence.from([
    async (input) => {
      // Auto-call trend tool if user query mentions trends
      let trendInfo = "";
      if (input.toLowerCase().includes("trend") || input.toLowerCase().includes("pinterest")) {
        trendInfo = await getTrendInsights(input);
      }

      const initialPrompt = [
        {
          role: "system",
          content: `You are a fashion stylist AI. Generate outfit suggestions based on the user's wardrobe and preferences.
          You also have access to the latest fashion trend insights via the \`get_trend_insights()\` function. 
          Use it when the user's query mentions trends, Pinterest, or what's in fashion.`,
        },
        { role: "user", content: `${input}\n\nTREND_INSIGHTS:\n${trendInfo}` },
      ];
      const res = await model.invoke(initialPrompt);
      console.log("👗 Draft from Tina:", res.content);
      return { draft: res.content, originalInput: input };
    },

    async ({ draft, originalInput }) => {
      const critiquePrompt = [
        {
          role: "system",
          content:
            "You are a senior stylist reviewing another stylist's outfit choices. Identify if the looks follow style rules and improve if needed. Only return corrected looks in clean JSON format.",
        },
        {
          role: "user",
          content: `Prompt:\n${originalInput}\n\nDraft Looks:\n${draft}`,
        },
      ];
      const revisedRes = await model.invoke(critiquePrompt);
      console.log("🧠 Tina's Revised Output:", revisedRes.content);
      return safeJson(revisedRes.content);
    },
  ]);

  return {
    call: async ({ input }) => {
      try {
        const finalOutput = await reasoningChain.invoke(input);
        console.log("✅ Final Looks JSON:", JSON.stringify(finalOutput, null, 2));
        return { output: finalOutput };
      } catch (err) {
        console.error("💥 Reasoning loop failed:", err);
        return { output: { looks: [], error: "Reasoning loop crashed" } };
      }
    },
  };
}

export default setupAgent;
