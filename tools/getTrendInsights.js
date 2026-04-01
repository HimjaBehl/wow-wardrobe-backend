// tools/getTrendInsights.js
export default async function getTrendInsights({ query = "", source = "disabled", limit = 0 } = {}) {
  return {
    query,
    source,
    trends: [],
    disabled: true,
    message: "Trend insights disabled (python tool not used)."
  };
}
