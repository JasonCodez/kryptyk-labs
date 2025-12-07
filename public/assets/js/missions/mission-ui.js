// assets/js/missions/mission-ui.js
import { missions } from "./missions.js";

let modalEl = null;
let titleEl = null;
let bodyEl = null;
let hintEl = null;
let closeBtnEl = null;
let confirmBtnEl = null;
let logWindowEl = null;
let wired = false;

function cacheElements() {
  modalEl = document.getElementById("kl-mission-modal");
  titleEl = document.getElementById("kl-mission-title");
  bodyEl = document.getElementById("kl-mission-body");
  hintEl = document.getElementById("kl-mission-hint");
  closeBtnEl = document.getElementById("kl-mission-close");
  confirmBtnEl = document.getElementById("kl-mission-confirm");
  logWindowEl = document.getElementById("kl-log-window");
}

function logToEventStream(line) {
  if (!logWindowEl) return;
  const row = document.createElement("div");
  row.classList.add("kl-log-line");
  row.textContent = line;
  logWindowEl.appendChild(row);
  logWindowEl.scrollTop = logWindowEl.scrollHeight;
}

function hideMissionModal() {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
  modalEl.removeAttribute("data-mission-id");
}

function wireOnce() {
  if (wired) return;
  wired = true;

  if (!modalEl) return;

  // Ensure hidden on load
  modalEl.classList.add("hidden");

  if (closeBtnEl) {
    closeBtnEl.addEventListener("click", () => {
      const id = modalEl.getAttribute("data-mission-id") || "UNKNOWN";
      logToEventStream(
        `[MISSION] ${id} viewer dismissed by asset.`
      );
      hideMissionModal();
    });
  }

  // Click on overlay to close
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      const id = modalEl.getAttribute("data-mission-id") || "UNKNOWN";
      logToEventStream(
        `[MISSION] ${id} viewer dismissed by overlay click.`
      );
      hideMissionModal();
    }
  });

  if (confirmBtnEl) {
    confirmBtnEl.addEventListener("click", () => {
      const id = modalEl.getAttribute("data-mission-id") || "UNKNOWN";
      logToEventStream(
        `[MISSION] ${id} acknowledged. Asset ready for next instructions.`
      );
      hideMissionModal();
    });
  }
}

// PUBLIC: called from main.js on boot
export function initMissionUi() {
  cacheElements();

  if (!modalEl) {
    console.warn("[MISSIONS] Mission modal element not found in DOM.");
    return;
  }

  wireOnce();
}

// PUBLIC: open a specific mission
export function openMission(missionId) {
  // Lazy cache/wire in case this runs before initMissionUi
  if (!modalEl) {
    cacheElements();
    wireOnce();
  }
  if (!modalEl || !titleEl || !bodyEl) {
    console.error("[MISSIONS] Modal elements missing, cannot open mission.");
    return;
  }

  const mission = missions[missionId];

  if (!mission) {
    console.error("Unknown mission id:", missionId);
    titleEl.textContent = "MISSING MISSION";
    bodyEl.textContent = `Mission with id "${missionId}" not found in registry.`;
    if (hintEl) hintEl.textContent = "";
  } else {
    titleEl.textContent =
      mission.title || mission.codename || mission.id || "Mission Briefing";
    bodyEl.textContent = (mission.briefing || "").trim();
    if (hintEl) {
      hintEl.textContent = (mission.hint || "").trim();
    }
  }

  modalEl.setAttribute("data-mission-id", missionId || "UNKNOWN");
  modalEl.classList.remove("hidden");

  logToEventStream(
    `[MISSION] ${missionId || "UNKNOWN"} — mission briefing opened.`
  );
}
