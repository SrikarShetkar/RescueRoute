const { calculateETA } = require("../utils/etaCalculator");

// Mock ambulance data
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

/**
 * GET /api/ambulance/:id
 * Get ambulance details
 */
async function getAmbulance(req, res) {
  try {
    const { id } = req.params;
    const ambulance = ambulances.find((a) => a.id === id);

    if (!ambulance) {
      return res.status(404).json({ error: "Ambulance not found" });
    }

    res.json(ambulance);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch ambulance",
      details: error.message,
    });
  }
}

/**
 * POST /api/ambulance/:id/location
 * Update ambulance location
 */
async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const ambulance = ambulances.find((a) => a.id === id);

    if (!ambulance) {
      return res.status(404).json({ error: "Ambulance not found" });
    }

    ambulance.location = { lat, lng };
    ambulance.lastUpdate = new Date().toISOString();

    res.json({
      success: true,
      ambulance,
      message: "Location updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update location",
      details: error.message,
    });
  }
}

/**
 * GET /api/ambulance/:id/route
 * Get ambulance route and ETA
 */
async function getRoute(req, res) {
  try {
    const { id } = req.params;
    const { destinationLat, destinationLng } = req.query;

    const ambulance = ambulances.find((a) => a.id === id);

    if (!ambulance) {
      return res.status(404).json({ error: "Ambulance not found" });
    }

    // Calculate distance (simple Euclidean for demo)
    const lat1 = ambulance.location.lat;
    const lng1 = ambulance.location.lng;
    const lat2 = parseFloat(destinationLat);
    const lng2 = parseFloat(destinationLng);

    const distanceKm = Math.sqrt(
      Math.pow((lat2 - lat1) * 111, 2) + Math.pow((lng2 - lng1) * 111, 2)
    );

    const eta = calculateETA(distanceKm);

    res.json({
      ambulanceId: id,
      currentLocation: ambulance.location,
      destination: { lat: lat2, lng: lng2 },
      distanceKm: distanceKm.toFixed(2),
      eta,
      route: [
        ambulance.location,
        { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 },
        { lat: lat2, lng: lng2 },
      ],
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to calculate route",
      details: error.message,
    });
  }
}

/**
 * GET /api/ambulance/nearby
 * Find nearest available ambulance
 */
async function findNearest(req, res) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const available = ambulances.filter((a) => a.status === "AVAILABLE");

    if (available.length === 0) {
      return res.status(404).json({ error: "No ambulances available" });
    }

    // Find nearest (simple distance calculation)
    let nearest = available[0];
    let minDistance = Infinity;

    available.forEach((amb) => {
      const dist = Math.sqrt(
        Math.pow((amb.location.lat - parseFloat(lat)) * 111, 2) +
          Math.pow((amb.location.lng - parseFloat(lng)) * 111, 2)
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearest = amb;
      }
    });

    res.json({
      ambulance: nearest,
      distanceKm: minDistance.toFixed(2),
      eta: calculateETA(minDistance),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to find nearest ambulance",
      details: error.message,
    });
  }
}

module.exports = {
  getAmbulance,
  updateLocation,
  getRoute,
  findNearest,
};