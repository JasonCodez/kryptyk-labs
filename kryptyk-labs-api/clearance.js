// kryptyk-labs-api/clearance.js

function normalizeClearance(value) {
  const raw = (value || "INITIATED").toString().trim().toUpperCase();
  const base = raw.split("-")[0] || "INITIATED";

  // Back-compat: older values used INITIATED as the tier label.
  if (base === "INITIATED") return "INITIATE";
  return base;
}

function clearanceForSuccessfulMissions(successCount) {
  const n = Math.max(0, Number(successCount) || 0);

  // Server-authoritative tiers (cumulative mission thresholds):
  // 0–9    => INITIATE
  // 10–29  => OPERATIVE
  // 30–59  => ARCHIVIST
  // >=60   => ADMIN
  //
  // Display rank resets per tier: <TIER>-<missions_within_tier>
  // Example: 5 missions => INITIATE-5
  if (n >= 60) return `ADMIN-${n - 60}`;
  if (n >= 30) return `ARCHIVIST-${n - 30}`;
  if (n >= 10) return `OPERATIVE-${n - 10}`;
  return `INITIATE-${n}`;
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
