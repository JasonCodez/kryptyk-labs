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

    { text: "", delay: 400 },

    { text: "You were not meant to find this system.", delay: 900 },

    { text: "", delay: 500 },

    {
      text:
        "Kryptyk Labs investigates encrypted anomalies and hidden structures\n" +
        "embedded across the open web.",
      delay: 1100
    },

    { text: "", delay: 600 },

    {
      text: "Access is restricted. Observation is permitted.",
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
