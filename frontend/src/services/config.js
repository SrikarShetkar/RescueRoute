/**
 * config.js — How the client finds the backend.
 *
 * During the demo the frontend and backend may live on different machines.
 * The client derives the server host from the page's own hostname so laptops
 * on the same LAN (http://<laptop-ip>:3000) automatically talk to the backend
 * on http://<laptop-ip>:5001. Override with REACT_APP_API_URL if needed.
 */
function resolveHost() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/$/, "");
  const host = window.location.hostname || "localhost";
  const port = 5001;
  return `http://${host}:${port}`;
}

export const SERVER_URL = resolveHost();
export const API_URL = `${SERVER_URL}/api/v1`;
export const SOCKET_URL = SERVER_URL;