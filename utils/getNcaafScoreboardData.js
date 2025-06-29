// utils/getNcaafScoreboardDataForDate.js
const axios = require("axios");

async function getNcaafScoreboardDataForDate(date) {
  const dateParam = date.toISOString().split("T")[0].replace(/-/g, "");
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${dateParam}`;

  try {
    const res = await axios.get(url);
    if (
      process.env.NODE_ENV !== "production" &&
      (!res.data || !Array.isArray(res.data.events))
    ) {
      console.warn(`No Ncaaf games found for ${dateParam}`);
      return [];
    }

    return res.data.events;
  } catch (err) {
    console.error(
      `Ncaaf scoreboard fetch failed for ${dateParam}:`,
      err.message
    );
    return [];
  }
}

module.exports = getNcaafScoreboardDataForDate;
