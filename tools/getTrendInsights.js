
const { Tool } = require("langchain/tools");
const { execSync } = require('child_process');

// Create a tool that uses the Python script for trend insights
const getTrendInsights = new Tool({
  name: "get_trend_insights",
  description: "Fetches current fashion trends from Pinterest or Vogue Runway by matching input with trend embeddings",
  func: async (query) => {
    try {
      const command = `python3 trend_insight_tool.py "${query}"`;
      const output = execSync(command).toString();
      return output.trim();
    } catch (err) {
      console.error("❌ Trend tool error:", err.message);
      return "Sorry, I couldn't fetch the latest trends right now.";
    }
  },
});

module.exports = getTrendInsights;
