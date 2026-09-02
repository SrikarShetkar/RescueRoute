import React, { useState, useEffect } from 'react';
import './HospitalDashboard.css';
import hospitalImg from "../assets/images/hospital-room.png";
import hospitalIcon from "../assets/icons/hospital.svg";
import { connectSocket, onEmergencyUpdate, offEmergencyUpdate } from '../services/socket';
import familyEmergencyApi from '../services/familyEmergencyApi';

const HospitalDashboard = () => {
  const [patientData, setPatientData] = useState({
    name: 'No active transport',
    age: '-',
    bloodGroup: '-',
    allergies: '-',
    condition: 'Waiting for alerts...',
    eta: 'N/A',
    location: 'N/A'
  });

  const [resources, setResources] = useState([
    { name: 'ICU Beds', available: 3, total: 8 },
    { name: 'Operation Theaters', available: 1, total: 4 },
    { name: 'Ventilators', available: 5, total: 12 },
    { name: 'ER Doctors', available: 4, total: 6 }
  ]);

  const [isAlerting, setIsAlerting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const updateDashboard = (emp) => {
    if (!emp) return;

    setIsAlerting(true);
    setPatientData({
      name: emp.medicalProfile?.name || 'Unknown Victim',
      age: emp.medicalProfile?.age || 'Unknown',
      bloodGroup: emp.medicalProfile?.bloodGroup || 'O+',
      allergies: emp.medicalProfile?.allergies || 'None listed',
      condition: emp.medicalProfile?.condition || `Trauma (${emp.type?.replace(/_/g, ' ') || 'Emergency'})`,
      eta: emp.eta || 'Calculating...',
      location: emp.location && emp.location.lat ? `Lat: ${Number(emp.location.lat).toFixed(4)}, Lng: ${Number(emp.location.lng).toFixed(4)}` : 'Unknown'
    });

    // Auto-reserve resources for demo
    setResources(prev => prev.map(r =>
      r.name === 'ICU Beds' ? { ...r, available: Math.max(0, r.available - 1) } : r
    ));

    setLastUpdated(new Date().toLocaleTimeString());
    // Stop alerting animation after 10 seconds
    setTimeout(() => setIsAlerting(false), 10000);
  };

  useEffect(() => {
    const socket = connectSocket();

    // Fetch existing active emergency on mount
    const fetchActive = async () => {
      try {
        const res = await familyEmergencyApi.getActiveEmergencies();
        if (res.success && res.emergencies && res.emergencies.length > 0) {
          console.log('Hospital Dashboard: Loading existing active emergency');
          updateDashboard(res.emergencies[0]);
        }
      } catch (err) {
        console.error('Failed to fetch active emergencies:', err);
      }
    };
    fetchActive();

    setConnectionStatus(socket.connected ? 'connected' : 'connecting');

    socket.on('connect', () => {
      console.log('Hospital Dashboard: Socket connected');
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      console.log('Hospital Dashboard: Socket disconnected');
      setConnectionStatus('disconnected');
    });

    const handleUpdate = (data) => {
      console.log('Hospital Dashboard received socket update:', data);
      if (data.type && data.type.startsWith('FAMILY_EMERGENCY_')) {
        updateDashboard(data.emergency);
      }
    };

    onEmergencyUpdate(handleUpdate);

    return () => {
      offEmergencyUpdate(handleUpdate);
    };
  }, []);

  return (
    <div className="hospital-page">
      <section className="hospital-hero">
        <div className="container">
          <h1>
            <img src={hospitalIcon} alt="Hospital icon" className="hospital-icon" />
            Hospital ER Dashboard
            <span className={`connection-badge ${connectionStatus}`}>
              {connectionStatus === 'connected' ? '● LIVE' : '○ OFFLINE'}
            </span>
          </h1>
          <p>Real-time patient data and resource status {lastUpdated && <span className="last-update">(Last alert: {lastUpdated})</span>}</p>
          <img src={hospitalImg} alt="Hospital" className="hospital-illustration" />
        </div>
      </section>

      <section className="hospital-dashboard">
        <div className="container">
          <div className="dashboard-layout">
            <div className={`patient-card ${isAlerting ? 'alert-pulse' : ''}`}>
              <h2>Incoming Patient {isAlerting && '🚨 LIVE'}</h2>
              <div className="patient-grid">
                <div className="patient-item">
                  <span className="label">Patient Name:</span>
                  <span className="value">{patientData.name}</span>
                </div>
                <div className="patient-item">
                  <span className="label">Age:</span>
                  <span className="value">{patientData.age} years</span>
                </div>
                <div className="patient-item">
                  <span className="label">Blood Group:</span>
                  <span className="value blood">{patientData.bloodGroup}</span>
                </div>
                <div className="patient-item">
                  <span className="label">Allergies:</span>
                  <span className="value alert">{patientData.allergies}</span>
                </div>
                <div className="patient-item full">
                  <span className="label">Condition:</span>
                  <span className="value">{patientData.condition}</span>
                </div>
                <div className="patient-item full">
                  <span className="label">Current Location:</span>
                  <span className="value">{patientData.location}</span>
                </div>
                <div className="patient-item full eta-item">
                  <span className="label">ETA:</span>
                  <span className="value eta">{patientData.eta}</span>
                </div>
              </div>
            </div>

            <div className="resources-card">
              <h2>Resource Availability</h2>
              <div className="resources-list">
                {resources.map((resource, index) => (
                  <div key={index} className="resource-item">
                    <div className="resource-header">
                      <span className="resource-name">{resource.name}</span>
                      <span className="resource-count">
                        {resource.available}/{resource.total}
                      </span>
                    </div>
                    <div className="resource-bar">
                      <div
                        className="resource-fill"
                        style={{ width: `${(resource.available / resource.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="prep-card">
              <h2>Preparation Checklist</h2>
              <div className="checklist">
                <div className="check-item done">
                  <span className="check-icon">✓</span>
                  <span>ER Team Notified</span>
                </div>
                <div className="check-item done">
                  <span className="check-icon">✓</span>
                  <span>Blood Type Verified</span>
                </div>
                <div className="check-item done">
                  <span className="check-icon">✓</span>
                  <span>ICU Bed Reserved</span>
                </div>
                <div className="check-item pending">
                  <span className="check-icon">⏳</span>
                  <span>Equipment Ready</span>
                </div>
                <div className="check-item pending">
                  <span className="check-icon">⏳</span>
                  <span>Specialist On Standby</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HospitalDashboard;