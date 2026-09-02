// Simple Rescue Score logic (can be replaced by AI later)

export function calculateRescueScore(action) {
  switch (action) {
    case "EARLY_YIELD":
      return 10;
    case "LATE_YIELD":
      return 5;
    case "BLOCKED":
      return -10;
    case "REPORTED_BLOCK":
      return 3;
    default:
      return 0;
  }
}

export function getRescueBadge(score) {
  if (score >= 50) return " Gold Rescuer";
  if (score >= 25) return " Silver Rescuer";
  if (score >= 10) return " Bronze Rescuer";
  return " New Driver";
}
