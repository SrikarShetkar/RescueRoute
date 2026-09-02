const { generateGreenCorridor } = require("../utils/signalLogic");

// Mock traffic signals
const signals = [
  { id: "SIG-001", location: { lat: 17.385, lng: 78.4867 }, state: "RED" },
  { id: "SIG-002", location: { lat: 17.39, lng: 78.49 }, state: "GREEN" },
  { id: "SIG-003", location: { lat: 17.395, lng: 78.495 }, state: "RED" },
  { id: "SIG-004", location: { lat: 17.4, lng: 78.5 }, state: "YELLOW" },
  { id: "SIG-005", location: { lat: 17.405, lng: 78.505 }, state: "RED" },
];

// Active corridors
const corridors = [];

/**
 * POST /api/traffic/green-corridor
 * Activate green corridor for emergency
 */
async function activateGreenCorridor(req, res) {
  try {
    const { emergencyId, routeSignals } = req.body;

    if (!emergencyId || !routeSignals || !Array.isArray(routeSignals)) {
      return res.status(400).json({
        error: "emergencyId and routeSignals array are required",
      });
    }

    const corridor = generateGreenCorridor(routeSignals);

    if (corridor.status === "NO_SIGNALS_FOUND") {
      return res.status(400).json({
        error: "No signals found on route",
      });
    }

    // Update signal states
    corridor.signals.forEach((sig) => {
      const signal = signals.find((s) => s.id === sig.signalId);
      if (signal) {
        signal.state = "GREEN";
        signal.corridorId = corridor.corridorId;
      }
    });

    corridor.emergencyId = emergencyId;
    corridor.activatedAt = new Date().toISOString();
    corridors.push(corridor);

    console.log(` Green corridor activated: ${corridor.corridorId}`);

    res.json({
      success: true,
      corridor,
      message: "Green corridor activated successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to activate green corridor",
      details: error.message,
    });
  }
}

/**
 * GET /api/traffic/signals/:signalId
 * Get signal state
 */
async function getSignal(req, res) {
  try {
    const { signalId } = req.params;
    const signal = signals.find((s) => s.id === signalId);

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" });
    }

    res.json(signal);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch signal",
      details: error.message,
    });
  }
}

/**
 * GET /api/traffic/signals
 * Get all signals
 */
async function getAllSignals(req, res) {
  try {
    res.json({
      count: signals.length,
      signals,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch signals",
      details: error.message,
    });
  }
}

/**
 * POST /api/traffic/corridor/:corridorId/deactivate
 * Deactivate green corridor
 */
async function deactivateGreenCorridor(req, res) {
  try {
    const { corridorId } = req.params;
    const corridor = corridors.find((c) => c.corridorId === corridorId);

    if (!corridor) {
      return res.status(404).json({ error: "Corridor not found" });
    }

    // Reset signals to RED
    corridor.signals.forEach((sig) => {
      const signal = signals.find((s) => s.id === sig.signalId);
      if (signal) {
        signal.state = "RED";
        signal.corridorId = null;
      }
    });

    corridor.status = "INACTIVE";
    corridor.deactivatedAt = new Date().toISOString();

    res.json({
      success: true,
      corridor,
      message: "Green corridor deactivated",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to deactivate corridor",
      details: error.message,
    });
  }
}

module.exports = {
  activateGreenCorridor,
  getSignal,
  getAllSignals,
  deactivateGreenCorridor,
};