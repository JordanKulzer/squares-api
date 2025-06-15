// routes/scoresRoute.js
const express = require("express");
const getScoreboardDataForDate = require("../utils/getScoreboardData");

const router = express.Router();

router.get("/", async (req, res) => {
  const { eventId, startDate } = req.query;
  if (!eventId || !startDate) {
    return res.status(400).json({ error: "Missing eventId or startDate" });
  }

  const start = new Date(startDate);

  try {
    let found = null;
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const events = await getScoreboardDataForDate(date);
      found = events.find((e) => e.id === eventId);
      if (found) break;
    }

    if (!found) return res.status(404).json({ error: "Game not found" });

    const comp = found.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");

    const homeScores = home?.linescores?.map((s) => s.value) || [];
    const awayScores = away?.linescores?.map((s) => s.value) || [];

    const scores = homeScores.map((homeQ, i) => ({
      quarter: `${i + 1}Q`,
      home: homeQ,
      away: awayScores[i],
      winner:
        homeQ > awayScores[i] ? home.team.displayName : away.team.displayName,
    }));

    res.json({
      id: found.id,
      date: found.date,
      homeTeam: home?.team?.displayName,
      awayTeam: away?.team?.displayName,
      homeLogo: home?.team?.logo,
      awayLogo: away?.team?.logo,
      quarterScores: scores,
    });
  } catch (err) {
    console.error("Scores error:", err.message);
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

module.exports = router;
