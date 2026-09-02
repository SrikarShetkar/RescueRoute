/**
 * Get current location using browser's Geolocation API
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        // Fallback to Hyderabad coordinates for demo
        console.warn('Location access denied, using default location');
        resolve({
          lat: 17.385,
          lng: 78.4867,
        });
      }
    );
  });
}

/**
 * Watch location changes
 */
export function watchLocation(callback, errorCallback) {
  if (!navigator.geolocation) {
    errorCallback(new Error('Geolocation is not supported'));
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => {
      errorCallback(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
    }
  );

  return watchId;
}

/**
 * Stop watching location
 */
export function clearLocationWatch(watchId) {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
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

  return distance; // Returns distance in kilometers
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

const locationService = {
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
  calculateDistance,
};

export default locationService;