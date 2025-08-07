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

  // Try NCAA scoreboard if not found
  if (!found) {
    games = await getNcaafScoreboardDataForDate(parsedDate);
    found = games.find((g) => g.id === eventId);
    if (found) source = "ncaaf";
  }

  const fallbackLeagues = ["college-football", "nfl"];
  for (const league of fallbackLeagues) {
    try {
      const summaryRes = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/${league}/summary?event=${eventId}`
      );

      const competition =
        summaryRes.data?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        ) ??
        summaryRes.data?.header?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        );

      if (competition) {
        // console.log(
        //   `✅ Found competition in summary fallback (${league}):`,
        //   competition
        // );
        found = { competitions: [competition] };
        source = "summary";
        break; // exit the loop early
      }
    } catch (err) {
      console.warn(`❌ ${league} summary fallback failed:`, err.message);
    }
  }

  if (!found) {
    console.warn(`Game not found for eventId ${eventId}`);
    return res.status(404).json({ error: "Game not found" });
  }

  try {
    const comp =
      found.competitions?.[0] || found.competition?.[0] || found.competition;

    const home = comp?.competitors?.find((c) => c.homeAway === "home");
    const away = comp?.competitors?.find((c) => c.homeAway === "away");

    // Robust score parsing
    const parseLineScores = (team) =>
      team?.linescores?.map((s) => {
        const val = parseInt(s.displayValue, 10);
        return isNaN(val) ? null : val;
      }) ?? [];

    const toCumulative = (arr) => {
      const result = [];
      arr.reduce((sum, val, i) => {
        const next = (sum ?? 0) + (val ?? 0);
        result[i] = next;
        return next;
      }, 0);
      return result;
    };

    const homeRaw = parseLineScores(home); // e.g., [0, 7, 6, 7]
    const awayRaw = parseLineScores(away); // e.g., [14, 7, 6, 7]

    const homeScores = toCumulative(homeRaw); // [0, 7, 13, 20]
    const awayScores = toCumulative(awayRaw); // [14, 21, 27, 34]
    console.log("homeScores:", homeScores, "/ awayScores: ", awayScores);

    const quarterScores = Array.from({
      length: Math.max(homeScores.length, awayScores.length, 4),
    }).map((_, i) => {
      const homeQ = homeScores[i] ?? null;
      const awayQ = awayScores[i] ?? null;

      let winner = null;
      if (homeQ != null && awayQ != null) {
        winner =
          homeQ > awayQ ? home?.team?.displayName : away?.team?.displayName;
      } else if (homeQ != null) {
        winner = home?.team?.displayName;
      } else if (awayQ != null) {
        winner = away?.team?.displayName;
      }

      return {
        quarter: `Q${i + 1}`,
        home: homeQ,
        away: awayQ,
        winner,
      };
    });

    res.json({
      id: eventId,
      source,
      date: comp.date,
      league: comp?.league?.abbreviation ?? "unknown",

      rawHome: home,
      rawAway: away,

      // Display mappings
      fullTeam1: away?.team?.displayName,
      fullTeam2: home?.team?.displayName,
      team1_abbr: away?.team?.abbreviation,
      team2_abbr: home?.team?.abbreviation,

      homeTeam: {
        ...home?.team,
        logo: home?.team?.logo,
      },
      awayTeam: {
        ...away?.team,
        logo: away?.team?.logo,
      },

      quarterScores,
      completed: comp?.status?.type?.completed ?? false,
    });
  } catch (err) {
    console.error("❌ Parsing error:", err.message);
    res.status(500).json({ error: "Failed to parse game data" });
  }
});

module.exports = router;
