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
    const preloader = document.getElementById("kl-preloader");
    const splash = document.getElementById("kl-splash");
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

    // -------------------------------------------------------
    // STATE
    // -------------------------------------------------------
    let activeTab = "signup";
    let signupEmail = "";
    let signupKey = ""; // key that passed verification (Step 2)
    let resetEmailContext = "";

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
      const displayName =
        localStorage.getItem("kl_display_name") || "Asset";
      const clearance =
        localStorage.getItem("kl_clearance_level") || "INITIATED";

      if (assetEmailPill) {
        assetEmailPill.textContent = email
          ? `asset: ${email}`
          : "asset: unknown";
      }

      if (welcomeName && welcomeClearance) {
        welcomeName.textContent = displayName.toUpperCase();
        welcomeClearance.textContent = clearance.toUpperCase();
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

    function clearAuthAndReload() {
      localStorage.removeItem("kl_token");
      localStorage.removeItem("kl_asset_email");
      localStorage.removeItem("kl_access_granted");
      localStorage.removeItem("kl_user_id");
      localStorage.removeItem("kl_display_name");
      localStorage.removeItem("kl_clearance_level");
      window.location.href = "index.html";
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

        return true;
      } catch (err) {
        console.error("Session verify error:", err);
        return false;
      }
    }

    // -------------------------------------------------------
    // LORE + SPLASH + APP TRANSITIONS
    // -------------------------------------------------------
    // -------------------------------------------------------
    // SPLASH + LORE + APP TRANSITIONS
    // -------------------------------------------------------
    // -------------------------------------------------------
    // SPLASH + LORE + APP TRANSITIONS
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

        // Then, if this user hasn't seen the origin dossier yet, show it
        if (showLoreAfterSplash && !hasSeenLore()) {
          playLoreIntro();
        }
      }, 2600); // matches your splash animation duration
    }

    function beginAppTransition(statusText, { showLoreAfterSplash = true } = {}) {
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

    async function runResumeBoot() {
      if (!terminalOutput) return;

      const email = localStorage.getItem("kl_asset_email") || "classified";

      await typeLine("[CORE] existing session token detected.", {
        system: true,
        charDelay: 14
      });
      await sleep(200);
      await typeLine(`[GATE] asset ${email} recognized.`, {
        system: true,
        charDelay: 14
      });
      await sleep(200);
      await typeLine(
        "[GATE] bypassing gate protocol and restoring orientation console…",
        { system: true, charDelay: 14 }
      );
    }

    // -------------------------------------------------------
    // MISSIONS: STARTER PROTOCOL (BUTTON-ONLY)
    // -------------------------------------------------------
    const starterProtocolMission = {
      id: "starter-protocol-01",
      title: "Starter Protocol // INITIATE-01",
      body: `
Welcome inside the Lab, asset.

Your first live operation is not about breaking ciphers — it's about proving you can observe.

Inside this Orientation Dashboard, the Lab has embedded a quiet heartbeat:
a repeating signal that marks every authenticated session.

Your task:

  1. Locate the element that references your "last successful authentication".
  2. Read the exact label the Lab uses for that event.
  3. Record that label in your field notes — it will be part of INITIATE-02.

No external tools are required. Everything you need is visible inside the Orientation Dashboard once you clear the gate.
      `,
      hint: `
Watch the Event Stream panel on the right side of the Orientation Dashboard.

The line you want begins with [GATE] and mentions "last successful authentication".
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
    }

    function closeMissionModal() {
      if (!missionModal) return;
      missionModal.classList.add("hidden");
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
      missionConfirmBtn.addEventListener("click", () => {
        logEventToDashboard(
          "[MISSION] Starter Protocol briefing acknowledged by asset."
        );
        closeMissionModal();
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
          setMockInput("> cryptographic artifact issued.");

          if (data.cipher) {
            appendLine(
              `[GATE] cipher fragment received: ${data.cipher}`,
              { system: true }
            );
          } else {
            appendLine(
              "[GATE] cipher fragment received: ??????",
              { system: true }
            );
          }

          if (typeof data.shift === "number") {
            appendLine(
              `[HINT] numeric drift parameter: +${data.shift} applied to each digit.`,
              { system: true }
            );
          } else {
            console.warn("[GATE] no shift value returned from server:", data);
          }

          await typeLine(
            "[GATE] decrypt the fragment using the drift parameter, then continue to Step 2.",
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

          await typeLine(
            "[CORE] credentials accepted. issuing session token…",
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

          beginAppTransition("STATUS: ACCESS GRANTED", { showLoreAfterSplash: true });

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
      hydrateHeaderAndWelcome();

      if (statusIndicator) {
        statusIndicator.textContent = "STATUS: ACTIVE SESSION DETECTED";
      }

      await runResumeBoot();
      beginAppTransition("STATUS: RESTORING ORIENTATION CONSOLE…");
    })();
  });
})();
