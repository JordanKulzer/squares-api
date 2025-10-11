require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// --- ESPN routes ---
const espnSchedule = require("./routes/espn/scheduleRoute");
const espnScores = require("./routes/espn/scoresRoute");
const ncaafSchedule = require("./routes/espn/ncaafScheduleRoute");
const ncaafScores = require("./routes/espn/ncaafScoresRoute");

// --- API-Sports routes ---
const apiSportsSchedule = require("./routes/apisports/scheduleRoute");
const apiSportsScores = require("./routes/apisports/scoresRoute");

// Root
app.get("/", (req, res) => {
  res.send("✅ Squares API running (ESPN + API-Sports available)");
});

// Mount routes
app.use("/espn/schedule", espnSchedule);
app.use("/espn/scores", espnScores);
app.use("/espn/ncaaf/schedule", ncaafSchedule);
app.use("/espn/ncaaf/scores", ncaafScores);

app.use("/apisports/schedule", apiSportsSchedule);
app.use("/apisports/scores", apiSportsScores);

app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ API running at http://0.0.0.0:${PORT}`)
);

// const express = require("express");
// const scheduleRoute = require("./routes/scheduleRoute");
// const scoresRoute = require("./routes/scoresRoute");
// const ncaafScheduleRoute = require("./routes/ncaafScheduleRoute");
// // const ncaafScoresRoute = require("./routes/ncaafScoresRoute");

// const app = express();
// const PORT = process.env.PORT || 3000;

// app.use("/schedule", scheduleRoute);
// app.use("/scores", scoresRoute);
// app.use("/ncaaf/schedule", ncaafScheduleRoute);
// // app.use("/ncaaf/scores", ncaafScoresRoute);

// app.get("/", (req, res) => {
//   res.send("API is running. Try /schedule or /ncaaf/schedule");
// });

// app.listen(PORT, "0.0.0.0", () => {
//   console.log(`✅ API running at http://0.0.0.0:${PORT}`);
// });
