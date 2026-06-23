const values = [0, 0, 0, 0];
const controls = document.querySelector("#servo-controls");
const statusBox = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const errorMessage = document.querySelector("#error-message");
let debounceTimer;
let requestSequence = 0;

const MIN_ANGLE = 0;
const MAX_ANGLE = 180;

const clamp = (value) => Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, Math.round(value)));

function setStatus(state, text) {
  statusBox.className = `status status-${state}`;
  statusText.textContent = text;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function updateControl(index, value, shouldSend = true) {
  const nextValue = clamp(value);
  values[index] = nextValue;
  document.querySelector(`#servo-${index}-range`).value = nextValue;
  document.querySelector(`#servo-${index}-number`).value = nextValue;
  if (shouldSend) scheduleSend();
}

function scheduleSend() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sendValues, 120);
}

async function sendValues() {
  const sequence = ++requestSequence;
  setStatus("pending", "Sending...");
  try {
    const response = await fetch("/api/servos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to update the servos.");
    if (sequence === requestSequence) {
      setStatus("online", `Connected on ${data.port}`);
      showError("");
    }
  } catch (error) {
    if (sequence === requestSequence) {
      setStatus("offline", "Arduino disconnected");
      showError(error.message);
    }
  }
}

values.forEach((value, index) => {
  const card = document.createElement("article");
  card.className = "servo-card";
  card.innerHTML = `
    <h2>Servo ${index + 1}</h2>
    <div class="control-row">
      <button type="button" data-action="minus" aria-label="Decrease Servo ${index + 1} by 10">&minus;</button>
      <input id="servo-${index}-range" type="range" min="${MIN_ANGLE}" max="${MAX_ANGLE}" step="1" value="${value}" aria-label="Servo ${index + 1} angle">
      <button type="button" data-action="plus" aria-label="Increase Servo ${index + 1} by 10">+</button>
    </div>
    <label class="number-wrap" for="servo-${index}-number">
      Angle
      <input id="servo-${index}-number" type="number" min="${MIN_ANGLE}" max="${MAX_ANGLE}" step="1" value="${value}" inputmode="numeric">
      <span>&deg;</span>
    </label>`;

  const range = card.querySelector('input[type="range"]');
  const number = card.querySelector('input[type="number"]');
  range.addEventListener("input", () => updateControl(index, Number(range.value)));
  number.addEventListener("input", () => {
    if (number.value !== "" && Number.isFinite(Number(number.value))) {
      updateControl(index, Number(number.value));
    }
  });
  number.addEventListener("change", () => updateControl(index, Number(number.value || values[index])));
  card.querySelector('[data-action="minus"]').addEventListener("click", () => updateControl(index, values[index] - 10));
  card.querySelector('[data-action="plus"]').addEventListener("click", () => updateControl(index, values[index] + 10));
  controls.appendChild(card);
});

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    if (data.connected) {
      setStatus("online", `Connected on ${data.port}`);
    } else {
      setStatus("offline", "Not connected");
    }
  } catch {
    setStatus("offline", "Flask app unavailable");
  }
}

checkStatus();
