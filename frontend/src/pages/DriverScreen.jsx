import React, { useState, useEffect } from "react";
import "./DriverScreen.css";
import socketService, { EVENTS } from "../services/socket";
import { setUiRole } from "../services/uiRole";
import { calculateDistance } from "../services/location";
import Icon from "../components/Icon";
import SirenMic from "../components/SirenMic";

// Simulated position near the demo route — the room demo can't use real GPS.
const BASE = {
  lat: 17.414,
  lng: 78.449,
};

/**
 * DriverScreen — a nearby driver's phone. It does ONE thing: say an ambulance
 * is approaching and how far away, and make itself impossible to ignore.
 * This is the one screen where a real siren sound is appropriate.
 */
export default function DriverScreen() {
  const [myLoc] = useState(() => BASE);
  const [alert, setAlert] = useState(null); // { ambulanceId, distanceM, at }
  const [connected, setConnected] = useState(false);
  const [micSiren, setMicSiren] = useState(false);

  useEffect(() => {
    setUiRole("driver");
    socketService.registerRole("driver", { name: "Nearby driver", location: myLoc });

    const onConnect = () => setConnected(true);
    socketService.getSocket().on("connect", onConnect);
    setConnected(socketService.getSocket().connected);

    const handleSiren = (payload) => {
      if (payload.on) {
        const distanceM = payload.distanceM ?? Math.round(calculateDistance(myLoc.lat, myLoc.lng, payload.location.lat, payload.location.lng) * 1000);
        setAlert({ ambulanceId: payload.ambulanceId, distanceM, at: payload.at, givingWay: true });
        if (!payload.outOfRange && payload.distanceM > 350) {
          setTimeout(() => setAlert((a) => (a ? { ...a, givingWay: false } : a)), 300);
        }
      } else {
        setAlert(null);
      }
    };

    const handleMove = (payload) => {
      setAlert((a) => {
        if (!a) return a; // only update distance while an alert is live
        const distanceM = Math.round(calculateDistance(myLoc.lat, myLoc.lng, payload.location.lat, payload.location.lng) * 1000);
        return { ...a, distanceM };
      });
    };

    const k1 = socketService.on(EVENTS.SIREN_EVENT, handleSiren);
    const k2 = socketService.on(EVENTS.AMBULANCE_LOCATION, handleMove);

    return () => {
      socketService.off(EVENTS.SIREN_EVENT, k1);
      socketService.off(EVENTS.AMBULANCE_LOCATION, k2);
      setUiRole("home");
    };
  }, [myLoc]);

  return (
    <div className={`drv ${alert ? "drv-alert" : ""}`}>
      <div className="drv-connection">
        <span className={`drv-dot ${connected ? "on" : ""}`} /> {connected ? "ONLINE" : "CONNECTING…"}
      </div>

      {alert ? (
        <div className="drv-alert-body">
          <div className="drv-siren-icon"><Icon name="ambulance" size={64} /></div>
          <h1>{alert.givingWay ? "AMBULANCE APPROACHING" : "AMBULANCE NEARBY"}</h1>
          <p className="drv-instruct">PLEASE GIVE WAY — move left</p>
          <div className="drv-distance">
            <span className="drv-dist-num">{Math.max(0, alert.distanceM)}</span>
            <span className="drv-dist-unit">metres away</span>
          </div>
          <p className="muted mono" style={{ fontSize: 12 }}>{alert.ambulanceId}</p>
          {micSiren && <p className="drv-mic-badge">ALSO DETECTED VIA MIC</p>}
        </div>
      ) : (
        <div className="drv-standby">
          <span className="drv-standby-icon"><Icon name="road" size={28} /></span>
          <h2>Ambulance approaching — give way</h2>
          <p className="muted">This screen will alert you when an ambulance is near.</p>
          <SirenMic onSirenDetected={setMicSiren} />
          {micSiren && (
            <div className="drv-mic-alert">
              <span className="drv-mic-dot" /> Siren detected via microphone
            </div>
          )}
        </div>
      )}

      <div className="drv-note">
        <Icon name="alert" size={16} />
        <span>
          Demo note: this alert only reaches other <strong>RescueRoute users</strong> nearby, not
          the general public. Push notifications to real bystanders are planned for a future
          release.
        </span>
      </div>
    </div>
  );
}