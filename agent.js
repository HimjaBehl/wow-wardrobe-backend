const { ChatOpenAI } = require("@langchain/openai");
const { StructuredOutputParser } = require("langchain/output_parsers");
const { z } = require("zod");

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    outfit: z
      .array(
        z.object({
          name: z.string().describe("Name of the clothing item"),
          image_url: z.string().url().describe("Image URL of the item"),
        })
      )
      .describe("List of clothing items in the outfit"),
  })
);

const formatInstructions = parser.getFormatInstructions();

async function setupAgent() {
  return {
    call: async ({ input }) => {
      const model = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-3.5-turbo",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `You are a fashion stylist. Suggest a complete outfit for this: ${input}

${formatInstructions}`;

const response = await model.invoke([
  { role: "system", content: "You are a fashion stylist …" },
  { role: "user",   content: prompt },
]);

// ---- PATCH bad storage domain ↓ ---------------------------
const parsed = await parser.parse(response.content);
parsed.outfit = parsed.outfit.map(item => ({
  ...item,
  image_url: item.image_url.replace(
    "firebasestorage.app",
    "firebasestorage.googleapis.com"
  ),
}));
// -----------------------------------------------------------

return { output: parsed };
    },
  };
}

module.exports = setupAgent;
