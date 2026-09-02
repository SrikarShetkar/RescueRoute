import React, { useState, useEffect } from 'react';
import { testEmergencyAlert, requestNotificationPermission } from '../components/EmergencySound';
import './VehicleAlerts.css';

const VehicleAlerts = () => {
  const [alertActive, setAlertActive] = useState(false);
  const [nearbyVehicles, setNearbyVehicles] = useState(0);
  const [myLocation, setMyLocation] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Simulate getting current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMyLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location error:', error);
          // Use default location for demo
          setMyLocation({
            lat: 17.4065, // Hyderabad coordinates
            lng: 78.4772
          });
        }
      );
    } else {
      // Default location for demo
      setMyLocation({
        lat: 17.4065,
        lng: 78.4772
      });
    }
  }, []);

  const handleTestAlert = async () => {
    // Request notification permission first
    await requestNotificationPermission();
    
    // Trigger alert on THIS device
    setAlertActive(true);
    testEmergencyAlert();
    
    // Simulate sending alerts to nearby vehicles
    simulateNearbyVehicleAlerts();
    
    // Reset after 3 seconds
    setTimeout(() => setAlertActive(false), 3000);
  };

  const simulateNearbyVehicleAlerts = () => {
    setIsSimulating(true);
    
    // Simulate finding 5-15 nearby vehicles
    const vehicleCount = Math.floor(Math.random() * 11) + 5;
    setNearbyVehicles(vehicleCount);
    
    // Simulate staggered alerts to nearby vehicles
    for (let i = 0; i < vehicleCount; i++) {
      setTimeout(() => {
        console.log(`🚗 Vehicle ${i + 1} received alert`);
        // In real implementation, this would be:
        // socket.emit('emergency-alert', { lat, lng, radius: 500 });
      }, i * 100); // Stagger by 100ms
    }
    
    setTimeout(() => {
      setIsSimulating(false);
      setNearbyVehicles(0);
    }, 5000);
  };

  return (
    <div className="vehicle-page">
      <section className="vehicle-hero">
        <div className="container">
          <h1>Vehicle Alert System</h1>
          <p>Sound + Vibration alerts that work without looking at screens</p>
        </div>
      </section>

      <section className="vehicle-content">
        <div className="container content-grid">
          <div className="content-left">
            <h2>The Problem with Traditional Alerts</h2>
            <p>
              Drivers can't safely check their phones while driving. Push notifications
              require looking at screens, causing dangerous distractions.
            </p>

            <h2>The RescueRoute Solution</h2>
            <div className="features-list">
              <div className="feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Unique Vibration Pattern</h4>
                  <p>Long-Short-Long (1000ms-500ms-1000ms) - instantly recognizable</p>
                </div>
              </div>

              <div className="feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Universal Emergency Tone</h4>
                  <p>Distinct sound that drivers learn to recognize immediately</p>
                </div>
              </div>

              <div className="feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Works with Screen Locked</h4>
                  <p>Alert triggers even when phone is in pocket or dashboard</p>
                </div>
              </div>

              <div className="feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>No Visual Distraction</h4>
                  <p>Drivers respond instinctively without taking eyes off road</p>
                </div>
              </div>

              <div className="feature-item">
                <span className="check">✓</span>
                <div>
                  <h4>Bluetooth Integration</h4>
                  <p>Voice announcement through car speakers: "Emergency vehicle approaching"</p>
                </div>
              </div>
            </div>

            <button onClick={handleTestAlert} className="test-btn">
              🔊 Test Alert Now
            </button>

            {isSimulating && (
              <div className="simulation-info">
                <div className="sim-header">
                  <span className="sim-icon">📡</span>
                  <strong>Broadcasting Alert...</strong>
                </div>
                <p className="sim-count">
                  Alerting <span className="highlight-number">{nearbyVehicles}</span> nearby vehicles within 500m radius
                </p>
                <div className="sim-status">
                  <div className="status-item">✅ Sound playing on all devices</div>
                  <div className="status-item">✅ Vibration triggered</div>
                  <div className="status-item">✅ Notifications sent</div>
                </div>
              </div>
            )}

            {myLocation && !isSimulating && (
              <div className="location-info">
                <p>📍 Your Location: {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</p>
                <p className="info-note">In production: All vehicles within 500m would receive this alert</p>
              </div>
            )}
          </div>

          <div className="content-right">
            <div className={`phone-demo ${alertActive ? 'active' : ''}`}>
              <div className="phone-frame">
                <div className="phone-screen-content">
                  {alertActive ? (
                    <div className="alert-active">
                      <div className="alert-icon-large">🚨</div>
                      <h3>Emergency Vehicle Approaching</h3>
                      <p>Please clear the lane</p>
                      <div className="vibration-indicator">
                        <div className="vib-bar"></div>
                        <div className="vib-bar"></div>
                        <div className="vib-bar"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-standby">
                      <div className="standby-icon">📱</div>
                      <p>Waiting for emergency alert...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="info-box">
              <h4>How It Works in Production</h4>
              <ol>
                <li>Ambulance driver activates emergency mode</li>
                <li>Backend server receives ambulance GPS location</li>
                <li>Server calculates all vehicles within 500m radius</li>
                <li>Server sends WebSocket alert to nearby vehicles</li>
                <li>Each vehicle's phone plays emergency tone</li>
                <li>Vibration triggers (Long-Short-Long pattern)</li>
                <li>Notification appears even if app is in background</li>
                <li>Driver clears lane instinctively</li>
              </ol>
              
              <div className="tech-stack">
                <h5>Technology Stack:</h5>
                <ul>
                  <li>🔧 Backend: Node.js + Socket.IO</li>
                  <li>📍 GPS: Geolocation API</li>
                  <li>🔊 Audio: Web Audio API</li>
                  <li>📳 Haptics: Vibration API</li>
                  <li>🔔 Alerts: Push Notification API</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VehicleAlerts;