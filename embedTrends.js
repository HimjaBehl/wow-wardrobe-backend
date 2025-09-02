import 'dotenv/config';
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// 🔑 Load keys
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function addTrend(content, source, url) {
  // 1. Get embedding from OpenAI
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",  // 1536-dim vector
    input: content
  });

  const embedding = embeddingResponse.data[0].embedding;

  // 2. Insert into Supabase
  const { error } = await supabase.from("fashion_trends").insert([
    {
      content,
      source,
      url,
      embedding
    }
  ]);

  if (error) {
    console.error("❌ Insert failed:", error);
  } else {
    console.log("✅ Inserted trend:", content);
  }
}

// Example trends
await addTrend("Metallic accessories are trending this season", "Vogue", "https://www.vogue.com/fashion/trends");
await addTrend("Denim maxi skirts are the must-have item of the season", "Pinterest", "https://www.pinterest.com/fashion/trends");
