const getTrendInsights = require("./tools/getTrendInsights");


async function testTrends() {
  const query = "Tell me about Loro Piana Fall 2025 fashion trends";

  const result = await getTrendInsights(query);

  console.log("\n🔍 Trend Insights:\n");

  if (result && result.length > 0) {
    console.log(result); // For now, this will show the raw trend content
  } else {
    console.log("No matching trend insights found.");
  }
}

testTrends();
