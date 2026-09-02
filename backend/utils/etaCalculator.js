/**
 * Calculate ETA based on distance and average speed
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} speedKmph - Average speed in km/h (default: 40 for ambulance)
 * @returns {string} ETA in minutes
 */
function calculateETA(distanceKm, speedKmph = 40) {
  if (!distanceKm || distanceKm <= 0) {
    return "Unknown";
  }

  const timeInHours = distanceKm / speedKmph;
  const timeInMinutes = Math.ceil(timeInHours * 60);

  if (timeInMinutes < 1) {
    return "Less than 1 minute";
  }

  if (timeInMinutes === 1) {
    return "1 minute";
  }

  return `${timeInMinutes} minutes`;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  calculateETA,
  calculateDistance,
};