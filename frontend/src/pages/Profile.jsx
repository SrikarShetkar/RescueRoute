import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import patientApi from "../services/patientApi";
import Icon from "../components/Icon";
import DataLabel from "../components/DataLabel";
import "./Profile.css";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/**
 * Profile — User profile management with emergency QR, vehicle management,
 * and medical information editing.
 */
export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState("profile"); // profile | vehicles | qr
  const [profileData, setProfileData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [error, setError] = useState(null);

  // Demo user ID mapping (matches patientRegistry demo data)
  const getUserId = useCallback(() => {
    if (!user) return null;
    // Map demo auth users to patient registry IDs
    const demoMap = {
      "citizen": "pat-001",
      "citizen1": "pat-004",
      "citizen2": "pat-005",
      "citizen3": "pat-006",
    };
    return demoMap[user.username] || user.id || user.backendId || "pat-001";
  }, [user]);

  const userId = getUserId();

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    async function load() {
      try {
        const [profileRes, vehiclesRes] = await Promise.all([
          patientApi.getProfile(userId),
          patientApi.listMyVehicles(userId),
        ]);
        setProfileData(profileRes.user);
        setVehicles(vehiclesRes.vehicles || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  const handleProfileChange = (field, value) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const result = await patientApi.updateProfile(userId, profileData);
      setProfileData(result.user);
      setSaveMsg("Profile saved successfully");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rr-page">
        <div className="container" style={{ padding: "40px 0", textAlign: "center" }}>
          <span className="spin" /> Loading profile…
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="rr-page">
        <div className="container" style={{ padding: "40px 0" }}>
          <div className="error-box">Could not load profile data.</div>
        </div>
      </div>
    );
  }

  const primaryVehicle = vehicles[0];

  return (
    <div className="rr-page">
      <header className="page-hero">
        <div className="container page-hero-inner">
          <div>
            <h1>My Profile</h1>
            <p className="muted">Manage your emergency profile, vehicles, and QR identification.</p>
          </div>
          <DataLabel kind="simulated">DEMO SYSTEM</DataLabel>
        </div>
      </header>

      <div className="container prof-body">
        <div className="prof-tabs">
          <button className={`prof-tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
            <Icon name="user" size={16} /> Profile
          </button>
          <button className={`prof-tab ${tab === "vehicles" ? "active" : ""}`} onClick={() => setTab("vehicles")}>
            <Icon name="car" size={16} /> Vehicles
          </button>
          <button className={`prof-tab ${tab === "qr" ? "active" : ""}`} onClick={() => setTab("qr")}>
            <Icon name="crash" size={16} /> Emergency QR
          </button>
        </div>

        {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
        {saveMsg && <div className="prof-save-msg">{saveMsg}</div>}

        {tab === "profile" && (
          <ProfileTab
            data={profileData}
            onChange={handleProfileChange}
            onSave={handleSaveProfile}
            saving={saving}
          />
        )}

        {tab === "vehicles" && (
          <VehiclesTab
            userId={userId}
            vehicles={vehicles}
            onRefresh={async () => {
              const res = await patientApi.listMyVehicles(userId);
              setVehicles(res.vehicles || []);
            }}
          />
        )}

        {tab === "qr" && (
          <QrTab
            vehicle={primaryVehicle}
            profileData={profileData}
          />
        )}
      </div>
    </div>
  );
}

/* ======================== PROFILE TAB ======================== */

function ProfileTab({ data, onChange, onSave, saving }) {
  return (
    <div className="prof-section">
      <div className="section-title">Personal Information</div>
      <div className="section-sub">Your basic identity information used for emergency identification.</div>

      <div className="card prof-card">
        <div className="prof-photo-section">
          <div className="prof-photo">
            {data.photo ? (
              <img src={data.photo} alt={data.name} />
            ) : (
              <span className="prof-photo-placeholder">
                {data.name ? data.name.charAt(0).toUpperCase() : "?"}
              </span>
            )}
          </div>
          <div>
            <p className="prof-photo-label">Profile Photo</p>
            <p className="prof-photo-hint muted">Used for visual identification during emergencies</p>
          </div>
        </div>

        <div className="prof-grid">
          <label className="prof-field">
            <span className="prof-field-label">Full Name *</span>
            <input
              value={data.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Full name"
            />
          </label>
          <label className="prof-field">
            <span className="prof-field-label">Age</span>
            <input
              type="number"
              value={data.age || ""}
              onChange={(e) => onChange("age", parseInt(e.target.value) || "")}
              placeholder="e.g. 34"
            />
          </label>
          <label className="prof-field">
            <span className="prof-field-label">Gender</span>
            <select value={data.gender || ""} onChange={(e) => onChange("gender", e.target.value)}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="prof-field">
            <span className="prof-field-label">Phone</span>
            <input
              value={data.phone || ""}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </label>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>Emergency Medical Information</div>
      <div className="section-sub">Critical medical data shared with hospitals and ambulance crews.</div>

      <div className="card prof-card">
        <div className="prof-grid">
          <label className="prof-field">
            <span className="prof-field-label">Blood Group *</span>
            <select value={data.bloodGroup || ""} onChange={(e) => onChange("bloodGroup", e.target.value)}>
              <option value="">Select</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </label>
          <label className="prof-field">
            <span className="prof-field-label">Allergies</span>
            <input
              value={data.allergies || ""}
              onChange={(e) => onChange("allergies", e.target.value)}
              placeholder="e.g. Penicillin, Peanuts, None"
            />
          </label>
        </div>

        <label className="prof-field prof-full">
          <span className="prof-field-label">Medical History</span>
          <input
            value={(data.medicalHistory || []).join(", ")}
            onChange={(e) => onChange("medicalHistory", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="e.g. Hypertension, Diabetes (comma separated)"
          />
        </label>
      </div>

      <div className="section-title" style={{ marginTop: 24 }}>Identification</div>
      <div className="section-sub">Identity verification and vehicle association.</div>

      <div className="card prof-card">
        <div className="prof-grid">
          <label className="prof-field">
            <span className="prof-field-label">Aadhaar Number *</span>
            <input
              value={data.aadhaar || ""}
              onChange={(e) => onChange("aadhaar", e.target.value)}
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
            />
          </label>
          <div className="prof-field">
            <span className="prof-field-label">Vehicle Numbers</span>
            <div className="prof-vehicle-tags">
              {(data.vehicleNumbers || []).map((v) => (
                <span key={v} className="prof-vehicle-tag">{v}</span>
              ))}
              {(!data.vehicleNumbers || data.vehicleNumbers.length === 0) && (
                <span className="muted" style={{ fontSize: 13 }}>No vehicles associated. Add in Vehicles tab.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rr-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-green" onClick={onSave} disabled={saving}>
          {saving ? <><span className="spin" /> Saving…</> : "Save Profile"}
        </button>
      </div>
    </div>
  );
}

/* ======================== VEHICLES TAB ======================== */

function VehiclesTab({ userId, vehicles, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newVehicleNum, setNewVehicleNum] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  const handleAddVehicle = async () => {
    const num = newVehicleNum.trim().toUpperCase().replace(/-/g, "").replace(/\s/g, "");
    if (!num) return;
    setAddingLoading(true);
    setAddError(null);
    try {
      await patientApi.createVehicle({ vehicleNumber: num, ownerUserId: userId });
      setNewVehicleNum("");
      setShowAdd(false);
      await onRefresh();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <div className="prof-section">
      <div className="section-title">My Vehicles</div>
      <div className="section-sub">
        Register vehicles and manage associated people. Each vehicle gets an emergency QR code.
      </div>

      {vehicles.length === 0 ? (
        <div className="card prof-card" style={{ textAlign: "center", padding: 30 }}>
          <p className="muted">No vehicles registered yet.</p>
          <button className="btn btn-blue" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>
            Register Your First Vehicle
          </button>
        </div>
      ) : (
        <div className="prof-vehicles-list">
          {vehicles.map((v) => (
            <div key={v.id} className="card prof-vehicle-card">
              <div className="prof-vehicle-header">
                <div>
                  <span className="prof-vehicle-num">{v.vehicleNumber}</span>
                  <DataLabel kind="simulated">DEMO</DataLabel>
                </div>
                {v.ownerUserId === userId && (
                  <span className="prof-owner-badge">Owner</span>
                )}
              </div>

              <div className="prof-vehicle-people">
                <span className="prof-field-label">Associated People</span>
                <div className="prof-people-list">
                  {v.people.map((p) => (
                    <div key={p.id} className="prof-person-chip">
                      <span className="prof-person-avatar">
                        {p.name ? p.name.charAt(0).toUpperCase() : "?"}
                      </span>
                      <div className="prof-person-info">
                        <strong>{p.name}</strong>
                        <span className="muted">
                          {p.age ? `Age ${p.age}` : ""} {p.bloodGroup ? `· ${p.bloodGroup}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="prof-vehicle-qr">
                <span className="prof-field-label">Emergency QR</span>
                <div className="prof-qr-preview">
                  <QRCodeSVG
                    value={`https://rescueroute.app/identify/${v.qrToken}`}
                    size={120}
                    bgColor="#141414"
                    fgColor="#3ef27c"
                    level="M"
                  />
                  <span className="prof-qr-hint muted">
                    Scan this QR to identify registered people during emergencies
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="card prof-card" style={{ marginTop: 14 }}>
          <div className="section-title" style={{ fontSize: 16 }}>Add Vehicle</div>
          <div className="prof-add-row">
            <input
              className="prof-add-input"
              value={newVehicleNum}
              onChange={(e) => setNewVehicleNum(e.target.value.toUpperCase())}
              placeholder="e.g. TS09AB1234"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddVehicle()}
            />
            <button className="btn btn-blue" onClick={handleAddVehicle} disabled={addingLoading || !newVehicleNum.trim()}>
              {addingLoading ? <><span className="spin" /> Adding…</> : "Add"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setAddError(null); }}>
              Cancel
            </button>
          </div>
          {addError && <div className="error-box" style={{ marginTop: 8 }}>{addError}</div>}
        </div>
      )}

      {!showAdd && vehicles.length > 0 && (
        <div className="rr-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={() => setShowAdd(true)}>
            + Add Vehicle
          </button>
        </div>
      )}
    </div>
  );
}

