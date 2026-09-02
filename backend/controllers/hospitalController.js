// Mock hospital data
const hospitals = [
  {
    id: "HOSP-001",
    name: "Apollo Hospital",
    location: { lat: 17.4326, lng: 78.4071 },
    availableBeds: 15,
    emergencyCapacity: "HIGH",
    specialties: ["Cardiology", "Neurology", "Trauma"],
  },
  {
    id: "HOSP-002",
    name: "Care Hospital",
    location: { lat: 17.4239, lng: 78.4738 },
    availableBeds: 8,
    emergencyCapacity: "MEDIUM",
    specialties: ["Trauma", "Orthopedics"],
  },
  {
    id: "HOSP-003",
    name: "Gandhi Hospital",
    location: { lat: 17.4484, lng: 78.4954 },
    availableBeds: 20,
    emergencyCapacity: "HIGH",
    specialties: ["General", "Emergency"],
  },
];

// Emergency notifications
const notifications = [];

/**
 * GET /api/hospital/nearby
 * Find nearby hospitals
 */
async function findNearby(req, res) {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const nearby = hospitals.filter((hospital) => {
      const distance = Math.sqrt(
        Math.pow((hospital.location.lat - parseFloat(lat)) * 111, 2) +
          Math.pow((hospital.location.lng - parseFloat(lng)) * 111, 2)
      );
      return distance <= parseFloat(radius);
    });

    res.json({
      count: nearby.length,
      hospitals: nearby.map((h) => ({
        ...h,
        distanceKm: Math.sqrt(
          Math.pow((h.location.lat - parseFloat(lat)) * 111, 2) +
            Math.pow((h.location.lng - parseFloat(lng)) * 111, 2)
        ).toFixed(2),
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to find nearby hospitals",
      details: error.message,
    });
  }
}

/**
 * POST /api/hospital/:id/prepare
 * Send preparation alert to hospital
 */
async function prepareHospital(req, res) {
  try {
    const { id } = req.params;
    const { emergencyId, patientInfo, eta } = req.body;

    const hospital = hospitals.find((h) => h.id === id);

    if (!hospital) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    const notification = {
      id: `NOTIF-${Date.now()}`,
      hospitalId: id,
      emergencyId,
      patientInfo: patientInfo || {},
      eta: eta || "Unknown",
      timestamp: new Date().toISOString(),
      status: "SENT",
    };

    notifications.push(notification);

    console.log(` Hospital ${hospital.name} notified for ${emergencyId}`);

    res.json({
      success: true,
      hospital,
      notification,
      message: `${hospital.name} has been alerted and is preparing`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to prepare hospital",
      details: error.message,
    });
  }
}

/**
 * GET /api/hospital/:id
 * Get hospital details
 */
async function getHospital(req, res) {
  try {
    const { id } = req.params;
    const hospital = hospitals.find((h) => h.id === id);

    if (!hospital) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    res.json(hospital);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch hospital",
      details: error.message,
    });
  }
}

/**
 * GET /api/hospital/:id/notifications
 * Get hospital notifications
 */
async function getNotifications(req, res) {
  try {
    const { id } = req.params;
    const hospitalNotifs = notifications.filter((n) => n.hospitalId === id);

    res.json({
      count: hospitalNotifs.length,
      notifications: hospitalNotifs,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch notifications",
      details: error.message,
    });
  }
}

module.exports = {
  findNearby,
  prepareHospital,
  getHospital,
  getNotifications,
};