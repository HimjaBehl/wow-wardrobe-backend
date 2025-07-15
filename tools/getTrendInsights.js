
const { execSync } = require('child_process');

// Function that uses the Python script for trend insights
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

module.exports = getTrendInsights;
