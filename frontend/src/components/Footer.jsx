import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-logo">
              <span className="logo-icon">
                <Icon name="ambulance" size={24} />
              </span>
              <span>RescueRoute</span>
            </div>
            <p>When an ambulance moves, the city moves with it.</p>
          </div>

          <div className="footer-col">
            <h4>Roles</h4>
            <ul>
              <li><Link to="/report">Report &amp; Track</Link></li>
              <li><Link to="/ambulance">Ambulance Driver</Link></li>
              <li><Link to="/hospital">Hospital ER</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Operations</h4>
            <ul>
              <li><Link to="/control-room">Control Room</Link></li>
              <li><Link to="/driver">Nearby Driver</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Demo rules</h4>
            <ul>
              <li><span className="muted">Numbers are labelled LIVE / SIMULATED / DEMO</span></li>
              <li><span className="muted">Sounds play only on system events</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 RescueRoute · 6-role live emergency demo</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;