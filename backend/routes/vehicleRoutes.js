const express = require("express");
const router = express.Router();
const {
  sendAlert,
  logAction,
  getScore,
  getLeaderboard,
} = require("../controllers/vehicleController");

// POST /api/vehicles/alert - Send alert to nearby vehicles
router.post("/alert", sendAlert);

// GET /api/vehicles/leaderboard - Get rescue score leaderboard
router.get("/leaderboard", getLeaderboard);

// POST /api/vehicles/:id/action - Log driver action
router.post("/:id/action", logAction);

// GET /api/vehicles/:id/score - Get vehicle rescue score
router.get("/:id/score", getScore);

module.exports = router;