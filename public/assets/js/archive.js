document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.location.origin;
  const token = localStorage.getItem("kl_token");

  const assetPill = document.getElementById("kl-header-asset-pill");
  const clearancePill = document.getElementById(
    "kl-header-clearance-pill"
  );
  const logoutBtn = document.getElementById("kl-logout-btn");

  const listEl = document.getElementById("kl-archive-list");
  const detailEl = document.getElementById("kl-archive-detail");
  const errorEl = document.getElementById("kl-archive-error");

  // Mission console (INITIATE-001)
  const starterOpenBtn = document.getElementById("kl-initiate-001-open");
  const starterStatusEl = document.getElementById("kl-initiate-001-status");
  const missionConsoleTitleEl = document.getElementById("kl-mission-console-title");
  const missionConsoleDescEl = document.getElementById("kl-mission-console-desc");

  // Mission modal elements
  const missionModal = document.getElementById("kl-mission-modal");
  const missionTitleEl = document.getElementById("kl-mission-title");
  const missionBodyEl = document.getElementById("kl-mission-body");
  const missionLearnMoreBtn = document.getElementById("kl-mission-learn-more-btn");
  const missionLearnMoreBlock = document.getElementById("kl-mission-learn-more");
  const missionLearnMoreBody = document.getElementById("kl-mission-learn-more-body");
  const missionHintEl = document.getElementById("kl-mission-hint");
  const missionCloseBtn = document.getElementById("kl-mission-close");
  const missionAnswerBlock = document.getElementById("kl-mission-answer-block");
  const missionAnswerInput = document.getElementById("kl-mission-answer-input");
  const missionAnswerError = document.getElementById("kl-mission-answer-error");
  const missionAnswerStatus = document.getElementById("kl-mission-answer-status");
  const missionSubmitBtn = document.getElementById("kl-mission-submit");
  const missionReceiptBlock = document.getElementById("kl-mission-receipt-block");
  const missionReceiptBody = document.getElementById("kl-mission-receipt-body");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const INITIATE_001_ID = "initiate-001-packet-parse";
  const INITIATE_002_ID = "initiate-002-order-of-ops";

  const completion = {
    [INITIATE_001_ID]: false,
    [INITIATE_002_ID]: false
  };

  let activeMissionId = INITIATE_001_ID;

  const initiate001Mission = {
    id: INITIATE_001_ID,
    title: "INITIATE-001 // PACKET PARSE",
    body:
      "Packet sync in progress…\n\n" +
      "When the packet arrives, locate the NONCE and submit it exactly as shown (6 digits).",
    hint:
      "Response format: 6 digits. Locate NONCE in the packet and submit it exactly."
  };

  const initiate002Mission = {
    id: INITIATE_002_ID,
    title: "INITIATE-002 // ORDER OF OPS",
    body:
      "Packet sync in progress…\n\n" +
      "When the packet arrives, check FRAME first.\n" +
      "IF frame == HANDSHAKE => submit NONCE (6 digits).\n" +
      "ELSE => submit SEQ (6 characters).",
    hint:
      "Order of ops: FRAME decides the field. HANDSHAKE => NONCE. Otherwise => SEQ."
  };

  // Basic header hydrate
  const email = localStorage.getItem("kl_asset_email") || "unknown@asset";
  const rawName = (localStorage.getItem("kl_display_name") || "").trim();
  const clearance =
    (localStorage.getItem("kl_clearance_level") || "INITIATE-0").toUpperCase();

  const assetLabel = rawName
    ? `asset: ${rawName.toUpperCase()}`
    : `asset: ${email}`;

  if (assetPill) assetPill.textContent = assetLabel;
  if (clearancePill)
    clearancePill.textContent = `clearance: ${clearance}`;

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("kl_token");
      localStorage.removeItem("kl_asset_email");
      localStorage.removeItem("kl_access_granted");
      localStorage.removeItem("kl_display_name");
      localStorage.removeItem("kl_clearance_level");
      localStorage.removeItem("kl_user_id");
      localStorage.removeItem("kl_debrief_seen");
      window.location.href = "login.html";
    });
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  function showStarterStatus(msg) {
    if (!starterStatusEl) return;
    starterStatusEl.textContent = msg;
    starterStatusEl.classList.remove("hidden");
  }

  function setMissionConsoleUI() {
    if (!starterOpenBtn) return;

    const bothComplete = completion[INITIATE_001_ID] && completion[INITIATE_002_ID];
    if (bothComplete) {
      showStarterStatus("STATUS: VERIFIED — INITIATE sequence complete.");
      starterOpenBtn.disabled = true;
      starterOpenBtn.textContent = "INITIATE VERIFIED";
      if (missionConsoleTitleEl) missionConsoleTitleEl.textContent = "INITIATE MISSIONS";
      if (missionConsoleDescEl) missionConsoleDescEl.textContent = "No further initiate missions available.";
      return;
    }

    if (!completion[INITIATE_001_ID]) {
      activeMissionId = INITIATE_001_ID;
      if (missionConsoleTitleEl) missionConsoleTitleEl.textContent = "INITIATE-001 // PACKET PARSE";
      if (missionConsoleDescEl) {
        missionConsoleDescEl.textContent =
          "Open the briefing, locate the NONCE in the packet, and submit it exactly as shown.";
      }
      starterOpenBtn.disabled = false;
      starterOpenBtn.textContent = "OPEN INITIATE-001";
      return;
    }

    activeMissionId = INITIATE_002_ID;
    if (missionConsoleTitleEl) missionConsoleTitleEl.textContent = "INITIATE-002 // ORDER OF OPS";
    if (missionConsoleDescEl) {
      missionConsoleDescEl.textContent =
        "Open the briefing, check FRAME, then submit NONCE (HANDSHAKE) or SEQ (otherwise).";
    }
    starterOpenBtn.disabled = false;
    starterOpenBtn.textContent = "OPEN INITIATE-002";
  }

  function clearMissionMessages() {
    if (missionAnswerError) missionAnswerError.textContent = "";
    if (missionAnswerStatus) {
      missionAnswerStatus.textContent = "";
      missionAnswerStatus.classList.add("hidden");
    }
  }

  function setLearnMoreVisible(visible) {
    if (!missionLearnMoreBlock) return;
    missionLearnMoreBlock.classList.toggle("hidden", !visible);
  }

  function learnMoreTextForMission(missionId) {
    const base =
      "This packet is JSON (JavaScript Object Notation).\n" +
      "Think of it like a labeled form: each label (a key) maps to a value.\n" +
      "Example: \"nonce\": \"123456\" means the field named NONCE contains the text 123456.\n\n" +
      "Common value types you’ll see:\n" +
      "- strings: text in quotes (\"HANDSHAKE\", \"RLY-AB12\")\n" +
      "- numbers: numeric values (like jitter_ms)\n" +
      "- objects: grouped fields inside { } (like noise, payload)\n\n" +
      "Tip: ignore fields labeled noise unless instructed otherwise.";

    if (missionId === INITIATE_002_ID) {
      return (
        base +
        "\n\nFor INITIATE-002:\n" +
        "- frame tells you which rule to follow (it’s a normal text field).\n" +
        "- If frame is HANDSHAKE, submit nonce (6 digits).\n" +
        "- Otherwise, submit seq (6 characters, shown as hex A–F/0–9)."
      );
    }

    return (
      base +
      "\n\nFor INITIATE-001:\n" +
      "- Your job is simply to find the field named nonce and copy it exactly (6 digits)."
    );
  }

  function setMissionAnswerVisible(visible) {
    if (missionAnswerBlock) {
      missionAnswerBlock.classList.toggle("hidden", !visible);
    }
    if (missionReceiptBlock) {
      missionReceiptBlock.classList.toggle("hidden", visible);
    }

    if (visible) {
      if (missionAnswerInput) missionAnswerInput.disabled = false;
      if (missionSubmitBtn) missionSubmitBtn.disabled = false;
    }
  }

  function fnv1aHex6(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      // 32-bit FNV-1a prime: 16777619
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h.toString(16).padStart(8, "0").slice(-6).toUpperCase();
  }

  function makeDossierRef(missionId) {
    const userId = localStorage.getItem("kl_user_id") || "unknown";
    const email = localStorage.getItem("kl_asset_email") || "unknown@asset";
    const seed = `${userId}|${email}|${missionId}|BG`;
    return `BG-VERIFIED-${fnv1aHex6(seed)}`;
  }

  function nextUnlockedLine(afterMissionId) {
    const bothComplete = completion[INITIATE_001_ID] && completion[INITIATE_002_ID];
    if (bothComplete) return "NEXT: NONE — INITIATE SEQUENCE COMPLETE";

    if (afterMissionId === INITIATE_001_ID && !completion[INITIATE_002_ID]) {
      return "NEXT UNLOCKED: INITIATE-002 // ORDER OF OPS";
    }

    return "NEXT: PENDING — AWAITING AUTHORIZATION";
  }

  function renderArchiveReceipt({
    stamp,
    missionTitle,
    prevClearance,
    nextClearance,
    afterMissionId
  }) {
    if (!missionReceiptBody) return;

    const prev = String(prevClearance || "").toUpperCase();
    const next = String(nextClearance || prevClearance || "").toUpperCase();
    const clearanceLine = prev && next && prev !== next
      ? `CLEARANCE UPDATED: ${prev} → ${next}`
      : `CLEARANCE CONFIRMED: ${next || prev || "UNKNOWN"}`;

    const receipt =
      `ARCHIVE STAMP: ${stamp}\n` +
      `LOG ENTRY: MISSION_COMPLETE\n` +
      `MISSION: ${missionTitle || "UNKNOWN"}\n` +
      `DOSSIER REF: ${makeDossierRef(afterMissionId || "UNKNOWN")}\n` +
      `${clearanceLine}\n` +
      `${nextUnlockedLine(afterMissionId)}\n` +
      `UTC: ${new Date().toISOString()}`;

    missionReceiptBody.textContent = receipt;
    setMissionAnswerVisible(false);
  }

  function openMissionModal(mission) {
    if (!missionModal) return;
    if (missionTitleEl) missionTitleEl.textContent = mission.title;
    if (missionBodyEl) missionBodyEl.textContent = mission.body;
    if (missionHintEl) missionHintEl.textContent = mission.hint;
    if (missionAnswerInput) missionAnswerInput.value = "";
    clearMissionMessages();
    missionModal.setAttribute("data-mission-id", mission.id);
    missionModal.classList.remove("hidden");

    if (missionLearnMoreBody) {
      missionLearnMoreBody.textContent = learnMoreTextForMission(mission.id);
    }
    setLearnMoreVisible(false);

    // Default: show answer UI. It may be replaced with a receipt if already completed.
    setMissionAnswerVisible(true);

    if (completion[mission.id]) {
      const currentClearance = (localStorage.getItem("kl_clearance_level") || "INITIATE-0").toUpperCase();
      renderArchiveReceipt({
        stamp: "ACCEPTED — ON FILE",
        missionTitle: mission.title,
        prevClearance: currentClearance,
        nextClearance: currentClearance,
        afterMissionId: mission.id
      });
    } else {
      if (missionAnswerInput) missionAnswerInput.disabled = false;
      if (missionSubmitBtn) missionSubmitBtn.disabled = false;
    }

    // Only focus input if the answer UI is visible.
    if (!completion[mission.id]) {
      setTimeout(() => missionAnswerInput?.focus(), 50);
    }
  }

  function closeMissionModal() {
    if (!missionModal) return;
    missionModal.classList.add("hidden");
    missionModal.removeAttribute("data-mission-id");
    if (missionAnswerInput) missionAnswerInput.value = "";
    if (missionAnswerInput) missionAnswerInput.disabled = false;
    if (missionSubmitBtn) missionSubmitBtn.disabled = false;
    setMissionAnswerVisible(true);
    setLearnMoreVisible(false);
    clearMissionMessages();
  }

  async function fetchMissionStatus(missionId) {
    const res = await fetch(
      `${API_BASE}/api/missions/status?mission_id=${encodeURIComponent(missionId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) return { ok: false };
    return { ok: true, completed: !!data.completed };
  }

  async function refreshMissionProgression() {
    try {
      const [m1, m2] = await Promise.all([
        fetchMissionStatus(INITIATE_001_ID),
        fetchMissionStatus(INITIATE_002_ID)
      ]);

      if (m1.ok) completion[INITIATE_001_ID] = !!m1.completed;
      if (m2.ok) completion[INITIATE_002_ID] = !!m2.completed;

      setMissionConsoleUI();

      const openMissionId = missionModal?.getAttribute("data-mission-id") || "";
      if (openMissionId && completion[openMissionId]) {
        const missionTitle = openMissionId === INITIATE_002_ID
          ? initiate002Mission.title
          : initiate001Mission.title;
        const currentClearance = (localStorage.getItem("kl_clearance_level") || "INITIATE-0").toUpperCase();
        renderArchiveReceipt({
          stamp: "ACCEPTED — ON FILE",
          missionTitle,
          prevClearance: currentClearance,
          nextClearance: currentClearance,
          afterMissionId: openMissionId
        });
      }
    } catch (err) {
      // non-fatal
    }
  }

  async function fetchMissionPacket(endpointPath) {
    const res = await fetch(`${API_BASE}${endpointPath}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return { ok: false, error: data?.error || "Unable to sync packet." };
    }
    return { ok: true, packet: data.packet };
  }

  function buildInitiate001Body(packet) {
    const packetText = packet ? JSON.stringify(packet, null, 2) : "(packet unavailable)";
    return (
      "Mission: INITIATE-001 // PACKET PARSE\n\n" +
      "Objective:\n" +
      "1) Locate the NONCE inside the packet payload.\n" +
      "2) Submit the NONCE exactly as shown (6 digits).\n\n" +
      "PACKET:\n" +
      packetText +
      "\n"
    );
  }

  function buildInitiate002Body(packet) {
    const packetText = packet ? JSON.stringify(packet, null, 2) : "(packet unavailable)";
    return (
      "Mission: INITIATE-002 // ORDER OF OPS\n\n" +
      "Objective:\n" +
      "1) Check FRAME first.\n" +
      "2) If frame == HANDSHAKE, submit NONCE (6 digits).\n" +
      "3) Otherwise, submit SEQ (6 characters).\n\n" +
      "PACKET:\n" +
      packetText +
      "\n"
    );
  }

  async function openInitiate001Modal() {
    openMissionModal(initiate001Mission);
    if (!missionBodyEl) return;

    missionBodyEl.textContent = "Syncing packet…";
    const result = await fetchMissionPacket("/api/missions/initiate-001-packet");
    if (!result.ok) {
      missionBodyEl.textContent =
        "Packet sync failed. Try again.\n\n" +
        (result.error || "Unable to sync packet.");
      return;
    }
    missionBodyEl.textContent = buildInitiate001Body(result.packet);
  }

  async function openInitiate002Modal() {
    openMissionModal(initiate002Mission);
    if (!missionBodyEl) return;

    missionBodyEl.textContent = "Syncing packet…";
    const result = await fetchMissionPacket("/api/missions/initiate-002-packet");
    if (!result.ok) {
      missionBodyEl.textContent =
        "Packet sync failed. Try again.\n\n" +
        (result.error || "Unable to sync packet.");
      return;
    }
    missionBodyEl.textContent = buildInitiate002Body(result.packet);
  }

  async function openActiveMissionModal() {
    if (activeMissionId === INITIATE_002_ID) {
      await openInitiate002Modal();
      return;
    }
    await openInitiate001Modal();
  }

  async function submitMissionAnswer(missionId, answer) {
    const res = await fetch(`${API_BASE}/api/missions/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ mission_id: missionId, answer })
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, error: "Submission failed." };
    if (!res.ok) {
      return { ok: false, error: data.error || "Submission failed." };
    }
    return data;
  }

  function formatDate(iso) {
    if (!iso) return "timestamp unknown";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "timestamp unknown";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function humanizeType(eventType) {
    switch (eventType) {
      case "BRIEFING_VIEW":
        return "Briefing Viewed";
      case "BRIEFING_ACK":
        return "Briefing Acknowledged";
      case "MISSION_UNLOCK":
        return "Mission Unlocked";
      case "MISSION_START":
        return "Mission Started";
      case "MISSION_COMPLETE":
        return "Mission Completed";
      default:
        return eventType;
    }
  }

  function renderDetail(evt) {
    if (!detailEl) return;
    const meta = evt.meta || {};
    detailEl.innerHTML = `
      <div class="kl-detail-block">
        <div class="kl-detail-label">Event Type</div>
        <div class="kl-detail-value">${humanizeType(evt.event_type)}</div>
      </div>
      <div class="kl-detail-block">
        <div class="kl-detail-label">Timestamp</div>
        <div class="kl-detail-value">${formatDate(
          evt.created_at
        )}</div>
      </div>
      ${
        evt.message
          ? `
      <div class="kl-detail-block">
        <div class="kl-detail-label">Message</div>
        <div class="kl-detail-value">${evt.message}</div>
      </div>`
          : ""
      }
      ${
        meta.mission_code
          ? `
      <div class="kl-detail-block">
        <div class="kl-detail-label">Mission Code</div>
        <div class="kl-detail-value">${meta.mission_code}</div>
      </div>`
          : ""
      }
      ${
        meta.tier
          ? `
      <div class="kl-detail-block">
        <div class="kl-detail-label">Tier</div>
        <div class="kl-detail-value">${meta.tier}</div>
      </div>`
          : ""
      }
    `;
  }

  function renderList(events) {
    if (!listEl) return;

    if (!events.length) {
      listEl.innerHTML =
        '<div class="kl-muted">No archived briefings or missions yet. Complete a mission or acknowledge a briefing and it will appear here.</div>';
      return;
    }

    listEl.innerHTML = "";
    events.forEach((evt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "kl-archive-item";
      item.innerHTML = `
        <div class="kl-archive-item-main">
          <div class="kl-archive-item-type">${humanizeType(
            evt.event_type
          )}</div>
          <div class="kl-archive-item-message">${
            evt.message || "No description available."
          }</div>
        </div>
        <div class="kl-archive-item-meta">
          <span class="kl-archive-item-date">${formatDate(
            evt.created_at
          )}</span>
        </div>
      `;

      item.addEventListener("click", () => {
        renderDetail(evt);
      });

      listEl.appendChild(item);
    });

    // Auto-select first item
    renderDetail(events[0]);
  }

  async function loadArchive() {
    try {
      const res = await fetch(`${API_BASE}/api/profile/archive`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        showError(
          data.error ||
            "Unable to retrieve archive from the lab console."
        );
        return;
      }

      renderList(data.events || []);
    } catch (err) {
      console.error("Archive load error:", err);
      showError("Signal to the archive subsystem failed.");
    }
  }

  // Wire Starter Protocol UI
  if (starterOpenBtn) {
    starterOpenBtn.addEventListener("click", () => {
      void openActiveMissionModal();
    });
  }

  if (missionCloseBtn) {
    missionCloseBtn.addEventListener("click", () => {
      closeMissionModal();
    });
  }

  if (missionModal) {
    missionModal.addEventListener("click", (e) => {
      if (e.target === missionModal) {
        closeMissionModal();
      }
    });
  }

  if (missionLearnMoreBtn) {
    missionLearnMoreBtn.addEventListener("click", () => {
      if (!missionLearnMoreBlock) return;
      const visible = !missionLearnMoreBlock.classList.contains("hidden");
      setLearnMoreVisible(!visible);
    });
  }

  if (missionSubmitBtn) {
    missionSubmitBtn.addEventListener("click", async () => {
      const missionId = missionModal?.getAttribute("data-mission-id") || "";
      const answer = (missionAnswerInput?.value || "").trim();
      clearMissionMessages();

      if (!missionId) return;

      const prevClearance = (localStorage.getItem("kl_clearance_level") || "INITIATE-0").toUpperCase();
      const missionTitle = missionId === INITIATE_002_ID
        ? initiate002Mission.title
        : initiate001Mission.title;

      if (completion[missionId]) {
        renderArchiveReceipt({
          stamp: "ACCEPTED — ON FILE",
          missionTitle,
          prevClearance,
          nextClearance: prevClearance,
          afterMissionId: missionId
        });
        setMissionConsoleUI();
        return;
      }

      if (!answer) {
        if (missionAnswerError) missionAnswerError.textContent = "Answer is required.";
        return;
      }

      missionSubmitBtn.disabled = true;
      try {
        const data = await submitMissionAnswer(missionId, answer);
        if (!data.ok) {
          if (missionAnswerError) missionAnswerError.textContent = data.error || "Submission failed.";
          return;
        }
        if (!data.correct) {
          if (missionAnswerError) {
            missionAnswerError.textContent = data.message || "Incorrect answer.";
          }
          return;
        }

        if (data.already_completed) {
          completion[missionId] = true;
          const current = (localStorage.getItem("kl_clearance_level") || prevClearance).toUpperCase();
          renderArchiveReceipt({
            stamp: "ACCEPTED — ON FILE",
            missionTitle,
            prevClearance: current,
            nextClearance: current,
            afterMissionId: missionId
          });
          setMissionConsoleUI();
          return;
        }

        completion[missionId] = true;

        const nextClearance = String(data.clearance_level || prevClearance).toUpperCase();

        // Refresh progression in case we just unlocked INITIATE-002.
        await refreshMissionProgression();

        renderArchiveReceipt({
          stamp: "ACCEPTED",
          missionTitle,
          prevClearance,
          nextClearance,
          afterMissionId: missionId
        });

        // Update local storage + header pills
        if (data.clearance_level) {
          localStorage.setItem("kl_clearance_level", String(data.clearance_level));
          if (clearancePill) clearancePill.textContent = `clearance: ${String(data.clearance_level).toUpperCase()}`;
        }

        // Refresh archive list so the completion event appears
        await loadArchive();
      } finally {
        if (!completion[missionId]) {
          missionSubmitBtn.disabled = false;
        }
      }
    });
  }

  void refreshMissionProgression();
  loadArchive();
});
