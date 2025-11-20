const audio = document.getElementById("player");
const titleEl = document.getElementById("title");
const stateEl = document.getElementById("state");
const artEl = document.getElementById("art");
const debugTimeEl = document.getElementById("debug-time");
const progressBarEl = document.getElementById("progressBar");

// Animation frame for smooth time updates
let timeUpdateFrameId = null;

// Statements loaded from JSON
let statements = [];
let currentStatementIndex = 0;
let currentStatement = null;
let inGracePeriod = true;
let countdownInterval = null;
let currentCountdown = 0; // track remaining seconds
let currentResponseLabel = "(awaiting response)"; // track current response
let progressUpdateFrameId = null;


// Track responses for each statement by statementId
let statementResponses = {};

// Media override checkbox state
let mediaOverrideEnabled = true; // Default to enabled

// Load statements from JSON file
async function loadStatements() {
  try {
    const response = await fetch('data/statements.json');
    statements = await response.json();
    console.log('📄 Loaded statements:', statements);
  } catch (error) {
    console.error('❌ Failed to load statements:', error);
    // Fallback to hardcoded statements
    statements = [];
  }
}

// Image variants
const images = {
  unseen: "assets/waiting.jpeg",
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
  if ("mediaSession" in navigator && currentStatement) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStatement.text,
      artist: `[0:${secondsLeft.toString().padStart(2, "0")}] ${label}`,
      artwork: [{ src: artEl.src, sizes: "512x512", type: "image/jpeg" }]
    });
  }
}

function updateProgressBar() {
  if (!audio.duration || statements.length === 0) {
    progressBarEl.style.width = '0%';
    return;
  }

  const currentTime = audio.currentTime;

  // Find the next statement after current time
  const nextStatement = statements.find(s => s.timecode > currentTime);

  // If we have a current statement, show countdown until next statement
  if (currentStatement && nextStatement) {
    const totalDuration = nextStatement.timecode - currentStatement.timecode;
    const timeRemaining = Math.max(0, nextStatement.timecode - currentTime);
    const progress = Math.max(0, Math.min(1, timeRemaining / totalDuration));
    progressBarEl.style.width = `${progress * 100}%`;
    return;
  }

  // If we have a current statement but no next statement, hide progress bar
  if (currentStatement && !nextStatement) {
    progressBarEl.style.width = '0%';
    return;
  }

  // If we're before any statement, show countdown until the first statement
  const firstStatement = statements[0];
  if (firstStatement && currentTime < firstStatement.timecode) {
    const timeUntilFirst = firstStatement.timecode - currentTime;
    const progress = Math.max(0, Math.min(1, timeUntilFirst / firstStatement.timecode));
    progressBarEl.style.width = `${progress * 100}%`;
    return;
  }

  // Fallback case - no current statement and past all statements
  progressBarEl.style.width = '0%';
}

function animateProgressUpdate() {
  updateProgressBar();
  progressUpdateFrameId = requestAnimationFrame(animateProgressUpdate);
}

function startProgressUpdates() {
  if (progressUpdateFrameId) {
    cancelAnimationFrame(progressUpdateFrameId);
  }
  animateProgressUpdate();
}

function stopProgressUpdates() {
  if (progressUpdateFrameId) {
    cancelAnimationFrame(progressUpdateFrameId);
    progressUpdateFrameId = null;
  }
}

function updateStatement(statement) {
  if (!statement) return;

  currentStatement = statement;
  titleEl.textContent = statement.text;

  // Check if this statement already has a response
  const savedResponse = statementResponses[statement.statementId];
  if (savedResponse) {
    stateEl.textContent = savedResponse.label;
    currentResponseLabel = savedResponse.label;
    artEl.src = savedResponse.art;
    stateEl.className = '';
    stateEl.classList.add(savedResponse.type);
  } else {
    stateEl.textContent = "(awaiting response)";
    currentResponseLabel = "(awaiting response)";
    artEl.src = images.unseen;
    stateEl.className = '';
  }

  inGracePeriod = true;

  // 1s grace period before votes are accepted
  setTimeout(() => {
    inGracePeriod = false;
    console.log("⏳ Grace period over, votes now accepted");
  }, 1000);

  // Reset countdown - calculate based on time to next statement
  const nextStatement = statements.find(s => s.timecode > audio.currentTime);
  currentCountdown = nextStatement ? Math.ceil(nextStatement.timecode - audio.currentTime) : 0;

  // Update progress bar for countdown (let updateProgressBar handle all calculations)
  updateProgressBar();

  console.log("🗣️ New statement:", statement.text, `(ID: ${statement.statementId})`);
}

function setResponse(type) {
  if (inGracePeriod || !currentStatement) return; // block votes in grace period

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

  // Save response for current statement by statementId
  statementResponses[currentStatement.statementId] = {
    type: type,
    label: label,
    art: art
  };

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

  console.log("Response updated:", type, `for statement ${currentStatement.statementId}`);

  // Update MediaSession with current countdown and latest response
  updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
}

function getActiveStatementFromTime(currentTime) {
  // Find the statement that should be active at the current time
  let activeStatement = null;

  for (let i = statements.length - 1; i >= 0; i--) {
    if (currentTime >= statements[i].timecode) {
      activeStatement = statements[i];
      break;
    }
  }

  return activeStatement;
}

