const { emitEmergencyUpdate, emitToEmergency } = require("../sockets/rescueSocket");
const { calculateDistance } = require("../utils/etaCalculator");
const Emergency = require("../models/Emergency");
const MedicalProfile = require("../models/MedicalProfile");
const { notifyEmergencyContacts } = require("../services/notificationService");

// In-memory storage for demo - now falling back to MongoDB
// familyEmergencies etc were removed

// Mock ambulances data (reusing from ambulanceController)
const ambulances = [
  {
    id: "AMB-001",
    location: { lat: 17.385, lng: 78.4867 },
    status: "AVAILABLE",
    driver: "Rajesh Kumar",
    vehicleNumber: "TS-09-AB-1234",
  },
  {
    id: "AMB-002",
    location: { lat: 17.44, lng: 78.35 },
    status: "AVAILABLE",
    driver: "Priya Sharma",
    vehicleNumber: "TS-09-CD-5678",
  },
];

// Mock hospitals
const hospitals = [
  {
    id: "HOSP-001",
    name: "Apollo Hospital",
    location: { lat: 17.4326, lng: 78.4071 },
    availableBeds: 15,
  },
  {
    id: "HOSP-002",
    name: "Care Hospital",
    location: { lat: 17.4239, lng: 78.4738 },
    availableBeds: 8,
  },
];

/**
 * POST /api/family-emergency/self-use
 * Case 1: Conscious user triggers emergency
 */
async function triggerSelfUseEmergency(req, res) {
  try {
    const { userId, location, medicalProfile } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: "Location (lat, lng) is required",
      });
    }

    // Create emergency record object
    const emergencyData = {
      emergencyId: `FEM-SELF-${Date.now()}`,
      type: "SELF_USE",
      userId: userId || `USER-${Date.now()}`,
      location,
      medicalProfile: medicalProfile || {},
      status: "ACTIVE",
    };

    // Find nearest ambulance
    const nearestAmbulance = findNearestAmbulance(location);

    // Find nearest hospital
    const nearestHospital = findNearestHospital(location);

    // Dispatch ambulance
    if (nearestAmbulance) {
      emergencyData.ambulanceId = nearestAmbulance.id;
      emergencyData.ambulance = nearestAmbulance;
      emergencyData.eta = calculateETA(nearestAmbulance.distance);
      // In a real app, we'd update ambulance status in DB too
      nearestAmbulance.status = "DISPATCHED";
      nearestAmbulance.assignedEmergency = emergencyData.emergencyId;
    }

    // Notify hospital
    if (nearestHospital) {
      emergencyData.hospitalId = nearestHospital.id;
      emergencyData.hospital = nearestHospital;
    }

    // Trigger traffic corridor
    emergencyData.trafficCorridor = {
      status: "ACTIVE",
      corridorId: `GC-${Date.now()}`,
      activatedAt: new Date().toISOString(),
    };

    // Notify family contacts
    emergencyData.familyContacts = {
      notified: true,
      count: 3,
      contacts: [
        { name: "Family Member 1", relation: "Spouse" },
        { name: "Family Member 2", relation: "Parent" },
        { name: "Family Member 3", relation: "Sibling" },
      ],
    };

    // Save to MongoDB
    const emergency = new Emergency(emergencyData);
    await emergency.save();

    // Notify contacts via service
    await notifyEmergencyContacts(emergency);

    // Emit real-time update via Socket.IO
    if (typeof emitEmergencyUpdate === 'function') {
      emitEmergencyUpdate({
        type: "FAMILY_EMERGENCY_SELF_USE",
        emergency,
      });
    }

    console.log(` Family Emergency (Self-Use) saved to DB: ${emergency.emergencyId}`);

    res.status(201).json({
      success: true,
      emergency,
      message: "Emergency alert sent successfully",
    });
  } catch (error) {
    console.error("Error triggering self-use emergency:", error);
    res.status(500).json({
      error: "Failed to trigger emergency",
      details: error.message,
    });
  }
}

/**
 * POST /api/family-emergency/victim-phone
 * Case 2A: Bystander uses victim's phone (lockscreen access)
 */
