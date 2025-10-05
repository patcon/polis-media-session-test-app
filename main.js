const audio = document.getElementById("player");
const titleEl = document.getElementById("title");
const stateEl = document.getElementById("state");
const artEl = document.getElementById("art");

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
  agree: "https://picsum.photos/seed/agree/512",
  disagree: "https://picsum.photos/seed/disagree/512?grayscale",
  pass: "https://picsum.photos/seed/pass/512?grayscale&blur=4"
};

// --- Helpers ---
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
      label = "✅ You agreed";
      art = images.agree;
      break;
    case "disagree":
      label = "❌ You disagreed";
      art = images.disagree;
      break;
    case "pass":
      label = "⏸️ You passed";
      art = images.pass;
      break;
  }

  // Save current response
  currentResponseLabel = label;

  stateEl.textContent = label;
  artEl.src = art;

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
