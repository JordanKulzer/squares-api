// utils/apisports/getApiSportsData.js
const axios = require("axios");

const BASE_URL = "https://v1.american-football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY;

/**
 * Fetch games from API-Sports (NFL or NCAAF)
 * @param {string} leagueType - "NFL" or "NCAAF"
 * @param {string} dateStr - Calendar day string in YYYY-MM-DD (local date from client)
 */
async function getApiSportsData(leagueType, dateStr) {
  // 👇 Client already sends the correct local date string
  const d = dateStr;

  const leagueIds = { NFL: 1, NCAAF: 2 };
  const leagueId = leagueIds[leagueType.toUpperCase()] || 1;

  try {
    const res = await axios.get(`${BASE_URL}/games`, {
      headers: { "x-apisports-key": API_KEY },
      params: { date: d, league: leagueId },
    });

    const games = res.data?.response ?? [];
    console.log(`📊 API-Sports returned ${games.length} games for ${d}`);

    if (games.length === 0) {
      console.warn(`⚠️ No ${leagueType} games found for ${d}`);
      return [];
    }

    return games.map((g) => {
      const timestamp = g.game?.date?.timestamp;
      const isoDate = timestamp
        ? new Date(timestamp * 1000).toISOString()
        : `${g.game?.date?.date}T${g.game?.date?.time}:00Z`;

      return {
        id:
          String(g.game?.id || g.fixture?.id || g.id) ||
          Math.random().toString(36).slice(2),
        date: isoDate,
        league: leagueType,
        homeTeam: g.teams?.home?.name || "TBD",
        awayTeam: g.teams?.away?.name || "TBD",
        homeLogo: g.teams?.home?.logo || "",
        awayLogo: g.teams?.away?.logo || "",
        status:
          g.game?.status?.short ||
          g.fixture?.status?.short ||
          g.game?.status?.long ||
          "Scheduled",
      };
    });
  } catch (err) {
    console.error(
      "❌ API-Sports fetch error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = { getApiSportsData };
