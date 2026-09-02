import React, { useState } from 'react';
import './Demo.css';
import api from '../services/api';
import socketService, { EVENTS } from '../services/socket';
import StatusBadge from '../components/StatusBadge';

const Demo = () => {
  const [demoActive, setDemoActive] = useState(false);
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [liveCases, setLiveCases] = useState([]);
  const [liveError, setLiveError] = useState(null);

  // Live server-driven scenarios (real engine, real timeline).
  const runScenario = async (which) => {
    setScenarioBusy(true);
    setLiveError(null);
    try {
      if (which === 'full') await api.runFullScenario();
      else await api.runCrashScenario();
      socketService.connectToServer();
      const key = socketService.on(EVENTS.EMERGENCY_UPDATE, (data) => {
        setLiveCases((list) => {
          const exists = list.find((e) => e.emergencyId === data.emergencyId);
          return exists ? list.map((e) => (e.emergencyId === data.emergencyId ? data : e)) : [data, ...list];
        });
      });
      // refresh after simulated travel so the last states land.
      setTimeout(() => api.listEmergencies().then(({ emergencies }) => setLiveCases(emergencies)).catch(() => {}), 2500);
      const out = setTimeout(() => socketService.off(EVENTS.EMERGENCY_UPDATE, key), 15000);
      return () => clearTimeout(out);
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setScenarioBusy(false);
    }
  };

  const steps = [
    { title: 'Emergency Triggered', icon: '🚨', time: 0 },
    { title: 'Ambulance Dispatched', icon: '🚑', time: 1500 },
    { title: 'Vehicle Alerts Sent', icon: '📳', time: 2500 },
    { title: 'Signals Turning Green', icon: '🚦', time: 3500 },
    { title: 'Hospital Notified', icon: '🏥', time: 4500 },
    { title: 'Patient Arrives', icon: '✅', time: 6000 }
  ];

  const addLog = (message) => {
    setLogs(prev => [...prev, { message, time: new Date().toLocaleTimeString() }]);
  };

  const startDemo = () => {
    setDemoActive(true);
    setStep(0);
    setLogs([]);

    steps.forEach((s, index) => {
      setTimeout(() => {
        setStep(index + 1);
        addLog(s.title);
      }, s.time);
    });

    setTimeout(() => {
      setDemoActive(false);
    }, 7000);
  };

  return (
    <div className="demo-page">
      <section className="demo-hero">
        <div className="container">
          <h1>Live Demo</h1>
          <p>Watch the entire RescueRoute system in action</p>
          <button onClick={startDemo} className="start-demo-btn" disabled={demoActive}>
            {demoActive ? '🔄 Running Demo...' : '🚀 Start 2-Minute Demo'}
          </button>
        </div>
      </section>

      <section className="demo-live">
        <div className="container">
          <h2>Live server scenario (real engine)</h2>
          <p className="demo-live-sub">
            These run against the actual state machine — hospital recommendation, accept/reject rerouting,
            green corridor and crash countdown are all real. Watch them on Ambulance / Hospital / Control tabs.
          </p>
          <div className="demo-live-actions">
            <button className="btn btn-blue" onClick={() => runScenario('full')} disabled={scenarioBusy}>
              <span className="datalabel simulated">DEMO</span> Run full scenario
            </button>
            <button className="btn btn-amber" onClick={() => runScenario('crash')} disabled={scenarioBusy}>
              <span className="datalabel simulated">DEMO</span> Run crash scenario
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => api.resetDemo().then(() => setLiveCases([]))}
              disabled={scenarioBusy}
            >
              Reset
            </button>
          </div>
          {scenarioBusy && <p className="demo-live-sub">Running… <span className="spin" /></p>}
          {liveError && <div className="error-box">{liveError}</div>}
          <div className="demo-live-cases">
            {liveCases.length === 0 && <p className="demo-live-sub">No live scenario ran yet in this session.</p>}
            {liveCases.map((e) => (
              <div key={e.emergencyId} className="demo-live-card card">
                <div className="demo-live-row">
                  <span className="mono">{e.emergencyId}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="muted mono" style={{ fontSize: 12 }}>{e.patient.name} · {e.patient.condition}</p>
                <div className="demo-live-row muted" style={{ fontSize: 12 }}>
                  <span><span className="datalabel simulated">AMB</span> {e.ambulance?.name || '—'}</span>
                  <span><span className="datalabel simulated">HOSP</span> {e.hospital?.name || 'not selected'}</span>
                  {e.greenCorridor?.active && <span className="datalabel live">GREEN CORRIDOR</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-simulation">
        <div className="container">
          <div className="demo-grid">
            <div className="timeline-panel">
              <h2>Timeline</h2>
              <div className="timeline-steps">
                {steps.map((s, index) => (
                  <div key={index} className={`timeline-step ${step > index ? 'active' : ''} ${step === index + 1 ? 'current' : ''}`}>
                    <div className="step-icon">{s.icon}</div>
                    <div className="step-content">
                      <h4>{s.title}</h4>
                      <span>{s.time / 1000}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="visualization-panel">
              <div className="viz-container">
                <div className={`viz-item patient ${step >= 1 ? 'active' : ''}`}>
                  📍 Patient Location
                </div>
                <div className={`viz-item ambulance ${step >= 2 ? 'active' : ''}`}>
                  🚑 Ambulance Moving
                </div>
                <div className={`viz-item vehicles ${step >= 3 ? 'active' : ''}`}>
                  🚗 Vehicles Alerted
                </div>
                <div className={`viz-item signals ${step >= 4 ? 'active' : ''}`}>
                  🚦 Signals Green
                </div>
                <div className={`viz-item hospital ${step >= 5 ? 'active' : ''}`}>
                  🏥 Hospital Ready
                </div>
                <div className={`viz-route ${step >= 2 ? 'active' : ''}`}></div>
              </div>
            </div>

            <div className="logs-panel">
              <h2>Live Updates</h2>
              <div className="logs-container">
                {logs.length === 0 ? (
                  <p className="no-logs">Press Start Demo to begin</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="log-entry">
                      <span className="log-time">{log.time}</span>
                      <span className="log-msg">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <h3>{step > 0 ? '✓' : '—'}</h3>
              <p>Emergency</p>
            </div>
            <div className="stat-item">
              <h3>{step > 1 ? '✓' : '—'}</h3>
              <p>Ambulance</p>
            </div>
            <div className="stat-item">
              <h3>{step > 2 ? '✓' : '—'}</h3>
              <p>Alerts</p>
            </div>
            <div className="stat-item">
              <h3>{step > 3 ? '✓' : '—'}</h3>
              <p>Traffic</p>
            </div>
            <div className="stat-item">
              <h3>{step > 4 ? '✓' : '—'}</h3>
              <p>Hospital</p>
            </div>
            <div className="stat-item">
              <h3>{step >= 6 ? '✓' : '—'}</h3>
              <p>Complete</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Demo;