/* ======================== QR TAB ======================== */

function QrTab({ vehicle, profileData }) {
  const [showFullQr, setShowFullQr] = useState(false);

  if (!vehicle) {
    return (
      <div className="prof-section">
        <div className="section-title">Emergency Identification QR</div>
        <div className="section-sub">
          This QR allows emergency responders to identify registered people associated with your vehicle.
        </div>
        <div className="card prof-card" style={{ textAlign: "center", padding: 40 }}>
          <p className="muted">No vehicle registered yet. Add a vehicle in the Vehicles tab to generate a QR code.</p>
        </div>
      </div>
    );
  }

  const qrUrl = `https://rescueroute.app/identify/${vehicle.qrToken}`;

  return (
    <div className="prof-section">
      <div className="section-title">Emergency Identification QR</div>
      <div className="section-sub">
        This QR allows emergency responders to identify registered people associated with your vehicle.
      </div>

      <div className="card prof-qr-main-card">
        <div className="prof-qr-main">
          <QRCodeSVG
            value={qrUrl}
            size={showFullQr ? 260 : 180}
            bgColor="#141414"
            fgColor="#3ef27c"
            level="H"
          />
        </div>

        <div className="prof-qr-info">
          <div className="prof-qr-vehicle">
            <span className="prof-field-label">Vehicle</span>
            <span className="prof-vehicle-num">{vehicle.vehicleNumber}</span>
          </div>

          <div className="prof-qr-people">
            <span className="prof-field-label">Registered People</span>
            {vehicle.people.map((p) => (
              <div key={p.id} className="prof-qr-person">
                <span className="prof-person-avatar sm">
                  {p.name ? p.name.charAt(0).toUpperCase() : "?"}
                </span>
                <span>{p.name}</span>
                <span className="muted">{p.bloodGroup}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="prof-qr-note">
          <Icon name="alert" size={14} />
          <span>
            This QR contains only a secure token — no medical data, personal information,
            or Aadhaar number is stored in the QR code.
          </span>
        </div>

        <div className="rr-actions">
          <button className="btn btn-ghost" onClick={() => setShowFullQr(!showFullQr)}>
            {showFullQr ? "Shrink QR" : "Enlarge QR"}
          </button>
          <button
            className="btn btn-blue"
            onClick={() => {
              const svg = document.querySelector(".prof-qr-main svg");
              if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  const pngUrl = canvas.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = pngUrl;
                  a.download = `rescueroute-qr-${vehicle.vehicleNumber}.png`;
                  a.click();
                };
                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
              }
            }}
          >
            Download QR
          </button>
        </div>
      </div>
    </div>
  );
}
