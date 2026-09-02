// Format seconds into mm:ss
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Generate simple random ID (for demo)
export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Capitalize first letter
export function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
