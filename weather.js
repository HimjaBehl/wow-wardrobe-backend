// weather.js
const axios = require("axios");

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

async function getWeatherByCity(city = "Delhi") {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric`;

  try {
    const response = await axios.get(url);
    const temp = response.data.main.temp;
    if (temp < 15) return "cold";
    if (temp > 30) return "hot";
    return "moderate";
  } catch (err) {
    console.error("❌ Weather fetch failed:", err.response?.data || err.message);
    return "moderate"; // fallback
  }
}

module.exports = { getWeatherByCity };
