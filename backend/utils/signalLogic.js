/**
 * Generate green corridor for emergency route
 * @param {Array} routeSignals - Array of signal IDs on the route
 * @returns {object} Corridor information
 */
function generateGreenCorridor(routeSignals = []) {
  if (!routeSignals || routeSignals.length === 0) {
    return {
      status: "NO_SIGNALS_FOUND",
      signals: [],
    };
  }

  const corridorId = `GC-${Date.now()}`;

  return {
    corridorId,
    status: "ACTIVE",
    signals: routeSignals.map((signalId) => ({
      signalId,
      state: "GREEN",
      duration: 120, // seconds
    })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculate signal timing for optimal flow
 * @param {number} ambulanceSpeed - Speed in km/h
 * @param {number} distanceToSignal - Distance in km
 * @returns {number} Recommended green light duration in seconds
 */
function calculateSignalTiming(ambulanceSpeed = 40, distanceToSignal) {
  const timeToReach = (distanceToSignal / ambulanceSpeed) * 3600; // Convert to seconds
  const bufferTime = 30; // 30 seconds buffer
  return Math.ceil(timeToReach + bufferTime);
}

/**
 * Prioritize signals based on traffic density
 * @param {Array} signals - Array of signal objects with traffic data
 * @returns {Array} Prioritized signal IDs
 */
function prioritizeSignals(signals) {
  return signals
    .sort((a, b) => {
      // Higher traffic density = higher priority
      const densityA = a.trafficDensity || 0;
      const densityB = b.trafficDensity || 0;
      return densityB - densityA;
    })
    .map((signal) => signal.id);
}

/**
 * Validate corridor route
 * @param {Array} signalIds - Array of signal IDs
 * @param {Array} availableSignals - All available signals
 * @returns {object} Validation result
 */
function validateCorridorRoute(signalIds, availableSignals) {
  const invalid = signalIds.filter(
    (id) => !availableSignals.find((s) => s.id === id)
  );

  return {
    valid: invalid.length === 0,
    invalidSignals: invalid,
    message:
      invalid.length === 0
        ? "All signals are valid"
        : `Invalid signals: ${invalid.join(", ")}`,
  };
}

/**
 * Calculate corridor efficiency
 * @param {object} corridor - Corridor object
 * @param {number} actualTime - Actual time taken (seconds)
 * @param {number} expectedTime - Expected time (seconds)
 * @returns {object} Efficiency metrics
 */
function calculateCorridorEfficiency(corridor, actualTime, expectedTime) {
  const timeSaved = expectedTime - actualTime;
  const efficiency = (timeSaved / expectedTime) * 100;

  return {
    corridorId: corridor.corridorId,
    timeSaved: Math.max(0, timeSaved),
    efficiency: Math.max(0, Math.min(100, efficiency)),
    rating:
      efficiency >= 80
        ? "EXCELLENT"
        : efficiency >= 60
        ? "GOOD"
        : efficiency >= 40
        ? "AVERAGE"
        : "POOR",
  };
}

module.exports = {
  generateGreenCorridor,
  calculateSignalTiming,
  prioritizeSignals,
  validateCorridorRoute,
  calculateCorridorEfficiency,
};