const express = require("express");
const scheduleRoute = require("./routes/scheduleRoute");
const scoresRoute = require("./routes/scoresRoute");
const ncaafScheduleRoute = require("./routes/ncaafScheduleRoute");
// const ncaafScoresRoute = require("./routes/ncaafScoresRoute");

const app = express();
const PORT = process.env.PORT || 3000;

app.use("/schedule", scheduleRoute);
app.use("/scores", scoresRoute);
app.use("/ncaaf/schedule", ncaafScheduleRoute);
// app.use("/ncaaf/scores", ncaafScoresRoute);

app.get("/", (req, res) => {
  res.send("API is running. Try /schedule or /ncaaf/schedule");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API running at http://0.0.0.0:${PORT}`);
});
