// assets/js/animations.js

// Tiny helper: type text into a container line by line
async function klTypeSequence(lines, outputEl, delayBetween = 400) {
  if (!outputEl) return;

  for (const line of lines) {
    const lineEl = document.createElement("div");
    lineEl.classList.add("kl-terminal-line");
    if (line.system) lineEl.classList.add("kl-terminal-system");

    outputEl.appendChild(lineEl);

    await typeText(line.text, lineEl, line.charDelay ?? 14);
    await sleep(line.pauseAfter ?? delayBetween);

    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function typeText(text, el, charDelay) {
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await sleep(charDelay);
  }
}
