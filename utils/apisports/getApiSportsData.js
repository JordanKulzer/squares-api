// utils/apisports/getApiSportsData.js
const axios = require("axios");

const BASE_URL = "https://v1.american-football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY;

/**
 * Fetch games from API-Sports (NFL or NCAAF)
 * @param {string} leagueType - "NFL" or "NCAAF"
 * @param {Date} date - JavaScript Date object
 */
async function getApiSportsData(leagueType, date) {
  // stay strictly local (ignore UTC)
  const localYear = date.getFullYear();
  const localMonth = date.getMonth();
  const localDay = date.getDate();

  // midnight local time so ISO date matches the local calendar day
  const localMidnight = new Date(localYear, localMonth, localDay, 0, 0, 0);
  const d = localMidnight.toISOString().split("T")[0];

  const leagueIds = { NFL: 1, NCAAF: 2 };
  const leagueId = leagueIds[leagueType.toUpperCase()] || 1;

  try {
    const res = await axios.get(`${BASE_URL}/games`, {
      headers: { "x-apisports-key": API_KEY },
      params: { date: d, league: leagueId },
    });

    const games = res.data?.response ?? [];
    console.log(`📊 API-Sports returned ${games.length} games`);

    if (games.length === 0) {
      console.warn(`⚠️ No ${leagueType} games found for ${d}`);
      return [];
    }

    return games.map((g) => {
      const timestamp = g.game?.date?.timestamp;
      let isoDate;

      if (timestamp) {
        // Convert the UTC timestamp to a *local* ISO string
        const localDate = new Date(timestamp * 1000);
        // reconstruct an ISO-like string without the trailing “Z”
        isoDate = `${localDate.getFullYear()}-${String(
          localDate.getMonth() + 1
        ).padStart(2, "0")}-${String(localDate.getDate()).padStart(
          2,
          "0"
        )}T${String(localDate.getHours()).padStart(2, "0")}:${String(
          localDate.getMinutes()
        ).padStart(2, "0")}:00`;
      } else {
        isoDate = `${g.game?.date?.date}T${g.game?.date?.time}:00Z`;
      }

      return {
        id: String(
          g.game?.id ||
            g.fixture?.id ||
            g.id ||
            Math.random().toString(36).slice(2)
        ),
        date: isoDate, // <— now includes real kickoff time
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
