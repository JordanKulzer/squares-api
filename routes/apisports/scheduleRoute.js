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

    // Save to cache for 5 minutes
    setCache(cacheKey, merged, 5 * 60 * 1000);

    console.log(`✅ Saved ${merged.length} total ${league} games to cache`);
    res.json(merged);
  } catch (err) {
    console.error("❌ Schedule fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

module.exports = router;
