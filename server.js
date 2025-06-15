// server.js
const express = require("express");
const scheduleRoute = require("./routes/scheduleRoute");
const scoresRoute = require("./routes/scoresRoute");

const app = express();
const PORT = process.env.PORT || 3000;

// Mount routes
app.use("/schedule", scheduleRoute);
app.use("/scores", scoresRoute);

// Optional root test route
app.get("/", (req, res) => {
  res.send("API is running. Try /schedule?startDate=YYYY-MM-DD");
});

app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});
