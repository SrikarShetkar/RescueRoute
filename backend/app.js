const express = require("express");
const cors = require("cors");

// Import routes
const ambulanceRoutes = require("./routes/ambulanceRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const trafficRoutes = require("./routes/trafficRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const familyEmergencyRoutes = require("./routes/familyEmergencyRoutes");
const authRoutes = require("./routes/authRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const patientRoutes = require("./routes/patientRoutes");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/family-emergency", familyEmergencyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);

// Unified v1 API (single source of truth for emergencies)
app.use("/api/v1", emergencyRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: " RescueRoute API is running",
    version: "1.0.0",
    endpoints: {
      ambulance: "/api/ambulance",
      hospital: "/api/hospital",
      traffic: "/api/traffic",
      vehicles: "/api/vehicles",
      familyEmergency: "/api/family-emergency",
      auth: "/api/auth",
      patient: "/api/patient",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(" Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

module.exports = app;