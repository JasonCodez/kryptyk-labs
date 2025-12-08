// routes/missions.js
const express = require("express");
const db = require("../db");
const authMiddleware = require("../kryptyk-labs-api/middleware/auth");

const router = express.Router();

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

module.exports = router;
