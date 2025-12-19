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
      window.location.href = "login.html";
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
      localStorage.removeItem("kl_debrief_seen");
      window.location.href = "login.html";
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

    // ID badge
    const idNameEl = document.getElementById("kl-id-name");
    const idBadgeEl = document.getElementById("kl-id-badge");
    const idEmailEl = document.getElementById("kl-id-email");
    const idClearanceEl = document.getElementById("kl-id-clearance");
    const idIssuedEl = document.getElementById("kl-id-issued");
    const idLastLoginEl = document.getElementById("kl-id-last-login");

    const idPhotoImg = document.getElementById("kl-id-photo");
    const idPhotoFallback = document.getElementById("kl-id-photo-fallback");
    const idPhotoInput = document.getElementById("kl-id-photo-input");
    const idPhotoStatus = document.getElementById("kl-id-photo-status");

    // Motto
    const mottoDisplayEl = document.getElementById(
      "kl-profile-motto-display"
    );
    const mottoForm = document.getElementById("kl-motto-form");
    const mottoInput = document.getElementById("kl-motto-input");
    const mottoError = document.getElementById("kl-motto-error");

    // Notepad (local-only)
    const notepadForm = document.getElementById("kl-notepad-form");
    const notepadInput = document.getElementById("kl-notepad-input");
    const notepadStatus = document.getElementById("kl-notepad-status");
    const NOTEPAD_STORAGE_KEY = "kl_profile_notepad_v1";

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

    function setIdPhotoStatus(msg) {
      if (!idPhotoStatus) return;
      idPhotoStatus.textContent = msg || "";
    }

    function initialsFromName(name) {
      const raw = String(name || "").trim();
      if (!raw) return "AS";
      const parts = raw.split(/\s+/).filter(Boolean);
      const a = (parts[0] || "A").slice(0, 1);
      const b = (parts[1] || parts[0] || "S").slice(0, 1);
      return (a + b).toUpperCase();
    }

    function setBadgePhoto(url, displayName) {
      if (!idPhotoImg || !idPhotoFallback) return;

      const fallback = initialsFromName(displayName);
      idPhotoFallback.textContent = fallback;

      const cleanUrl = url && String(url).trim().length ? String(url).trim() : "";
      if (!cleanUrl) {
        idPhotoImg.style.display = "none";
        idPhotoFallback.style.display = "";
        idPhotoImg.removeAttribute("src");
        return;
      }

      idPhotoImg.style.display = "";
      idPhotoFallback.style.display = "none";
      idPhotoImg.src = cleanUrl;
    }

    function showError(msg) {
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = "block";
      } else {
        console.error("[PROFILE ERROR]", msg);
      }
    }

    function setNotepadStatus(msg) {
      if (!notepadStatus) return;
      notepadStatus.textContent = msg || "";
    }

    function loadNotepadFromLocalStorage() {
      if (!notepadInput) return;
      try {
        const saved = localStorage.getItem(NOTEPAD_STORAGE_KEY);
        if (typeof saved === "string") {
          notepadInput.value = saved;
        }
      } catch (err) {
        console.warn("[NOTEPAD] failed to read localStorage:", err);
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

        // ID badge fields
        safeText(idNameEl, displayName.toUpperCase());
        safeText(idEmailEl, email);
        safeText(idIssuedEl, formatDate(profile.created_at));
        safeText(idLastLoginEl, formatDate(profile.last_login_at));
        if (idClearanceEl) idClearanceEl.textContent = clearance;

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

          // Mirror to ID badge
          safeText(idBadgeEl, badge);
        }

        // Photo
        setBadgePhoto(profile.profile_image_url, displayName);

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

    async function uploadIdPhoto(file) {
      if (!file) return;
      if (!file.type || !String(file.type).startsWith("image/")) {
        setIdPhotoStatus("Please choose an image file.");
        return;
      }

      setIdPhotoStatus("Uploading…");

      const body = new FormData();
      body.append("photo", file);

      try {
        const res = await fetch(`${API_BASE}/api/profile/photo`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          setIdPhotoStatus(data.error || "Upload failed.");
          return;
        }

        const url = String(data.profile_image_url || "").trim();
        if (url) {
          // cache-bust to ensure immediate refresh
          const busted = url.includes("?") ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
          setBadgePhoto(busted, idNameEl?.textContent || "ASSET");
        }
        setIdPhotoStatus("Photo updated.");
      } catch (err) {
        console.error("Photo upload error:", err);
        setIdPhotoStatus("Upload failed. Check server connection.");
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

          // Clear input after successful update
          mottoInput.value = "";
        } catch (err) {
          console.error("Motto update error:", err);
          if (mottoError) {
            mottoError.textContent =
              "Transmission failed. Try again in a moment.";
          }
        }
      });
    }

    // Notepad: save locally
    if (notepadForm && notepadInput) {
      loadNotepadFromLocalStorage();

      notepadForm.addEventListener("submit", (e) => {
        e.preventDefault();
        setNotepadStatus("");

        try {
          localStorage.setItem(NOTEPAD_STORAGE_KEY, notepadInput.value || "");
          setNotepadStatus("Saved locally.");
        } catch (err) {
          console.warn("[NOTEPAD] failed to write localStorage:", err);
          setNotepadStatus("Unable to save notes locally.");
        }
      });
    }

    // ID photo upload
    if (idPhotoInput) {
      idPhotoInput.addEventListener("change", async () => {
        setIdPhotoStatus("");
        const file = idPhotoInput.files && idPhotoInput.files[0];
        await uploadIdPhoto(file);
        // allow selecting the same file again
        idPhotoInput.value = "";
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

          // Clear input after successful update
          displayNameInput.value = "";
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
