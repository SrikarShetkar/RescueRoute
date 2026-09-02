const express = require("express");
const router = express.Router();
const {
  getAmbulance,
  updateLocation,
  getRoute,
  findNearest,
} = require("../controllers/ambulanceController");

// GET /api/ambulance/nearby - Find nearest ambulance
router.get("/nearby", findNearest);

// GET /api/ambulance/:id - Get ambulance details
router.get("/:id", getAmbulance);

// POST /api/ambulance/:id/location - Update ambulance location
router.post("/:id/location", updateLocation);

// GET /api/ambulance/:id/route - Get route and ETA
router.get("/:id/route", getRoute);

module.exports = router;