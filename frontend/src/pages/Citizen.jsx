import React from "react";
import { Link } from "react-router-dom";
import { useAuth, ROLE_META } from "../context/AuthContext";
import Icon from "../components/Icon";
import "./Citizen.css";

/**
 * Citizen — the citizen/reporter hub. Two sections:
 *  - View Profile   -> /profile  (medical info, vehicles, emergency QR)
 *  - Report Emergency -> /report (report + track an emergency)
 */
export default function Citizen() {
  const { user } = useAuth();

  return (
    <section className="rr-page">
      <div className="page-hero muted-hero">
        <div className="container page-hero-inner">
          <div>
            <div className="rr-eyebrow">
              <Icon name={ROLE_META.reporter.icon} size={14} /> CITIZEN
            </div>
            <h1>
              {user?.name || "Citizen"}
              <span className="rr-hero-accent"> Desk</span>
            </h1>
            <p className="page-hero-sub">
              Report an emergency for yourself or someone nearby, or manage your
              RescueRoute profile for faster care.
            </p>
          </div>
        </div>
      </div>

      <div className="container rr-body">
        <div className="rr-cit-grid">
          <Link to="/report" className="card rr-cit-card rr-cit-report">
            <Icon name="alert" size={30} className="rr-cit-icon" />
            <h2>Report Emergency</h2>
            <p>
              Call for help, describe what happened, and track the ambulance and
              responders live until you&apos;re safe.
            </p>
            <span className="btn btn-red rr-cit-action">Report now</span>
          </Link>

          <Link to="/profile" className="card rr-cit-card rr-cit-profile">
            <Icon name="user" size={30} className="rr-cit-icon" />
            <h2>View Profile</h2>
            <p>
              Edit your medical information, manage your vehicles, and generate
              your emergency QR for first responders.
            </p>
            <span className="btn btn-blue rr-cit-action">View profile</span>
          </Link>
        </div>

        <div className="rr-cit-note card">
          <Icon name="shield" size={16} />
          <span>
            In an emergency, tap <strong>Report Emergency</strong>. If you can
            scan a victim&apos;s vehicle QR, RescueRoute pre-fills their medical
            profile for the ambulance crew.
          </span>
        </div>
      </div>
    </section>
  );
}
