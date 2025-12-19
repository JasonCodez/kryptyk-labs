// kryptyk-labs-api/clearance.js

function normalizeClearance(value) {
  return (value || "INITIATED").toString().trim().toUpperCase();
}

function clearanceForSuccessfulMissions(successCount) {
  const n = Math.max(0, Number(successCount) || 0);
  // Thresholds (server-authoritative):
  // <10 INITIATED
  // 10–29 OPERATIVE
  // 30–59 ARCHIVIST
  // >=60 ADMIN
  if (n >= 60) return "ADMIN";
  if (n >= 30) return "ARCHIVIST";
  if (n >= 10) return "OPERATIVE";
  return "INITIATED";
}

function progressPctToNextTier(successCount) {
  const n = Math.max(0, Number(successCount) || 0);

  // Per spec: rank-up thresholds are 10 / 30 / 60.
  // Progress is shown within the current tier toward the next threshold.
  if (n >= 60) return 100;

  let start = 0;
  let end = 10;

  if (n >= 30) {
    start = 30;
    end = 60;
  } else if (n >= 10) {
    start = 10;
    end = 30;
  }

  const span = end - start;
  const pct = span > 0 ? ((n - start) / span) * 100 : 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function nextTierTarget(successCount) {
  const n = Math.max(0, Number(successCount) || 0);
  if (n >= 60) {
    return {
      next_tier: null,
      next_threshold: null,
      remaining: 0
    };
  }

  if (n >= 30) {
    return {
      next_tier: "ADMIN",
      next_threshold: 60,
      remaining: Math.max(0, 60 - n)
    };
  }

  if (n >= 10) {
    return {
      next_tier: "ARCHIVIST",
      next_threshold: 30,
      remaining: Math.max(0, 30 - n)
    };
  }

  return {
    next_tier: "OPERATIVE",
    next_threshold: 10,
    remaining: Math.max(0, 10 - n)
  };
}

module.exports = {
  normalizeClearance,
  clearanceForSuccessfulMissions,
  progressPctToNextTier,
  nextTierTarget
};
