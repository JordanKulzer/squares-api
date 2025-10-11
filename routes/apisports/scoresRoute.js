// routes/apisports/scoresRoute.js
const express = require("express");
const axios = require("axios");
const { getCache, setCache } = require("../../utils/cache");

const router = express.Router();
const BASE_URL = "https://v1.american-football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY;

router.get("/", async (req, res) => {
  const { eventId, league = "NFL" } = req.query;
  if (!eventId) return res.status(400).json({ error: "Missing eventId" });

  const cacheKey = `SCORES-${league}-${eventId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    console.log("🔍 Fetching API-Sports game id:", eventId, "league:", league);

    const { data } = await axios.get(`${BASE_URL}/games`, {
      headers: { "x-apisports-key": API_KEY },
      params: { id: eventId },
    });

    const gameData = data.response?.[0];
    if (!gameData) return res.status(404).json({ error: "Game not found" });

    // 🧮 Convert per-quarter → cumulative
    const home = gameData.scores?.home || {};
    const away = gameData.scores?.away || {};
    const quarters = [
      "quarter_1",
      "quarter_2",
      "quarter_3",
      "quarter_4",
      "overtime",
    ];

    let runningHome = 0;
    let runningAway = 0;

    const quarterScores = quarters
      .map((qKey, i) => {
        const qNum = i < 4 ? `Q${i + 1}` : "OT";
        const homeScore = home[qKey];
        const awayScore = away[qKey];
        if (homeScore == null && awayScore == null) return null;

        runningHome += homeScore ?? 0;
        runningAway += awayScore ?? 0;

        return {
          quarter: qNum,
          home: runningHome,
          away: runningAway,
          winner:
            runningHome > runningAway
              ? gameData.teams.home.name
              : runningAway > runningHome
              ? gameData.teams.away.name
              : null,
        };
      })
      .filter(Boolean);

    const completedQuarters = quarterScores.length;
    const status = gameData.status?.short;
    const isFinal = ["FT", "AOT"].includes(status);
    const hasAllQuarters = completedQuarters >= 4;
    const completed = isFinal || hasAllQuarters;

    const response = {
      id: String(gameData.id),
      date: gameData.date,
      league,
      fullTeam1: gameData.teams.away.name,
      fullTeam2: gameData.teams.home.name,
      team1_abbr: gameData.teams.away.code,
      team2_abbr: gameData.teams.home.code,
      quarterScores,
      completedQuarters,
      completed,
      gameState: status || "",
    };

    setCache(cacheKey, response, 60 * 1000);
    res.json(response);
  } catch (err) {
    console.error("❌ Scores fetch failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch game" });
  }
});

module.exports = router;
