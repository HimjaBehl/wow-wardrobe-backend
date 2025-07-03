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
        {
          role: "system",
          content: "You are a fashion stylist AI that ONLY responds in structured JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ]);

      return {
        output: await parser.parse(response.content),
      };
    },
  };
}

module.exports = setupAgent;
