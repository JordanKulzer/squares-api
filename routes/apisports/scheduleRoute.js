// routes/apisports/scheduleRoute.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { getApiSportsData } = require("../../utils/apisports/getApiSportsData");
const { getCache, setCache } = require("../../utils/cache");

const router = express.Router();

router.get("/", async (req, res) => {
  const { startDate, league } = req.query;
  const cacheKey = `${league}-${startDate}`;

  // ✅ 1️⃣ Mock mode safeguard
  if (process.env.MOCK_MODE === "true") {
    const mockPath = path.join(__dirname, "../../mock/schedule_mock.json");
    try {
      const data = fs.readFileSync(mockPath, "utf-8");
      const mock = JSON.parse(data);
      console.log(`⚠️ MOCK_MODE active — serving mock schedule for ${league}`);
      return res.json(mock);
    } catch (err) {
      console.error("❌ Failed to read mock schedule:", err);
      return res.status(500).json({ error: "Mock mode failed" });
    }
  }

  // ✅ 2️⃣ Cache lookup (5 min TTL)
  const cached = getCache(cacheKey);
  if (cached) {
    const firstGameDate = new Date(
      cached?.[0]?.start_date || cached?.[0]?.date || 0
    );
    const now = new Date();
    if (Math.abs(now - firstGameDate) < 7 * 24 * 60 * 60 * 1000) {
      console.log("🗄️ Using valid cache for", league);
      return res.json(cached);
    } else {
      console.log("🧹 Cache expired — refreshing schedule");
    }
  }

  // ✅ 3️⃣ Live fetch only if mock mode is off
  try {
    console.log(
      `📡 Fetching 7-day schedule for ${league} starting ${startDate}`
    );

    const start = new Date(startDate);

    // Fetch 7 days (Sun–Sat) in parallel
    const allDays = await Promise.all(
      Array.from({ length: 7 }).map((_, i) =>
        getApiSportsData(league, new Date(start.getTime() + i * 86400000))
      )
    );

    // Flatten + remove duplicates
    const merged = allDays
      .flat()
      .filter((g, idx, arr) =>
        g.id ? arr.findIndex((x) => x.id === g.id) === idx : true
      );

    const now = new Date();
    const normalized = merged.map((g) => {
      // 🧠 Try to get date info from g.date or fallback to fixture.date if available
      const rawDate = g.date || g.start_date || g.fixture?.date;
      const gameDate = rawDate ? new Date(rawDate) : null;

      // 🧠 Determine base status
      let status = g.status || g.fixture?.status?.short || "Scheduled";

      // 🧮 If no status but date is in the past, mark Final
      if (!status && gameDate) {
        status = gameDate < now ? "Final" : "Scheduled";
      }

      // 🔁 Normalize standard API short codes
      if (["NS", "TBD"].includes(status)) {
        status = gameDate && gameDate < now ? "Final" : "Scheduled";
      } else if (["FT", "AET", "FT+"].includes(status)) {
        status = "Final";
      } else if (["1H", "2H", "LIVE", "INPLAY"].includes(status)) {
        status = "In Progress";
      }

      // ✅ Fallback: If we still don't have a date, infer based on ID (for mock/test)
      const ensuredDate =
        rawDate ||
        new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      return {
        ...g,
        date: ensuredDate,
        status,
      };
    });
    // Save to cache for 5 minutes
    setCache(cacheKey, normalized, 5 * 60 * 1000);
    console.log(`✅ Saved ${normalized.length} total ${league} games to cache`);
    res.json(normalized);
  } catch (err) {
    console.error("❌ Schedule fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

module.exports = router;
