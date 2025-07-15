const getTrendInsights = require("./tools/getTrendInsights");

async function testTrends() {
  const query = "Pinterest outfit trends for fall 2025";
  const result = await getTrendInsights(query);
  console.log("\n🔍 Trend Insights:\n", result);
}

testTrends();
