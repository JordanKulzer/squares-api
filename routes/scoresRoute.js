// routes/scoresRoute.js
const express = require("express");
const axios = require("axios");
const getScoreboardDataForDate = require("../utils/getScoreboardData");
const getNcaafScoreboardDataForDate = require("../utils/getNcaafScoreboardData");

const router = express.Router();

router.get("/", async (req, res) => {
  const { eventId, startDate } = req.query;
  if (!eventId || !startDate) {
    return res.status(400).json({ error: "Missing eventId or startDate" });
  }

  const parsedDate = new Date(startDate);
  if (isNaN(parsedDate)) {
    return res.status(400).json({ error: "Invalid startDate format" });
  }

  let found = null;
  let source = "none";

  // Try NFL scoreboard first
  let games = await getScoreboardDataForDate(parsedDate);
  found = games.find((g) => g.id === eventId);
  if (found) source = "nfl";

  // Try NCAA scoreboard next
  if (!found) {
    games = await getNcaafScoreboardDataForDate(parsedDate);
    found = games.find((g) => g.id === eventId);
    if (found) source = "ncaaf";
  }

  if (!found) {
    try {
      const summaryRes = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}`
      );

      const competition =
        summaryRes.data?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        ) ??
        summaryRes.data?.header?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        );

      if (competition) {
        console.log("✅ Found competition in summary fallback:", competition);

        found = {
          competitions: [competition],
        };
        source = "summary";
      } else {
        console.warn("❌ Competition not found in summary response");
      }
    } catch (err) {
      console.warn("Final fallback (summary) failed:", err.message);
    }
  }

  if (!found) {
    console.warn(`Game not found for eventId ${eventId}`);
    return res.status(404).json({ error: "Game not found" });
  }

  try {
    const comp =
      found.competitions?.[0] || found.competition?.[0] || found.competition;
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");

    const homeScores = home?.linescores?.map((s) => s.value) || [];
    const awayScores = away?.linescores?.map((s) => s.value) || [];

    const quarterScores = Array.from({
      length: Math.max(homeScores.length, awayScores.length, 4),
    }).map((_, i) => {
      const homeQ = homeScores[i] ?? null;
      const awayQ = awayScores[i] ?? null;

      return {
        quarter: `${i + 1}Q`,
        home: homeQ,
        away: awayQ,
        winner:
          homeQ != null && awayQ != null
            ? homeQ > awayQ
              ? home.team.displayName
              : away.team.displayName
            : homeQ == null && awayQ == null
            ? null
            : homeQ != null
            ? home.team.displayName
            : away.team.displayName,
      };
    });

    res.json({
      id: eventId,
      source,
      date: comp.date,
      league: comp?.league?.abbreviation ?? "unknown", // "NFL" or "NCAAF"

      // For display
      fullTeam1: away?.team?.displayName,
      fullTeam2: home?.team?.displayName,

      // Team display info
      homeTeam: {
        name: home?.team?.name,
        location: home?.team?.location,
        displayName: home?.team?.displayName,
        shortDisplayName: home?.team?.shortDisplayName,
        abbreviation: home?.team?.abbreviation,
        logo: home?.team?.logo,
      },

      awayTeam: {
        name: away?.team?.name,
        location: away?.team?.location,
        displayName: away?.team?.displayName,
        shortDisplayName: away?.team?.shortDisplayName,
        abbreviation: away?.team?.abbreviation,
        logo: away?.team?.logo,
      },

      quarterScores,
    });
  } catch (err) {
    console.error("Parsing error:", err.message);
    res.status(500).json({ error: "Failed to parse game data" });
  }
});

module.exports = router;
