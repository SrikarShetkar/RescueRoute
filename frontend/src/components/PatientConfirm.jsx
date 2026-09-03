import React, { useState, useEffect } from "react";
import patientApi from "../services/patientApi";
import Icon from "./Icon";
import "./PatientConfirm.css";

/**
 * PatientConfirm — Shows full emergency profile of selected patient.
 * Bystander confirms this is the injured person.
 * Fetches full emergency profile from backend.
 */
export default function PatientConfirm({ person, vehicleNumber, onConfirm, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      try {
        setLoading(true);
        const result = await patientApi.getEmergencyProfile(person.id);
        if (!cancelled) {
          setProfile(result.profile);
        }
      } catch (err) {
        if (!cancelled) {
          // Fallback: use the person data we already have
          setProfile({
            ...person,
            medicalHistory: person.medicalHistory || [],
            emergencyContacts: person.emergencyContacts || [],
            vehicleNumbers: person.vehicleNumbers || [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProfile();
    return () => { cancelled = true; };
  }, [person.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="pc-section">
        <div className="pc-loading">
          <span className="spin" />
          <p>Loading emergency profile…</p>
        </div>
      </div>
    );
  }

  const p = profile || person;

  return (
    <div className="pc-section">
      <div className="section-title">Confirm Patient</div>
      <div className="section-sub">Verify this is the injured person before continuing.</div>

      <div className="card pc-card">
        <div className="pc-photo">
          {p.photo ? (
            <img src={p.photo} alt={p.name} />
          ) : (
            <span className="pc-photo-placeholder">
              {p.name ? p.name.charAt(0).toUpperCase() : "?"}
            </span>
          )}
        </div>

        <h2 className="pc-name">{p.name}</h2>

        <div className="pc-details-grid">
          {p.age && (
            <div className="pc-detail">
              <span className="pc-detail-label">Age</span>
              <span className="pc-detail-value">{p.age} yrs</span>
            </div>
          )}
          {p.gender && (
            <div className="pc-detail">
              <span className="pc-detail-label">Gender</span>
              <span className="pc-detail-value">{p.gender}</span>
            </div>
          )}
          {p.bloodGroup && (
            <div className="pc-detail">
              <span className="pc-detail-label">Blood Group</span>
              <span className="pc-detail-value pc-blood">{p.bloodGroup}</span>
            </div>
          )}
        </div>

        {p.allergies && p.allergies !== "None" && (
          <div className="pc-section-block">
            <span className="pc-section-label"><Icon name="alert" size={14} /> Allergies</span>
            <p className="pc-section-text">{p.allergies}</p>
          </div>
        )}

        {p.medicalHistory && p.medicalHistory.length > 0 && (
          <div className="pc-section-block">
            <span className="pc-section-label"><Icon name="hospital" size={14} /> Medical History</span>
            <p className="pc-section-text">{p.medicalHistory.join(", ")}</p>
          </div>
        )}

        {vehicleNumber && vehicleNumber !== "—" && (
          <div className="pc-section-block">
            <span className="pc-section-label">Vehicle</span>
            <p className="pc-section-text pc-vehicle">{vehicleNumber}</p>
          </div>
        )}

        <div className="rr-actions pc-actions">
          <button className="btn btn-ghost" onClick={onBack}>
            ← Choose Another Person
          </button>
          <button className="btn btn-red" onClick={() => onConfirm(p)}>
            <Icon name="sos" size={16} /> Confirm Patient
          </button>
        </div>
      </div>
    </div>
  );
}
