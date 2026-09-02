const { getScoreForAction, getRescueLevel } = require("../utils/rescueScoreLogic");

// Mock vehicle data
const vehicles = [];
const alerts = [];
const actions = [];

/**
 * POST /api/vehicles/alert
 * Send alert to nearby vehicles
 */
async function sendAlert(req, res) {
  try {
    const { emergencyId, location, radius = 1 } = req.body;

    if (!emergencyId || !location) {
      return res.status(400).json({
        error: "emergencyId and location are required",
      });
    }

    const alert = {
      id: `ALERT-${Date.now()}`,
      emergencyId,
      location,
      radius,
      timestamp: new Date().toISOString(),
      vehiclesNotified: 0,
    };

    // In real app, would find vehicles within radius
    // For demo, we'll just create the alert
    alerts.push(alert);

    console.log(` Alert sent for emergency ${emergencyId}`);

    res.json({
      success: true,
      alert,
      message: "Alert sent to nearby vehicles",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to send alert",
      details: error.message,
    });
  }
}

/**
 * POST /api/vehicles/:id/action
 * Log driver action and update rescue score
 */
async function logAction(req, res) {
  try {
    const { id: vehicleId } = req.params;
    const { action, emergencyId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    // Find or create vehicle record
    let vehicle = vehicles.find((v) => v.id === vehicleId);

    if (!vehicle) {
      vehicle = {
        id: vehicleId,
        totalScore: 0,
        level: "NEW",
        actions: [],
      };
      vehicles.push(vehicle);
    }

    // Calculate points
    const points = getScoreForAction(action);
    vehicle.totalScore += points;
    vehicle.level = getRescueLevel(vehicle.totalScore);

    const actionRecord = {
      id: `ACTION-${Date.now()}`,
      vehicleId,
      emergencyId,
      action,
      points,
      timestamp: new Date().toISOString(),
    };

    vehicle.actions.push(actionRecord);
    actions.push(actionRecord);

    console.log(
      ` Vehicle ${vehicleId} action: ${action} (${points > 0 ? "+" : ""}${points} points)`
    );

    res.json({
      success: true,
      vehicle,
      action: actionRecord,
      message: `Action logged: ${action}`,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to log action",
      details: error.message,
    });
  }
}

/**
 * GET /api/vehicles/:id/score
 * Get vehicle rescue score
 */
async function getScore(req, res) {
  try {
    const { id } = req.params;
    const vehicle = vehicles.find((v) => v.id === id);

    if (!vehicle) {
      return res.json({
        vehicleId: id,
        totalScore: 0,
        level: "NEW",
        actions: [],
        message: "No actions recorded yet",
      });
    }

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch score",
      details: error.message,
    });
  }
}

/**
 * GET /api/vehicles/leaderboard
 * Get top vehicles by rescue score
 */
async function getLeaderboard(req, res) {
  try {
    const { limit = 10 } = req.query;

    const sorted = [...vehicles]
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, parseInt(limit));

    res.json({
      count: sorted.length,
      leaderboard: sorted.map((v, index) => ({
        rank: index + 1,
        vehicleId: v.id,
        score: v.totalScore,
        level: v.level,
        actionsCount: v.actions.length,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch leaderboard",
      details: error.message,
    });
  }
}

module.exports = {
  sendAlert,
  logAction,
  getScore,
  getLeaderboard,
};