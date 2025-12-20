// routes/missions.js
const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const authMiddleware = require("../kryptyk-labs-api/middleware/auth");
const {
  normalizeClearance,
  clearanceForSuccessfulMissions,
  progressPctToNextTier,
  nextTierTarget
} = require("../kryptyk-labs-api/clearance");

const router = express.Router();

const STARTER_PROTOCOL_ID = "starter-protocol-01";
const INITIATE_001_ID = "initiate-001-packet-parse";

function computeChecksumFromNonce(nonce) {
  const digits = String(nonce || "").replace(/\D/g, "").split("");
  if (!digits.length) return null;
  const sum = digits.reduce((acc, d) => acc + Number(d), 0);
  const checkDigit = String(sum % 10);
  return checkDigit.repeat(6);
}

async function computeInitiate001Packet(userId) {
  const { rows } = await db.query(
    "SELECT id, email, last_login_at, created_at FROM users WHERE id = $1",
    [userId]
  );
  const user = rows[0];
  if (!user) return null;

  const secret =
    process.env.MISSION_SECRET || process.env.JWT_SECRET || "changeme";

  const baseTime = user.last_login_at || user.created_at;
  const base = `${user.id}|${user.email}|${new Date(baseTime).toISOString()}|INITIATE_001`;
  const hex = crypto.createHmac("sha256", secret).update(base).digest("hex");
  const n = Number.parseInt(hex.slice(0, 12), 16) % 1000000;
  const nonce = String(n).padStart(6, "0");

  const packet = {
    proto: "BG/1.0",
    channel: "BLACK_GLASS",
    frame: "HANDSHAKE",
    route: "C2/ORIENT",
    ts_utc: new Date().toISOString(),
    seq: hex.slice(12, 18).toUpperCase(),
    nonce,
    noise: {
      jitter_ms: (Number.parseInt(hex.slice(18, 20), 16) % 27) + 3,
      ecc: hex.slice(20, 28).toUpperCase(),
      relay: `RLY-${hex.slice(28, 32).toUpperCase()}`,
      padding: hex.slice(32, 48)
    },
    payload: {
      op: "CHALLENGE",
      target: "ASSET_VALIDATION",
      note: "Parse only what you are instructed to parse. Ignore noise.",
      rules: {
        response: "submit the NONCE exactly as shown (6 digits)"
      }
    }
  };

  return {
    nonce,
    packet
  };
}

async function computeStarterProtocolBeacon(userId) {
  const { rows } = await db.query(
    "SELECT id, email, last_login_at, created_at FROM users WHERE id = $1",
    [userId]
  );
  const user = rows[0];
  if (!user) return null;

  const secret =
    process.env.MISSION_SECRET || process.env.JWT_SECRET || "changeme";

  // Tie to last successful auth time when available (still stable until next login).
  const baseTime = user.last_login_at || user.created_at;
  const base = `${user.id}|${user.email}|${new Date(baseTime).toISOString()}`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(base)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return `SIG-${digest}`;
}

