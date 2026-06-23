const values = [0, 0, 0, 0];
const controls = document.querySelector("#servo-controls");
const statusBox = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const errorMessage = document.querySelector("#error-message");
let chatToggle = document.querySelector("#chat-toggle");
let chatPanel = document.querySelector("#chat-panel");
let chatMessages = document.querySelector("#chat-messages");
let chatForm = document.querySelector("#chat-form");
let chatInput = document.querySelector("#chat-input");
let debounceTimer;
let requestSequence = 0;

const MIN_ANGLE = 0;
const MAX_ANGLE = 180;
const THINKING_DELAY_MS = 850;
const CLAW_SERVO_INDEX = 3;
const chatCommands = {
  "open claw": {
    angle: 180,
    response: "Set Servo 4 to 180 degrees.",
  },
  "close claw": {
    angle: 0,
    response: "Set Servo 4 to 0 degrees.",
  },
};

const clamp = (value) => Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, Math.round(value)));

function ensureChatUi() {
  if (chatToggle && chatPanel && chatMessages && chatForm && chatInput) return;

  const chat = document.createElement("section");
  chat.id = "ai-chat";
  chat.className = "ai-chat";
  chat.setAttribute("aria-label", "Natural language control");
  chat.innerHTML = `
    <button id="chat-toggle" class="chat-toggle" type="button" aria-label="Open AI command chat" aria-expanded="false">
      <span aria-hidden="true">&#128172;</span>
    </button>

    <div id="chat-panel" class="chat-panel" hidden>
      <div class="chat-header">
        <div class="chat-avatar" aria-hidden="true">&#129302;</div>
        <div>
          <h2>Arm Controller AI</h2>
          <p>Natural language commands</p>
        </div>
      </div>

      <div id="chat-messages" class="chat-messages" aria-live="polite"></div>

      <form id="chat-form" class="chat-form">
        <input id="chat-input" type="text" autocomplete="off" placeholder="Type a command..." aria-label="AI chat command">
        <button type="submit" aria-label="Send command">Send</button>
      </form>
    </div>`;

  document.body.appendChild(chat);
  chatToggle = document.querySelector("#chat-toggle");
  chatPanel = document.querySelector("#chat-panel");
  chatMessages = document.querySelector("#chat-messages");
  chatForm = document.querySelector("#chat-form");
  chatInput = document.querySelector("#chat-input");
}

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

ensureChatUi();

function scrollChatToLatest() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendMessage(sender, text, isThinking = false) {
  const message = document.createElement("div");
  message.className = `chat-message chat-message-${sender}`;
  if (isThinking) message.classList.add("message-thinking");

  if (sender === "ai") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "\uD83E\uDD16";
    message.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  message.appendChild(bubble);

  chatMessages.appendChild(message);
  scrollChatToLatest();
  return { message, bubble };
}

function setThinkingResponse(thinkingMessage, response) {
  thinkingMessage.bubble.textContent = response;
  thinkingMessage.message.classList.remove("message-thinking");
  scrollChatToLatest();
}

function handleChatCommand(rawCommand) {
  const command = rawCommand.trim().toLowerCase();
  const action = chatCommands[command];
  const thinkingMessage = appendMessage("ai", "thinking...", true);

  window.setTimeout(() => {
    if (action) {
      updateControl(CLAW_SERVO_INDEX, action.angle);
      setThinkingResponse(thinkingMessage, action.response);
      return;
    }

    setThinkingResponse(thinkingMessage, 'Sorry, I don\'t understand that command.');
  }, THINKING_DELAY_MS);
}

chatToggle.addEventListener("click", () => {
  const isOpening = chatPanel.hidden;
  chatPanel.hidden = !isOpening;
  chatToggle.setAttribute("aria-expanded", String(isOpening));
  chatToggle.setAttribute("aria-label", isOpening ? "Close AI command chat" : "Open AI command chat");
  if (isOpening) chatInput.focus();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = chatInput.value.trim();
  if (!command) return;

  appendMessage("user", command);
  chatInput.value = "";
  handleChatCommand(command);
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
