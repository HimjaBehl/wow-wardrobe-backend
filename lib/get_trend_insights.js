const { Tool } = require("langchain/tools");
const { createClient } = require("@supabase/supabase-js");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { SupabaseVectorStore } = require("langchain/vectorstores/supabase");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseKey);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const vectorStore = new SupabaseVectorStore(embeddings, {
  client,
  tableName: "trend_embeddings",
  queryName: "match_trends",
});

const getTrendInsights = new Tool({
  name: "get_trend_insights",
  description: "Fetches current fashion trends from Pinterest or Vogue Runway by matching input with trend embeddings",
  func: async (query) => {
    try {
      const results = await vectorStore.similaritySearch(query, 3);
      return results.map(r => r.pageContent).join("\n");
    } catch (err) {
      return "Trend search failed: " + err.message;
    }
  },
});

module.exports = getTrendInsights;
