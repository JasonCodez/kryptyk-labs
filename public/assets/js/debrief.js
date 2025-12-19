(() => {
  const API_BASE =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "";

  const token = localStorage.getItem("kl_token");
  const email = localStorage.getItem("kl_asset_email") || "unknown@asset";
  const rawName = (localStorage.getItem("kl_display_name") || "").trim();

  const pill = document.getElementById("kl-debrief-asset-pill");
  if (pill) {
    pill.textContent = rawName
      ? `asset: ${rawName.toUpperCase()}`
      : `asset: ${email}`;
  }

  const statusEl = document.getElementById("kl-debrief-status");
  const errEl = document.getElementById("kl-debrief-error");
  const ackBtn = document.getElementById("kl-debrief-ack");
  const logoutBtn = document.getElementById("kl-debrief-logout");

  function setError(msg) {
    if (errEl) errEl.textContent = msg || "";
  }

  function logout() {
    localStorage.removeItem("kl_token");
    localStorage.removeItem("kl_asset_email");
    localStorage.removeItem("kl_access_granted");
    localStorage.removeItem("kl_user_id");
    localStorage.removeItem("kl_display_name");
    localStorage.removeItem("kl_clearance_level");
    localStorage.removeItem("kl_debrief_seen");
    window.location.href = "login.html";
  }

  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  if (!token) {
    if (statusEl) {
      statusEl.textContent =
        "STATUS: no session token detected. routing to gate…";
    }
    setTimeout(() => (window.location.href = "login.html"), 600);
    return;
  }

  async function acknowledge() {
    setError("");
    if (statusEl) {
      statusEl.textContent =
        "STATUS: transmitting debrief acknowledgement…";
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/debrief-complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Debrief acknowledgement failed.");
      }

      localStorage.setItem("kl_debrief_seen", "1");

      if (statusEl) {
        statusEl.textContent =
          "STATUS: debrief recorded. returning to orientation…";
      }

      setTimeout(() => {
        window.location.href = "login.html?autostart=initiate-01";
      }, 700);
    } catch (err) {
      console.error("debrief ack error:", err);
      if (statusEl) statusEl.textContent = "STATUS: channel error.";
      setError("Unable to record debrief. Check server status and try again.");
    }
  }

  if (ackBtn) ackBtn.addEventListener("click", acknowledge);
})();