async function triggerVictimPhoneEmergency(req, res) {
  try {
    const { victimId, location } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: "Location (lat, lng) is required",
      });
    }

    // Retrieve victim's medical profile from MongoDB
    let victimProfile = await MedicalProfile.findOne({ userId: victimId });

    if (!victimProfile) {
      // Fallback for demo if not in DB
      victimProfile = {
        name: "Rajesh Kumar",
        age: 45,
        bloodGroup: "O+",
        allergies: "Penicillin",
        medicalConditions: ["Hypertension"],
        emergencyContacts: [
          { name: "Priya Kumar", phone: "+91-9876543210", relation: "Wife" },
        ],
      };
    }

    // Create emergency record object
    const emergencyData = {
      emergencyId: `FEM-VICTIM-${Date.now()}`,
      type: "VICTIM_PHONE",
      userId: victimId || `VICTIM-${Date.now()}`,
      location,
      medicalProfile: victimProfile,
      status: "ACTIVE",
    };

    // Find nearest ambulance
    const nearestAmbulance = findNearestAmbulance(location);

    // Find nearest hospital
    const nearestHospital = findNearestHospital(location);

    // Dispatch ambulance
    if (nearestAmbulance) {
      emergencyData.ambulanceId = nearestAmbulance.id;
      emergencyData.ambulance = nearestAmbulance;
      emergencyData.eta = calculateETA(nearestAmbulance.distance);
      nearestAmbulance.status = "DISPATCHED";
      nearestAmbulance.assignedEmergency = emergencyData.emergencyId;
    }

    // Notify hospital with victim's medical info
    if (nearestHospital) {
      emergencyData.hospitalId = nearestHospital.id;
      emergencyData.hospital = nearestHospital;
    }

    // Save to MongoDB
    const emergency = new Emergency(emergencyData);
    await emergency.save();

    // Notify contacts systems
    await notifyEmergencyContacts(emergency);

    // Emit real-time update
    if (typeof emitEmergencyUpdate === 'function') {
      emitEmergencyUpdate({
        type: "FAMILY_EMERGENCY_VICTIM_PHONE",
        emergency,
      });
    }

    console.log(` Family Emergency (Victim Phone) saved: ${emergency.emergencyId}`);

    res.status(201).json({
      success: true,
      emergency,
      victimProfile: {
        name: victimProfile.name,
        bloodGroup: victimProfile.bloodGroup,
        allergies: victimProfile.allergies,
      },
      message: "Victim's emergency profile saved and alert sent",
    });
  } catch (error) {
    console.error("Error triggering victim phone emergency:", error);
    res.status(500).json({
      error: "Failed to trigger emergency",
      details: error.message,
    });
  }
}

/**
 * POST /api/family-emergency/report-accident
 * Case 2B: Bystander uses their own phone to report accident
 */
async function reportAccident(req, res) {
  try {
    const { location, severity, description, photo, reporterId } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: "Location (lat, lng) is required",
      });
    }

    // Create accident report data
    const emergencyData = {
      emergencyId: `ACC-REPORT-${Date.now()}`,
      type: "ACCIDENT_REPORT",
      userId: reporterId || `REPORTER-${Date.now()}`,
      location,
      status: "ACTIVE",
      medicalProfile: {
        condition: description || "Accident reported",
        severity: severity?.toUpperCase() || "UNKNOWN"
      }
    };

    // Find nearest ambulance
    const nearestAmbulance = findNearestAmbulance(location);

    // Find nearest hospital
    const nearestHospital = findNearestHospital(location);

    // Dispatch ambulance
    if (nearestAmbulance) {
      emergencyData.ambulanceId = nearestAmbulance.id;
      emergencyData.ambulance = nearestAmbulance;
      emergencyData.eta = calculateETA(nearestAmbulance.distance);
      nearestAmbulance.status = "DISPATCHED";
      nearestAmbulance.assignedEmergency = emergencyData.emergencyId;
    }

    // Notify hospital
    if (nearestHospital) {
      emergencyData.hospitalId = nearestHospital.id;
      emergencyData.hospital = nearestHospital;
    }

    // Save to MongoDB
    const emergency = new Emergency(emergencyData);
    await emergency.save();

    // Notify (broadcast for bystander report)
    await notifyEmergencyContacts(emergency);

    // Emit real-time update
    if (typeof emitEmergencyUpdate === 'function') {
      emitEmergencyUpdate({
        type: "FAMILY_EMERGENCY_ACCIDENT_REPORT",
        emergency,
      });
    }

    console.log(` Accident Reported and Saved: ${emergency.emergencyId}`);

    res.status(201).json({
      success: true,
      emergency,
      message: "Accident reported successfully. Emergency services dispatched.",
    });
  } catch (error) {
    console.error("Error reporting accident:", error);
    res.status(500).json({
      error: "Failed to report accident",
      details: error.message,
    });
  }
}

/**
 * POST /api/family-emergency/crash-detection
 * Case 3: Automatic crash detection
 */
