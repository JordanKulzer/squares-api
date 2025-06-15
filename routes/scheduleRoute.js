// routes/scheduleRoute.js
const express = require("express");
const getScoreboardDataForDate = require("../utils/getScoreboardData");

const router = express.Router();

router.get("/", async (req, res) => {
  const startDateStr = req.query.startDate;
  if (!startDateStr) {
    return res.status(400).json({ error: "Missing startDate parameter" });
  }

  const startDate = new Date(startDateStr);
  const allGames = [];

  try {
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const events = await getScoreboardDataForDate(currentDate);
      events.forEach((event) => {
        const comp = event.competitions[0];
        const home = comp.competitors.find((c) => c.homeAway === "home");
        const away = comp.competitors.find((c) => c.homeAway === "away");

        allGames.push({
          id: event.id,
          date: event.date,
          homeTeam: home?.team?.shortDisplayName,
          awayTeam: away?.team?.shortDisplayName,
          homeLogo: home?.team?.logo,
          awayLogo: away?.team?.logo,
          status: comp.status?.type?.shortDetail,
        });
      });
    }

    res.json(allGames);
  } catch (err) {
    console.error("Schedule error:", err.message);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

module.exports = router;
