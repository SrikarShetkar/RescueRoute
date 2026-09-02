const express = require("express");
const router = express.Router();
const {
  findNearby,
  prepareHospital,
  getHospital,
  getNotifications,
} = require("../controllers/hospitalController");

// GET /api/hospital/nearby - Find nearby hospitals
router.get("/nearby", findNearby);

// GET /api/hospital/:id - Get hospital details
router.get("/:id", getHospital);

// POST /api/hospital/:id/prepare - Send preparation alert
router.post("/:id/prepare", prepareHospital);

// GET /api/hospital/:id/notifications - Get hospital notifications
router.get("/:id/notifications", getNotifications);

module.exports = router;