async function handleCrashDetection(req, res) {
  try {
    const { userId, location, sensorData, userResponse } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: "Location (lat, lng) is required",
      });
    }

    // Create crash detection record
    const emergencyData = {
      emergencyId: `CRASH-${Date.now()}`,
      type: "CRASH_DETECTION",
      userId: userId || `USER-${Date.now()}`,
      location,
      status: userResponse === "OK" ? "CANCELLED" : "ACTIVE",
      sensorData: sensorData || {
        impactForce: "High",
        suddenStop: true,
      }
    };

    // If user responded "OK", cancel emergency
    if (userResponse === "OK") {
      emergencyData.status = "CANCELLED";
      const emergency = new Emergency(emergencyData);
      await emergency.save();

      return res.json({
        success: true,
        emergency,
        message: "Emergency cancelled. Glad you're safe!",
      });
    }

    // If no response or "NEED_HELP", dispatch
    // Retrieve user's medical profile
    const userProfile = await MedicalProfile.findOne({ userId }) || {
      name: "User",
      bloodGroup: "Unknown",
    };

    emergencyData.medicalProfile = userProfile;

    // Find nearest ambulance
    const nearestAmbulance = findNearestAmbulance(location);

    // Find nearest hospital
    const nearestHospital = findNearestHospital(location);

    // Dispatch ambulance
    if (nearestAmbulance) {
      emergencyData.ambulanceId = nearestAmbulance.id;
      emergencyData.ambulance = nearestAmbulance;
      emergencyData.eta = calculateETA(nearestAmbulance.distance);
      nearestAmbulance.status = "DISPATCHED";
      nearestAmbulance.assignedEmergency = emergencyData.emergencyId;
    }

    // Notify hospital
    if (nearestHospital) {
      emergencyData.hospitalId = nearestHospital.id;
      emergencyData.hospital = nearestHospital;
    }

    // Save to MongoDB
    const emergency = new Emergency(emergencyData);
    await emergency.save();

    // Notify contacts systems
    await notifyEmergencyContacts(emergency);

    // Emit real-time update
    if (typeof emitEmergencyUpdate === 'function') {
      emitEmergencyUpdate({
        type: "FAMILY_EMERGENCY_CRASH_DETECTION",
        emergency,
      });
    }

    console.log(` Crash Detected and Saved: ${emergency.emergencyId}`);

    res.status(201).json({
      success: true,
      emergency,
      message: "Crash detected. Emergency services automatically dispatched.",
    });
  } catch (error) {
    console.error("Error handling crash detection:", error);
    res.status(500).json({
      error: "Failed to handle crash detection",
      details: error.message,
    });
  }
}

/**
 * GET /api/family-emergency/:id
 * Get emergency details by ID
 */
async function getEmergencyDetails(req, res) {
  try {
    const { id } = req.params;

    const emergency = await Emergency.findOne({ emergencyId: id });

    if (!emergency) {
      return res.status(404).json({ error: "Emergency not found" });
    }

    res.json(emergency);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch emergency details",
      details: error.message,
    });
  }
}

async function getActiveEmergencies(req, res) {
  try {
    const active = await Emergency.find({ status: "ACTIVE" }).sort({ timestamp: -1 });

    res.json({
      count: active.length,
      emergencies: active,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch active emergencies",
      details: error.message,
    });
  }
}

/**
 * POST /api/family-emergency/medical-profile
 * Save/update user's medical profile
 */
async function saveMedicalProfile(req, res) {
  try {
    const { userId, profile } = req.body;

    if (!userId || !profile) {
      return res.status(400).json({
        error: "userId and profile are required",
      });
    }

    // Save profile to MongoDB
    const updatedProfile = await MedicalProfile.findOneAndUpdate(
      { userId },
      { ...profile, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    console.log(` Medical profile saved for user: ${userId}`);

    res.json({
      success: true,
      message: "Medical profile saved successfully",
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error saving medical profile:", error);
    res.status(500).json({
      error: "Failed to save medical profile",
      details: error.message,
    });
  }
}

async function getMedicalProfile(req, res) {
  try {
    const { userId } = req.params;

    const profile = await MedicalProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        error: "Medical profile not found",
      });
    }

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch medical profile",
      details: error.message,
    });
  }
}

// Helper functions
function findNearestAmbulance(location) {
  const available = ambulances.filter((a) => a.status === "AVAILABLE");

  if (available.length === 0) {
    return null;
  }

  let nearest = available[0];
  let minDistance = calculateDistance(
    location.lat,
    location.lng,
    nearest.location.lat,
    nearest.location.lng
  );

  available.forEach((ambulance) => {
    const distance = calculateDistance(
      location.lat,
      location.lng,
      ambulance.location.lat,
      ambulance.location.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = ambulance;
    }
  });

  nearest.distance = minDistance;
  return nearest;
}

function findNearestHospital(location) {
  let nearest = hospitals[0];
  let minDistance = calculateDistance(
    location.lat,
    location.lng,
    nearest.location.lat,
    nearest.location.lng
  );

  hospitals.forEach((hospital) => {
    const distance = calculateDistance(
      location.lat,
      location.lng,
      hospital.location.lat,
      hospital.location.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = hospital;
    }
  });

  nearest.distance = minDistance;
  return nearest;
}

function calculateETA(distanceKm) {
  const speedKmph = 40; // Average ambulance speed
  const timeInMinutes = Math.ceil((distanceKm / speedKmph) * 60);
  return `${timeInMinutes} minutes`;
}

module.exports = {
  triggerSelfUseEmergency,
  triggerVictimPhoneEmergency,
  reportAccident,
  handleCrashDetection,
  getEmergencyDetails,
  getActiveEmergencies,
  saveMedicalProfile,
  getMedicalProfile,
};