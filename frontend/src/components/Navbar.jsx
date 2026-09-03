import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, ROLE_META } from "../context/AuthContext";
import Icon from "./Icon";
import "./Navbar.css";

const ALL_LINKS = [
  { path: "/report", label: "Report & Track", role: "reporter" },
  { path: "/ambulance", label: "Ambulance", role: "ambulance" },
  { path: "/hospital", label: "Hospital", role: "hospital" },
  { path: "/control-room", label: "Control Room", role: "dispatch" },
  { path: "/driver", label: "Nearby Driver", role: "driver" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Role-based access: signed-in users only see links for their own role.
  const links = user ? ALL_LINKS.filter((l) => l.role === user.role) : ALL_LINKS;

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-container">
        <Link to="/" className="logo" onClick={() => setOpen(false)}>
          <span className="logo-mark">
            <Icon name="sos" size={22} />
          </span>
          <span className="logo-text">RES'Q' ROUTE</span>
        </Link>

        <div className={`nav-links ${open ? "active" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.path}
              to={user && l.role !== user.role ? ROLE_META[user.role].home : l.path}
              className={`nav-link ${location.pathname === l.path ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}

          <div className="nav-auth">
            {user ? (
              <>
                <span className="nav-user" title={`Signed in as ${ROLE_META[user.role].label}`}>
                  <Icon name={ROLE_META[user.role].icon} size={15} /> {user.name || user.username}
                </span>
                <Link to="/profile" className="nav-link" onClick={() => setOpen(false)}>
                  Profile
                </Link>
                <button className="btn-logout" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="nav-link" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        </div>

        <button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label="menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;