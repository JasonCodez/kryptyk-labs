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

  if (!token) {
    window.location.href = "/";
    return;
  }

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

  loadArchive();
});
