import React, { useState } from "react";
import PatientConfirm from "./PatientConfirm";
import DataLabel from "./DataLabel";
import "./PatientSelect.css";

/**
 * PatientSelect — Displays registered people from a vehicle/QR/Aadhaar lookup.
 * Bystander visually identifies the victim and selects them.
 * On confirmation, fetches full emergency profile.
 */
export default function PatientSelect({ people, vehicleNumber, isSingleProfile, onConfirm, onBack }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [confirming, setConfirming] = useState(false);

  if (!people || people.length === 0) {
    return (
      <div className="ps-section">
        <div className="card ps-empty">
          <p>No registered people found for this vehicle.</p>
          <div className="rr-actions">
            <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (confirming && selectedPerson) {
    return (
      <PatientConfirm
        person={selectedPerson}
        vehicleNumber={vehicleNumber}
        onConfirm={(person) => onConfirm(person)}
        onBack={() => { setConfirming(false); setSelectedPerson(null); }}
      />
    );
  }

  return (
    <div className="ps-section">
      <div className="section-title">
        {isSingleProfile ? "Patient Found" : "Registered People"}
      </div>
      <div className="section-sub">
        {isSingleProfile
          ? "This profile was found. Confirm this is the injured person."
          : "Select the injured person. Compare photos and details to identify the right person."
        }
      </div>

      {vehicleNumber && (
        <div className="ps-vehicle-badge">
          <span className="ps-vehicle-label">Vehicle</span>
          <span className="ps-vehicle-number">{vehicleNumber}</span>
          <DataLabel kind="simulated">LOOKUP</DataLabel>
        </div>
      )}

      <div className="ps-people-grid">
        {people.map((person) => (
          <div key={person.id} className="card ps-person-card">
            <div className="ps-person-photo">
              {person.photo ? (
                <img src={person.photo} alt={person.name} />
              ) : (
                <span className="ps-photo-placeholder">
                  {person.name ? person.name.charAt(0).toUpperCase() : "?"}
                </span>
              )}
            </div>
            <div className="ps-person-info">
              <strong className="ps-person-name">{person.name}</strong>
              <div className="ps-person-details">
                {person.age && <span>Age: {person.age}</span>}
                {person.gender && <span>Gender: {person.gender}</span>}
                {person.bloodGroup && <span>Blood: {person.bloodGroup}</span>}
              </div>
              {person.allergies && person.allergies !== "None" && (
                <span className="ps-allergy-tag">Allergies: {person.allergies}</span>
              )}
            </div>
            <button
              className="btn btn-red ps-select-btn"
              onClick={() => { setSelectedPerson(person); setConfirming(true); }}
            >
              Select Patient
            </button>
          </div>
        ))}
      </div>

      <div className="rr-actions">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}
