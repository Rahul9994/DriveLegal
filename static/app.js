const CHAT_URL = "/chat";

let selectedRegion = "India";
let conversationHistory = [];
let isLoading = false;

function selectRegion(el, region) {
  document.querySelectorAll(".loc-chip").forEach((chip) => chip.classList.remove("active"));
  el.classList.add("active");
  selectedRegion = region;
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendQuick(el) {
  insertAndSend(el.textContent.trim());
}

function insertHint(el) {
  const input = document.getElementById("userInput");
  input.value += `${input.value ? " " : ""}${el.textContent.trim()}`;
  input.focus();
  autoResize(input);
}

function insertAndSend(text) {
  document.getElementById("userInput").value = text;
  sendMessage();
}

function triggerChallan() {
  const input = document.getElementById("userInput");
  input.value = "Calculate my challan for: ";
  input.focus();
  autoResize(input);
}

function addMessage(role, content, rawHtml = false) {
  const container = document.getElementById("chatMessages");
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "ai" ? "AI" : "You";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = rawHtml ? content : formatMessage(content);

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMessage(text) {
  if (text.includes("CHALLAN_CARD|")) {
    return formatChallanCard(text);
  }

  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]/g, '<span class="law-tag">$1</span>')
    .replace(/^(?:-|\*) (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*?<\/li>\n?)+)/gs, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function formatChallanCard(text) {
  const parts = text
    .split("CHALLAN_CARD|")
    .pop()
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const total = parts.find((part) => part.toUpperCase().startsWith("TOTAL:")) || "";
  const items = parts.filter((part) => part !== total);
  const totalAmount = escapeHtml(total.replace(/^TOTAL:/i, "").trim() || "Pending");

  const rows = items
    .map((item) => {
      const separator = item.indexOf(":");
      if (separator === -1) return "";
      const key = escapeHtml(item.slice(0, separator).trim());
      const value = escapeHtml(item.slice(separator + 1).trim());
      return `<div class="challan-row"><span class="challan-key">${key}</span><span class="challan-val">${value}</span></div>`;
    })
    .join("");

  return `<div class="challan-card"><div class="challan-title">Challan Breakdown</div>${rows}<div class="challan-total"><span>Total Challan</span><span class="challan-total-amt">${totalAmount}</span></div></div>`;
}

function showTyping() {
  const container = document.getElementById("chatMessages");
  const msg = document.createElement("div");
  msg.className = "msg ai";
  msg.id = "typingMsg";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("typingMsg");
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const text = input.value.trim();
  if (!text || isLoading) return;

  isLoading = true;
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  showTyping();

  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        region: selectedRegion,
        history: conversationHistory.slice(-10)
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `API error: ${res.status}`);
    }

    const reply = data.reply || "I'm unable to process that request right now.";
    removeTyping();
    conversationHistory.push({ role: "assistant", content: reply });
    addMessage("ai", reply);
  } catch (err) {
    removeTyping();
    showOfflineBadge();
    const fallback = getOfflineFallback(text);
    conversationHistory.push({ role: "assistant", content: fallback });
    addMessage("ai", fallback);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function showOfflineBadge() {
  const badge = document.getElementById("offlineBadge");
  badge.style.display = "block";
  window.setTimeout(() => {
    badge.style.display = "none";
  }, 4000);
}

function getOfflineFallback(query) {
  const q = query.toLowerCase();
  if (q.includes("helmet")) return "**No Helmet Violation (India):**\n\nUnder [Section 129 MV Act], wearing a helmet is mandatory for two-wheeler riders.\n\n- Fine: *Rs. 1,000* first offense\n- License suspension: 3 months\n- Applies to: Rider and pillion\n\n*Note: Telangana enforces strictly in Hyderabad metro areas.*";
  if (q.includes("speed") || q.includes("overspeeding")) return "**Overspeeding Fines (India 2019):**\n\n- Light Motor Vehicle: *Rs. 1,000-2,000*\n- Medium Passenger Vehicle: *Rs. 2,000-4,000*\n- Juvenile offense: *Rs. 25,000* plus guardian liability\n\n[Section 112 MV Act 1988], amended 2019. State highways may vary.";
  if (q.includes("drunk") || q.includes("dui") || q.includes("alcohol")) return "**Drunk Driving (India):**\n\n- First offense: *Rs. 10,000* or 6 months imprisonment\n- Second offense within 3 years: *Rs. 15,000* plus 2 years imprisonment\n- BAC limit: 30mg per 100ml blood [Section 185 MV Act]\n\nNever drink and drive. It endangers lives.";
  if (q.includes("seatbelt")) return "**Seatbelt Violation (India):**\n\n- Fine: *Rs. 1,000* [Section 194B MV Act]\n- Applies to driver and all passengers\n- Children must use appropriate restraints\n\n*Maharashtra and Delhi enforce this strictly.*";
  if (q.includes("red light") || q.includes("signal")) return "**Traffic Signal Jump (India):**\n\n- Fine: *Rs. 1,000-5,000* [Section 177 MV Act]\n- Repeat offense: *Rs. 5,000*\n- May lead to license suspension\n\nMany cities use automated cameras for enforcement.";
  if (q.includes("mobile") || q.includes("phone")) return "**Mobile Phone While Driving (India):**\n\n- Fine: *Rs. 5,000* [Section 184 MV Act 2019]\n- Hands-free is permitted but discouraged\n- Includes handheld GPS devices\n\nHyderabad Traffic Police runs frequent mobile phone drives.";
  return "**DriveLegal Offline Mode**\n\nI'm currently in offline mode. Basic traffic law information is available. For detailed queries, check the server logs and confirm `OPENROUTER_API_KEY` is set in `.env`.\n\nCommon Indian fines: Overspeeding Rs. 1,000+, No Helmet Rs. 1,000, Drunk Driving Rs. 10,000, No Seatbelt Rs. 1,000, Red Light Jump Rs. 1,000-5,000.";
}
