const express = require("express");
const router = express.Router();
const {
  triggerSelfUseEmergency,
  triggerVictimPhoneEmergency,
  reportAccident,
  handleCrashDetection,
  getEmergencyDetails,
  getActiveEmergencies,
  saveMedicalProfile,
  getMedicalProfile,
} = require("../controllers/familyEmergencyController");

// Base route info
router.get("/", (req, res) => {
  res.json({
    message: "Family Emergency API Service",
    endpoints: {
      active: "GET /active",
      details: "GET /:id",
      selfUse: "POST /self-use",
      victimPhone: "POST /victim-phone",
      reportAccident: "POST /report-accident",
      crashDetection: "POST /crash-detection",
      medicalProfile: "GET/POST /medical-profile"
    }
  });
});

// POST /api/family-emergency/self-use - Case 1: Self-use emergency
router.post("/self-use", triggerSelfUseEmergency);

// POST /api/family-emergency/victim-phone - Case 2A: Bystander uses victim's phone
router.post("/victim-phone", triggerVictimPhoneEmergency);

// POST /api/family-emergency/report-accident - Case 2B: Bystander reports using own phone
router.post("/report-accident", reportAccident);

// POST /api/family-emergency/crash-detection - Case 3: Auto crash detection
router.post("/crash-detection", handleCrashDetection);

// GET /api/family-emergency/active - Get all active emergencies
router.get("/active", getActiveEmergencies);

// GET /api/family-emergency/:id - Get specific emergency details
router.get("/:id", getEmergencyDetails);

// POST /api/family-emergency/medical-profile - Save medical profile
router.post("/medical-profile", saveMedicalProfile);

// GET /api/family-emergency/medical-profile/:userId - Get medical profile
router.get("/medical-profile/:userId", getMedicalProfile);

module.exports = router;