function clearStatement() {
  currentStatement = null;
  titleEl.textContent = "Statements will load here...";
  stateEl.textContent = "(awaiting response)";
  currentResponseLabel = "(awaiting response)";
  artEl.src = images.unseen;
  stateEl.className = '';
  updateProgressBar();
}

function updateStatementFromSeekTime() {
  const activeStatement = getActiveStatementFromTime(audio.currentTime);

  if (activeStatement && (!currentStatement || activeStatement.statementId !== currentStatement.statementId)) {
    updateStatement(activeStatement);

    // Calculate countdown based on time until next statement or end of current statement window
    const nextStatement = statements.find(s => s.timecode > audio.currentTime);
    const endTime = nextStatement ? nextStatement.timecode : audio.duration;
    currentCountdown = Math.ceil(endTime - audio.currentTime);

    console.log(`🎯 Seek detected: Statement ${activeStatement.statementId}, ${currentCountdown}s remaining`);
  } else if (!activeStatement && currentStatement) {
    // We're before the first statement, clear the display
    clearStatement();
    console.log(`🎯 Before first statement, cleared display`);
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    // Update statement based on current audio time instead of just counting down
    updateStatementFromSeekTime();

    updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
    currentCountdown--;

    if (currentCountdown <= 0) {
      // Recalculate countdown based on current time
      const activeStatement = getActiveStatementFromTime(audio.currentTime);
      if (activeStatement) {
        const nextStatement = statements.find(s => s.timecode > audio.currentTime);
        const endTime = nextStatement ? nextStatement.timecode : audio.duration;
        currentCountdown = Math.ceil(endTime - audio.currentTime);
      }
    }
  }, 1000);

  // Initial update
  updateStatementFromSeekTime();
  updateMediaSessionCountdown(currentCountdown, currentResponseLabel);
}

// --- Media Session action mapping ---
function updateMediaSessionHandlers() {
  if ("mediaSession" in navigator) {
    if (mediaOverrideEnabled) {
      // Set vote handlers
      navigator.mediaSession.setActionHandler("nexttrack", () => setResponse("agree"));
      navigator.mediaSession.setActionHandler("previoustrack", () => setResponse("disagree"));
      navigator.mediaSession.setActionHandler("play", () => setResponse("pass"));
      navigator.mediaSession.setActionHandler("pause", () => setResponse("pass"));
      console.log("🎛️ Media session handlers set to vote actions");
    } else {
      // Remove vote handlers to restore default behavior
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      console.log("🎛️ Media session handlers cleared for default behavior");
    }
  }
}

// Initialize media session handlers
updateMediaSessionHandlers();

// --- Initialize ---
async function initialize() {
  await loadStatements();

  // Setup media override checkbox
  const mediaOverrideCheckbox = document.getElementById('mediaOverrideCheckbox');
  if (mediaOverrideCheckbox) {
    mediaOverrideCheckbox.addEventListener('change', (e) => {
      mediaOverrideEnabled = e.target.checked;
      updateMediaSessionHandlers(); // Update handlers when checkbox changes
      console.log(`🎛️ Media override ${mediaOverrideEnabled ? 'enabled' : 'disabled'}`);
    });
  }

  audio.addEventListener("play", () => {
    updateStatementFromSeekTime(); // Set statement based on current time
    startCountdown();
    startProgressUpdates();
  });

  // Handle seeking - update statement when user scrubs through audio
  audio.addEventListener("seeked", () => {
    updateStatementFromSeekTime();
    updateProgressBar();
    console.log(`🔍 Seeked to ${formatTime(audio.currentTime)}`);
  });

  // Handle time updates during playback
  audio.addEventListener("timeupdate", () => {
    // Only update if we're not already in a countdown (to avoid conflicts)
    if (!countdownInterval) {
      updateStatementFromSeekTime();
    }
  });
}

// Initialize the app
initialize();

// Update debug time display with smooth animation
audio.addEventListener("play", startSmoothTimeUpdates);
audio.addEventListener("pause", () => {
  stopSmoothTimeUpdates();
  stopProgressUpdates();
  updateDebugTime(); // Final update when paused
  updateProgressBar(); // Final progress update when paused
});
audio.addEventListener("seeking", startSmoothTimeUpdates); // Smooth updates while scrubbing
audio.addEventListener("seeked", () => {
  if (audio.paused) {
    stopSmoothTimeUpdates();
    stopProgressUpdates();
    updateDebugTime(); // Final update if paused after seek
    updateProgressBar(); // Final progress update if paused after seek
  } else {
    startProgressUpdates(); // Resume progress updates if playing
  }
  // If playing, smooth updates continue automatically
});
audio.addEventListener("loadedmetadata", () => {
  updateDebugTime();
  updateProgressBar();
});
audio.addEventListener("durationchange", () => {
  updateDebugTime();
  updateProgressBar();
});

// Handle playback rate changes
audio.addEventListener("ratechange", () => {
  console.log(`🎵 Playback rate changed to ${audio.playbackRate}x`);
  updateProgressBar();
});

// Initial updates
updateDebugTime();
updateProgressBar();
