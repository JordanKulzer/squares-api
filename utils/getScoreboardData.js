// utils/getScoreboardData.js
const axios = require("axios");

async function getScoreboardDataForDate(date) {
  const dateParam = date.toISOString().split("T")[0].replace(/-/g, "");

  try {
    const res = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateParam}`
    );

    return res.data.events || [];
  } catch (err) {
    console.error(`Failed to fetch scoreboard for ${dateParam}:`, err.message);
    return [];
  }
}

module.exports = getScoreboardDataForDate;
