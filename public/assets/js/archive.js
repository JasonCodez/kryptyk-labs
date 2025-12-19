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

  // Starter Protocol console
  const starterOpenBtn = document.getElementById("kl-starter-protocol-open");
  const starterBeaconEl = document.getElementById("kl-last-auth-beacon");
  const starterStatusEl = document.getElementById("kl-starter-protocol-status");

  // Mission modal elements
  const missionModal = document.getElementById("kl-mission-modal");
  const missionTitleEl = document.getElementById("kl-mission-title");
  const missionBodyEl = document.getElementById("kl-mission-body");
  const missionHintEl = document.getElementById("kl-mission-hint");
  const missionCloseBtn = document.getElementById("kl-mission-close");
  const missionAnswerInput = document.getElementById("kl-mission-answer-input");
  const missionAnswerError = document.getElementById("kl-mission-answer-error");
  const missionAnswerStatus = document.getElementById("kl-mission-answer-status");
  const missionSubmitBtn = document.getElementById("kl-mission-submit");

  if (!token) {
    window.location.href = "/";
    return;
  }

  const STARTER_PROTOCOL_ID = "starter-protocol-01";
  let starterProtocolCompleted = false;
  const starterMission = {
    id: STARTER_PROTOCOL_ID,
    title: "Starter Protocol // INITIATE-01",
    body:
      "Welcome inside the Lab, asset.\n\n" +
      "Your first live operation is observation under pressure.\n\n" +
      "In the Mission Console on this page, locate the [GATE] line that shows your last successful authentication.\n" +
      "Copy the beacon token exactly as displayed (it begins with SIG-), then submit it here.\n",
    hint:
      "The token is shown in the Mission Console as: [GATE] last successful authentication: SIG-..."
  };

  // Basic header hydrate
  const email = localStorage.getItem("kl_asset_email") || "unknown@asset";
  const rawName = (localStorage.getItem("kl_display_name") || "").trim();
  const clearance =
    (localStorage.getItem("kl_clearance_level") || "INITIATED").toUpperCase();

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
      localStorage.removeItem("kl_display_name");
      localStorage.removeItem("kl_clearance_level");
      localStorage.removeItem("kl_user_id");
      window.location.href = "/";
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

  function setStarterProtocolCompletedUI() {
    showStarterStatus("STATUS: VERIFIED — Starter Protocol completed.");
    if (starterOpenBtn) {
      starterOpenBtn.disabled = true;
      starterOpenBtn.textContent = "STARTER PROTOCOL VERIFIED";
    }
  }

  function clearMissionMessages() {
    if (missionAnswerError) missionAnswerError.textContent = "";
    if (missionAnswerStatus) {
      missionAnswerStatus.textContent = "";
      missionAnswerStatus.classList.add("hidden");
    }
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

    if (mission.id === STARTER_PROTOCOL_ID && starterProtocolCompleted) {
      if (missionAnswerStatus) {
        missionAnswerStatus.textContent = "Already verified. Starter Protocol is complete.";
        missionAnswerStatus.classList.remove("hidden");
      }
      if (missionAnswerInput) missionAnswerInput.disabled = true;
      if (missionSubmitBtn) missionSubmitBtn.disabled = true;
    } else {
      if (missionAnswerInput) missionAnswerInput.disabled = false;
      if (missionSubmitBtn) missionSubmitBtn.disabled = false;
    }

    setTimeout(() => missionAnswerInput?.focus(), 50);
  }

  function closeMissionModal() {
    if (!missionModal) return;
    missionModal.classList.add("hidden");
    missionModal.removeAttribute("data-mission-id");
    if (missionAnswerInput) missionAnswerInput.value = "";
    if (missionAnswerInput) missionAnswerInput.disabled = false;
    if (missionSubmitBtn) missionSubmitBtn.disabled = false;
    clearMissionMessages();
  }

  async function refreshStarterBeacon() {
    if (!starterBeaconEl) return;
    starterBeaconEl.textContent = "syncing…";
    try {
      const res = await fetch(`${API_BASE}/api/missions/starter-protocol`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) {
        starterBeaconEl.textContent = "unavailable";
        return;
      }
      starterBeaconEl.textContent = data.beacon || "unavailable";
    } catch (err) {
      starterBeaconEl.textContent = "unavailable";
    }
  }

  async function refreshStarterProtocolStatus() {
    try {
      const res = await fetch(
        `${API_BASE}/api/missions/status?mission_id=${encodeURIComponent(
          STARTER_PROTOCOL_ID
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) return;

      if (data.completed) {
        starterProtocolCompleted = true;
        setStarterProtocolCompletedUI();

        const openMissionId = missionModal?.getAttribute("data-mission-id") || "";
        if (openMissionId === STARTER_PROTOCOL_ID) {
          if (missionAnswerStatus) {
            missionAnswerStatus.textContent = "Already verified. Starter Protocol is complete.";
            missionAnswerStatus.classList.remove("hidden");
          }
          if (missionAnswerInput) missionAnswerInput.disabled = true;
          if (missionSubmitBtn) missionSubmitBtn.disabled = true;
        }
      }
    } catch (err) {
      // non-fatal
    }
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
      openMissionModal(starterMission);
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

  if (missionSubmitBtn) {
    missionSubmitBtn.addEventListener("click", async () => {
      const missionId = missionModal?.getAttribute("data-mission-id") || "";
      const answer = (missionAnswerInput?.value || "").trim();
      clearMissionMessages();

      if (!missionId) return;

      if (missionId === STARTER_PROTOCOL_ID && starterProtocolCompleted) {
        if (missionAnswerStatus) {
          missionAnswerStatus.textContent = "Already verified. Starter Protocol is complete.";
          missionAnswerStatus.classList.remove("hidden");
        }
        setStarterProtocolCompletedUI();
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
          starterProtocolCompleted = true;
          if (missionAnswerStatus) {
            missionAnswerStatus.textContent = "Already verified. Starter Protocol is complete.";
            missionAnswerStatus.classList.remove("hidden");
          }
          setStarterProtocolCompletedUI();
          return;
        }

        // Confirmation of success (requested)
        if (missionAnswerStatus) {
          missionAnswerStatus.textContent = "Verified. Starter Protocol completed.";
          missionAnswerStatus.classList.remove("hidden");
        }
        starterProtocolCompleted = true;
        setStarterProtocolCompletedUI();

        // Update local storage + header pills
        if (data.clearance_level) {
          localStorage.setItem("kl_clearance_level", String(data.clearance_level));
          if (clearancePill) clearancePill.textContent = `clearance: ${String(data.clearance_level).toUpperCase()}`;
        }

        // Refresh archive list so the completion event appears
        await loadArchive();
      } finally {
        if (!starterProtocolCompleted) {
          missionSubmitBtn.disabled = false;
        }
      }
    });
  }

  void refreshStarterBeacon();
  void refreshStarterProtocolStatus();
  loadArchive();
});
