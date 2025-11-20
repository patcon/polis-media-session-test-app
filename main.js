const audio = document.getElementById("player");
const titleEl = document.getElementById("title");
const stateEl = document.getElementById("state");
const artEl = document.getElementById("art");
const debugTimeEl = document.getElementById("debug-time");

// Animation frame for smooth time updates
let timeUpdateFrameId = null;

// Statements to display over time
const statements = [
  "The city should close downtown streets to cars on weekends.",
  "Public funding should prioritize local businesses over big corporations.",
  "All public meetings should be recorded and archived online.",
  "We should allow citizens to vote directly on annual budget priorities."
];

let currentStatementIndex = 0;
let inGracePeriod = true;
let countdownInterval = null;
let currentCountdown = 15; // track remaining seconds
let currentResponseLabel = "(awaiting response)"; // track current response

const STATEMENT_DURATION = 15; // seconds

// Image variants
const images = {
  unseen: "https://picsum.photos/seed/unseen/512?blur=8",
  agree: "assets/i-agree.png",
  disagree: "assets/i-disagree.png",
  pass: "assets/i-pass.jpeg"
};

// --- Helpers ---
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function updateDebugTime() {
  const currentTime = audio.currentTime || 0;
  const duration = audio.duration || 0;
  debugTimeEl.textContent = `⏱️ ${formatTime(currentTime)} / ${formatTime(duration)}`;
}

function animateTimeUpdate() {
  updateDebugTime();
  timeUpdateFrameId = requestAnimationFrame(animateTimeUpdate);
}

function startSmoothTimeUpdates() {
  if (timeUpdateFrameId) {
    cancelAnimationFrame(timeUpdateFrameId);
  }
  animateTimeUpdate();
}

function stopSmoothTimeUpdates() {
  if (timeUpdateFrameId) {
    cancelAnimationFrame(timeUpdateFrameId);
    timeUpdateFrameId = null;
  }
}

function updateMediaSessionCountdown(secondsLeft, label) {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: statements[currentStatementIndex],
      artist: `[0:${secondsLeft.toString().padStart(2, "0")}] ${label}`,
      artwork: [{ src: artEl.src, sizes: "512x512", type: "image/jpeg" }]
    });
  }
}

function updateStatement(i) {
  const statement = statements[i];
  titleEl.textContent = statement;
  stateEl.textContent = "(awaiting response)";
  currentResponseLabel = "(awaiting response)";
  inGracePeriod = true;
  artEl.src = images.unseen;

  // Reset state styling to default
  stateEl.className = '';

  // 1s grace period before votes are accepted
  setTimeout(() => {
    inGracePeriod = false;
    console.log("⏳ Grace period over, votes now accepted");
  }, 1000);

  // Reset countdown
  currentCountdown = STATEMENT_DURATION;

  console.log("🗣️ New statement:", statement);
}

function setResponse(type) {
  if (inGracePeriod) return; // block votes in grace period

  let label, art;
  switch (type) {
    case "agree":
      label = "✔️ You agreed";
      art = images.agree;
      break;
    case "disagree":
      label = "❌ You disagreed";
      art = images.disagree;
      break;
    case "pass":
      label = "🔹 You passed";
      art = images.pass;
      break;
  }

  // Save current response
  currentResponseLabel = label;

  // Reset classes and add new ones
  stateEl.className = '';
  stateEl.classList.add('updated', type);
  stateEl.textContent = label;
  artEl.src = art;

  // Remove animation class after animation completes
  setTimeout(() => {
    stateEl.classList.remove('updated');
  }, 600);

  console.log("Response updated:", type);

  // Update MediaSession with current countdown and latest response
  updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
    currentCountdown--;

    if (currentCountdown < 0) {
      // Move to next statement
      currentStatementIndex = (currentStatementIndex + 1) % statements.length;
      updateStatement(currentStatementIndex);
    }
  }, 1000);

  // Initial update
  updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
}

// --- Media Session action mapping ---
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("nexttrack", () => setResponse("agree"));
  navigator.mediaSession.setActionHandler("previoustrack", () => setResponse("disagree"));
  navigator.mediaSession.setActionHandler("play", () => setResponse("pass"));
  navigator.mediaSession.setActionHandler("pause", () => setResponse("pass"));
}

// --- Initialize ---
audio.addEventListener("play", () => {
  updateStatement(currentStatementIndex);
  startCountdown();
});

// Update debug time display with smooth animation
audio.addEventListener("play", startSmoothTimeUpdates);
audio.addEventListener("pause", () => {
  stopSmoothTimeUpdates();
  updateDebugTime(); // Final update when paused
});
audio.addEventListener("seeking", startSmoothTimeUpdates); // Smooth updates while scrubbing
audio.addEventListener("seeked", () => {
  if (audio.paused) {
    stopSmoothTimeUpdates();
    updateDebugTime(); // Final update if paused after seek
  }
  // If playing, smooth updates continue automatically
});
audio.addEventListener("loadedmetadata", updateDebugTime);
audio.addEventListener("durationchange", updateDebugTime);

// Initial debug time update
updateDebugTime();
