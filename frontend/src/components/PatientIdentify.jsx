import React, { useState } from "react";
import QrScanner from "./QrScanner";
import PatientSelect from "./PatientSelect";
import patientApi from "../services/patientApi";
import Icon from "./Icon";
import "./PatientIdentify.css";

/**
 * PatientIdentify — Main identification interface for bystander mode.
 * Provides four methods: QR Scan, Vehicle Number, Aadhaar Number, Manual Entry.
 * On successful lookup, shows PatientSelect for victim selection.
 */
export default function PatientIdentify({ onManualEntry, onPatientConfirmed }) {
  const [mode, setMode] = useState(null); // null | qr | vehicle | aadhaar | manual
  const [vehicleInput, setVehicleInput] = useState("");
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const reset = () => {
    setMode(null);
    setVehicleInput("");
    setAadhaarInput("");
    setError(null);
    setLookupResult(null);
    setLoading(false);
    setShowScanner(false);
  };

  // --- QR Scan ---
  const handleQrScan = async (token) => {
    setShowScanner(false);
    setLoading(true);
    setError(null);
    try {
      const result = await patientApi.lookupByQr(token);
      setLookupResult(result);
    } catch (err) {
      setError(err.message || "Invalid QR code. No vehicle found.");
    } finally {
      setLoading(false);
    }
  };

  // --- Vehicle Number Lookup ---
  const handleVehicleLookup = async () => {
    const num = vehicleInput.trim();
    if (!num) { setError("Please enter a vehicle number."); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await patientApi.lookupByVehicle(num);
      setLookupResult(result);
    } catch (err) {
      setError(err.message || "Vehicle not found. Check the number and try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Aadhaar Lookup ---
  const handleAadhaarLookup = async () => {
    const num = aadhaarInput.replace(/\s/g, "").trim();
    if (!num || num.length !== 12) { setError("Please enter a valid 12-digit Aadhaar number."); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await patientApi.lookupByAadhaar(num);
      // Aadhaar returns a single profile, wrap it as a "people" array
      setLookupResult({
        vehicleNumber: result.profile.vehicleNumbers?.[0] || "—",
        people: [result.profile],
        isSingleProfile: true,
      });
    } catch (err) {
      setError(err.message || "No profile found for this Aadhaar number.");
    } finally {
      setLoading(false);
    }
  };

  // --- Format Aadhaar with spaces ---
  const formatAadhaar = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(" ");
  };

  // --- If lookupResult is set, show PatientSelect ---
  if (lookupResult) {
    return (
      <PatientSelect
        people={lookupResult.people}
        vehicleNumber={lookupResult.vehicleNumber}
        isSingleProfile={lookupResult.isSingleProfile}
        onConfirm={(person) => onPatientConfirmed(person)}
        onBack={reset}
      />
    );
  }

  return (
    <div className="pi-section">
      {showScanner && (
        <QrScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="section-title">Identify Patient</div>
      <div className="section-sub">
        Use one of these methods to quickly identify the injured person.
        All options fetch registered profiles so you can visually confirm who needs help.
      </div>

      <div className="pi-grid">
        {/* QR Scan Card */}
        <button className="card pi-card" onClick={() => { setMode("qr"); setShowScanner(true); }}>
          <span className="pi-card-icon"><Icon name="crash" size={28} /></span>
          <strong>Scan Emergency QR</strong>
          <span className="muted">Quickly identify registered people associated with a vehicle QR code</span>
          <span className="pi-card-action btn btn-blue" onClick={(e) => { e.stopPropagation(); setMode("qr"); setShowScanner(true); }}>
            Scan QR
          </span>
        </button>

        {/* Vehicle Number Card */}
        <div className="card pi-card" onClick={() => setMode(mode === "vehicle" ? null : "vehicle")}>
          <span className="pi-card-icon"><Icon name="car" size={28} /></span>
          <strong>Vehicle Number</strong>
          <span className="muted">Look up registered people by entering the vehicle number</span>
          {mode === "vehicle" && (
            <div className="pi-input-group" onClick={(e) => e.stopPropagation()}>
              <input
                className="pi-input"
                value={vehicleInput}
                onChange={(e) => setVehicleInput(e.target.value.toUpperCase())}
                placeholder="e.g. TS09AB1234"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleVehicleLookup()}
              />
              <button
                className="btn btn-blue"
                onClick={handleVehicleLookup}
                disabled={loading || !vehicleInput.trim()}
              >
                {loading ? <><span className="spin" /> Searching…</> : "Find Patient"}
              </button>
            </div>
          )}
        </div>

        {/* Aadhaar Card */}
        <div className="card pi-card" onClick={() => setMode(mode === "aadhaar" ? null : "aadhaar")}>
          <span className="pi-card-icon"><Icon name="user" size={28} /></span>
          <strong>Aadhaar Number</strong>
          <span className="muted">Look up a registered profile by Aadhaar identity number</span>
          {mode === "aadhaar" && (
            <div className="pi-input-group" onClick={(e) => e.stopPropagation()}>
              <input
                className="pi-input"
                value={aadhaarInput}
                onChange={(e) => setAadhaarInput(formatAadhaar(e.target.value))}
                placeholder="XXXX XXXX XXXX"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAadhaarLookup()}
                maxLength={14}
              />
              <button
                className="btn btn-blue"
                onClick={handleAadhaarLookup}
                disabled={loading || aadhaarInput.replace(/\s/g, "").length !== 12}
              >
                {loading ? <><span className="spin" /> Searching…</> : "Find Patient"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="pi-error-box">
          <span className="pi-error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      <div className="pi-manual-row">
        <span className="pi-or">or</span>
        <button className="btn btn-ghost" onClick={onManualEntry}>
          Enter Patient Details Manually
        </button>
      </div>
    </div>
  );
}
