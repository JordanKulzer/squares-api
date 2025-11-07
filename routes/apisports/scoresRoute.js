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
    console.log("📊 Fetching game", eventId, "league:", league);
    const { data } = await axios.get(`${BASE_URL}/games`, {
      headers: { "x-apisports-key": API_KEY },
      params: { id: eventId },
      timeout: 8000,
    });

    const gameData = data.response?.[0];
    if (!gameData) {
      console.warn("⚠️ No game data from API-Sports for", eventId);
      return res.status(404).json({ error: "Game not found" });
    }

    const team1 = gameData.teams?.away || {};
    const team2 = gameData.teams?.home || {};
    const scores = gameData.scores || {};
    const home = scores.home || {};
    const away = scores.away || {};

    // Build at least one entry so the frontend resolves loading
    const quarterScores = [];
    if (home.points != null || away.points != null) {
      quarterScores.push({
        quarter: "Total",
        home: home.points ?? 0,
        away: away.points ?? 0,
        winner:
          (home.points ?? 0) > (away.points ?? 0)
            ? team2.name
            : (away.points ?? 0) > (home.points ?? 0)
            ? team1.name
            : null,
      });
    }

    const response = {
      id: String(gameData.id || eventId),
      date: gameData.date,
      league,
      fullTeam1: team1.name,
      fullTeam2: team2.name,
      quarterScores,
      completedQuarters: quarterScores.length,
      completed: ["FT", "AOT"].includes(gameData.status?.short),
      gameState: gameData.status?.short || "",
    };

    setCache(cacheKey, response, 60 * 1000);
    res.json(response);
  } catch (err) {
    console.error("❌ Scores fetch failed:", err.response?.data || err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch game", details: err.message });
  }
});

module.exports = router;
