// routes/espn/NcaafScoresRoute.js
const express = require("express");
const axios = require("axios");
const getNcaafScoreboardDataForDate = require("../../utils/espn/getNcaafScoreboardData");

const router = express.Router();

router.get("/", async (req, res) => {
  const { eventId, startDate } = req.query;
  if (!eventId || !startDate) {
    return res.status(400).json({ error: "Missing eventId or startDate" });
  }

  const date = new Date(startDate);
  let found = null;
  let drives = [];
  let state = "";

  try {
    for (let i = 0; i < 7; i++) {
      const d = new Date(date);
      d.setDate(date.getDate() + i);

      const events = await getNcaafScoreboardDataForDate(d);
      found = events.find((e) => e.id === eventId);
      if (found) break;
    }

    if (!found) return res.status(404).json({ error: "Game not found" });

    const summaryRes = await axios.get(
      `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}`
    );
    drives = summaryRes.data?.drives?.previous ?? [];

    const competition =
      summaryRes.data?.competitions?.find(
        (c) => String(c.id) === String(eventId)
      ) ??
      summaryRes.data?.header?.competitions?.find(
        (c) => String(c.id) === String(eventId)
      );

    if (competition) {
      state = competition?.status?.type?.state?.toLowerCase() || "unknown";
    }
    const comp = found.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");

    const parseLineScores = (team) =>
      team?.linescores?.map((s) => {
        const val = parseInt(s.displayValue ?? s.value, 10);
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

    const homeScores = toCumulative(parseLineScores(home));
    const awayScores = toCumulative(parseLineScores(away));

    const quarterScores = Array.from({
      length: Math.max(homeScores.length, awayScores.length, 4),
    }).map((_, i) => {
      const homeQ = homeScores[i] ?? null;
      const awayQ = awayScores[i] ?? null;

      let winner = null;
      if (homeQ != null && awayQ != null) {
        winner = homeQ > awayQ ? home.team.displayName : away.team.displayName;
      } else if (homeQ != null) {
        winner = home.team.displayName;
      } else if (awayQ != null) {
        winner = away.team.displayName;
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
    drives.forEach((d) => {
      const endPeriod = Number(d?.end?.period?.number) || null;
      const endClock = d?.end?.clock?.displayValue;

      if (endPeriod) {
        if (endPeriod > lastPeriod) {
          completedQuarters = Math.max(completedQuarters, endPeriod - 1);
        }
        if (endClock === "0:00") {
          completedQuarters = Math.max(completedQuarters, endPeriod);
        }
        lastPeriod = endPeriod;
      }
    });

    res.json({
      id: found.id,
      date: found.date,
      league: "NCAAF",
      rawHome: home,
      rawAway: away,
      fullTeam1: away?.team?.displayName,
      fullTeam2: home?.team?.displayName,
      team1_abbr: away?.team?.abbreviation,
      team2_abbr: home?.team?.abbreviation,
      homeTeam: { ...home?.team, logo: home?.team?.logo },
      awayTeam: { ...away?.team, logo: away?.team?.logo },
      quarterScores,
      completedQuarters,
      completed: comp?.status?.type?.completed ?? false,
      gameState: state,
    });
  } catch (err) {
    console.error("Ncaaf scores error:", err.message);
    res.status(500).json({ error: "Failed to fetch Ncaaf scores" });
  }
});

module.exports = router;
