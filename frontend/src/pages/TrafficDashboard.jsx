import React, { useState, useEffect } from 'react';
import './TrafficDashboard.css';
import trafficIcon from "../assets/icons/traffic.svg";
import { connectSocket, onEmergencyUpdate, offEmergencyUpdate } from '../services/socket';
import familyEmergencyApi from '../services/familyEmergencyApi';

const TrafficDashboard = () => {
  const [signals, setSignals] = useState([
    { id: 1, name: 'Main St & 1st Ave', status: 'red', distance: '500m' },
    { id: 2, name: '2nd Ave & Park Rd', status: 'green', distance: '300m' },
    { id: 3, name: '3rd Ave & Hill St', status: 'red', distance: '100m' },
    { id: 4, name: '4th Ave & Lake Rd', status: 'amber', distance: '800m' },
  ]);

  const [ambulanceActive, setAmbulanceActive] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState(null);

  useEffect(() => {
    connectSocket();

    // Fetch existing active emergency on mount
    const fetchActive = async () => {
      try {
        const res = await familyEmergencyApi.getActiveEmergencies();
        if (res.success && res.emergencies && res.emergencies.length > 0) {
          console.log('Traffic Dashboard: Loading existing active emergency');
          setActiveEmergency(res.emergencies[0]);
          triggerGreenCorridor();
        }
      } catch (err) {
        console.error('Failed to fetch active emergencies:', err);
      }
    };
    fetchActive();

    const handleUpdate = (data) => {
      console.log('Traffic Dashboard received update:', data);
      if (data.type && data.type.startsWith('FAMILY_EMERGENCY_')) {
        setActiveEmergency(data.emergency);
        triggerGreenCorridor();
      }
    };

    onEmergencyUpdate(handleUpdate);

    return () => {
      offEmergencyUpdate(handleUpdate);
    };
  }, []);

  const triggerGreenCorridor = () => {
    setAmbulanceActive(true);

    // Reset signals first
    setSignals(prev => prev.map(s => ({ ...s, status: 'red' })));

    // Sequential green light activation
    setTimeout(() => {
      setSignals(prev => prev.map(s => s.id === 1 ? { ...s, status: 'green' } : s));
    }, 1000);

    setTimeout(() => {
      setSignals(prev => prev.map(s => s.id === 2 ? { ...s, status: 'green' } : s));
    }, 2000);

    setTimeout(() => {
      setSignals(prev => prev.map(s => s.id === 3 ? { ...s, status: 'green' } : s));
    }, 3000);

    setTimeout(() => {
      setSignals(prev => prev.map(s => s.id === 4 ? { ...s, status: 'green' } : s));
    }, 4000);
  };

  return (
    <div className="traffic-page">
      <section className="traffic-hero">
        <div className="container">
          <h1>Smart Traffic Control</h1>
          <p>API-based signal coordination that clears ambulance routes</p>
        </div>
      </section>

      <section className="traffic-dashboard">
        <div className="container">
          <div className="dashboard-header">
            <h2><img src={trafficIcon} alt="Traffic icon" className="traffic-icon" /> Live Traffic Signals</h2>
            <div className="header-actions">
              {activeEmergency && (
                <div className="live-alert-badge">
                  🚨 LIVE EMERGENCY: {activeEmergency.emergencyId}
                </div>
              )}
              <button onClick={triggerGreenCorridor} className="demo-btn">
                🚑 Run Manual Demo
              </button>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="map-view">
              <div className="map-container">
                <div className="ambulance-marker" style={{ display: ambulanceActive ? 'flex' : 'none' }}>
                  🚑 Ambulance
                </div>
                {signals.map(signal => (
                  <div key={signal.id} className={`signal-marker signal-${signal.id}`}>
                    <div className={`signal-light ${signal.status}`}></div>
                    <span>{signal.name}</span>
                  </div>
                ))}
                <div className="route-path"></div>
              </div>
            </div>

            <div className="signals-list">
              <h3>Signal Status</h3>
              {signals.map(signal => (
                <div key={signal.id} className="signal-item">
                  <div className="signal-info">
                    <h4>{signal.name}</h4>
                    <p>{signal.distance} from ambulance</p>
                  </div>
                  <div className={`status-badge ${signal.status}`}>
                    {signal.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-box">
              <h3>4</h3>
              <p>Signals Controlled</p>
            </div>
            <div className="stat-box">
              <h3>2.3km</h3>
              <p>Route Length</p>
            </div>
            <div className="stat-box">
              <h3>45%</h3>
              <p>Time Saved</p>
            </div>
            <div className="stat-box">
              <h3>0s</h3>
              <p>Wait Time</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrafficDashboard;