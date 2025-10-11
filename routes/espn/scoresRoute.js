const express = require("express");
const axios = require("axios");
const getScoreboardDataForDate = require("../../utils/espn/getScoreboardData");
const getNcaafScoreboardDataForDate = require("../../utils/espn/getNcaafScoreboardData");

const router = express.Router();

router.get("/", async (req, res) => {
  const { eventId, startDate, league } = req.query;
  console.log("Requested league:", league);

  if (!eventId || !startDate) {
    return res.status(400).json({ error: "Missing eventId or startDate" });
  }

  const parsedDate = new Date(startDate);
  if (isNaN(parsedDate)) {
    return res.status(400).json({ error: "Invalid startDate format" });
  }

  let found = null;
  let source = league.toLowerCase();

  let games = [];
  if (league.toUpperCase() === "NCAAF") {
    games = await getNcaafScoreboardDataForDate(parsedDate);
  } else {
    games = await getScoreboardDataForDate(parsedDate);
  }
  found = games.find((g) => g.id === eventId);
  let drives = [];
  let state = "";
  const fallbackLeagues = ["college-football", "nfl"];
  for (const endpoint of fallbackLeagues) {
    try {
      const summaryRes = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/football/${endpoint}/summary?event=${eventId}`
      );

      const competition =
        summaryRes.data?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        ) ??
        summaryRes.data?.header?.competitions?.find(
          (c) => String(c.id) === String(eventId)
        );

      drives = summaryRes.data?.drives?.previous ?? [];

      if (competition) {
        state = competition?.status?.type?.state?.toLowerCase() || "unknown";

        found = { competitions: [competition] };
        source = "summary";
        break; // exit the loop early
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.warn(`❌ ${endpoint} summary fallback failed:`, err.message);
      }
    }
  }

  if (!found) {
    console.warn(`Game not found for eventId ${eventId}`);
    return res.status(404).json({ error: "Game not found" });
  }

  try {
    const comp =
      found.competitions?.[0] || found.competition?.[0] || found.competition;

    if (!state) {
      state = comp?.status?.type?.state?.toLowerCase() || "unknown";
    }

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

    let completedQuarters = 0;
    let lastPeriod = 0;

    drives.forEach((d, i) => {
      const endPeriod = Number(d?.end?.period?.number) || null;
      const endClock = d?.end?.clock?.displayValue;

      if (endPeriod) {
        // If we see a period jump (e.g., from 1 → 2), mark the previous one as completed
        if (endPeriod > lastPeriod) {
          completedQuarters = Math.max(completedQuarters, endPeriod - 1);
        }

        // Still allow the strict 0:00 case (when available)
        if (endClock === "0:00") {
          completedQuarters = Math.max(completedQuarters, endPeriod);
        }

        lastPeriod = endPeriod;
      }
    });

    console.log("state: ", state);
    res.json({
      id: eventId,
      source,
      date: comp.date,
      league: league.toUpperCase(),

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
      completedQuarters,
      completed: comp?.status?.type?.completed ?? false,
      gameState: state,
    });
    console.log("Responding with scores for", eventId);
  } catch (err) {
    console.error("❌ Parsing error:", err.message);
    res.status(500).json({ error: "Failed to parse game data" });
  }
});

module.exports = router;