// Small helper just for this router
async function logAssetEvent(userId, eventType, message, meta) {
  try {
    await db.query(
      `
      INSERT INTO asset_access_logs (user_id, event_type, message, meta)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, eventType, message || null, meta || null]
    );
  } catch (err) {
    console.warn("[MISSIONS] failed to log mission event:", err.message);
  }
}

/**
 * POST /api/missions/log
 * Body:
 *  {
 *    event_type: "BRIEFING_VIEW" | "BRIEFING_ACK" | "MISSION_START" | "MISSION_COMPLETE",
 *    mission_id: "starter-protocol-01",
 *    title?: "Starter Protocol // INITIATE-01"
 *  }
 */
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { event_type, mission_id, title } = req.body || {};

    if (!event_type || !mission_id) {
      return res.status(400).json({
        ok: false,
        error: "event_type and mission_id are required."
      });
    }

    const cleanType = String(event_type).toUpperCase();
    const allowed = new Set([
      "BRIEFING_VIEW",
      "BRIEFING_ACK",
      "MISSION_START",
      "MISSION_COMPLETE"
    ]);

    if (!allowed.has(cleanType)) {
      return res.status(400).json({
        ok: false,
        error: "Unsupported event_type for mission log."
      });
    }

    const label = title || mission_id;
    let message;

    switch (cleanType) {
      case "BRIEFING_VIEW":
        message = `Viewed briefing: ${label}`;
        break;
      case "BRIEFING_ACK":
        message = `Acknowledged briefing: ${label}`;
        break;
      case "MISSION_START":
        message = `Mission started: ${label}`;
        break;
      case "MISSION_COMPLETE":
        message = `Mission completed: ${label}`;
        break;
      default:
        message = label;
    }

    const meta = {
      mission_id,
      title: label
    };

    await logAssetEvent(userId, cleanType, message, meta);

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/missions/log error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to record mission event." });
  }
});

/**
 * GET /api/missions/starter-protocol
 * Returns the per-user beacon token shown in the Orientation Event Stream.
 */
router.get("/starter-protocol", authMiddleware, async (req, res) => {
  try {
    const beacon = await computeStarterProtocolBeacon(req.user.id);
    if (!beacon) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }
    return res.json({
      ok: true,
      mission_id: STARTER_PROTOCOL_ID,
      beacon
    });
  } catch (err) {
    console.error("/api/missions/starter-protocol error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load beacon." });
  }
});

/**
 * GET /api/missions/initiate-001-packet
 * Returns the packet used for INITIATE-001 // PACKET PARSE.
 */
router.get("/initiate-001-packet", authMiddleware, async (req, res) => {
  try {
    const result = await computeInitiate001Packet(req.user.id);
    if (!result) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }
    return res.json({
      ok: true,
      mission_id: INITIATE_001_ID,
      packet: result.packet
    });
  } catch (err) {
    console.error("/api/missions/initiate-001-packet error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load mission packet." });
  }
});

async function countSuccessfulMissions(userId) {
  const { rows } = await db.query(
    "SELECT COUNT(*)::int AS c FROM mission_completions WHERE user_id = $1 AND success = TRUE",
    [userId]
  );
  return rows[0]?.c || 0;
}

async function getSuccessfulCompletion(userId, missionId) {
  const { rows } = await db.query(
    "SELECT success, completed_at FROM mission_completions WHERE user_id = $1 AND mission_id = $2 AND success = TRUE",
    [userId, missionId]
  );
  return rows[0] || null;
}

/**
 * POST /api/missions/complete
 * Body:
 *  {
 *    mission_id: "starter-protocol-01",
 *    success?: true
 *  }
 *
 * Notes:
 * - Server-authoritative: a mission only counts once per user (unique user_id+mission_id).
 * - When a successful completion is recorded, clearance auto-updates using thresholds:
 *   10 => OPERATIVE, 20 => ARCHIVIST, 30 => ADMIN.
 */
router.post("/complete", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { mission_id, success } = req.body || {};

  const missionId = (mission_id || "").toString().trim();
  if (!missionId) {
    return res.status(400).json({
      ok: false,
      error: "mission_id is required."
    });
  }

  const isSuccess = typeof success === "undefined" ? true : !!success;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // If already completed successfully, do not allow re-completion/spam.
    const { rows: existingRows } = await client.query(
      "SELECT completed_at FROM mission_completions WHERE user_id = $1 AND mission_id = $2 AND success = TRUE",
      [userId, missionId]
    );
    const existing = existingRows[0] || null;
    if (existing) {
      const { rows: countRows } = await client.query(
        "SELECT COUNT(*)::int AS c FROM mission_completions WHERE user_id = $1 AND success = TRUE",
        [userId]
      );
      const successCount = countRows[0]?.c || 0;

      const computedClearance = clearanceForSuccessfulMissions(successCount);
      const computedProgress = progressPctToNextTier(successCount);

      await client.query(
        "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
        [computedClearance, computedProgress, userId]
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        mission_id: missionId,
        success: true,
        already_completed: true,
        completed_at: existing.completed_at,
        successful_missions: successCount,
        clearance_level: computedClearance,
        clearance_progress_pct: computedProgress,
        ranked_up: false,
        ...nextTierTarget(successCount)
      });
    }

    // Upsert completion record.
    await client.query(
      `
      INSERT INTO mission_completions (user_id, mission_id, success)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, mission_id)
      DO UPDATE SET
        success = EXCLUDED.success,
        completed_at = NOW()
      `,
      [userId, missionId, isSuccess]
    );

    // Compute authoritative success count after upsert.
    const { rows: countRows } = await client.query(
      "SELECT COUNT(*)::int AS c FROM mission_completions WHERE user_id = $1 AND success = TRUE",
      [userId]
    );
    const successCount = countRows[0]?.c || 0;

    // Determine clearance from spec thresholds.
    const computedClearance = clearanceForSuccessfulMissions(successCount);
    const computedProgress = progressPctToNextTier(successCount);

    // Compare against stored clearance.
    const { rows: userRows } = await client.query(
      "SELECT clearance_level FROM users WHERE id = $1",
      [userId]
    );
    const previousTier = normalizeClearance(userRows[0]?.clearance_level);
    const nextTier = normalizeClearance(computedClearance);

    const rankedUp = previousTier !== nextTier;

    await client.query(
      "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
      [computedClearance, computedProgress, userId]
    );

    // Log completion for audit trail.
    if (isSuccess) {
      await logAssetEvent(
        userId,
        "MISSION_COMPLETE",
        `Mission completed: ${missionId}`,
        { mission_id: missionId, success: true }
      );
    } else {
      await logAssetEvent(
        userId,
        "MISSION_ATTEMPT",
        `Mission attempted: ${missionId}`,
        { mission_id: missionId, success: false }
      );
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      mission_id: missionId,
      success: isSuccess,
      successful_missions: successCount,
      clearance_level: computedClearance,
      clearance_progress_pct: computedProgress,
      ranked_up: rankedUp,
      ...nextTierTarget(successCount)
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("/api/missions/complete error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to record mission completion." });
  } finally {
    client.release();
  }
});

/**
 * GET /api/missions/progress
 * Returns authoritative mission success count + computed clearance.
 */
router.get("/progress", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const successCount = await countSuccessfulMissions(userId);
    const computedClearance = clearanceForSuccessfulMissions(successCount);
    const computedProgress = progressPctToNextTier(successCount);

    // Keep users table in sync (server-authoritative).
    await db.query(
      "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
      [computedClearance, computedProgress, userId]
    );

    return res.json({
      ok: true,
      successful_missions: successCount,
      clearance_level: computedClearance,
      clearance_progress_pct: computedProgress,
      ...nextTierTarget(successCount)
    });
  } catch (err) {
    console.error("/api/missions/progress error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load mission progress." });
  }
});

/**
 * GET /api/missions/status?mission_id=starter-protocol-01
 * Returns whether a mission has already been successfully completed.
 */
router.get("/status", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const missionId = (req.query.mission_id || "").toString().trim();

  if (!missionId) {
    return res.status(400).json({
      ok: false,
      error: "mission_id is required."
    });
  }

  try {
    const completion = await getSuccessfulCompletion(userId, missionId);
    return res.json({
      ok: true,
      mission_id: missionId,
      completed: !!completion,
      completed_at: completion?.completed_at || null
    });
  } catch (err) {
    if (err && err.code === "42P01") {
      return res.status(500).json({
        ok: false,
        error:
          "Database schema missing mission_completions. Run kryptyk-labs-api/sql/schema.sql (or migrate your DB) and retry."
      });
    }
    console.error("/api/missions/status error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load mission status."
    });
  }
});

/**
 * POST /api/missions/submit
 * Body:
 *  {
 *    mission_id: "starter-protocol-01",
 *    answer: "SIG-XXXXXXXXXX"
 *  }
 */
router.post("/submit", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { mission_id, answer } = req.body || {};

  const missionId = (mission_id || "").toString().trim();
  const submitted = (answer || "").toString().trim();

  if (!missionId) {
    return res.status(400).json({ ok: false, error: "mission_id is required." });
  }
  if (!submitted) {
    return res.status(400).json({ ok: false, error: "answer is required." });
  }

  const supported = new Set([STARTER_PROTOCOL_ID, INITIATE_001_ID]);
  if (!supported.has(missionId)) {
    return res.status(400).json({ ok: false, error: "Unsupported mission_id for submission." });
  }

  try {
    // If already completed successfully, do not allow re-completion.
    const existing = await getSuccessfulCompletion(userId, missionId);
    if (existing) {
      const successCount = await countSuccessfulMissions(userId);
      const computedClearance = clearanceForSuccessfulMissions(successCount);
      const computedProgress = progressPctToNextTier(successCount);

      // Keep users table in sync.
      await db.query(
        "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
        [computedClearance, computedProgress, userId]
      );

      return res.json({
        ok: true,
        mission_id: missionId,
        correct: true,
        already_completed: true,
        completed_at: existing.completed_at,
        successful_missions: successCount,
        clearance_level: computedClearance,
        clearance_progress_pct: computedProgress,
        ranked_up: false,
        ...nextTierTarget(successCount)
      });
    }

    let correct = false;
    let incorrectMessage = "Incorrect answer.";

    if (missionId === STARTER_PROTOCOL_ID) {
      const expected = await computeStarterProtocolBeacon(userId);
      if (!expected) {
        return res.status(404).json({ ok: false, error: "User not found." });
      }
      correct = submitted.toUpperCase() === expected.toUpperCase();
      incorrectMessage = "Incorrect answer. Re-check the Event Stream.";
    }

    if (missionId === INITIATE_001_ID) {
      if (!/^\d{6}$/.test(submitted)) {
        return res.json({
          ok: true,
          mission_id: missionId,
          correct: false,
          message: "Response format invalid. Expected the 6-digit NONCE."
        });
      }

      const result = await computeInitiate001Packet(userId);
      if (!result) {
        return res.status(404).json({ ok: false, error: "User not found." });
      }

      const expected = result.nonce;
      correct = submitted === expected;
      incorrectMessage = "Incorrect NONCE. Re-parse the packet and copy it exactly.";
    }

    if (!correct) {
      await logAssetEvent(
        userId,
        "MISSION_ATTEMPT",
        `Mission attempted: ${missionId}`,
        { mission_id: missionId, success: false }
      );

      return res.json({
        ok: true,
        mission_id: missionId,
        correct: false,
        message: incorrectMessage
      });
    }

    // Correct: record success + update clearance in one transaction.
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO mission_completions (user_id, mission_id, success)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (user_id, mission_id)
        DO UPDATE SET
          success = TRUE,
          completed_at = NOW()
        `,
        [userId, missionId]
      );

      const { rows: countRows } = await client.query(
        "SELECT COUNT(*)::int AS c FROM mission_completions WHERE user_id = $1 AND success = TRUE",
        [userId]
      );
      const successCount = countRows[0]?.c || 0;

      const computedClearance = clearanceForSuccessfulMissions(successCount);
      const computedProgress = progressPctToNextTier(successCount);

      const { rows: userRows } = await client.query(
        "SELECT clearance_level FROM users WHERE id = $1",
        [userId]
      );
      const previousTier = normalizeClearance(userRows[0]?.clearance_level);
      const nextTier = normalizeClearance(computedClearance);
      const rankedUp = previousTier !== nextTier;

      await client.query(
        "UPDATE users SET clearance_level = $1, clearance_progress_pct = $2 WHERE id = $3",
        [computedClearance, computedProgress, userId]
      );

      await logAssetEvent(
        userId,
        "MISSION_COMPLETE",
        `Mission completed: ${missionId}`,
        { mission_id: missionId, success: true }
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        mission_id: missionId,
        correct: true,
        successful_missions: successCount,
        clearance_level: computedClearance,
        clearance_progress_pct: computedProgress,
        ranked_up: rankedUp,
        ...nextTierTarget(successCount)
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    // 42P01 = undefined_table (schema not applied)
    if (err && err.code === "42P01") {
      return res.status(500).json({
        ok: false,
        error:
          "Database schema missing mission_completions. Run kryptyk-labs-api/sql/schema.sql (or migrate your DB) and retry."
      });
    }
    console.error("/api/missions/submit error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to submit mission answer." });
  }
});

module.exports = router;
