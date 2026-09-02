import React, { useState } from 'react';
import EmergencySound from '../components/EmergencySound';
import './EmergencyButton.css';
import { triggerSelfUseEmergency } from '../services/familyEmergencyApi';
import { getCurrentLocation } from '../services/location';

const EmergencyButton = () => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    bloodGroup: '',
    allergies: '',
    contact: '',
    location: '123 Main St, Hyderabad',
    symptoms: ''
  });

  const [emergencyActive, setEmergencyActive] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({
    emergency: 'Standby',
    ambulance: '—',
    traffic: '—',
    hospital: '—',
    eta: '—'
  });

  const addLog = (message) => {
    setLogs(prev => [{ message, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmergencyActive(true);
    addLog('Initiating emergency sequence...');

    try {
      const location = await getCurrentLocation();
      const userId = 'USER-' + Date.now();

      // Mirroring the medical profile structure expected by the backend
      const medicalProfile = {
        name: formData.name,
        age: parseInt(formData.age),
        bloodGroup: formData.bloodGroup,
        allergies: formData.allergies,
        condition: formData.symptoms || "Critical condition reported via Emergency Button"
      };

      addLog('Sending alert to RescueRoute servers...');
      const response = await triggerSelfUseEmergency({
        userId,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        medicalProfile
      });

      if (response.success) {
        setStatus(prev => ({ ...prev, emergency: 'ACTIVE 🚨' }));
        addLog(`Emergency registered: ${response.emergency.emergencyId}`);
        addLog('Notifying emergency contacts...');

        // Keep simulation running for those who stay or if navigation takes a moment
        setTimeout(() => {
          setStatus(prev => ({ ...prev, ambulance: 'Dispatched 🚑' }));
          addLog('Ambulance #AB-1234 dispatched');
        }, 1500);

        setTimeout(() => {
          setStatus(prev => ({ ...prev, traffic: 'Clearing Route 🚦' }));
          addLog('Traffic signals synchronized - Green Corridor Active');
        }, 3000);

        setTimeout(() => {
          setStatus(prev => ({ ...prev, hospital: 'Preparing ER 🏥' }));
          addLog('Hospital notified - ER ready for patient');
        }, 4500);

        setTimeout(() => {
          setStatus(prev => ({ ...prev, eta: '8 minutes ⏱️' }));
          addLog('ETA calculated - 8 minutes to arrival');
        }, 6000);
      } else {
        throw new Error(response.error || 'Failed to connect to server');
      }
    } catch (error) {
      console.error('Emergency trigger error:', error);
      addLog(`❌ Error: ${error.message}`);
      setEmergencyActive(false);
    }
  };

  return (
    <div className="emergency-page">
      <EmergencySound isActive={emergencyActive} onComplete={() => setEmergencyActive(false)} />

      <section className="emergency-hero">
        <div className="container">
          <h1>Emergency Button</h1>
          <p>One tap to activate the entire city's emergency response system</p>
        </div>
      </section>

      <section className="emergency-demo">
        <div className="container demo-grid">
          <div className="form-section">
            <div className="form-card">
              <h2>Patient Information</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Patient Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter patient name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Enter age"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    required
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Allergies</label>
                  <input
                    type="text"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="e.g., Penicillin, None"
                  />
                </div>

                <div className="form-group">
                  <label>Emergency Contact</label>
                  <input
                    type="tel"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Phone number"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Current Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Auto-detected"
                  />
                </div>

                <div className="form-group">
                  <label>Symptoms / Condition</label>
                  <textarea
                    value={formData.symptoms}
                    onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                    rows="3"
                    placeholder="Describe the emergency..."
                  />
                </div>

                <button type="submit" className="emergency-btn">
                  <span className="btn-icon">🚨</span>
                  <span>TRIGGER EMERGENCY</span>
                </button>
              </form>
            </div>
          </div>

          <div className="status-section">
            <div className="status-card">
              <h3>System Status</h3>
              <div className="status-items">
                <div className="status-item">
                  <span>Emergency:</span>
                  <span className="value">{status.emergency}</span>
                </div>
                <div className="status-item">
                  <span>Ambulance:</span>
                  <span className="value">{status.ambulance}</span>
                </div>
                <div className="status-item">
                  <span>Traffic Signals:</span>
                  <span className="value">{status.traffic}</span>
                </div>
                <div className="status-item">
                  <span>Hospital:</span>
                  <span className="value">{status.hospital}</span>
                </div>
                <div className="status-item">
                  <span>ETA:</span>
                  <span className="value eta">{status.eta}</span>
                </div>
              </div>
            </div>

            <div className="map-card">
              <div className="map-placeholder">
                <div className="map-marker patient">📍 Patient</div>
                <div className="map-marker ambulance">🚑 Ambulance</div>
                <div className="map-marker hospital">🏥 Hospital</div>
                <div className="route-line"></div>
              </div>
            </div>

            <div className="logs-card">
              <h4>Live Updates</h4>
              <div className="logs">
                {logs.length === 0 ? (
                  <p className="no-logs">Waiting for emergency activation...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="log-item">
                      <span className="time">{log.time}</span>
                      <span className="msg">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EmergencyButton;