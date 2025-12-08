// assets/js/profile.js
(() => {
  const API_BASE =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "";


  document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("kl_token");

    // If there is no token at all, bounce back to the gate
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    // --- Shared logout handler (same behavior as main.js) ---
    function clearAuthAndRedirectToGate() {
      localStorage.removeItem("kl_token");
      localStorage.removeItem("kl_asset_email");
      localStorage.removeItem("kl_access_granted");
      localStorage.removeItem("kl_user_id");
      localStorage.removeItem("kl_display_name");
      localStorage.removeItem("kl_clearance_level");
      window.location.href = "index.html";
    }

    // Header logout buttons
    const logoutBtn = document.getElementById("kl-logout-btn");
    const altLogoutBtn = document.getElementById(
      "kl-profile-logout-btn-duplicate"
    );

    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearAuthAndRedirectToGate();
      });
    }
    if (altLogoutBtn) {
      altLogoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        clearAuthAndRedirectToGate();
      });
    }

    // --- DOM references ---
    // Pills
    const emailPill = document.getElementById("kl-profile-email-pill");
    const clearancePill = document.getElementById(
      "kl-profile-clearance-pill"
    );

    // Core profile fields
    const emailEl = document.getElementById("kl-profile-email");
    const nameEl = document.getElementById("kl-profile-name");
    const clearanceEl = document.getElementById("kl-profile-clearance");
    const badgeIdEl = document.getElementById("kl-profile-badge-id");
    const createdEl = document.getElementById("kl-profile-created");
    const lastLoginEl = document.getElementById("kl-profile-last-login");

    // Motto
    const mottoDisplayEl = document.getElementById(
      "kl-profile-motto-display"
    );
    const mottoForm = document.getElementById("kl-motto-form");
    const mottoInput = document.getElementById("kl-motto-input");
    const mottoError = document.getElementById("kl-motto-error");

    // Display name onboarding
    const displayNameForm = document.getElementById("kl-display-name-form");
    const displayNameInput = document.getElementById("kl-display-name-input");
    const displayNameError = document.getElementById("kl-display-name-error");

    // Progress + logs + error
    const progressEl = document.getElementById("kl-clearance-progress");
    const progressLabelEl = document.getElementById(
      "kl-clearance-progress-label"
    );
    const logsContainer = document.getElementById("kl-profile-logs");
    const errorBanner = document.getElementById("kl-profile-error");

    function safeText(node, text) {
      if (!node) return;
      node.textContent = text ?? "";
    }

    function formatDate(isoString) {
      if (!isoString) return "—";
      try {
        const d = new Date(isoString);
        return d.toLocaleString();
      } catch {
        return "—";
      }
    }

    function showError(msg) {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = "block";
      } else {
        console.error("[PROFILE ERROR]", msg);
      }
    }

    async function loadProfile() {
      try {
        const res = await fetch(`${API_BASE}/api/profile/summary`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const isAuthError = res.status === 401 || res.status === 403;

        let data;
        try {
          data = await res.json();
        } catch (e) {
          data = {};
        }

        if (!res.ok || !data.ok) {
          if (isAuthError) {
            // Token invalid/expired → clear + send to gate
            clearAuthAndRedirectToGate();
            return;
          }

          showError(
            data.error ||
            "Unable to load asset profile. The lab console may be offline."
          );
          return;
        }

        const profile = data.profile || {};
        const logs = data.logs || [];

        // Identity
        const email = profile.email || "unknown@asset";
        const rawDisplayName = profile.display_name || "";
        const displayName =
          (rawDisplayName && rawDisplayName.trim().length
            ? rawDisplayName.trim()
            : "Asset");

        const clearanceRaw = profile.clearance_level || "INITIATED";
        const clearance = clearanceRaw.toUpperCase();

        // Core fields in the dossier body
        safeText(emailEl, email);
        safeText(nameEl, displayName);
        safeText(clearanceEl, clearance);
        safeText(createdEl, formatDate(profile.created_at));
        safeText(lastLoginEl, formatDate(profile.last_login_at));

        // Header pills
        let assetLabel;
        if (rawDisplayName && rawDisplayName.trim().length) {
          assetLabel = `asset: ${rawDisplayName.trim().toUpperCase()}`;
        } else {
          assetLabel = `asset: ${email}`;
        }

        safeText(emailPill, assetLabel);
        safeText(clearancePill, `clearance: ${clearance}`);

        // (rest of loadProfile unchanged)


        // Badge ID: prefer backend field, fallback to id-based
        if (badgeIdEl) {
          let badge =
            profile.badge_id && String(profile.badge_id).trim().length
              ? profile.badge_id
              : null;

          if (!badge) {
            const id = profile.id || profile.user_id;
            if (id) {
              const padded = String(id).padStart(4, "0");
              badge = `KRY-${padded}-A`;
            } else {
              badge = "KRY-0000-0000";
            }
          }

          safeText(badgeIdEl, badge);
        }

        // Motto
        safeText(
          mottoDisplayEl,
          profile.motto || "No field motto set. The lab is listening…"
        );

        // Progress bar
        const pct = Math.max(
          0,
          Math.min(100, profile.clearance_progress_pct || 5)
        );
        if (progressEl) {
          progressEl.style.width = `${pct}%`;
        }
        if (progressLabelEl) {
          progressLabelEl.textContent = `${pct}%`;
        }

        // Logs
        if (logsContainer) {
          logsContainer.innerHTML = "";
          if (!logs.length) {
            const empty = document.createElement("div");
            empty.className = "kl-log-line";
            empty.textContent = "[LOG] no asset events recorded yet.";
            logsContainer.appendChild(empty);
          } else {
            logs.forEach((log) => {
              const row = document.createElement("div");
              row.className = "kl-log-line";
              const when = formatDate(log.created_at);
              row.textContent = `[${log.event_type || "EVENT"}] ${when} — ${log.message || ""
                }`;
              logsContainer.appendChild(row);
            });
          }
        }
      } catch (err) {
        console.error("Profile load error:", err);
        showError(
          "Profile console unreachable. Check that the lab server is online."
        );
      }
    }

    // Motto form handler (if present)
    if (mottoForm && mottoInput) {
      mottoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (mottoError) mottoError.textContent = "";

        const value = mottoInput.value.trim();
        if (!value) {
          if (mottoError) mottoError.textContent = "Motto cannot be empty.";
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/profile/settings`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ motto: value })
          });

          const data = await res.json();

          if (!res.ok || !data.ok) {
            if (mottoError) {
              mottoError.textContent =
                data.error ||
                "Unable to update motto. The lab console is unstable.";
            }
            return;
          }

          safeText(
            mottoDisplayEl,
            data.motto || value || "No field motto set."
          );
        } catch (err) {
          console.error("Motto update error:", err);
          if (mottoError) {
            mottoError.textContent =
              "Transmission failed. Try again in a moment.";
          }
        }
      });
    }
    // Display name form handler
    if (displayNameForm && displayNameInput) {
      displayNameForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (displayNameError) displayNameError.textContent = "";

        const value = displayNameInput.value.trim();

        if (!value) {
          if (displayNameError) {
            displayNameError.textContent =
              "Provide a name the lab can address you by.";
          }
          return;
        }

        if (value.length < 2 || value.length > 40) {
          if (displayNameError) {
            displayNameError.textContent =
              "Display name must be between 2 and 40 characters.";
          }
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/profile/settings`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ display_name: value })
          });

          const data = await res.json();

          if (!res.ok || !data.ok) {
            if (displayNameError) {
              displayNameError.textContent =
                data.error ||
                "Unable to update display name. The lab console is unstable.";
            }
            return;
          }

          // Update UI + local storage
          safeText(nameEl, value);
          localStorage.setItem("kl_display_name", value);
        } catch (err) {
          console.error("Display name update error:", err);
          if (displayNameError) {
            displayNameError.textContent =
              "Transmission failed. Try again in a moment.";
          }
        }
      });
    }


    // Kick it off
    loadProfile();
  });
})();
