import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, ROLE_META } from "../context/AuthContext";

/**
 * ProtectedRoute — dashboards require a sign-in AND the account's role must
 * match the screen. A logged-in user from another role is redirected to their
 * own dashboard (role-based access).
 */
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && user.role !== role) {
    const home = ROLE_META[user.role]?.home || "/";
    return <Navigate to={home} replace />;
  }

  return children;
}