(() => {
  // If an auth token exists, the user already has an active session (or at least
  // a resumable one). Route them straight to the Orientation dashboard instead
  // of replaying the landing intro.
  const token = localStorage.getItem("kl_token");
  if (token) {
    window.location.replace("login.html");
    return;
  }

  const lines = [
    { text: "[ SIGNAL DETECTED ]", class: "muted", delay: 600 },

    { text: "", delay: 350 },
    { text: "KRYPTYK LABS // PROGRAM: BLACK GLASS", class: "strong", delay: 900 },
    { text: "CHANNEL: DENIABLE ORIENTATION", class: "muted", delay: 850 },

    { text: "", delay: 450 },
    {
      text:
        "A non-human protocol has been observed in deep space—\n" +
        "structured traffic embedded in background noise.",
      delay: 1200
    },

    { text: "", delay: 450 },
    {
      text:
        "It behaves like an intrusion: handshake → challenge → response.\n" +
        "It adapts when we change how we listen.",
      delay: 1300
    },

    { text: "", delay: 450 },
    {
      text:
        "Active skyfiles reference known systems:\n" +
        "PROXIMA CENTAURI / TAU CETI / EPSILON ERIDANI / TRAPPIST-1 / VEGA",
      delay: 1300
    },

    { text: "", delay: 550 },
    {
      text: "Access is restricted. Containment is mandatory.",
      class: "strong",
      delay: 1200
    }
  ];

  const target = document.getElementById("typeTarget");
  if (!target) return;

  let lineIndex = 0;

  function typeLine(line, cb) {
    let i = 0;
    const span = document.createElement("span");
    if (line.class) span.className = line.class;
    target.appendChild(span);

    function tick() {
      span.textContent += line.text[i] || "";
      i++;
      if (i < line.text.length) {
        setTimeout(tick, 22);
      } else {
        target.appendChild(document.createTextNode("\n"));
        setTimeout(cb, line.delay || 500);
      }
    }

    tick();
  }

  function nextLine() {
    if (lineIndex >= lines.length) return;
    typeLine(lines[lineIndex], () => {
      lineIndex++;
      nextLine();
    });
  }

  nextLine();

  const actions = document.getElementById("introActions");
  setTimeout(() => {
    if (!actions) return;
    actions.classList.add("is-ready");
  }, 9000);
})();
