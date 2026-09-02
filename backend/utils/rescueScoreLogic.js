/**
 * Get points for a driver action
 * @param {string} action - Action type
 * @returns {number} Points awarded
 */
function getScoreForAction(action) {
  const scoreMap = {
    EARLY_YIELD: 10, // Cleared path 30+ seconds early
    ON_TIME_YIELD: 7, // Cleared path just in time
    LATE_YIELD: 3, // Cleared path but delayed
    BLOCKED_AMBULANCE: -15, // Did not yield/blocked
    REPORTED_BLOCK: 5, // Reported blocking vehicle
    ASSISTED_ACCIDENT: 20, // Helped at accident scene
    BLOOD_DONATION: 15, // Donated blood for emergency
    FALSE_REPORT: -10, // False emergency report
  };

  return scoreMap[action] || 0;
}

/**
 * Get rescue level based on total score
 * @param {number} totalScore - Total accumulated score
 * @returns {string} Level name
 */
function getRescueLevel(totalScore) {
  if (totalScore >= 100) return "PLATINUM";
  if (totalScore >= 60) return "GOLD";
  if (totalScore >= 30) return "SILVER";
  if (totalScore >= 10) return "BRONZE";
  return "NEW";
}

/**
 * Get level benefits and perks
 * @param {string} level - Level name
 * @returns {object} Benefits information
 */
function getLevelBenefits(level) {
  const benefits = {
    PLATINUM: {
      badge: "",
      perks: [
        "Priority ambulance access",
        "Insurance discounts",
        "Free annual health check",
        "VIP hospital services",
      ],
      color: "#E5E4E2",
    },
    GOLD: {
      badge: "",
      perks: [
        "Insurance discount",
        "Free health checkup",
        "Priority support",
      ],
      color: "#FFD700",
    },
    SILVER: {
      badge: "",
      perks: ["Basic insurance discount", "Recognition badge"],
      color: "#C0C0C0",
    },
    BRONZE: {
      badge: "",
      perks: ["Recognition badge", "Community support"],
      color: "#CD7F32",
    },
    NEW: {
      badge: "",
      perks: ["Welcome to RescueRoute!"],
      color: "#808080",
    },
  };

  return benefits[level] || benefits.NEW;
}

/**
 * Calculate next level progress
 * @param {number} currentScore - Current total score
 * @returns {object} Progress information
 */
function getLevelProgress(currentScore) {
  const currentLevel = getRescueLevel(currentScore);
  const thresholds = {
    NEW: 10,
    BRONZE: 30,
    SILVER: 60,
    GOLD: 100,
    PLATINUM: Infinity,
  };

  const nextThreshold = thresholds[currentLevel];
  const prevThreshold =
    currentLevel === "NEW" ? 0 : thresholds[getPreviousLevel(currentLevel)];

  const progress =
    nextThreshold === Infinity
      ? 100
      : ((currentScore - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

  return {
    currentLevel,
    currentScore,
    nextLevel: getNextLevel(currentLevel),
    pointsToNext:
      nextThreshold === Infinity ? 0 : nextThreshold - currentScore,
    progress: Math.min(progress, 100),
  };
}

function getNextLevel(currentLevel) {
  const levels = ["NEW", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
  const index = levels.indexOf(currentLevel);
  return index < levels.length - 1 ? levels[index + 1] : "PLATINUM";
}

function getPreviousLevel(currentLevel) {
  const levels = ["NEW", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
  const index = levels.indexOf(currentLevel);
  return index > 0 ? levels[index - 1] : "NEW";
}

module.exports = {
  getScoreForAction,
  getRescueLevel,
  getLevelBenefits,
  getLevelProgress,
};