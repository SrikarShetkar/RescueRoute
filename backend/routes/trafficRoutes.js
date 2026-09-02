const express = require("express");
const router = express.Router();
const {
  activateGreenCorridor,
  getSignal,
  getAllSignals,
  deactivateGreenCorridor,
} = require("../controllers/trafficController");

// POST /api/traffic/green-corridor - Activate green corridor
router.post("/green-corridor", activateGreenCorridor);

// POST /api/traffic/corridor/:corridorId/deactivate - Deactivate corridor
router.post("/corridor/:corridorId/deactivate", deactivateGreenCorridor);

// GET /api/traffic/signals - Get all signals
router.get("/signals", getAllSignals);

// GET /api/traffic/signals/:signalId - Get specific signal
router.get("/signals/:signalId", getSignal);

module.exports = router;