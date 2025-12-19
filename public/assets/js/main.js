// assets/js/main.js
(() => {
  const API_BASE =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "";


  document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------
    // DOM REFERENCES
    // -------------------------------------------------------
    // Stop main.js from running on pages that are NOT the gate/login page
    if (!document.getElementById("kl-preloader")) {
      return;
    }

    const preloader = document.getElementById("kl-preloader");
    const splash = document.getElementById("kl-splash");
    // Transition guard: ensure we only run the splash/app sequence once
    const app = document.getElementById("kl-app");

    const terminalOutput = document.getElementById("kl-terminal-output");
    const terminalInputMock = document.getElementById("kl-terminal-input-mock");
    const terminalCursor = document.getElementById("kl-terminal-cursor");
    const statusIndicator = document.getElementById("kl-status-indicator");

    const tabButtons = document.querySelectorAll(".kl-tab");

    // Signup forms
    const emailForm = document.getElementById("kl-email-form");
    const keyForm = document.getElementById("kl-key-form");
    const passwordForm = document.getElementById("kl-password-form");

    // Login form
    const loginForm = document.getElementById("kl-login-form");

    // Reset forms
    const resetOpenBtn = document.getElementById("kl-open-reset");
    const resetRequestForm = document.getElementById("kl-reset-request-form");
    const resetEmailInput = document.getElementById("kl-reset-email-input");
    const resetEmailError = document.getElementById("kl-reset-email-error");
    const resetBack1 = document.getElementById("kl-reset-back-1");

    const resetCompleteForm = document.getElementById("kl-reset-complete-form");
    const resetKeyInput = document.getElementById("kl-reset-key-input");
    const resetPwInput = document.getElementById("kl-reset-password-input");
    const resetPwConfirmInput = document.getElementById(
      "kl-reset-password-confirm-input"
    );
    const resetCompleteError = document.getElementById(
      "kl-reset-complete-error"
    );
    const resetBack2 = document.getElementById("kl-reset-back-2");

    // Inputs + errors for main gate
    const emailInput = document.getElementById("kl-email-input");
    const emailError = document.getElementById("kl-email-error");

    const keyInput = document.getElementById("kl-key-input");
    const keyHint = document.getElementById("kl-key-hint");
    const keyError = document.getElementById("kl-key-error");


    const passwordInput = document.getElementById("kl-password-input");
    const passwordConfirmInput = document.getElementById(
      "kl-password-confirm-input"
    );
    const passwordError = document.getElementById("kl-password-error");

    const loginEmailInput = document.getElementById("kl-login-email-input");
    const loginPasswordInput = document.getElementById(
      "kl-login-password-input"
    );
    const loginError = document.getElementById("kl-login-error");

    // App header / meta
    const assetEmailPill = document.getElementById("kl-asset-email-pill");
    const assetClearancePill = document.getElementById("kl-asset-clearance-pill");
    const logoutBtn = document.getElementById("kl-logout-btn");
    const welcomeName = document.getElementById("kl-welcome-name");
    const welcomeClearance = document.getElementById("kl-welcome-clearance");

    // Starter protocol button + log
    const startMissionBtn = document.getElementById("kl-start-mission-btn");
    const logWindow = document.getElementById("kl-log-window");

    // Lore overlay
    const loreOverlay = document.getElementById("kl-lore");
    const loreBody = document.getElementById("kl-lore-body");
    const loreSkipBtn = document.getElementById("kl-lore-skip");
    const loreContinueBtn = document.getElementById("kl-lore-continue");

    // Mission modal
    const missionModal = document.getElementById("kl-mission-modal");
    const missionTitleEl = document.getElementById("kl-mission-title");
    const missionBodyEl = document.getElementById("kl-mission-body");
    const missionHintEl = document.getElementById("kl-mission-hint");
    const missionCloseBtn = document.getElementById("kl-mission-close");
    const missionConfirmBtn = document.getElementById("kl-mission-confirm");
    const missionAnswerBlock = document.getElementById("kl-mission-answer-block");
    const missionAnswerInput = document.getElementById("kl-mission-answer-input");
    const missionAnswerError = document.getElementById("kl-mission-answer-error");
    const missionSubmitBtn = document.getElementById("kl-mission-submit");
    const lastAuthBeaconEl = document.getElementById("kl-last-auth-beacon");

    // -------------------------------------------------------
    // STATE
    // -------------------------------------------------------
    let activeTab = "signup";
    let signupEmail = "";
    let signupKey = ""; // key that passed verification (Step 2)
    let resetEmailContext = "";
    // Prevent running splash/app transition multiple times
    let appTransitionStarted = false;


    // -------------------------------------------------------
    // SMALL UTILITIES
    // -------------------------------------------------------
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function isValidEmail(value) {
      return /\S+@\S+\.\S+/.test(value);
    }

    function appendLine(text, opts = {}) {
      if (!terminalOutput) return;
      const el = document.createElement("div");
      el.classList.add("kl-terminal-line");
      if (opts.system) el.classList.add("kl-terminal-system");
      if (opts.error) el.classList.add("kl-terminal-error");
      el.textContent = text;
      terminalOutput.appendChild(el);
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    async function typeLine(text, opts = {}) {
      if (!terminalOutput) return;
      const { system = false, error = false, charDelay = 12 } = opts;
      const el = document.createElement("div");
      el.classList.add("kl-terminal-line");
      if (system) el.classList.add("kl-terminal-system");
      if (error) el.classList.add("kl-terminal-error");
      terminalOutput.appendChild(el);

      for (let i = 0; i < text.length; i++) {
        el.textContent = text.slice(0, i + 1);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        await sleep(charDelay);
      }
    }

    function setMockInput(text, isError = false) {
      if (!terminalInputMock) return;
      terminalInputMock.textContent = text;
      terminalInputMock.classList.toggle("kl-terminal-error", !!isError);
    }

    function clearFieldErrors() {
      if (emailError) emailError.textContent = "";
      if (keyError) keyError.textContent = "";
      if (passwordError) passwordError.textContent = "";
      if (loginError) loginError.textContent = "";
      if (resetEmailError) resetEmailError.textContent = "";
      if (resetCompleteError) resetCompleteError.textContent = "";
      if (terminalInputMock) {
        terminalInputMock.textContent = "";
        terminalInputMock.classList.remove("kl-terminal-error");
      }
    }

    function hydrateHeaderAndWelcome() {
      const email = localStorage.getItem("kl_asset_email") || "";
      const rawDisplayName = localStorage.getItem("kl_display_name") || "";
      const displayName = rawDisplayName.trim();
      const clearance =
        localStorage.getItem("kl_clearance_level") || "INITIATED";

      // Top-right "ASSET: ..." pill
      if (assetEmailPill) {
        let label;
        if (displayName) {
          // Prefer callsign when available
          label = `asset: ${displayName.toUpperCase()}`;
        } else if (email) {
          // Fallback to email until they set a name
          label = `asset: ${email}`;
        } else {
          label = "asset: unknown";
        }
        assetEmailPill.textContent = label;
      }

      // Orientation welcome block
      if (welcomeName && welcomeClearance) {
        const nameForWelcome = displayName || "Asset";
        welcomeName.textContent = nameForWelcome.toUpperCase();
        welcomeClearance.textContent = clearance.toUpperCase();
      }

      // Top-right clearance pill (Orientation dashboard)
      if (assetClearancePill) {
        assetClearancePill.textContent = `clearance: ${clearance.toUpperCase()}`;
      }
    }


    async function recordMissionCompletion(missionId, { success = true } = {}) {
      const token = localStorage.getItem("kl_token");
      if (!token) return;

      const cleanId = (missionId || "").toString().trim();
      if (!cleanId) return;

      try {
        const res = await fetch(`${API_BASE}/api/missions/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            mission_id: cleanId,
            success: !!success
          })
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) {
          const msg = (data && data.error) || "Mission completion not recorded.";
          console.warn("[MISSIONS] complete failed:", msg);
          logEventToDashboard(`[MISSIONS] completion sync failed: ${msg}`);
          return;
        }

        if (data.clearance_level) {
          localStorage.setItem("kl_clearance_level", String(data.clearance_level));
        }
        if (typeof data.clearance_progress_pct === "number") {
          localStorage.setItem(
            "kl_clearance_progress_pct",
            String(data.clearance_progress_pct)
          );
        }

        hydrateHeaderAndWelcome();

        if (data.ranked_up && data.clearance_level) {
          logEventToDashboard(
            `[CLEARANCE] tier elevated: ${String(data.clearance_level).toUpperCase()}`
          );
        }

        if (typeof data.successful_missions === "number") {
          logEventToDashboard(
            `[PROGRESS] successful missions: ${data.successful_missions}`
          );
        }

        if (data.next_tier && typeof data.remaining === "number") {
          logEventToDashboard(
            `[PROGRESS] ${data.remaining} to ${String(data.next_tier).toUpperCase()}`
          );
        }
      } catch (err) {
        console.warn("[MISSIONS] completion request failed:", err);
      }
    }

    async function refreshStarterProtocolBeacon() {
      const token = localStorage.getItem("kl_token");
      if (!token) return;

      // Starter Protocol UI is hosted on archive.html. If this element isn't
      // present, don't fetch.
      if (!lastAuthBeaconEl) return;

      if (lastAuthBeaconEl) {
        lastAuthBeaconEl.textContent = "syncing…";
      }

      try {
        const res = await fetch(`${API_BASE}/api/missions/starter-protocol`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) {
          if (lastAuthBeaconEl) {
            lastAuthBeaconEl.textContent = "unavailable";
          }
          return;
        }

        if (lastAuthBeaconEl) {
          lastAuthBeaconEl.textContent = data.beacon || "unavailable";
        }
      } catch (err) {
        if (lastAuthBeaconEl) {
          lastAuthBeaconEl.textContent = "unavailable";
        }
      }
    }

    async function submitMissionAnswer(missionId, answer) {
      const token = localStorage.getItem("kl_token");
      if (!token) {
        return { ok: false, error: "Missing session token." };
      }

      try {
        const res = await fetch(`${API_BASE}/api/missions/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            mission_id: missionId,
            answer
          })
        });
        const data = await res.json().catch(() => null);

        // If backend or middleware returns non-standard errors (e.g. {error: ...}),
        // normalize them so the UI can display a meaningful message.
        if (!data) {
          return { ok: false, error: "Submission failed." };
        }

        if (!res.ok) {
          if (typeof data.ok === "undefined") {
            return { ok: false, error: data.error || "Submission failed." };
          }
          return data;
        }

        return data;
      } catch (err) {
        return { ok: false, error: "Submission failed." };
      }
    }


    function logEventToDashboard(line) {
      if (!logWindow) return;
      const row = document.createElement("div");
      row.classList.add("kl-log-line");
      row.textContent = line;
      logWindow.appendChild(row);
      logWindow.scrollTop = logWindow.scrollHeight;
    }

    // -------------------------------------------------------
    // DEBRIEF + MISSION AUTOSTART HELPERS
    // -------------------------------------------------------
    function shouldForceDebrief() {
      // If server has synced a value, trust it. Otherwise, fallback to localStorage.
      const v = localStorage.getItem("kl_debrief_seen");
      return v !== "1";
    }

    function maybeAutoStartMission() {
      // Allows debrief.html to send the user back and auto-open Mission 01.
      const params = new URLSearchParams(window.location.search);
      if (params.get("autostart") !== "initiate-01") return;

      // Remove param so refresh doesn't re-open forever
      params.delete("autostart");
      const nextUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", nextUrl);

      // Mission modal + log
      setTimeout(() => {
        if (typeof openMissionModal === "function") {
          openMissionModal(starterProtocolMission);
          logEventToDashboard(
            "[MISSION] Auto-launch INITIATE-01 (post-debrief)."
          );
        }
      }, 650);
    }

    function clearAuthAndReload() {
      localStorage.removeItem("kl_token");
      localStorage.removeItem("kl_asset_email");
      localStorage.removeItem("kl_access_granted");
      localStorage.removeItem("kl_user_id");
      localStorage.removeItem("kl_display_name");
      localStorage.removeItem("kl_clearance_level");
      localStorage.removeItem("kl_debrief_seen");
      window.location.href = "login.html";
    }

    async function verifySession() {
      const token = localStorage.getItem("kl_token");
      if (!token) return false;

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          return false;
        }

        const data = await res.json();
        if (!data.ok || !data.user || !data.user.email) {
          return false;
        }

        const user = data.user;

        // Sync localStorage with server
        localStorage.setItem("kl_asset_email", user.email);
        if (user.id) {
          localStorage.setItem("kl_user_id", String(user.id));
        }
        if (user.display_name) {
          localStorage.setItem("kl_display_name", user.display_name);
        }
        if (user.clearance_level) {
          localStorage.setItem("kl_clearance_level", user.clearance_level);
        }
        if (data.user.display_name) {
          localStorage.setItem("kl_display_name", data.user.display_name);
        }

        // Debrief flag (server-truth)
        if (typeof user.debrief_seen !== "undefined") {
          localStorage.setItem("kl_debrief_seen", user.debrief_seen ? "1" : "0");
        }

        return true;
      } catch (err) {
        console.error("Session verify error:", err);
        return false;
      }
    }

    // -------------------------------------------------------
    // LORE + SPLASH + APP TRANSITIONS
    // -------------------------------------------------------
    const loreLines = [
      "[FILE 01] Incoming signal anomaly recorded over the Pacific.",
      "[FILE 02] Frequency does not match any known broadcast, satellite, or military band.",
      "[FILE 03] Embedded within the noise: structured numerical sequences.",
      "[FILE 04] Those numbers were the first keys.",
      "",
      "Kryptyk Labs was not founded to entertain codebreakers.",
      "It was created to intercept whatever is sending those sequences—and to train assets capable of answering back.",
      "",
      "Every access key you receive, every cipher you break, feeds into the same system:",
      "a listening post pointed at something that has not yet explained itself.",
      "",
      "If you are inside this console, your pattern-matching profile was flagged as useful.",
      "Your job is simple, but not easy:",
      "  • decode what others overlook,",
      "  • follow the threads the noise is hiding,",
      "  • and survive the escalation curve.",
      "",
      "INITIATE tier is observation.",
      "OPERATIVE tier is contact.",
      "ARCHIVIST tier is containment.",
      "ADMIN tier is… redacted.",
      "",
      "For now: learn the instruments. Watch the system logs. Treat every 'harmless' puzzle",
      "as rehearsal for the moment the signal changes."
    ];

    // --- Lore “seen” flag helpers ---
    function hasSeenLore() {
      return localStorage.getItem("kl_lore_seen_v1") === "true";
    }

    function markLoreSeen() {
      localStorage.setItem("kl_lore_seen_v1", "true");
    }

    async function playLoreIntro() {
      if (!loreOverlay || !loreBody) {
        // If for some reason the lore modal isn't present, just skip.
        markLoreSeen();
        return;
      }

      // Reset content and show overlay on top of the app
      loreBody.innerHTML = "";
      loreOverlay.style.display = "flex";

      for (const line of loreLines) {
        const el = document.createElement("div");
        el.classList.add("kl-lore-line");
        loreBody.appendChild(el);

        for (let i = 0; i < line.length; i++) {
          el.textContent = line.slice(0, i + 1);
          loreBody.scrollTop = loreBody.scrollHeight;
          await sleep(12);
        }
        await sleep(220);
      }
    }

    function closeLoreOverlay() {
      if (loreOverlay) {
        loreOverlay.style.display = "none";
      }
      markLoreSeen();
    }

    if (loreSkipBtn) {
      loreSkipBtn.addEventListener("click", () => {
        closeLoreOverlay();
      });
    }
    if (loreContinueBtn) {
      loreContinueBtn.addEventListener("click", () => {
        closeLoreOverlay();
      });
    }

    // Centralized splash → app transition
    function runSplashThenShowApp({ showLoreAfterSplash = true } = {}) {
      // Ensure dashboard is HIDDEN until we're ready
      if (app) {
        app.classList.add("hidden");
      }

      // Keep header synced, but still hidden visually
      hydrateHeaderAndWelcome();

      // No splash element: just show app + optional lore
      if (!splash) {
        if (app) app.classList.remove("hidden");
        void refreshStarterProtocolBeacon();
        maybeAutoStartMission();
        if (showLoreAfterSplash && !hasSeenLore()) {
          // Fire and forget; no need to await here
          playLoreIntro();
        }
        return;
      }

      // Show splash FIRST, before app appears
      splash.style.display = "flex";
      void splash.offsetWidth; // force reflow so transition works
      splash.classList.add("kl-splash-active");

      setTimeout(() => {
        // Hide splash
        splash.classList.remove("kl-splash-active");
        splash.style.display = "none";

        // Now finally reveal the dashboard
        if (app) {
          app.classList.remove("hidden");
        }
        void refreshStarterProtocolBeacon();
        maybeAutoStartMission();

        // Then, if this user hasn't seen the origin dossier yet, show it
        if (showLoreAfterSplash && !hasSeenLore()) {
          playLoreIntro();
        }
      }, 2600); // matches your splash animation duration
    }

    function beginAppTransition(
      statusText,
      { showLoreAfterSplash = true } = {}
    ) {
      // Prevent double-running the splash/app sequence
      if (appTransitionStarted) return;
      appTransitionStarted = true;

      if (statusIndicator && statusText) {
        statusIndicator.textContent = statusText;
      }

      // Safety: app MUST be hidden going into this
      if (app) {
        app.classList.add("hidden");
      }

      if (!preloader) {
        // If somehow there is no preloader, just run splash + app logic
        runSplashThenShowApp({ showLoreAfterSplash });
        return;
      }

      // Fade out the gate container
      preloader.classList.add("kl-preloader-fade-out");

      setTimeout(() => {
        preloader.style.display = "none";
        // Once gate is gone, splash takes over, then app
        runSplashThenShowApp({ showLoreAfterSplash });
      }, 600);
    }



    // -------------------------------------------------------
    // TABS
    // -------------------------------------------------------
    function setActiveTab(tabName) {
      activeTab = tabName;
      tabButtons.forEach((btn) => {
        const tab = btn.getAttribute("data-tab");
        if (tab === tabName) {
          btn.classList.add("kl-tab-active");
        } else {
          btn.classList.remove("kl-tab-active");
        }
      });

      // Show/hide forms
      if (tabName === "signup") {
        if (emailForm) emailForm.classList.remove("kl-form-hidden");
        if (keyForm) keyForm.classList.add("kl-form-hidden");
        if (passwordForm) passwordForm.classList.add("kl-form-hidden");
        if (loginForm) loginForm.classList.add("kl-form-hidden");
        if (resetRequestForm) resetRequestForm.classList.add("kl-form-hidden");
        if (resetCompleteForm) resetCompleteForm.classList.add("kl-form-hidden");
      } else {
        if (emailForm) emailForm.classList.add("kl-form-hidden");
        if (keyForm) keyForm.classList.add("kl-form-hidden");
        if (passwordForm) passwordForm.classList.add("kl-form-hidden");
        if (loginForm) loginForm.classList.remove("kl-form-hidden");
        if (resetRequestForm) resetRequestForm.classList.add("kl-form-hidden");
        if (resetCompleteForm) resetCompleteForm.classList.add("kl-form-hidden");
      }
      clearFieldErrors();
      setMockInput("");
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        setActiveTab(tab);
      });
    });

    // -------------------------------------------------------
    // BOOT SEQUENCE
    // -------------------------------------------------------
    async function runFreshBoot() {
      if (!terminalOutput) return;

      if (statusIndicator) {
        statusIndicator.textContent = "STATUS: INITIALIZING GATE…";
      }

      await typeLine("[CORE] establishing secure channel…", {
        system: true,
        charDelay: 14
      });
      await sleep(200);
      await typeLine("[CORE] entropy pool seeded.", {
        system: true,
        charDelay: 16
      });
      await sleep(180);
      await typeLine("[GATE] access control terminal online.", {
        system: true,
        charDelay: 16
      });
      await sleep(220);
      await typeLine(
        "[GATE] use REQUEST ACCESS to initialize a new asset, or SIGN IN to resume.",
        { system: true, charDelay: 14 }
      );

      if (statusIndicator) {
        statusIndicator.textContent = "STATUS: AWAITING CREDENTIALS";
      }
    }

    function runResumeBoot() {
      const displayName =
        (localStorage.getItem("kl_display_name") || "").trim();
      const nameForGate = displayName ? displayName.toUpperCase() : null;

      const bootLines = [
        "[CORE] entropy pool seeded.",
        "[CORE] terminal online.",
      ];

      if (nameForGate) {
        bootLines.push(`[CORE] asset ${nameForGate} authenticated.`);
      } else {
        bootLines.push("[CORE] asset authentication restored.");
      }

      bootLines.push("[CORE] restoring assigned clearance channel...");
      bootLines.push("[GATE] routing to orientation…");

      // Render these into the mock terminal
      let i = 0;
      const interval = setInterval(() => {
        if (i >= bootLines.length) {
          clearInterval(interval);
          // IMPORTANT: no redirect here anymore.
          // The caller (bootstrap) is responsible for showing the app.
          return;
        }

        setMockInput(bootLines[i], false, true);
        i++;
      }, 500);
    }

    // -------------------------------------------------------
    // MISSIONS: STARTER PROTOCOL (BUTTON-ONLY)
    // -------------------------------------------------------
    const starterProtocolMission = {
      id: "starter-protocol-01",
      title: "Starter Protocol // INITIATE-01",
      requiresAnswer: true,
      body: `
Welcome inside the Lab, asset.

Your first live operation is not about breaking ciphers — it's about proving you can observe.

Inside this Orientation Dashboard, the Lab has embedded a quiet heartbeat:
a per-session beacon tied to your last successful authentication.

Your task:

  1. Locate the Event Stream line that begins with [GATE].
  2. Find the beacon token shown after "last successful authentication:".
  3. Enter that beacon token into this mission console.

No external tools are required. Everything you need is visible inside the Orientation Dashboard once you clear the gate.
      `,
      hint: `
Watch the Event Stream panel on the right side of the Orientation Dashboard.

    Copy the token that starts with SIG- (no external tools required).
      `
    };

    function openMissionModal(mission) {
      if (!missionModal) return;

      if (missionTitleEl) {
        missionTitleEl.textContent = mission.title || "";
      }
      if (missionBodyEl) {
        missionBodyEl.textContent = mission.body || "";
      }
      if (missionHintEl) {
        missionHintEl.textContent = mission.hint || "";
      }

      missionModal.classList.remove("hidden");

      // Track what's open so the confirm handler can act on it
      missionModal.setAttribute("data-mission-id", mission?.id || "");
      missionModal.setAttribute(
        "data-requires-answer",
        mission?.requiresAnswer ? "1" : "0"
      );

      if (missionAnswerError) {
        missionAnswerError.textContent = "";
      }

      if (missionAnswerBlock) {
        const needsAnswer = !!mission?.requiresAnswer;
        missionAnswerBlock.classList.toggle("hidden", !needsAnswer);
      }

      if (missionAnswerInput) {
        missionAnswerInput.value = "";
        if (mission?.requiresAnswer) {
          setTimeout(() => missionAnswerInput.focus(), 50);
        }
      }
    }

    function closeMissionModal() {
      if (!missionModal) return;
      missionModal.classList.add("hidden");
      missionModal.removeAttribute("data-mission-id");
      missionModal.removeAttribute("data-requires-answer");

      if (missionAnswerBlock) {
        missionAnswerBlock.classList.add("hidden");
      }
      if (missionAnswerInput) {
        missionAnswerInput.value = "";
      }
      if (missionAnswerError) {
        missionAnswerError.textContent = "";
      }
    }

    // Only open Starter Protocol when the button is clicked
    if (startMissionBtn) {
      startMissionBtn.addEventListener("click", () => {
        openMissionModal(starterProtocolMission);
        logEventToDashboard(
          "[MISSION] Starter Protocol INITIATE-01 briefing opened."
        );
      });
    }

    if (missionCloseBtn) {
      missionCloseBtn.addEventListener("click", () => {
        closeMissionModal();
      });
    }

    if (missionConfirmBtn) {
      missionConfirmBtn.addEventListener("click", async () => {
        logEventToDashboard(
          "[MISSION] Starter Protocol briefing acknowledged by asset."
        );
        closeMissionModal();
      });
    }

    if (missionSubmitBtn) {
      missionSubmitBtn.addEventListener("click", async () => {
        if (missionAnswerError) missionAnswerError.textContent = "";

        const missionId = missionModal?.getAttribute("data-mission-id") || "";
        const requiresAnswer =
          missionModal?.getAttribute("data-requires-answer") === "1";

        if (!requiresAnswer || !missionId) {
          return;
        }

        const answer = (missionAnswerInput?.value || "").trim();
        if (!answer) {
          if (missionAnswerError) {
            missionAnswerError.textContent = "Answer is required.";
          }
          return;
        }

        missionSubmitBtn.disabled = true;
        try {
          const data = await submitMissionAnswer(missionId, answer);

          if (!data || !data.ok) {
            const msg = data?.error || "Submission failed.";
            if (missionAnswerError) missionAnswerError.textContent = msg;
            return;
          }

          if (!data.correct) {
            if (missionAnswerError) {
              missionAnswerError.textContent =
                data?.message || "Incorrect answer. Re-check the Event Stream.";
            }
            return;
          }

          // Apply returned progression state.
          if (data.clearance_level) {
            localStorage.setItem("kl_clearance_level", String(data.clearance_level));
          }
          if (typeof data.clearance_progress_pct === "number") {
            localStorage.setItem(
              "kl_clearance_progress_pct",
              String(data.clearance_progress_pct)
            );
          }
          hydrateHeaderAndWelcome();

          logEventToDashboard(`[MISSION] ${missionId} completed (validated).`);
          if (data.ranked_up && data.clearance_level) {
            logEventToDashboard(
              `[CLEARANCE] tier elevated: ${String(data.clearance_level).toUpperCase()}`
            );
          }

          closeMissionModal();
        } finally {
          missionSubmitBtn.disabled = false;
        }
      });
    }

    // -------------------------------------------------------
    // FORM HANDLERS — SIGNUP STEP 1: REQUEST ACCESS
    // -------------------------------------------------------
    if (emailForm) {
      emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearFieldErrors();

        const email = (emailInput?.value || "").trim().toLowerCase();
        if (!email) {
          if (emailError) emailError.textContent = "Email is required.";
          setMockInput("> invalid: missing email", true);
          return;
        }

        setMockInput("> dispatching access key…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/request-access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });

          const data = await res.json();

          if (!res.ok || !data.ok) {
            const msg =
              data.error || "Unable to request access key at this time.";
            if (emailError) emailError.textContent = msg;
            setMockInput(`> error: ${msg}`, true);

            // If this asset already has credentials, move them to SIGN IN
            if (
              msg.toLowerCase().includes("use sign in") &&
              typeof setActiveTab === "function"
            ) {
              if (loginEmailInput) {
                loginEmailInput.value = email;
              }
              setActiveTab("login");
            }
            return;
          }


          // cache signup email for later steps
          signupEmail = email;
          localStorage.setItem("kl_asset_email", email);

          // update inline email in Step 2 hint
          if (keyHint) {
            const span = keyHint.querySelector(".kl-inline-email");
            if (span) span.textContent = email;
          }

          // --- show cipher + drift from server ---
          setMockInput("> Caesar cipher received. Standing by for decryption…");

          if (data.cipher) {
            appendLine(
              `[GATE] cipher received: ${data.cipher}`,
              { system: true }
            );
          } else {
            appendLine(
              "[GATE] cipher received: ??????",
              { system: true }
            );
          }

          if (typeof data.shift === "number") {
            appendLine(
              `[HINT] Shift +${data.shift} applied to each digit.`,
              { system: true }
            );
          } else {
            console.warn("[GATE] no shift value returned from server:", data);
          }

          await typeLine(
            "[GATE] decode the cipher, then continue to Step 2.",
            { system: true, charDelay: 14 }
          );

          // move UI to key form
          if (emailForm) emailForm.classList.add("kl-form-hidden");
          if (keyForm) keyForm.classList.remove("kl-form-hidden");
        } catch (err) {
          console.error("request-access error:", err);
          const msg = "Gate service unavailable.";
          if (emailError) emailError.textContent = msg;
          setMockInput(`> error: ${msg}`, true);
        }
      });
    }




    // -------------------------------------------------------
    // SIGNUP STEP 2: VERIFY KEY
    // -------------------------------------------------------
    console.log("[KL] keyForm wired?", !!keyForm);

    if (keyForm) {
      keyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("[KL] keyForm submit fired");

        clearFieldErrors?.(); // safe if defined; no-op if not

        const key = (keyInput?.value || "").trim();
        if (!key) {
          if (keyError) keyError.textContent = "Access key is required.";
          setMockInput?.("> invalid: missing access key", true);
          return;
        }

        // use cached signupEmail if present; otherwise fall back to email input
        const emailForVerify =
          signupEmail || (emailInput?.value || "").trim().toLowerCase();

        if (!emailForVerify) {
          if (keyError)
            keyError.textContent = "Session lost. Please request a new access key.";
          setMockInput?.("> error: missing email context for verification", true);
          console.warn(
            "[KL] No emailForVerify when submitting key. signupEmail=",
            signupEmail
          );
          return;
        }

        setMockInput?.("> submitting decrypted access key…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/verify-key`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailForVerify,
              key
            })
          });

          let data;
          try {
            data = await res.json();
          } catch (parseErr) {
            console.error("[KL] verify-key JSON parse error:", parseErr);
            data = {};
          }

          console.log("[KL] /verify-key response:", res.status, data);

          if (!res.ok || !data.ok) {
            const msg =
              data.error ||
              "Unable to verify access key. The lab gate may be unstable.";
            if (keyError) keyError.textContent = msg;
            setMockInput?.(`> error: ${msg}`, true);
            return;
          }

          // success
          setMockInput?.("> key accepted. initializing signup console…");
          appendLine?.("[GATE] access key verified. Proceed to credentials stage.", {
            system: true
          });

          // You can stash user info from data.user if you want:
          if (data.user) {
            localStorage.setItem("kl_user_id", data.user.id);
            localStorage.setItem("kl_asset_email", data.user.email);
            if (data.user.display_name) {
              localStorage.setItem("kl_display_name", data.user.display_name);
            }
            if (data.user.clearance_level) {
              localStorage.setItem("kl_clearance_level", data.user.clearance_level);
            }
          }

          // move UI from key form -> password form
          if (keyForm) keyForm.classList.add("kl-form-hidden");
          if (passwordForm) passwordForm.classList.remove("kl-form-hidden");
        } catch (err) {
          console.error("verify-key frontend error:", err);
          const msg = "Gate service unavailable.";
          if (keyError) keyError.textContent = msg;
          setMockInput?.(`> error: ${msg}`, true);
        }
      });
    } else {
      console.warn("[KL] #kl-key-form not found in DOM");
    }

    console.log("[KL] passwordForm wired?", !!passwordForm);

    // 

    // Password form submit (Step 3: complete signup)
    if (passwordForm) {
      passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("[GATE] password form submitted.");
        clearFieldErrors();

        const password = (passwordInput?.value || "").trim();

        if (!signupEmail) {
          if (passwordError) {
            passwordError.textContent =
              "Email context lost. Restart the gate sequence.";
          }
          setMockInput("> error: missing asset email context.", true);
          return;
        }

        if (!password || password.length < 8) {
          if (passwordError) {
            passwordError.textContent = "Password must be at least 8 characters.";
          }
          setMockInput("> invalid: password too short", true);
          return;
        }

        setMockInput("> sealing asset credentials…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/complete-signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: signupEmail,
              password,
              // no codename yet – keep it null for now
              display_name: null
            })
          });

          const data = await res.json();
          console.log("[COMPLETE-SIGNUP] response:", data);

          if (!res.ok || !data.ok) {
            const msg =
              data.error || "The lab console failed to finalize your asset.";
            if (passwordError) passwordError.textContent = msg;
            setMockInput(`> error: ${msg}`, true);
            return;
          }

          // Store token + user info, then transition to app
          if (data.token) {
            localStorage.setItem("kl_token", data.token);
          }

          if (data.user) {
            if (data.user.email) {
              localStorage.setItem("kl_asset_email", data.user.email);
            }
            if (data.user.id) {
              localStorage.setItem("kl_user_id", String(data.user.id));
            }
            if (data.user.display_name) {
              localStorage.setItem("kl_display_name", data.user.display_name);
            }
            if (data.user.clearance_level) {
              localStorage.setItem("kl_clearance_level", data.user.clearance_level);
            }
          }


          appendLine("[GATE] asset credentials sealed. Clearance channel unlocked.", {
            system: true
          });

          // Debrief enforcement (brand-new assets)
          if (data.user && typeof data.user.debrief_seen !== "undefined") {
            localStorage.setItem("kl_debrief_seen", data.user.debrief_seen ? "1" : "0");
          } else {
            // New signup defaults to not-seen unless server says otherwise
            localStorage.setItem("kl_debrief_seen", "0");
          }
          if (shouldForceDebrief()) {
            window.location.href = "/debrief.html";
            return;
          }

          beginAppTransition("STATUS: ACCESS GRANTED", {
            showLoreAfterSplash: true
          });

        } catch (err) {
          console.error("complete-signup error:", err);
          const msg = "Gate service unavailable.";
          if (passwordError) passwordError.textContent = msg;
          setMockInput(`> error: ${msg}`, true);
        }
      });
    }


    // -------------------------------------------------------
    // LOGIN (EXISTING USER)
    // -------------------------------------------------------
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearFieldErrors();

        const email = (loginEmailInput?.value || "").trim().toLowerCase();
        const pw = (loginPasswordInput?.value || "").trim();

        if (!email) {
          if (loginError) loginError.textContent = "Email is required.";
          setMockInput("> invalid: missing email", true);
          return;
        }
        if (!isValidEmail(email)) {
          if (loginError) loginError.textContent = "Enter a valid email.";
          setMockInput("> invalid: email format", true);
          return;
        }
        if (!pw) {
          if (loginError) {
            loginError.textContent = "Clearance password is required.";
          }
          setMockInput("> invalid: missing password", true);
          return;
        }

        setMockInput("> verifying credentials…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pw })
          });
          const data = await res.json();

          if (!res.ok || !data.ok) {
            const msg = data.error || "Invalid email or password.";
            if (loginError) loginError.textContent = msg;
            setMockInput(`> error: ${msg}`, true);
            return;
          }

          // Store token + email + id + display name + clearance
          if (data.token) {
            localStorage.setItem("kl_token", data.token);
          }
          if (data.user && data.user.id) {
            localStorage.setItem("kl_user_id", String(data.user.id));
          }
          if (data.user && data.user.display_name) {
            localStorage.setItem("kl_display_name", data.user.display_name);
          }
          if (data.user && data.user.clearance_level) {
            localStorage.setItem(
              "kl_clearance_level",
              data.user.clearance_level
            );
          }
          localStorage.setItem("kl_asset_email", email);
          localStorage.setItem("kl_access_granted", "true");

          if (assetEmailPill) {
            assetEmailPill.textContent = `asset: ${email}`;
          }
          if (statusIndicator) {
            statusIndicator.textContent = "STATUS: ACCESS GRANTED";
          }

          // Debrief enforcement (new assets)
          if (data.user && typeof data.user.debrief_seen !== "undefined") {
            localStorage.setItem("kl_debrief_seen", data.user.debrief_seen ? "1" : "0");
          }
          if (shouldForceDebrief()) {
            // Route to debrief video once, then return to auto-start Mission 01.
            window.location.href = "/debrief.html";
            return;
          }

          // Figure out what to call the asset in the gate logs
          const rawDisplayName =
            (data.user && data.user.display_name) ||
            localStorage.getItem("kl_display_name") ||
            "";
          const callsign = rawDisplayName.trim();
          const assetLabel = callsign ? callsign.toUpperCase() : email;

          await typeLine(
            `[CORE] asset ${assetLabel} authenticated. issuing session token…`,
            {
              system: true,
              charDelay: 14
            }
          );
          await sleep(180);
          await typeLine(
            "[GATE] authentication successful. opening lab shell…",
            {
              system: true,
              charDelay: 14
            }
          );

          beginAppTransition("STATUS: ACCESS GRANTED", {
            showLoreAfterSplash: true
          });

        } catch (err) {
          console.error("login error:", err);
          const msg = "Gate service unavailable.";
          if (loginError) loginError.textContent = msg;
          setMockInput(`> error: ${msg}`, true);
        }
      });
    }

    // -------------------------------------------------------
    // RESET PASSWORD FLOW
    // -------------------------------------------------------
    if (resetOpenBtn) {
      resetOpenBtn.addEventListener("click", () => {
        clearFieldErrors();
        resetEmailContext = "";

        if (loginForm) loginForm.classList.add("kl-form-hidden");
        if (resetRequestForm)
          resetRequestForm.classList.remove("kl-form-hidden");
        if (resetCompleteForm)
          resetCompleteForm.classList.add("kl-form-hidden");

        setMockInput("> initiating clearance reset protocol…");
      });
    }

    if (resetBack1) {
      resetBack1.addEventListener("click", () => {
        clearFieldErrors();
        if (resetRequestForm) resetRequestForm.classList.add("kl-form-hidden");
        if (loginForm) loginForm.classList.remove("kl-form-hidden");
        setMockInput("> returning to sign-in.");
      });
    }

    if (resetBack2) {
      resetBack2.addEventListener("click", () => {
        clearFieldErrors();
        if (resetCompleteForm)
          resetCompleteForm.classList.add("kl-form-hidden");
        if (loginForm) loginForm.classList.remove("kl-form-hidden");
        setMockInput("> returning to sign-in.");
      });
    }

    // Step 1: request reset key
    if (resetRequestForm) {
      resetRequestForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearFieldErrors();

        const email = (resetEmailInput?.value || "").trim().toLowerCase();
        if (!email) {
          if (resetEmailError) {
            resetEmailError.textContent = "Email is required.";
          }
          setMockInput("> invalid: missing email", true);
          return;
        }
        if (!isValidEmail(email)) {
          if (resetEmailError) {
            resetEmailError.textContent = "Enter a valid email address.";
          }
          setMockInput("> invalid: email format", true);
          return;
        }

        setMockInput("> transmitting reset key…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/request-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
          const data = await res.json();

          if (!res.ok || !data.ok) {
            const msg =
              data.error ||
              "If this asset exists, a reset key has been transmitted.";
            if (resetEmailError) resetEmailError.textContent = msg;
            setMockInput(`> response: ${msg}`, true);
            return;
          }

          resetEmailContext = email;
          setMockInput("> reset key dispatched. check your channel.");
          await typeLine(
            "[GATE] reset token issued. supply the key and a new clearance password to complete reset.",
            { system: true, charDelay: 14 }
          );

          if (resetRequestForm)
            resetRequestForm.classList.add("kl-form-hidden");
          if (resetCompleteForm)
            resetCompleteForm.classList.remove("kl-form-hidden");
        } catch (err) {
          console.error("request-reset error:", err);
          const msg = "Gate service unavailable.";
          if (resetEmailError) resetEmailError.textContent = msg;
          setMockInput(`> error: ${msg}`, true);
        }
      });
    }

    // Step 2: complete reset
    if (resetCompleteForm) {
      resetCompleteForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearFieldErrors();

        const key = (resetKeyInput?.value || "").trim();
        const pw = (resetPwInput?.value || "").trim();
        const pw2 = (resetPwConfirmInput?.value || "").trim();

        if (!resetEmailContext || !key) {
          if (resetCompleteError) {
            resetCompleteError.textContent =
              "Reset context missing. Start reset flow again.";
          }
          setMockInput("> invalid: reset context missing", true);
          return;
        }

        if (!pw || pw.length < 8) {
          if (resetCompleteError) {
            resetCompleteError.textContent =
              "Password must be at least 8 characters.";
          }
          setMockInput("> invalid: weak password", true);
          return;
        }
        if (pw !== pw2) {
          if (resetCompleteError) {
            resetCompleteError.textContent = "Passwords do not match.";
          }
          setMockInput("> invalid: passwords mismatch", true);
          return;
        }

        setMockInput("> finalizing reset…");

        try {
          const res = await fetch(`${API_BASE}/api/auth/complete-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: resetEmailContext,
              key,
              password: pw
            })
          });
          const data = await res.json();

          if (!res.ok || !data.ok) {
            const msg =
              data.error || "Unable to complete reset at this time.";
            if (resetCompleteError) resetCompleteError.textContent = msg;
            setMockInput(`> error: ${msg}`, true);
            return;
          }

          setMockInput("> reset complete. you may now sign in.");
          await typeLine(
            "[GATE] clearance password updated. resume via SIGN IN.",
            { system: true, charDelay: 14 }
          );

          if (resetCompleteForm)
            resetCompleteForm.classList.add("kl-form-hidden");
          if (loginForm) loginForm.classList.remove("kl-form-hidden");
        } catch (err) {
          console.error("complete-reset error:", err);
          const msg = "Gate service unavailable.";
          if (resetCompleteError) resetCompleteError.textContent = msg;
          setMockInput(`> error: ${msg}`, true);
        }
      });
    }

    // -------------------------------------------------------
    // LOGOUT
    // -------------------------------------------------------
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearAuthAndReload();
      });
    }

    // -------------------------------------------------------
    // CURSOR BLINK
    // -------------------------------------------------------
    if (terminalCursor) {
      setInterval(() => {
        terminalCursor.classList.toggle("hidden");
      }, 550);
    }

    // -------------------------------------------------------
    // INITIAL BOOTSTRAP
    // -------------------------------------------------------
    (async () => {
      // Default to signup tab on fresh load
      setActiveTab("signup");

      const hasToken = !!localStorage.getItem("kl_token");
      if (!hasToken) {
        await runFreshBoot();
        hydrateHeaderAndWelcome();
        return;
      }

      // Try to restore session
      if (statusIndicator) {
        statusIndicator.textContent = "STATUS: CHECKING SESSION TOKEN…";
      }

      const valid = await verifySession();
      if (!valid) {
        localStorage.removeItem("kl_token");
        localStorage.removeItem("kl_access_granted");
        await runFreshBoot();
        hydrateHeaderAndWelcome();
        return;
      }

      // Session is valid

      // Debrief enforcement (resume sessions too)
      if (shouldForceDebrief()) {
        window.location.href = "/debrief.html";
        return;
      }

      hydrateHeaderAndWelcome();

      if (statusIndicator) {
        statusIndicator.textContent = "STATUS: ACTIVE SESSION DETECTED";
      }

      // For existing sessions, just play the terminal copy and then show the app.
      // Don't re-run the full splash transition here.
      await runResumeBoot();

      // Hide gate + splash directly
      if (preloader) {
        preloader.style.display = "none";
      }
      if (splash) {
        splash.classList.remove("kl-splash-active");
        splash.style.display = "none";
      }
      if (app) {
        app.classList.remove("hidden");
      }
      void refreshStarterProtocolBeacon();
      maybeAutoStartMission();
    })();
  });
})();
