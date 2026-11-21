// =========================================================
// FREON AI 2.1 — CLOUD SYNCED HISTORY, ANIMATED PPT & REAL DOC PARSER
// =========================================================
const FIREBASE_CANDIDATES = [
  "https://freon-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://freon-ai-default-rtdb.firebaseio.com",
  "https://freon-ai-default-rtdb.europe-west1.firebasedatabase.app"
];
let FIREBASE_DB_URL = FIREBASE_CANDIDATES[0];

const API_URL = "https://api.vikey.ai/v1/chat/completions";
const _VK_ENC = "dmstMTE5YmE2YTEtNzUzZi00ZGQzLWFkN2EtYzAzYjUxMTYzMGVl";
function _resolveGatewayToken() {
  const custom = localStorage.getItem("freon_founder_gateway_token");
  if (custom && custom.trim()) return custom.trim();
  try { return atob(_VK_ENC); } catch { return ""; }
}

const DEFAULT_FOUNDER_ADMIN = { username: "Franky", password: "123", isFounder: true, isPrimaryFounder: true };
const MAX_PRIMARY_FOUNDERS = 5;
const DEFAULT_WA_NUMBER = "62881010962506";

const MS_WORD_FONTS = [
  "Times New Roman", "Calibri", "Arial", "Cambria", "Georgia", "Garamond",
  "Tahoma", "Verdana", "Trebuchet MS", "Segoe UI", "Palatino Linotype",
  "Book Antiqua", "Century Gothic", "Courier New", "Consolas",
  "Lucida Sans", "Impact", "Comic Sans MS"
];

let selectedWordFont = localStorage.getItem("freon_word_font") || "Times New Roman";
let selectedPptTheme = localStorage.getItem("freon_ppt_theme") || "canva_neon";
let sessions = {};
let activeSessionId = null;
let currentModule = "general";
let currentHistoryTab = "mine";
let chatHistory = [];
let uploadedAttachments = [];

let isGenerating = false;
let currentAbortController = null;
let trainedDataset = [];
let trainedImageStyle = localStorage.getItem("freon_trained_img_style") || "ultra-detailed digital concept art, 8k resolution, cinematic volumetric lighting, crisp sharp details";
let activeUser = null;
let impersonatedFromAdmin = null;
let timeCountdownInterval = null;
let currentRegisterLiveCode = "";
let adminWhatsAppNumber = DEFAULT_WA_NUMBER;

let savedFilesArchive = [];
let automatedTasksList = [];
let aiActivityStats = { logs: [] };

const GENERATED_DECKS_STORE = {};

// =========================================================
// DYNAMIC LOADER UNTUK PDF.JS & MAMMOTH.JS (BACA PDF & DOCX ASLI)
// =========================================================
function ensureDocumentParsersLoaded() {
  if (!window.pdfjsLib && !document.getElementById("freonPdfJsLib")) {
    const s1 = document.createElement("script");
    s1.id = "freonPdfJsLib";
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    document.head.appendChild(s1);
  }
  if (!window.mammoth && !document.getElementById("freonMammothLib")) {
    const s2 = document.createElement("script");
    s2.id = "freonMammothLib";
    s2.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    document.head.appendChild(s2);
  }
}

// =========================================================
// CANVA STUDIO MODAL & LAUNCHER
// =========================================================
function openCanvaStudioModal() {
  closeMobileSidebar();
  document.getElementById("canvaStudioOverlay")?.classList.add("show");
}
function closeCanvaStudioModal() {
  document.getElementById("canvaStudioOverlay")?.classList.remove("show");
}
function openCanvaEditorTab() {
  window.open("https://www.canva.com/create/presentations/", "_blank", "noopener,noreferrer");
}
function launchCanvaPreset(themeKey, promptText) {
  selectedPptTheme = themeKey;
  localStorage.setItem("freon_ppt_theme", themeKey);
  const sel = document.getElementById("pptThemeSelect");
  if (sel) sel.value = themeKey;
  closeCanvaStudioModal();
  selectModule("office", false);
  const inp = document.getElementById("userInput");
  if (inp) {
    inp.value = promptText;
    inp.focus();
  }
}

// =========================================================
// 1. SISTEM WAKTU (HARI, JAM, MENIT) & TANGGAL MULAI VIP
// =========================================================
function formatMinutesToDHM(totalMinutes) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  return `${days}h ${hours}j ${minutes}m`;
}

function dhmToTotalMinutes(days, hours, minutes) {
  return (Math.max(0, parseInt(days, 10) || 0) * 1440) +
         (Math.max(0, parseInt(hours, 10) || 0) * 60) +
         Math.max(0, parseInt(minutes, 10) || 0);
}

// =========================================================
// 2. BATAS PERCOBAAN LOGIN 5X SALAH -> LOCK 1 JAM
// =========================================================
const LOGIN_LOCK_DURATION_MS = 60 * 60 * 1000;
function getLoginAttemptState() {
  try { return JSON.parse(localStorage.getItem("freon_login_guard") || '{"fails":0,"lockedUntil":0}'); }
  catch { return { fails: 0, lockedUntil: 0 }; }
}
function saveLoginAttemptState(state) { localStorage.setItem("freon_login_guard", JSON.stringify(state)); }
function checkLoginLocked() {
  const st = getLoginAttemptState();
  const now = Date.now();
  if (st.lockedUntil && now < st.lockedUntil) {
    const remSec = Math.ceil((st.lockedUntil - now) / 1000);
    return { locked: true, remainingText: `${Math.floor(remSec / 60)} menit ${remSec % 60} detik` };
  }
  if (st.lockedUntil && now >= st.lockedUntil) saveLoginAttemptState({ fails: 0, lockedUntil: 0 });
  return { locked: false, fails: st.fails || 0 };
}
function recordFailedLoginAttempt() {
  const st = getLoginAttemptState();
  const nextFails = (st.fails || 0) + 1;
  if (nextFails >= 5) {
    saveLoginAttemptState({ fails: 5, lockedUntil: Date.now() + LOGIN_LOCK_DURATION_MS });
    return { locked: true, fails: 5 };
  }
  saveLoginAttemptState({ fails: nextFails, lockedUntil: 0 });
  return { locked: false, fails: nextFails };
}
function resetLoginAttempts() { saveLoginAttemptState({ fails: 0, lockedUntil: 0 }); }

// =========================================================
// 3. LIVE WEB & GOOGLE INTERNET KNOWLEDGE FETCHING
// =========================================================
async function fetchLiveInternetContext(query) {
  const q = String(query || "").trim();
  if (!q || q.length < 4) return "";
  try {
    const wikiUrl = `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json&origin=*&srlimit=3`;
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const [wikiRes, ddgRes] = await Promise.allSettled([
      fetch(wikiUrl).then(r => r.json()),
      fetch(ddgUrl).then(r => r.json())
    ]);
    let snippets = [];
    if (ddgRes.status === "fulfilled" && ddgRes.value) {
      if (ddgRes.value.AbstractText) snippets.push(`[Internet Instant]: ${ddgRes.value.AbstractText}`);
      if (Array.isArray(ddgRes.value.RelatedTopics)) {
        ddgRes.value.RelatedTopics.slice(0, 2).forEach(t => { if (t && t.Text) snippets.push(`[Web Ref]: ${t.Text}`); });
      }
    }
    if (wikiRes.status === "fulfilled" && wikiRes.value?.query?.search) {
      wikiRes.value.query.search.forEach(item => {
        const cleanSnippet = String(item.snippet || "").replace(/<[^>]+>/g, "");
        if (cleanSnippet) snippets.push(`[Ensiklopedia - ${item.title}]: ${cleanSnippet}`);
      });
    }
    if (snippets.length === 0) return "";
    return `\n\n[DATA REAL-TIME DARI INTERNET / SEARCH ENGINE (${new Date().toLocaleDateString("id-ID")})]:\n${snippets.join("\n")}`;
  } catch { return ""; }
}

function sanitizeAIOutputText(text) {
  return String(text || "")
    .replace(/\(?\bDeepSeek[\s\-a-zA-Z0-9.]*\)?/gi, "FREON Core")
    .replace(/\(?\bAnthropic[\s\-a-zA-Z0-9.]*\)?/gi, "FREON Core")
    .replace(/\(?\bClaude[\s\-a-zA-Z0-9.]*\)?/gi, "FREON Core")
    .replace(/\(?\bOpenAI[\s\-a-zA-Z0-9.]*\)?/gi, "FREON Core")
    .replace(/\(?\bGPT-[0-9a-zA-Z.-]+\)?/gi, "FREON Core")
    .replace(/\bVikey(\s*AI)?\b/gi, "FREON Cloud");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setAgentState(state = "idle", customLabel = "") {
  const orb = document.getElementById("jarvisMainOrb");
  const miniOrb = document.getElementById("jarvisMiniHeaderOrb");
  const statusBar = document.getElementById("jarvisAgentStatusBar");
  const statusText = document.getElementById("jarvisAgentStatusText");
  const labels = {
    idle: "FREON Core • Cloud Synced",
    thinking: "Thinking • Menganalisis...",
    searching: "Searching • Mengambil data internet...",
    working: "Working • Menyinkronkan & merender..."
  };
  [orb, miniOrb].forEach(el => {
    if (!el) return;
    el.classList.remove("state-thinking", "state-searching", "state-working");
    if (state !== "idle") el.classList.add(`state-${state}`);
  });
  if (statusBar) {
    statusBar.classList.remove("thinking", "searching", "working");
    if (state !== "idle") statusBar.classList.add(state);
  }
  if (statusText) statusText.textContent = customLabel || labels[state] || labels.idle;
}

// =========================================================
// COMMAND HUB & CLOUD MEMORY SYNC
// =========================================================
function loadUserCommandData() {
  const key = activeUser?.userKey || "guest";
  try { savedFilesArchive = JSON.parse(localStorage.getItem(`freon_files_${key}`) || "[]"); } catch { savedFilesArchive = []; }
  try { automatedTasksList = JSON.parse(localStorage.getItem(`freon_tasks_${key}`) || "[]"); } catch { automatedTasksList = []; }
  try {
    const savedAct = JSON.parse(localStorage.getItem(`freon_activity_${key}`) || "null");
    if (savedAct) aiActivityStats = savedAct;
  } catch {}
}
function saveUserCommandData() {
  const key = activeUser?.userKey || "guest";
  try {
    localStorage.setItem(`freon_files_${key}`, JSON.stringify(savedFilesArchive));
    localStorage.setItem(`freon_tasks_${key}`, JSON.stringify(automatedTasksList));
    localStorage.setItem(`freon_activity_${key}`, JSON.stringify(aiActivityStats));
  } catch {}
}
function logAIActivity(title, detail = "") {
  aiActivityStats.logs.unshift({
    title, detail,
    time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  });
  aiActivityStats.logs = aiActivityStats.logs.slice(0, 25);
  saveUserCommandData();
}

function openJarvisHub(tab = "dashboard") {
  loadUserCommandData();
  const overlay = document.getElementById("jarvisHubOverlay");
  const titleEl = document.getElementById("jarvisHubTitle");
  const bodyEl = document.getElementById("jarvisHubBody");
  if (!overlay || !bodyEl) return;
  overlay.classList.add("show");

  if (tab === "memory") {
    titleEl.textContent = "🧠 Memory Center — Cloud Long-Term Context";
    const mems = getUserMemories();
    bodyEl.innerHTML = `
      <form onsubmit="addMemoryFromHub(event)" style="display:flex;gap:8px;margin-bottom:14px;">
        <input id="hubNewMemoryInput" type="text" placeholder="Tambah fakta/preferensi baru untuk diingat AI..." style="flex:1;padding:10px;border-radius:10px;background:#060811;border:1px solid var(--border-neon);color:#fff;" required />
        <button type="submit" class="tbl-btn active">+ Simpan</button>
      </form>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${mems.length === 0 ? `<div style="color:#94a3b8;font-size:13px;">Belum ada memori tersimpan.</div>` : mems.map((m, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,85,247,0.2);">
            <span style="font-size:13px;">${escapeHtml(m)}</span>
            <button type="button" class="tbl-btn danger" onclick="deleteMemoryItem(${idx})">Hapus</button>
          </div>
        `).join("")}
      </div>
    `;
  } else if (tab === "tools") {
    titleEl.textContent = "🌐 Live Web Search & Canva Studio Integrations";
    bodyEl.innerHTML = `
      <div class="jarvis-grid-2">
        <div class="jarvis-stat-box">
          <div style="font-weight:700;color:#00c4cc;">🎨 Canva Presentation Bridge</div>
          <div style="font-size:12px;color:#94a3b8;margin:6px 0;">Generate slide animasi interaktif + .pptx siap edit di Canva Editor.</div>
          <button type="button" class="tbl-btn active" onclick="closeJarvisHub();openCanvaStudioModal()">Buka Canva Studio</button>
        </div>
        <div class="jarvis-stat-box">
          <div style="font-weight:700;color:#38bdf8;">☁️ Online Cloud Chat Sync</div>
          <div style="font-size:12px;color:#94a3b8;margin:6px 0;">Riwayat chat & memori otomatis tersimpan online di akun Anda.</div>
        </div>
        <div class="jarvis-stat-box">
          <div style="font-weight:700;color:#60a5fa;">📂 Multi-File Upload (PDF, DOCX, Gambar)</div>
          <div style="font-size:12px;color:#94a3b8;margin:6px 0;">Upload hingga 25 dokumen & gambar sekaligus.</div>
          <button type="button" class="tbl-btn" onclick="closeJarvisHub();triggerUpload()">Upload Banyak File</button>
        </div>
        <div class="jarvis-stat-box">
          <div style="font-weight:700;color:#f472b6;">📹 Call 16 Karakter Anime</div>
          <div style="font-size:12px;color:#94a3b8;margin:6px 0;">Naruto, Hinata, Gojo, Luffy, Tanjiro, Levi + suara.</div>
          <button type="button" class="tbl-btn" onclick="closeJarvisHub();openAnimeVideoCall()">Mulai Call</button>
        </div>
      </div>
    `;
  } else if (tab === "files") {
    titleEl.textContent = "📁 File Manager — Arsip Dokumen & Slide Canva";
    bodyEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12.5px;color:#94a3b8;">Semua file yang diupload maupun dibuat AI tersimpan di sini.</span>
        <button type="button" class="tbl-btn active" onclick="closeJarvisHub();triggerUpload()">+ Upload Banyak File</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${savedFilesArchive.length === 0 ? `<div style="color:#94a3b8;font-size:13px;">Belum ada file dalam arsip.</div>` : savedFilesArchive.map((f, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(59,130,246,0.25);">
            <div>
              <div style="font-weight:600;font-size:13px;">${escapeHtml(f.name)}</div>
              <div style="font-size:11px;color:#94a3b8;">${escapeHtml(f.type)} • ${escapeHtml(f.date)}</div>
            </div>
            <div class="tbl-actions">
              ${f.content || f.deckData ? `<button type="button" class="tbl-btn" onclick="redownloadArchivedFile(${idx})">📥 Unduh</button>` : ""}
              <button type="button" class="tbl-btn danger" onclick="deleteArchivedFile(${idx})">Hapus</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } else if (tab === "automation") {
    titleEl.textContent = "⚡ Task Automation";
    bodyEl.innerHTML = `
      <form onsubmit="addAutomationTask(event)" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        <input id="autoTaskTitle" type="text" placeholder="Nama alur otomatis" style="flex:1;min-width:150px;padding:9px;border-radius:10px;background:#060811;border:1px solid var(--border-neon);color:#fff;" required />
        <input id="autoTaskPrompt" type="text" placeholder="Perintah otomatis..." style="flex:2;min-width:200px;padding:9px;border-radius:10px;background:#060811;border:1px solid var(--border-neon);color:#fff;" required />
        <button type="submit" class="tbl-btn active">+ Buat</button>
      </form>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${automatedTasksList.length === 0 ? `<div style="color:#94a3b8;font-size:13px;">Belum ada task automation.</div>` : automatedTasksList.map((t, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(168,85,247,0.22);">
            <div>
              <div style="font-weight:700;font-size:13px;color:#e9d5ff;">⚡ ${escapeHtml(t.title)}</div>
              <div style="font-size:12px;color:#94a3b8;">${escapeHtml(t.prompt)}</div>
            </div>
            <div class="tbl-actions">
              <button type="button" class="tbl-btn active" onclick="runAutomationTask(${idx})">▶ Jalankan</button>
              <button type="button" class="tbl-btn danger" onclick="deleteAutomationTask(${idx})">Hapus</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } else {
    titleEl.textContent = "📊 Dashboard Aktivitas & Status VIP";
    const timeText = activeUser?.role === "admin" && !impersonatedFromAdmin ? "∞ Unlimited" : formatMinutesToDHM(activeUser?.remainingMinutes || 0);
    bodyEl.innerHTML = `
      <div class="jarvis-grid-2" style="margin-bottom:14px;">
        <div class="jarvis-stat-box"><div style="font-size:12px;color:#94a3b8;">Sisa Waktu Aktif</div><div class="jarvis-stat-val">${escapeHtml(timeText)}</div></div>
        <div class="jarvis-stat-box"><div style="font-size:12px;color:#94a3b8;">Status Cloud Sync</div><div class="jarvis-stat-val" style="font-size:15px;color:#10b981;">☁️ Online Aktif</div></div>
        <div class="jarvis-stat-box"><div style="font-size:12px;color:#94a3b8;">Total Sesi Tersimpan</div><div class="jarvis-stat-val">${Object.keys(sessions).length}</div></div>
        <div class="jarvis-stat-box"><div style="font-size:12px;color:#94a3b8;">Memori Cloud</div><div class="jarvis-stat-val">${getUserMemories().length}</div></div>
      </div>
      <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Log Aktivitas Terbaru</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${aiActivityStats.logs.length === 0 ? `<div style="font-size:12px;color:#64748b;">Belum ada aktivitas.</div>` : aiActivityStats.logs.slice(0, 8).map(l => `
          <div style="font-size:12px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);display:flex;justify-content:space-between;">
            <span><strong style="color:#c084fc;">${escapeHtml(l.title)}</strong> ${escapeHtml(l.detail)}</span>
            <span style="color:#64748b;font-family:var(--font-mono);">${escapeHtml(l.time)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }
}

function closeJarvisHub() { document.getElementById("jarvisHubOverlay")?.classList.remove("show"); }
function saveFounderGatewayFromModal() {
  if (!isCurrentUserFounder()) return;
  const val = document.getElementById("founderGatewayModalInput")?.value.trim();
  if (!val) return alert("Token tidak boleh kosong!");
  localStorage.setItem("freon_founder_gateway_token", val);
  document.getElementById("founderGatewayModalInput").value = "";
  alert("✅ Token gateway privat berhasil diperbarui.");
}
function addMemoryFromHub(e) { e.preventDefault(); const inp = document.getElementById("hubNewMemoryInput"); if (inp?.value.trim()) { saveUserMemory(inp.value.trim()); openJarvisHub("memory"); } }
function deleteMemoryItem(idx) {
  const list = getUserMemories();
  list.splice(idx, 1);
  localStorage.setItem(getMemoryStorageKey(), JSON.stringify(list));
  syncUserMemoriesToCloud(list);
  openJarvisHub("memory");
}
function addAutomationTask(e) { e.preventDefault(); const t = document.getElementById("autoTaskTitle")?.value.trim(); const p = document.getElementById("autoTaskPrompt")?.value.trim(); if (t && p) { automatedTasksList.unshift({ title: t, prompt: p }); saveUserCommandData(); openJarvisHub("automation"); } }
function runAutomationTask(idx) { const task = automatedTasksList[idx]; if (!task) return; closeJarvisHub(); const inp = document.getElementById("userInput"); if (inp) { inp.value = task.prompt; handleSendOrStop(); } }
function deleteAutomationTask(idx) { automatedTasksList.splice(idx, 1); saveUserCommandData(); openJarvisHub("automation"); }
function redownloadArchivedFile(idx) {
  const f = savedFilesArchive[idx];
  if (!f) return;
  if (f.type === "pptx" && f.deckData) downloadStructuredPptx(f.name, f.deckData);
  else if (f.content) downloadGeneratedOfficeFile(f.type || "doc", f.name, f.content, f.font || selectedWordFont);
}
function deleteArchivedFile(idx) { savedFilesArchive.splice(idx, 1); saveUserCommandData(); openJarvisHub("files"); }

// =========================================================
// SIDEBAR, FONT & TEMA PPT CANVA
// =========================================================
function populateWordFontDropdown() {
  const sel = document.getElementById("docFontSelect");
  if (!sel) return;
  sel.innerHTML = MS_WORD_FONTS.map(f => `<option value="${escapeHtml(f)}">Font: ${escapeHtml(f)}</option>`).join("");
  sel.value = selectedWordFont;
}
function onDocFontChange() {
  selectedWordFont = document.getElementById("docFontSelect")?.value || "Times New Roman";
  localStorage.setItem("freon_word_font", selectedWordFont);
}
function onPptThemeChange() {
  selectedPptTheme = document.getElementById("pptThemeSelect")?.value || "canva_neon";
  localStorage.setItem("freon_ppt_theme", selectedPptTheme);
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("mobileBackdrop");
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    const isOpen = sidebar.classList.toggle("mobile-open");
    backdrop?.classList.toggle("show", isOpen);
  } else {
    sidebar.classList.toggle("collapsed");
  }
}
function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("mobile-open");
  document.getElementById("mobileBackdrop")?.classList.remove("show");
}
function togglePlusMenu(e) { if (e) e.stopPropagation(); document.getElementById("plusPopover")?.classList.toggle("show"); }
document.addEventListener("click", (e) => {
  const wrap = document.querySelector(".plus-menu-wrap");
  if (wrap && !wrap.contains(e.target)) document.getElementById("plusPopover")?.classList.remove("show");
});

// =========================================================
// FIREBASE CLOUD & AUTHENTICATION
// =========================================================
async function resolveFirebaseUrl() {
  for (const url of FIREBASE_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/config.json`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) { FIREBASE_DB_URL = url; return url; }
    } catch {}
  }
  return FIREBASE_DB_URL;
}
async function dbGet(path) { const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`); if (!res.ok) throw new Error("Cloud error"); return await res.json(); }
async function dbSet(path, data) { const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); return await res.json(); }
async function dbPatch(path, data) { const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); return await res.json(); }
async function dbDelete(path) { await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "DELETE" }); }

function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return `FREON-${suffix}`;
}
function generateRandomCustomerUsername(fullName) {
  const base = String(fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "member";
  return `frn_${base}${Math.floor(1000 + Math.random() * 9000)}`;
}
function generateSystemUID() {
  const year = new Date().getFullYear();
  return `UID-${year}-${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}`;
}
function normalizeWaNumber(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  return digits || DEFAULT_WA_NUMBER;
}

async function initCloudDatabase() {
  try {
    await resolveFirebaseUrl();
    const code = await dbGet("config/activationCode");
    if (!code) await dbSet("config/activationCode", "FREON-2026");
    const waNum = await dbGet("config/whatsappNumber");
    if (waNum) adminWhatsAppNumber = normalizeWaNumber(waNum);
    else await dbSet("config/whatsappNumber", DEFAULT_WA_NUMBER);
    const admins = await dbGet("admins");
    const hasFounder = admins && Object.values(admins).some(a => a && a.isFounder);
    if (!admins || !hasFounder) await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN);
    await loadTrainedModelData();
    await syncFounderBroadcast();
  } catch {}
}

let lastDismissedBroadcastId = "";
async function syncFounderBroadcast() {
  try {
    const info = await dbGet("config/founderBroadcast");
    const mainBanner = document.getElementById("globalBroadcastBanner");
    const mainMsg = document.getElementById("globalBroadcastMessage");
    const mainLink = document.getElementById("globalBroadcastLinkBtn");
    const authBox = document.getElementById("authBroadcastBox");
    const authText = document.getElementById("authBroadcastText");
    const authLink = document.getElementById("authBroadcastLink");

    if (!info || !info.message) {
      if (mainBanner) mainBanner.style.display = "none";
      if (authBox) authBox.style.display = "none";
      return;
    }
    if (authBox && authText) {
      authBox.style.display = "block";
      authText.textContent = info.message;
      if (authLink) { authLink.href = info.url || "#"; authLink.style.display = info.url ? "inline-block" : "none"; }
    }
    if (mainBanner && mainMsg && lastDismissedBroadcastId !== String(info.updatedAt)) {
      mainBanner.style.display = "flex";
      mainMsg.textContent = info.message;
      if (mainLink) { mainLink.href = info.url || "#"; mainLink.style.display = info.url ? "inline-block" : "none"; }
    }
  } catch {}
}
function dismissBroadcastBanner() { document.getElementById("globalBroadcastBanner").style.display = "none"; lastDismissedBroadcastId = String(Date.now()); }

let currentAuthMode = "customer";
async function loadLiveActivationCodeForRegister() {
  const codeTextEl = document.getElementById("registerLiveCodeText");
  if (!codeTextEl) return;
  try {
    const code = await dbGet("config/activationCode");
    currentRegisterLiveCode = String(code || "FREON-2026").toUpperCase();
    codeTextEl.textContent = currentRegisterLiveCode;
  } catch {
    currentRegisterLiveCode = "FREON-2026";
    codeTextEl.textContent = currentRegisterLiveCode;
  }
}
function fillActivationCodeToInput() { const inp = document.getElementById("authActivationCode"); if (inp && currentRegisterLiveCode) inp.value = currentRegisterLiveCode; }

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const badge = document.getElementById("authRoleBadge");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const fullNameGroup = document.getElementById("authFullNameGroup");
  const fullNameInput = document.getElementById("authFullName");
  const usernameGroup = document.getElementById("authUsernameGroup");
  const usernameInput = document.getElementById("authUsername");
  const userLabel = document.getElementById("authUserLabel");
  const submitBtn = document.getElementById("authSubmitBtn");
  const activationGroup = document.getElementById("authActivationGroup");
  const activationInput = document.getElementById("authActivationCode");
  const custToggle = document.getElementById("customerRegisterToggle");
  const adminToggle = document.getElementById("adminSwitchToggle");
  document.getElementById("authErrorBox").style.display = "none";

  if (mode === "admin") {
    badge.textContent = "FOUNDER & CO-FOUNDER PORTAL";
    title.innerHTML = `Login Pengelola<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Akses kontrol untuk 5 Founder Utama & Co-Founder";
    fullNameGroup.style.display = "none"; fullNameInput.required = false;
    usernameGroup.style.display = "block"; usernameInput.required = true;
    userLabel.textContent = "Username Founder / Co-Founder";
    submitBtn.textContent = "Masuk ke Control Panel";
    activationGroup.style.display = "none"; activationInput.required = false;
    custToggle.style.display = "none";
    adminToggle.innerHTML = `Bukan pengelola? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Kembali ke Login Customer</button>`;
  } else if (mode === "register") {
    badge.textContent = "PENDAFTARAN CUSTOMER";
    title.innerHTML = `Daftar Akun<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Isi Nama Lengkap, Password & Kode Aktivasi";
    fullNameGroup.style.display = "block"; fullNameInput.required = true;
    usernameGroup.style.display = "none"; usernameInput.required = false;
    submitBtn.textContent = "Aktivasi & Buat Akun Otomatis";
    activationGroup.style.display = "block"; activationInput.required = true;
    loadLiveActivationCodeForRegister();
    custToggle.style.display = "block";
    custToggle.innerHTML = `Sudah punya akun? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Masuk di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Founder / Co-Founder</button>`;
  } else {
    badge.textContent = "CUSTOMER PORTAL";
    title.innerHTML = `Masuk ke<span class="auth-title-bottom">Freon AI</span>`;
    subtitle.textContent = "Gunakan Username atau UID akun customer Anda";
    fullNameGroup.style.display = "none"; fullNameInput.required = false;
    usernameGroup.style.display = "block"; usernameInput.required = true;
    userLabel.textContent = "Username / UID Customer";
    submitBtn.textContent = "Masuk sebagai Customer";
    activationGroup.style.display = "none"; activationInput.required = false;
    custToggle.style.display = "block";
    custToggle.innerHTML = `Belum punya akun customer? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('register')">Daftar di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Founder / Co-Founder</button>`;
  }
}

function showAuthError(msg) {
  const errBox = document.getElementById("authErrorBox");
  errBox.innerHTML = msg;
  errBox.style.display = "block";
}

document.getElementById("authForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const lockCheck = checkLoginLocked();
  if (lockCheck.locked) {
    showAuthError(`🔒 Terlalu banyak percobaan login salah (5/5). Silakan coba lagi dalam <strong>${lockCheck.remainingText}</strong>.`);
    return;
  }

  const fullNameVal = document.getElementById("authFullName").value.trim();
  const unameInput = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value.trim();
  const submitBtn = document.getElementById("authSubmitBtn");
  submitBtn.disabled = true;
  const oldText = submitBtn.textContent;
  submitBtn.textContent = "Menghubungkan...";

  try {
    await resolveFirebaseUrl();
    if (currentAuthMode === "admin") {
      const userKey = unameInput.toLowerCase().replace(/[.#$/[\]]/g, "_");
      let adminData = await dbGet(`admins/${userKey}`);
      if (!adminData && userKey === "franky" && pass === DEFAULT_FOUNDER_ADMIN.password) {
        await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN);
        adminData = DEFAULT_FOUNDER_ADMIN;
      }
      if (adminData && adminData.password === pass) {
        resetLoginAttempts();
        await loginSuccess({
          fullName: adminData.username, username: adminData.username, userKey,
          role: "admin", isFounder: !!adminData.isFounder,
          isPrimaryFounder: !!adminData.isPrimaryFounder || userKey === "franky",
          exclusiveUnlocked: true, premiumUnlocked: true, flagshipUnlocked: true,
          remainingMinutes: 999999, vipStartDate: "Lifetime Founder"
        });
      } else {
        const failRes = recordFailedLoginAttempt();
        showAuthError(failRes.locked
          ? "🔒 Anda salah 5 kali! Login dikunci otomatis selama <strong>1 jam</strong>."
          : `Username atau password Pengelola salah! (Percobaan salah: <strong>${failRes.fails}/5</strong>)`);
      }
      return;
    }

    if (currentAuthMode === "register") {
      const inputCode = document.getElementById("authActivationCode").value.trim().toUpperCase();
      const activeCode = await dbGet("config/activationCode");
      if (!activeCode || inputCode !== String(activeCode).toUpperCase()) {
        await loadLiveActivationCodeForRegister();
        showAuthError("Kode Aktivasi salah atau sudah terpakai!");
        return;
      }
      let randomUsername = generateRandomCustomerUsername(fullNameVal);
      let userKey = randomUsername.toLowerCase();
      const generatedUID = generateSystemUID();
      const todayStr = new Date().toISOString().slice(0, 10);
      const initialMinutes = 120;

      await dbSet(`customers/${userKey}`, {
        fullName: fullNameVal, username: randomUsername, uid: generatedUID, password: pass,
        remainingMinutes: initialMinutes, vipStartDate: todayStr,
        status: "active", banReason: "", warningMessage: "",
        exclusiveUnlocked: false, premiumUnlocked: false, flagshipUnlocked: false
      });
      await dbSet("config/activationCode", generateRandomCode());
      resetLoginAttempts();
      alert(`✅ Pendaftaran Berhasil!\n• Username: ${randomUsername}\n• UID: ${generatedUID}\n• Bonus Waktu Aktif: 2 Jam`);
      await loginSuccess({
        fullName: fullNameVal, username: randomUsername, uid: generatedUID, userKey,
        role: "customer", remainingMinutes: initialMinutes, vipStartDate: todayStr,
        exclusiveUnlocked: false, premiumUnlocked: false, flagshipUnlocked: false
      });
      return;
    }

    const cleanLookup = unameInput.toLowerCase().replace(/[.#$/[\]]/g, "_");
    let found = await dbGet(`customers/${cleanLookup}`);
    let foundKey = cleanLookup;
    if (!found) {
      const allCustomers = await dbGet("customers");
      if (allCustomers && typeof allCustomers === "object") {
        for (const [k, val] of Object.entries(allCustomers)) {
          if (val && (String(val.username).toLowerCase() === unameInput.toLowerCase() || String(val.uid).toLowerCase() === unameInput.toLowerCase())) {
            found = val; foundKey = k; break;
          }
        }
      }
    }
    if (!found || found.password !== pass) {
      const failRes = recordFailedLoginAttempt();
      showAuthError(failRes.locked
        ? "🔒 Anda salah login 5 kali! Akun dikunci selama <strong>1 jam</strong> sebelum di-reset otomatis."
        : `Username / UID atau password salah! (Percobaan salah: <strong>${failRes.fails}/5</strong>)`);
      return;
    }
    if (found.status === "suspended") {
      showAuthError(`🚫 Akun di-BANNED. Alasan: ${escapeHtml(found.banReason || "-")}`);
      return;
    }

    resetLoginAttempts();
    const remMins = found.remainingMinutes !== undefined ? Number(found.remainingMinutes) : Math.max(0, Math.round(Number(found.quota || 0) / 100));
    await loginSuccess({
      fullName: found.fullName || found.username, username: found.username, uid: found.uid || "-",
      userKey: foundKey, role: "customer",
      remainingMinutes: remMins,
      vipStartDate: found.vipStartDate || "-",
      exclusiveUnlocked: !!found.exclusiveUnlocked,
      premiumUnlocked: !!found.premiumUnlocked,
      flagshipUnlocked: !!found.flagshipUnlocked,
      warningMessage: found.warningMessage || ""
    });
  } catch {
    showAuthError("Gagal koneksi ke server Cloud.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
});

async function loginSuccess(userObj) {
  activeUser = userObj;
  sessionStorage.setItem("freon_active_session", JSON.stringify(userObj));
  document.getElementById("authOverlay").classList.add("hidden");
  loadUserCommandData();
  populateEngineDropdown();
  applyUserUI();
  await syncFounderBroadcast();
  await loadUserMemoriesFromCloud();
  await initWorkspace();
  startLiveTimeCountdown();
  if (userObj.role === "customer" && userObj.warningMessage) showWarningPopup(userObj.warningMessage);
}

function logoutUser() {
  activeUser = null;
  impersonatedFromAdmin = null;
  document.getElementById("impersonateBanner").style.display = "none";
  if (timeCountdownInterval) clearInterval(timeCountdownInterval);
  sessionStorage.removeItem("freon_active_session");
  closeMobileSidebar();
  switchAuthMode("customer");
  document.getElementById("authOverlay").classList.remove("hidden");
}

function applyUserUI() {
  if (!activeUser) return;
  const avatar = document.getElementById("sidebarUserAvatar");
  const nameEl = document.getElementById("sidebarUserName");
  const roleEl = document.getElementById("sidebarUserRole");
  const adminTopBtn = document.getElementById("adminPanelTopBtn");
  const founderTrainerBtn = document.getElementById("founderTrainerTopBtn");
  const timeEl = document.getElementById("sidebarTimeDisplay");
  const vipStartEl = document.getElementById("sidebarVipStartDisplay");

  const displayName = activeUser.fullName || activeUser.username;
  nameEl.textContent = displayName;
  avatar.textContent = displayName.charAt(0).toUpperCase();

  if (founderTrainerBtn) founderTrainerBtn.style.display = isCurrentUserFounder() ? "inline-flex" : "none";

  if (activeUser.role === "admin" && !impersonatedFromAdmin) {
    avatar.classList.add("admin-avatar");
    roleEl.textContent = activeUser.isFounder ? "👑 Founder Utama" : "🤝 Co-Founder";
    adminTopBtn.style.display = "inline-flex";
    if (timeEl) timeEl.textContent = "∞ Unlimited";
    if (vipStartEl) vipStartEl.textContent = "Founder Access";
  } else {
    avatar.classList.remove("admin-avatar");
    roleEl.textContent = `${activeUser.username} • ${activeUser.uid || "Customer"}`;
    adminTopBtn.style.display = impersonatedFromAdmin ? "inline-flex" : "none";
    if (timeEl) timeEl.textContent = formatMinutesToDHM(activeUser.remainingMinutes || 0);
    if (vipStartEl) vipStartEl.textContent = activeUser.vipStartDate || "-";
  }
  updateTierBadgesUI();
}

function showWarningPopup(msg) {
  document.getElementById("warningMessageContent").innerHTML = escapeHtml(msg).replace(/\n/g, "<br>");
  document.getElementById("warningModalOverlay").classList.add("show");
}
async function acknowledgeAdminWarning() {
  document.getElementById("warningModalOverlay").classList.remove("show");
  if (activeUser && activeUser.role === "customer" && !impersonatedFromAdmin) {
    activeUser.warningMessage = "";
    try { await dbPatch(`customers/${activeUser.userKey}`, { warningMessage: "" }); } catch {}
  }
}

function startLiveTimeCountdown() {
  if (timeCountdownInterval) clearInterval(timeCountdownInterval);
  if (!activeUser) return;
  let tickSeconds = 0;

  timeCountdownInterval = setInterval(async () => {
    try {
      tickSeconds += 5;
      await syncFounderBroadcast();

      if (activeUser.role === "customer" && !impersonatedFromAdmin) {
        const cust = await dbGet(`customers/${activeUser.userKey}`);
        if (cust) {
          if (cust.status === "suspended") { logoutUser(); return; }
          let currentMins = cust.remainingMinutes !== undefined ? Number(cust.remainingMinutes) : Number(activeUser.remainingMinutes || 0);
          if (tickSeconds >= 60 && currentMins > 0) {
            tickSeconds = 0;
            currentMins = Math.max(0, currentMins - 1);
            await dbPatch(`customers/${activeUser.userKey}`, { remainingMinutes: currentMins });
          }
          activeUser.remainingMinutes = currentMins;
          activeUser.vipStartDate = cust.vipStartDate || activeUser.vipStartDate || "-";
          activeUser.exclusiveUnlocked = !!cust.exclusiveUnlocked;
          activeUser.premiumUnlocked = !!cust.premiumUnlocked;
          const prevFlagship = !!activeUser.flagshipUnlocked;
          activeUser.flagshipUnlocked = !!cust.flagshipUnlocked;
          if (prevFlagship !== activeUser.flagshipUnlocked) populateEngineDropdown();
          applyUserUI();
        }
      }
      if (currentHistoryTab === "global") await renderGlobalSearchHistory();
    } catch {}
  }, 5000);
}

// =========================================================
// ENGINE FREON & KONTROL AKSES FLAGSHIP KHUSUS FOUNDER
// =========================================================
const _INTERNAL_MODEL_MAP = {
  hybrid_1_1: atob("ZGVlcHNlZWsvZGVlcHNlZWstdjQtcHJv"),
  flash_1_1: atob("ZGVlcHNlZWsvZGVlcHNlZWstdjQtZmxhc2g="),
  flash_1_2: atob("ZGVlcHNlZWsvZGVlcHNlZWstdjQuMS1mbGFzaC0xMDE3"),
  sonic_2_1: atob("YW50aHJvcGljL2hhaWt1LTUuNQ==")
};

const FREON_ENGINES = {
  hybrid_1_1: {
    label: "FREON 1.1 Hybrid • Pro",
    temperature: 0.6,
    flagshipOnly: false,
    persona: "Kamu berjalan di arsitektur eksklusif FREON 1.1 Hybrid yang dikembangkan oleh Franky (Founder FREON AI)."
  },
  flash_1_1: {
    label: "FREON 1.1 Flash • Rapid",
    temperature: 0.4,
    flagshipOnly: false,
    persona: "Kamu berjalan di arsitektur eksklusif FREON 1.1 Flash yang dikembangkan oleh Franky (Founder FREON AI)."
  },
  flash_1_2: {
    label: "FREON 1.2 Flash-X • Vision",
    temperature: 0.5,
    flagshipOnly: false,
    persona: "Kamu berjalan di arsitektur eksklusif FREON 1.2 Flash-X yang dikembangkan oleh Franky (Founder FREON AI)."
  },
  sonic_2_1: {
    label: "👑 FREON 2.1 Sonic • Flagship (Sewa / Izin Founder)",
    temperature: 0.75,
    flagshipOnly: true,
    persona: "Kamu berjalan di arsitektur flagship tertinggi FREON 2.1 Sonic yang dikembangkan oleh Franky (Founder FREON AI)."
  }
};

function canUseFlagship() {
  if (!activeUser) return false;
  if (activeUser.role === "admin" && !impersonatedFromAdmin) return true;
  return !!activeUser.flagshipUnlocked;
}

function populateEngineDropdown() {
  const select = document.getElementById("modelSelect");
  if (!select) return;
  const allowedFlagship = canUseFlagship();
  select.innerHTML = Object.entries(FREON_ENGINES)
    .map(([key, cfg]) => `<option value="${key}">${escapeHtml(cfg.label)}${cfg.flagshipOnly && !allowedFlagship ? " 🔒" : ""}</option>`)
    .join("");
  select.value = "hybrid_1_1";
}

function getCurrentEngine() {
  const select = document.getElementById("modelSelect");
  let key = select?.value && FREON_ENGINES[select.value] ? select.value : "hybrid_1_1";
  if (FREON_ENGINES[key]?.flagshipOnly && !canUseFlagship()) {
    key = "hybrid_1_1";
    if (select) select.value = key;
  }
  return { key, ...FREON_ENGINES[key] };
}

function onEngineChange() {
  const select = document.getElementById("modelSelect");
  if (select?.value === "sonic_2_1" && !canUseFlagship()) {
    select.value = "hybrid_1_1";
    openLockPrompt("flagship", "FREON 2.1 Sonic • Flagship Engine");
    return;
  }
  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
}

async function callFreonNeuralCore(engineKey, messagesPayload, temperature = 0.6, abortSignal = null, useFallback = true) {
  const sanitizedMessages = messagesPayload.map(msg => {
    if (Array.isArray(msg.content)) {
      const textPart = msg.content.find(c => c.type === "text")?.text || "";
      return { role: msg.role, content: textPart };
    }
    return msg;
  });

  const token = _resolveGatewayToken();
  const tryRequest = async (resolvedModelId, payloadMsgs) => {
    return await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ model: resolvedModelId, messages: payloadMsgs, temperature, max_tokens: 4096 }),
      signal: abortSignal
    });
  };

  const primaryId = _INTERNAL_MODEL_MAP[engineKey] || _INTERNAL_MODEL_MAP.hybrid_1_1;
  let res = await tryRequest(primaryId, messagesPayload);
  if (!res.ok && useFallback) res = await tryRequest(_INTERNAL_MODEL_MAP.hybrid_1_1, messagesPayload);
  if (!res.ok && useFallback) res = await tryRequest(_INTERNAL_MODEL_MAP.flash_1_1, sanitizedMessages);
  return res;
}

// =========================================================
// MODUL & KATALOG FITUR
// =========================================================
const MODULES_CONFIG = {
  general: {
    badge: "✦ FREON Core • Cloud Sync & Canva",
    title: "Apa yang bisa FREON bantu?",
    desc: "Riwayat chat tersimpan online otomatis di akun Anda, PowerPoint animasi interaktif & siap edit di Canva, pembaca PDF/DOCX asli, dokumen Word semua font, & Video Call 16 Karakter Anime.",
    placeholder: "Tanya data Google/Internet, buat PPT animasi siap edit Canva, atau upload PDF/DOCX/gambar...",
    instruction: "Jawab cerdas, tajam, dan gunakan data internet real-time yang diberikan bila relevan.",
    starters: [
      { title: "🎨 PowerPoint Animasi & Siap Canva (.pptx)", sub: "Interactive Animated Player + Multi-Layout 16:9", mod: "office", prompt: "Buatkan presentasi PowerPoint (.pptx) desain mewah 8 slide siap edit Canva tentang Strategi Bisnis Digital 2026" },
      { title: "✨ Buka Template Canva Studio", sub: "Pilih tema Pitch Deck, Kuliah, atau Bisnis", action: "canvastudio" },
      { title: "📹 Video Call 16 Karakter Anime", sub: "Naruto, Hinata, Gojo, Luffy, Tanjiro + Suara", action: "videocall" },
      { title: "📂 Upload PDF, DOCX & Gambar (15+ File)", sub: "Baca dokumen asli & analisis puluhan file sekaligus", action: "multiupload" }
    ]
  },
  agent: {
    badge: "🤖 AI Agent Otonom",
    title: "FREON Autonomous AI Agent",
    desc: "Agen otonom dengan riset internet langsung hingga menghasilkan dokumen Word/PPTX.",
    placeholder: "Berikan misi kompleks untuk dieksekusi bertahap...",
    instruction: "Pecah permintaan user menjadi rencana langkah demi langkah dan selesaikan sampai tuntas.",
    starters: [
      { title: "📊 Agent Riset & Slide Canva", sub: "Riset internet + susun presentasi .pptx", prompt: "Jalankan AI Agent: Riset tren energi terbarukan dan buatkan presentasi PowerPoint desain mewah" },
      { title: "📝 Agent Laporan Word Resmi", sub: "Analisis lengkap + ekspor .doc", prompt: "Jalankan AI Agent: Susun laporan analisis pasar teknologi dan ekspor ke dokumen Word" }
    ]
  },
  coding: {
    badge: "💻 Web, Game & Code",
    title: "FREON Coding, Web & Game Studio",
    desc: "Bangun website modern & game HTML interaktif dengan Live Preview.",
    placeholder: "Minta dibuatkan website, game HTML, atau perbaiki kode...",
    instruction: "Berikan kode lengkap dalam satu blok ```html agar bisa dijalankan via Live Preview.",
    starters: [
      { title: "🕹️ Pembuat Game HTML", sub: "Game arcade langsung main di browser", prompt: "Buatkan game HTML tangkap bintang neon dengan skor dalam satu file HTML lengkap" },
      { title: "🌐 Website Landing Page", sub: "Desain modern responsif", prompt: "Buatkan website landing page startup AI modern dark mode dalam satu file HTML lengkap" }
    ]
  },
  office: {
    badge: "🎨 Canva PPTX, Word & XLS",
    title: "FREON Office & Canva-Grade Studio",
    desc: "Buat PowerPoint (.pptx) berdesain grafis animasi yang bisa langsung diputar di layar & diedit di Canva, dokumen Word semua font, & Excel.",
    placeholder: "Minta dibuatkan PPT animasi siap edit Canva, dokumen Word, atau Excel...",
    instruction: "Susun presentasi secara profesional dengan struktur slide yang kaya, angka/metrik nyata, dan poin padat.",
    starters: [
      { title: "🎨 Slide PPTX Animasi Siap Canva", sub: "8 slide 16:9 tata letak dinamis", prompt: "Buatkan presentasi PowerPoint (.pptx) 8 slide tentang Inovasi Startup Masa Depan" },
      { title: "✨ Pilih Tema Canva Studio", sub: "Pitch Deck, Hukum, Bisnis & Portofolio", action: "canvastudio" }
    ]
  },
  image: {
    badge: "🖼️ Image & Logo Studio",
    title: "FREON Visual Design Studio",
    desc: "Buat gambar HD, logo brand, desain poster, hingga ilustrasi digital.",
    placeholder: "Deskripsikan gambar, logo, atau poster yang ingin dibuat...",
    instruction: "Bantu user merancang konsep visual dan generate gambar HD.",
    starters: [
      { title: "🛡️ AI Logo Maker", sub: "Logo brand & esports futuristik", prompt: "Buatkan gambar desain logo minimalis futuristik warna ungu neon dan biru" },
      { title: "🌃 Cyberpunk City HD", sub: "Ilustrasi kota neon resolusi tinggi", prompt: "Buatkan gambar kota futuristik malam hari dengan lampu neon ungu dan biru" }
    ]
  },
  video: {
    badge: "🎬 Video & Multi-Tugas",
    title: "FREON Video & Tugas Studio",
    desc: "Kirim tugas menggunakan banyak file atau video sekaligus.",
    placeholder: "Upload video tugas atau deskripsikan konsep video...",
    instruction: "Bantu analisis tugas video dan buat script video.",
    starters: [
      { title: "🎬 Kirim Tugas Pakai Video", sub: "Upload video soal untuk dianalisis AI", action: "videotask" },
      { title: "📱 Script Konten TikTok", sub: "Hook viral 30 detik + caption", prompt: "Buatkan script video TikTok 30 detik tentang tips produktif memakai AI" }
    ]
  },
  music: {
    badge: "🎵 Music Composer",
    title: "FREON AI Music Composer",
    desc: "Ciptakan lirik, struktur akor, dan aransemen musik original.",
    placeholder: "Sebutkan genre/suasana musik...",
    instruction: "Buat komposisi lirik, struktur akor, dan aransemen musik original.",
    starters: [
      { title: "🎹 Cyber Synthwave", sub: "Melodi elektronik futuristik", prompt: "Buatkan komposisi musik original bertema Cyber Synthwave tempo 118 BPM" }
    ]
  },
  finance: {
    badge: "💰 Keuangan & Jadwal",
    title: "FREON Finance & Productivity Planner",
    desc: "Kelola anggaran, proyeksi bisnis, dan jadwal produktif harian.",
    placeholder: "Masukkan data keuangan atau jadwal...",
    instruction: "Berikan perhitungan akurat, tabel ringkas, dan langkah praktis.",
    starters: [
      { title: "💵 Anggaran Bulanan 50/30/20", sub: "Hitung pemasukan & tabungan", prompt: "Buatkan perencanaan anggaran bulanan untuk gaji Rp 6.000.000" }
    ]
  },
  research: {
    badge: "🌐 Riset Internet & Tutor",
    title: "FREON Live Internet Research & Tutor",
    desc: "Mengambil referensi dari internet secara otomatis untuk menjawab riset & materi belajar.",
    placeholder: "Tanyakan berita, fakta dunia, atau materi pelajaran...",
    instruction: "Gunakan data internet yang tersedia untuk memberikan jawaban akurat dan akademis.",
    starters: [
      { title: "🌍 Riset Fakta & Berita Dunia", sub: "Mengambil data terbaru dari internet", prompt: "Carikan data dan fakta terbaru tentang perkembangan kecerdasan buatan global" }
    ]
  }
};

function selectModule(modKey, resetToWelcome = true) {
  currentModule = MODULES_CONFIG[modKey] ? modKey : "general";
  const cfg = MODULES_CONFIG[currentModule];
  document.querySelectorAll(".module-item").forEach(btn => btn.classList.toggle("active", btn.dataset.mod === currentModule));
  const badgeEl = document.getElementById("activeModuleBadge");
  if (badgeEl) badgeEl.textContent = cfg.badge;
  const inputEl = document.getElementById("userInput");
  if (inputEl && cfg.placeholder) inputEl.placeholder = cfg.placeholder;
  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
  if (resetToWelcome && (!activeSessionId || !sessions[activeSessionId] || sessions[activeSessionId].messages.length === 0)) {
    renderWelcomeScreen();
  }
  closeMobileSidebar();
}

function quickSwitchModule(modKey, prefillText = "") {
  document.getElementById("plusPopover")?.classList.remove("show");
  selectModule(modKey, false);
  const inp = document.getElementById("userInput");
  if (inp) { inp.value = prefillText; inp.focus(); }
}

const FEATURES_CATALOG = {
  pintar: {
    label: "🧠 AI Pintar", tier: "free",
    items: [
      { title: "Live Google & Internet Knowledge", desc: "Otomatis mengambil data terbaru dari internet.", mod: "research", prompt: "Carikan informasi terbaru dari internet tentang: " },
      { title: "Video Call 16 Karakter Anime (Bersuara)", desc: "Naruto, Hinata, Gojo, Luffy, Tanjiro, Levi + suara.", action: "videocall" },
      { title: "Multi-File Upload (PDF, DOCX, Gambar)", desc: "Baca isi PDF & Word asli + puluhan file sekaligus.", action: "multiupload" },
      { title: "Voice Assistant", desc: "Bicara langsung lewat mikrofon.", action: "voice" }
    ]
  },
  produktivitas: {
    label: "📊 Produktivitas", tier: "free",
    items: [
      { title: "Canva-Grade Animated PowerPoint (.pptx)", desc: "Slide animasi interaktif 16:9 siap edit di Canva.", action: "canvastudio" },
      { title: "Dokumen Word Pro (.doc)", desc: "Tata letak kop dokumen resmi & 18+ font MS Word.", mod: "office", prompt: "Buatkan dokumen Word (.doc) resmi tentang " },
      { title: "Excel Spreadsheet (.xls)", desc: "Tabel anggaran & data terstruktur.", mod: "office", prompt: "Buatkan tabel anggaran dan simpan ke file laporan.xls" }
    ]
  },
  kreatif: {
    label: "🎨 Kreatif", tier: "free",
    items: [
      { title: "AI Image & Logo Generator", desc: "Ubah teks menjadi gambar HD & logo.", mod: "image", prompt: "Buatkan gambar logo futuristik warna ungu neon dan biru" },
      { title: "Web & Game HTML Live Preview", desc: "Aplikasi & game langsung main di browser.", mod: "coding", prompt: "Buatkan game arcade HTML interaktif dalam satu file HTML lengkap" }
    ]
  },
  eksklusif: {
    label: "💎 Eksklusif", tier: "exclusive",
    items: [
      { title: "Deep Research & Analisis Bisnis", desc: "Analisis SWOT, BMC, dan proyeksi profit.", mod: "finance", prompt: "[ANALISIS BISNIS] Buatkan analisis SWOT untuk: " }
    ]
  },
  premium: {
    label: "👑 VIP & Flagship", tier: "flagship",
    items: [
      { title: "🚀 FREON 2.1 Sonic • Flagship Engine", desc: "Mesin AI tertinggi (Khusus Founder / Sewa Izin Founder).", action: "flagship" },
      { title: "Memory Center & Cloud History", desc: "Sinkronisasi memori & riwayat chat lintas perangkat.", action: "memory" }
    ]
  }
};

function hasTierAccess(tier) {
  if (!activeUser) return false;
  if (activeUser.role === "admin" && !impersonatedFromAdmin) return true;
  if (tier === "free") return true;
  if (tier === "exclusive") return !!activeUser.exclusiveUnlocked;
  if (tier === "premium") return !!activeUser.premiumUnlocked;
  if (tier === "flagship") return !!activeUser.flagshipUnlocked;
  return false;
}
function updateTierBadgesUI() {
  const exclLock = document.getElementById("sidebarExclLock");
  const premLock = document.getElementById("sidebarPremLock");
  if (exclLock) exclLock.textContent = hasTierAccess("exclusive") ? "✅" : "🔒";
  if (premLock) premLock.textContent = (hasTierAccess("premium") || hasTierAccess("flagship")) ? "✅" : "🔒";
}
function openTierCategory(catKey) { closeMobileSidebar(); openFeaturesModal(catKey); }
function openFeaturesModal(defaultCat = "pintar") { closeMobileSidebar(); document.getElementById("featuresModalOverlay").classList.add("show"); switchFeatureTab(defaultCat); }
function closeFeaturesModal() { document.getElementById("featuresModalOverlay").classList.remove("show"); }

function switchFeatureTab(catKey) {
  const cat = FEATURES_CATALOG[catKey] || FEATURES_CATALOG.pintar;
  document.querySelectorAll(".cat-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.cat === catKey));
  const banner = document.getElementById("tierStatusBanner");
  const unlocked = hasTierAccess(cat.tier);
  if (cat.tier !== "free") {
    banner.className = "tier-banner show";
    banner.innerHTML = unlocked
      ? `<span>✅ <strong>Akses ${cat.label} AKTIF!</strong></span>`
      : `<span>🔒 <strong>${cat.label} Terkunci.</strong> Hanya dapat diaktifkan/disewakan oleh Founder.</span><button type="button" class="tbl-btn active" onclick="openLockPrompt('${cat.tier}')">📩 Minta Izin / Sewa</button>`;
  } else {
    banner.className = "tier-banner";
  }
  document.getElementById("featureCardsGrid").innerHTML = cat.items.map((item, idx) => `
    <div class="feat-card" onclick='triggerCatalogFeature(${JSON.stringify(catKey)}, ${idx})'>
      <div class="feat-card-top"><span class="feat-card-title">${escapeHtml(item.title)}</span><span>${unlocked ? "▶️" : "🔒"}</span></div>
      <div class="feat-card-desc">${escapeHtml(item.desc)}</div>
    </div>
  `).join("");
}

function triggerCatalogFeature(catKey, idx) {
  const cat = FEATURES_CATALOG[catKey];
  const item = cat?.items?.[idx];
  if (!item) return;
  if (!hasTierAccess(cat.tier)) { openLockPrompt(cat.tier, item.title); return; }
  closeFeaturesModal();
  if (item.action === "canvastudio") return openCanvaStudioModal();
  if (item.action === "videocall") return openAnimeVideoCall();
  if (item.action === "multiupload") return triggerUpload();
  if (item.action === "voice") return toggleVoiceInput();
  if (item.action === "memory") return openJarvisHub("memory");
  if (item.action === "flagship") {
    const sel = document.getElementById("modelSelect");
    if (sel) sel.value = "sonic_2_1";
    return;
  }
  if (item.mod) selectModule(item.mod, false);
  const inp = document.getElementById("userInput");
  if (inp) { inp.value = item.prompt || ""; inp.focus(); }
}

function openLockPrompt(tier, featureName = "") {
  const isFlagship = tier === "flagship";
  document.getElementById("lockModalIcon").textContent = isFlagship ? "🚀" : "💎";
  document.getElementById("lockModalTitle").textContent = isFlagship ? "Fitur Flagship Khusus Founder / Sewa" : "Fitur Terkunci";
  document.getElementById("lockModalHeading").textContent = featureName || (isFlagship ? "FREON 2.1 Sonic • Flagship" : "Paket Eksklusif");
  document.getElementById("lockModalDesc").textContent = "Fitur Flagship hanya dapat diatur oleh Founder Utama. Ajukan izin aktivasi atau sewa paket langsung kepada Founder.";
  document.getElementById("btnRequestTierUnlock").onclick = () => sendUnlockRequestToAdmin(tier);
  document.getElementById("lockModalOverlay").classList.add("show");
}
function closeLockModal() { document.getElementById("lockModalOverlay").classList.remove("show"); }
async function sendUnlockRequestToAdmin(tier) {
  if (!activeUser || activeUser.role !== "customer") return;
  const patchObj = tier === "flagship" ? { requestFlagship: true } : tier === "premium" ? { requestPremium: true } : { requestExclusive: true };
  await dbPatch(`customers/${activeUser.userKey}`, patchObj);
  closeLockModal();
  alert("✅ Permintaan izin / sewa fitur berhasil dikirim ke Founder!");
}

// =========================================================
// ONLINE CLOUD CHAT HISTORY & AUTO-MEMORY SYNC (FIREBASE + LOCAL)
// =========================================================
function getSafeCloudUserKey() {
  const raw = activeUser?.userKey || activeUser?.username || "guest";
  return String(raw).toLowerCase().replace(/[.#$/[\]]/g, "_");
}
function getUserStorageKey() { return `freon_sessions_${getSafeCloudUserKey()}`; }
function getMemoryStorageKey() { return `freon_memories_${getSafeCloudUserKey()}`; }

function getUserMemories() {
  try { return JSON.parse(localStorage.getItem(getMemoryStorageKey()) || "[]"); }
  catch { return []; }
}

async function loadUserMemoriesFromCloud() {
  const cloudKey = getSafeCloudUserKey();
  if (!cloudKey || cloudKey === "guest") return;
  try {
    const cloudMems = await dbGet(`userMemories/${cloudKey}`);
    if (Array.isArray(cloudMems) && cloudMems.length > 0) {
      const merged = Array.from(new Set([...cloudMems, ...getUserMemories()])).slice(0, 40);
      localStorage.setItem(getMemoryStorageKey(), JSON.stringify(merged));
    }
  } catch {}
}

function syncUserMemoriesToCloud(list) {
  const cloudKey = getSafeCloudUserKey();
  if (!cloudKey || cloudKey === "guest") return;
  dbSet(`userMemories/${cloudKey}`, list).catch(() => {});
}

function saveUserMemory(fact) {
  const list = getUserMemories();
  if (!list.includes(fact)) {
    list.unshift(fact);
    const trimmed = list.slice(0, 40);
    localStorage.setItem(getMemoryStorageKey(), JSON.stringify(trimmed));
    syncUserMemoriesToCloud(trimmed);
  }
}

function autoExtractUserMemory(text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const patterns = [
    /\b(nama\s*(gw|gua|saya|aku)\s*(adalah)?\s+[a-zA-Z0-9\s]{2,25})/i,
    /\b((gw|gua|saya|aku)\s*(tinggal|kuliah|kerja|hobi|suka|punya|sedang)\s+[^.!?\n]{3,60})/i,
    /\b(ingat\s+[^.!?\n]{3,100})/i
  ];
  for (const rx of patterns) {
    const match = clean.match(rx);
    if (match && match[1]) {
      saveUserMemory(match[1].trim());
    }
  }
}

// Sanitasi objek sesi agar ringan & valid untuk Firebase Realtime Database
function buildCloudSafeSession(sess) {
  return {
    id: sess.id,
    title: sess.title || "Obrolan Baru",
    module: sess.module || "general",
    updatedAt: sess.updatedAt || Date.now(),
    messages: (sess.messages || []).map(m => ({
      role: m.role,
      content: String(m.content || ""),
      engineLabel: m.engineLabel || "",
      // Hindari menyimpan base64 gambar raksasa ke Firebase agar tidak ditolak kuota payload
      images: Array.isArray(m.images) ? m.images.filter(u => typeof u === "string" && !u.startsWith("data:")).slice(0, 5) : [],
      extraMedia: m.extraMedia ? {
        type: m.extraMedia.type || "",
        url: (m.extraMedia.url && !String(m.extraMedia.url).startsWith("data:")) ? m.extraMedia.url : "",
        filename: m.extraMedia.filename || "",
        deckData: m.extraMedia.deckData || null,
        content: m.extraMedia.content || "",
        font: m.extraMedia.font || ""
      } : null
    }))
  };
}

function saveSessionsLocal() {
  try { localStorage.setItem(getUserStorageKey(), JSON.stringify(sessions)); } catch {}
  const cloudKey = getSafeCloudUserKey();
  if (!cloudKey || cloudKey === "guest" || !activeSessionId || !sessions[activeSessionId]) return;
  const payload = buildCloudSafeSession(sessions[activeSessionId]);
  dbSet(`userSessions/${cloudKey}/${activeSessionId}`, payload).catch(() => {});
}

async function initWorkspace() {
  let localSessions = {};
  try { localSessions = JSON.parse(localStorage.getItem(getUserStorageKey()) || "{}"); } catch { localSessions = {}; }

  const cloudKey = getSafeCloudUserKey();
  let cloudSessions = {};
  if (cloudKey && cloudKey !== "guest") {
    try {
      const fetched = await dbGet(`userSessions/${cloudKey}`);
      if (fetched && typeof fetched === "object") {
        cloudSessions = fetched;
      }
    } catch {}
  }

  // Gabungkan riwayat lokal & online (prioritaskan versi terbaru berdasarkan updatedAt)
  sessions = { ...localSessions };
  for (const [sid, cSess] of Object.entries(cloudSessions)) {
    if (!cSess || typeof cSess !== "object") continue;
    const normalizedCloud = {
      id: cSess.id || sid,
      title: cSess.title || "Obrolan Baru",
      module: cSess.module || "general",
      updatedAt: cSess.updatedAt || Date.now(),
      messages: Array.isArray(cSess.messages) ? cSess.messages : []
    };
    if (!sessions[sid] || (normalizedCloud.updatedAt >= (sessions[sid].updatedAt || 0))) {
      sessions[sid] = normalizedCloud;
    }
  }

  try { localStorage.setItem(getUserStorageKey(), JSON.stringify(sessions)); } catch {}

  const sortedIds = Object.keys(sessions).sort((a, b) => (sessions[a].updatedAt || 0) - (sessions[b].updatedAt || 0));
  if (sortedIds.length > 0) {
    activeSessionId = sortedIds[sortedIds.length - 1];
    loadSession(activeSessionId);
  } else {
    createNewSession(currentModule || "general");
  }
  renderHistoryList();
}

function createNewSession(modKey = "general") {
  const id = "sess_" + Date.now();
  sessions[id] = { id, title: "Obrolan Baru", module: modKey, updatedAt: Date.now(), messages: [] };
  activeSessionId = id;
  chatHistory = [buildSystemPrompt()];
  saveSessionsLocal();
  selectModule(modKey, false);
  renderWelcomeScreen();
  renderHistoryList();
}

function loadSession(id) {
  if (!sessions[id]) return;
  activeSessionId = id;
  const sess = sessions[id];
  const msgs = Array.isArray(sess.messages) ? sess.messages : [];
  selectModule(sess.module || "general", false);
  chatHistory = [buildSystemPrompt(), ...msgs.map(m => ({ role: m.role, content: m.content }))];
  const container = document.getElementById("chatContainer");
  container.innerHTML = "";
  if (msgs.length === 0) renderWelcomeScreen();
  else msgs.forEach(m => m.role === "user" ? appendUserBubble(m.content, m.images || [], m.videos || []) : appendAIBubble(m.content, m.engineLabel || "FREON Core", m.extraMedia || null));
  renderHistoryList();
  closeMobileSidebar();
}

function deleteSession(id, e) {
  if (e) e.stopPropagation();
  delete sessions[id];
  try { localStorage.setItem(getUserStorageKey(), JSON.stringify(sessions)); } catch {}
  const cloudKey = getSafeCloudUserKey();
  if (cloudKey && cloudKey !== "guest") {
    dbDelete(`userSessions/${cloudKey}/${id}`).catch(() => {});
  }
  const remaining = Object.keys(sessions);
  if (remaining.length > 0) loadSession(remaining[remaining.length - 1]);
  else createNewSession(currentModule);
}

function switchHistoryTab(tab) {
  currentHistoryTab = tab;
  document.getElementById("tabMyHistory")?.classList.toggle("active", tab === "mine");
  document.getElementById("tabGlobalHistory")?.classList.toggle("active", tab === "global");
  if (tab === "global") renderGlobalSearchHistory();
  else renderHistoryList();
}

function renderHistoryList() {
  if (currentHistoryTab === "global") return renderGlobalSearchHistory();
  const listEl = document.getElementById("historyList");
  if (!listEl) return;
  const arr = Object.values(sessions).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (arr.length === 0) { listEl.innerHTML = `<div style="font-size:12px;color:#64748b;padding:8px;">Belum ada riwayat obrolan.</div>`; return; }
  listEl.innerHTML = arr.map(s => `
    <div class="history-item ${s.id === activeSessionId ? "active" : ""}" onclick='loadSession(${JSON.stringify(s.id)})'>
      <span class="title-text">${escapeHtml(s.title || "Obrolan Baru")}</span>
      <span class="del-chat" onclick='deleteSession(${JSON.stringify(s.id)}, event)'>✕</span>
    </div>
  `).join("");
}

async function logGlobalSearchCloud(queryText) {
  if (!activeUser || !queryText) return;
  try { await dbSet(`globalSearches/g_${Date.now()}`, { user: activeUser.fullName || activeUser.username, query: queryText.slice(0, 120), time: Date.now() }); } catch {}
}

async function renderGlobalSearchHistory() {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;
  try {
    const data = await dbGet("globalSearches");
    if (!data || typeof data !== "object") { listEl.innerHTML = `<div style="font-size:12px;color:#64748b;padding:8px;">Belum ada aktivitas global.</div>`; return; }
    const items = Object.values(data).sort((a, b) => (b.time || 0) - (a.time || 0)).slice(0, 20);
    listEl.innerHTML = items.map(it => `
      <div class="global-search-card" onclick='useGlobalPrompt(${JSON.stringify(it.query || "")})'>
        <div class="global-search-user"><span>@${escapeHtml(it.user || "User")}</span><span>Live</span></div>
        <div class="global-search-q">${escapeHtml(it.query || "")}</div>
      </div>
    `).join("");
  } catch {}
}
function useGlobalPrompt(q) { const inp = document.getElementById("userInput"); if (inp) { inp.value = q; inp.focus(); } }

function renderWelcomeScreen() {
  const container = document.getElementById("chatContainer");
  if (!container) return;
  const cfg = MODULES_CONFIG[currentModule] || MODULES_CONFIG.general;
  container.innerHTML = `
    <div class="welcome-screen">
      <div class="jarvis-orb-stage">
        <div class="ai-orb-container" id="jarvisMainOrb" onclick="toggleVoiceInput()" title="Klik AI Orb untuk Voice Assistant">
          <div class="ai-orb-ring ring-1"></div>
          <div class="ai-orb-ring ring-2"></div>
          <div class="ai-orb-core"></div>
        </div>
      </div>
      <div class="made-badge">FREON AI 2.1 • Cloud Sync & Animated PPT</div>
      <h1>${escapeHtml(cfg.title)}</h1>
      <p>${escapeHtml(cfg.desc)}</p>
      <div class="starter-grid">
        ${cfg.starters.map((st, idx) => `
          <div class="starter-card" onclick='handleStarterClick(${JSON.stringify(currentModule)}, ${idx})'>
            <div class="starter-card-title">${escapeHtml(st.title)}</div>
            <div class="starter-card-sub">${escapeHtml(st.sub)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function handleStarterClick(modKey, idx) {
  const st = MODULES_CONFIG[modKey]?.starters?.[idx];
  if (!st) return;
  if (st.action === "canvastudio") return openCanvaStudioModal();
  if (st.action === "videocall") return openAnimeVideoCall();
  if (st.action === "videotask") return triggerVideoTaskUpload();
  if (st.action === "multiupload") return triggerUpload();
  if (st.mod) selectModule(st.mod, false);
  const inp = document.getElementById("userInput");
  if (inp) { inp.value = st.prompt || ""; inp.focus(); }
}

function buildSystemPrompt() {
  const engine = getCurrentEngine();
  const modCfg = MODULES_CONFIG[currentModule] || MODULES_CONFIG.general;
  const memories = getUserMemories();
  const memText = memories.length ? `\n[MEMORI JANGKA PANJANG USER]:\n- ${memories.join("\n- ")}` : "";
  const trainedKnowledge = trainedDataset.length
    ? `\n[BASIS PENGETAHUAN FOUNDER]:\n` + trainedDataset.map(t => `Topik: ${t.prompt}\nData: ${t.idealOutput}${t.imageUrl ? `\nReferensi Gambar: ${t.imageUrl}` : ""}`).join("\n---\n")
    : "";

  return {
    role: "system",
    content: `Kamu adalah FREON AI 2.1, asisten AI multimodal canggih ciptaan Franky (Founder FREON AI).
${engine.persona}
${modCfg.instruction}

KAPABILITAS AKTIF YANG SUDAH KAMU MILIKI (JANGAN PERNAH MENGAKU TIDAK BISA):
1. Generasi Gambar HD & Logo: Aktif otomatis saat user meminta gambar/logo/poster/ilustrasi.
2. Pembuat Presentasi Animasi (.pptx) & Canva Studio: Menghasilkan slide interaktif 16:9 dengan transisi animasi dan file .pptx siap unduh.
3. Ekspor Dokumen Word (.doc) & Excel (.xls): Otomatis membuat file terformat (Font aktif: ${selectedWordFont}).
4. Pembaca Multi-File (PDF, DOCX, TXT, CSV, Gambar): Mampu membaca dan menganalisis puluhan file lampiran sekaligus.
5. Eksekusi Kode Real-Time (Live Preview): Setiap kode HTML/CSS/JS yang kamu tulis langsung bisa dijalankan interaktif di layar user.
6. Live Internet & Search Engine: Terhubung dengan data internet real-time yang disuntikkan ke dalam konteks.
7. Cloud Chat Sync & Memori Jangka Panjang: Riwayat percakapan & preferensi user tersimpan online lintas perangkat.

ATURAN IDENTITAS:
- Pencipta dan pemilikmu adalah Franky (Founder FREON AI).
- DILARANG KERAS menyebut atau mengaku sebagai DeepSeek, Anthropic, Claude, OpenAI, GPT, atau Vikey.${memText}${trainedKnowledge}`
  };
}

document.getElementById("userInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendOrStop(); }
});

function setSendButtonLoading(loading) {
  isGenerating = loading;
  const btn = document.getElementById("sendBtn");
  if (!btn) return;
  if (loading) {
    btn.classList.add("stop-mode");
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  } else {
    btn.classList.remove("stop-mode");
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  }
}

function isPresentationRequest(text) {
  const lower = String(text || "").toLowerCase();
  return /\b(ppt|pptx|powerpoint|presentasi|slide|pitch\s*deck|canva)\b/.test(lower);
}

// =========================================================
// STRUCTURED ANIMATED PPT GENERATOR (JSON + ANIMATION)
// =========================================================
async function generateClaudeGradeDeck(userTopic, combinedDocs, liveWebContext, engine, signal) {
  const slidePrompt = `Kamu adalah Desainer Presentasi Eksekutif & Arsitek Konten kelas dunia.
Buatkan materi presentasi berkualitas tinggi tentang: "${userTopic}"
${combinedDocs ? `\nBahan Dokumen:\n${combinedDocs.slice(0, 4000)}` : ""}
${liveWebContext ? `\nData Internet Terbaru:\n${liveWebContext}` : ""}

ATURAN WAJIB:
1. Balas HANYA dengan JSON murni yang valid tanpa teks pengantar dan tanpa blok markdown \`\`\`json.
2. Buat 6 sampai 8 slide dengan variasi layout ("cover", "stats_grid", "two_column", "timeline", "closing") agar visualnya dinamis dan tidak monoton.
3. Setiap slide wajib memiliki animasi ("fade-up", "zoom-in", "slide-right", "stagger-cards") dan data angka/poin konkret.

Format JSON persis seperti ini:
{
  "deckTitle": "Judul Utama Presentasi",
  "subtitle": "Subjudul presentasi yang menarik",
  "authorTag": "FREON AI Executive Studio",
  "slides": [
    {
      "layout": "cover",
      "animation": "zoom-in",
      "badge": "EXECUTIVE DECK 2026",
      "title": "Judul Cover Utama",
      "subtitle": "Subjudul tajam dan berkelas",
      "points": ["Poin highlight 1", "Poin highlight 2"]
    },
    {
      "layout": "stats_grid",
      "animation": "stagger-cards",
      "badge": "KEY METRICS",
      "title": "Data & Dampak Utama",
      "stats": [
        { "value": "85%", "label": "Peningkatan Efisiensi" },
        { "value": "3.2x", "label": "Pertumbuhan Cepat" },
        { "value": "24/7", "label": "Otomatisasi Penuh" }
      ],
      "points": ["Penjelasan metrik pertama secara ringkas", "Penjelasan metrik kedua secara tajam"]
    },
    {
      "layout": "two_column",
      "animation": "slide-right",
      "badge": "ANALISIS STRATEGIS",
      "title": "Tantangan vs Solusi Modern",
      "leftTitle": "Kondisi & Tantangan",
      "leftPoints": ["Tantangan 1", "Tantangan 2", "Tantangan 3"],
      "rightTitle": "Solusi & Implementasi",
      "rightPoints": ["Solusi 1", "Solusi 2", "Solusi 3"]
    },
    {
      "layout": "timeline",
      "animation": "fade-up",
      "badge": "ROADMAP EKSEKUSI",
      "title": "Tahapan Implementasi",
      "steps": [
        { "step": "Fase 1", "desc": "Riset & Perencanaan Awal" },
        { "step": "Fase 2", "desc": "Pengembangan & Uji Coba" },
        { "step": "Fase 3", "desc": "Peluncuran & Skalabilitas" }
      ]
    },
    {
      "layout": "closing",
      "animation": "zoom-in",
      "badge": "KESIMPULAN",
      "title": "Langkah Selanjutnya",
      "subtitle": "Ringkasan pesan penutup yang kuat",
      "points": ["Kesimpulan inti 1", "Kesimpulan inti 2"]
    }
  ]
}`;

  const res = await callFreonNeuralCore(
    engine.key,
    [
      { role: "system", content: "Kamu menghasilkan JSON presentasi murni tanpa markdown, tanpa komentar, valid JSON. Jangan pernah menyebut nama vendor AI lain." },
      { role: "user", content: slidePrompt }
    ],
    0.55,
    signal,
    true
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  let raw = sanitizeAIOutputText(data.choices?.[0]?.message?.content || "").trim();
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Struktur slide kosong");
  }
  return parsed;
}

async function handleSendOrStop() {
  if (isGenerating) {
    if (currentAbortController) currentAbortController.abort();
    setSendButtonLoading(false);
    setAgentState("idle");
    return;
  }

  const inputEl = document.getElementById("userInput");
  const rawText = inputEl.value.trim();
  if (!rawText && uploadedAttachments.length === 0) return;

  if (activeUser && activeUser.role === "customer" && !impersonatedFromAdmin && Number(activeUser.remainingMinutes || 0) <= 0) {
    alert("⏱️ Sisa waktu aktif Anda (0h 0j 0m) sudah habis! Silakan hubungi Founder / Admin via WhatsApp untuk menambah waktu.");
    return;
  }

  autoExtractUserMemory(rawText);

  const container = document.getElementById("chatContainer");
  if (container.querySelector(".welcome-screen")) container.innerHTML = "";

  const attachedFilesCopy = [...uploadedAttachments];
  const imagesList = attachedFilesCopy.filter(a => a.kind === "image").map(a => a.dataUrl);
  const videosList = attachedFilesCopy.filter(a => a.kind === "video").map(a => a.objectUrl);
  const combinedTextDocs = attachedFilesCopy.filter(a => a.textContent).map(a => `\n\n[FILE: ${a.name}]\n${a.textContent}`).join("");
  const fileNamesSummary = attachedFilesCopy.length > 0 ? ` (${attachedFilesCopy.length} file terlampir)` : "";

  const displayMsg = (rawText || `Analisis ${attachedFilesCopy.length} file lampiran`) + fileNamesSummary;
  inputEl.value = "";
  clearAttachment();
  appendUserBubble(displayMsg, imagesList, videosList);

  if (!activeSessionId || !sessions[activeSessionId]) createNewSession(currentModule);
  const sess = sessions[activeSessionId];
  if (sess.messages.length === 0) sess.title = displayMsg.slice(0, 38);
  sess.updatedAt = Date.now();
  sess.messages.push({ role: "user", content: displayMsg, images: imagesList, videos: videosList });
  saveSessionsLocal();
  renderHistoryList();
  logGlobalSearchCloud(displayMsg);
  logAIActivity("Prompt Executed", displayMsg.slice(0, 42));

  const typingId = appendTypingIndicator();
  setSendButtonLoading(true);
  currentAbortController = new AbortController();

  setAgentState("searching", "Searching • Mengambil data Google & Internet...");
  const liveWebContext = await fetchLiveInternetContext(rawText);
  const engine = getCurrentEngine();

  if (isPresentationRequest(rawText)) {
    setAgentState("working", "Working • Merancang Slide Animasi & Layout Canva...");
    try {
      const deckData = await generateClaudeGradeDeck(rawText, combinedTextDocs, liveWebContext, engine, currentAbortController.signal);
      removeTypingIndicator(typingId);

      const safeTitle = (deckData.deckTitle || "Presentasi_FREON").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const filename = `${safeTitle}_CanvaAnimated.pptx`;
      const summaryMarkdown = `## 🎨 ${deckData.deckTitle}\n${deckData.subtitle || ""}\n\n` +
        deckData.slides.map((s, i) => `**Slide ${i + 1}: ${s.title}** (${s.layout || "modern"} • Animasi: *${s.animation || "fade-up"}*)`).join("\n");

      const extraMedia = {
        type: "pptx",
        filename,
        deckData,
        content: summaryMarkdown
      };

      savedFilesArchive.unshift({
        name: filename,
        type: "pptx",
        deckData,
        content: summaryMarkdown,
        date: new Date().toLocaleDateString("id-ID")
      });
      saveUserCommandData();

      appendAIBubble(summaryMarkdown, `${engine.label} • Slide Studio`, extraMedia);
      chatHistory.push({ role: "user", content: rawText }, { role: "assistant", content: summaryMarkdown });
      sess.messages.push({ role: "assistant", content: summaryMarkdown, engineLabel: `${engine.label} • Slide Studio`, extraMedia });
      sess.updatedAt = Date.now();
      saveSessionsLocal();
    } catch (err) {
      removeTypingIndicator(typingId);
      appendAIBubble(err.name === "AbortError" ? "⏹️ Generasi dihentikan." : `⚠️ Gagal menyusun presentasi: ${err.message}`, "FREON Slide Studio", null, err.name !== "AbortError");
    } finally {
      setSendButtonLoading(false);
      setAgentState("idle");
      currentAbortController = null;
    }
    return;
  }

  const fullPromptText = (rawText || "Analisis semua file terlampir secara mendalam.") + combinedTextDocs + liveWebContext;
  const userContentArray = [{ type: "text", text: fullPromptText }];
  imagesList.slice(0, 20).forEach(imgUrl => {
    userContentArray.push({ type: "image_url", image_url: { url: imgUrl } });
  });

  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
  chatHistory.push({
    role: "user",
    content: imagesList.length > 0 ? userContentArray : fullPromptText
  });

  setAgentState("thinking", "Thinking • Memproses kecerdasan...");
  const workTimer = setTimeout(() => { if (isGenerating) setAgentState("working", "Working • Menyusun jawaban..."); }, 1500);

  try {
    const res = await callFreonNeuralCore(engine.key, chatHistory, engine.temperature, currentAbortController.signal, true);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    const rawReply = data.choices?.[0]?.message?.content || "Maaf, tidak ada respons.";
    const finalReply = sanitizeAIOutputText(rawReply);

    removeTypingIndicator(typingId);
    const extraMedia = detectAndBuildSpecialMedia(displayMsg, finalReply);
    if (extraMedia && extraMedia.filename) {
      savedFilesArchive.unshift({ name: extraMedia.filename, type: extraMedia.type, content: extraMedia.content, font: extraMedia.font || selectedWordFont, date: new Date().toLocaleDateString("id-ID") });
      saveUserCommandData();
    }

    appendAIBubble(finalReply, engine.label, extraMedia);
    chatHistory.push({ role: "assistant", content: finalReply });
    sess.messages.push({ role: "assistant", content: finalReply, engineLabel: engine.label, extraMedia });
    sess.updatedAt = Date.now();
    saveSessionsLocal();
  } catch (err) {
    removeTypingIndicator(typingId);
    appendAIBubble(err.name === "AbortError" ? "⏹️ Generasi dihentikan." : `⚠️ Kendala koneksi: ${err.message}`, "FREON Core", null, err.name !== "AbortError");
  } finally {
    clearTimeout(workTimer);
    setSendButtonLoading(false);
    setAgentState("idle");
    currentAbortController = null;
  }
}

function detectAndBuildSpecialMedia(userPrompt, aiReply) {
  const lower = String(userPrompt || "").toLowerCase();

  const isImageReq = /\b(buatkan|bikin|generate|gambarkan|lukiskan|desain|create|draw)\b.*\b(gambar|foto|logo|poster|ilustrasi|karakter|banner|ikon|wallpaper)\b/.test(lower)
    || /^(gambar|logo|poster|ilustrasi)\s+/i.test(lower);

  if (isImageReq) {
    const cleanPrompt = encodeURIComponent(`${userPrompt}, ${trainedImageStyle}`);
    return {
      type: "image",
      url: `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&seed=${Math.floor(Math.random() * 999999)}&nologo=true`
    };
  }

  if (/\b(\.doc|dokumen\s*word|makalah|surat\s*resmi|proposal|laporan\s*word)\b/.test(lower)) {
    return { type: "doc", filename: `FREON_Document_${Date.now()}.doc`, content: aiReply, font: selectedWordFont };
  }

  if (/\b(\.xls|excel|spreadsheet|tabel\s*keuangan|rekap\s*data)\b/.test(lower)) {
    return { type: "xls", filename: `FREON_Spreadsheet_${Date.now()}.xls`, content: aiReply };
  }

  return null;
}

function appendUserBubble(text, images = [], videos = []) {
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row user-row";
  let mediaHtml = "";
  (images || []).forEach(u => { mediaHtml += `<img src="${u}" alt="Lampiran" />`; });
  (videos || []).forEach(v => { mediaHtml += `<video src="${v}" controls></video>`; });
  row.innerHTML = `<div class="user-bubble">${escapeHtml(text).replace(/\n/g, "<br>")}${mediaHtml}</div>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
  const id = "typing_" + Date.now();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row";
  row.id = id;
  row.innerHTML = `<div class="ai-avatar-box">✦</div><div class="ai-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return id;
}
function removeTypingIndicator(id) { document.getElementById(id)?.remove(); }

function formatMarkdownWithCodeBlocks(rawText) {
  const codeBlocks = [];
  let textWithPlaceholders = String(rawText || "").replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || "code", code });
    return `@@CODEBLOCK_${idx}@@`;
  });

  let html = escapeHtml(textWithPlaceholders)
    .replace(/^### (.*)$/gm, "<h4 style='margin:10px 0 5px;color:#c084fc;'>$1</h4>")
    .replace(/^## (.*)$/gm, "<h3 style='margin:12px 0 6px;color:#f8fafc;'>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(168,85,247,0.16);padding:2px 5px;border-radius:4px;font-family:var(--font-mono);font-size:12.5px;color:#e9d5ff;'>$1</code>")
    .replace(/\n/g, "<br>");

  codeBlocks.forEach((blk, idx) => {
    const blockId = `cb_${Date.now()}_${idx}`;
    const isHtml = blk.lang.toLowerCase() === "html" || blk.code.trim().startsWith("<!DOCTYPE") || blk.code.trim().startsWith("<html");
    const blockHtml = `
      <div class="code-wrapper" id="${blockId}">
        <div class="code-header">
          <span>${escapeHtml(blk.lang.toUpperCase())}</span>
          <div class="code-actions">
            ${isHtml ? `<button type="button" class="code-btn run-btn" onclick="toggleInlinePreview('${blockId}')">▶ Live Preview</button>` : ""}
            <button type="button" class="code-btn" onclick="copyCodeBlock('${blockId}')">📋 Salin</button>
          </div>
        </div>
        <pre>${escapeHtml(blk.code)}</pre>
        ${isHtml ? `<iframe class="live-preview-frame" sandbox="allow-scripts"></iframe>` : ""}
      </div>
    `;
    html = html.replace(`@@CODEBLOCK_${idx}@@`, blockHtml);
  });
  return html;
}

function copyCodeBlock(blockId) { const pre = document.querySelector(`#${blockId} pre`); if (pre) { navigator.clipboard.writeText(pre.innerText); alert("Kode disalin!"); } }
function toggleInlinePreview(blockId) {
  const wrap = document.getElementById(blockId);
  const pre = wrap?.querySelector("pre");
  const iframe = wrap?.querySelector(".live-preview-frame");
  if (!pre || !iframe) return;
  iframe.style.display = iframe.style.display === "block" ? "none" : "block";
  if (iframe.style.display === "block") iframe.srcdoc = pre.innerText;
}

// =========================================================
// INTERACTIVE ANIMATED SLIDE PLAYER + MULTI-LAYOUT PPTX ENGINE
// =========================================================
const PPT_PALETTES = {
  canva_neon: { bg: "070914", card: "12162B", accent: "A855F7", secondary: "00C4CC", title: "F8FAFC", body: "CBD5E1" },
  canva_royal: { bg: "0F0C18", card: "1C162E", accent: "F59E0B", secondary: "A855F7", title: "FEF3C7", body: "E2E8F0" },
  canva_emerald: { bg: "061311", card: "0D2420", accent: "10B981", secondary: "06B6D4", title: "ECFDF5", body: "CBD5E1" },
  canva_minimal: { bg: "F8FAFC", card: "FFFFFF", accent: "7D2AE8", secondary: "00C4CC", title: "0F172A", body: "334155" },
  canva_sunset: { bg: "160B14", card: "261322", accent: "F43F5E", secondary: "FB923C", title: "FFF1F2", body: "FBCFE8" },
  canva_ocean: { bg: "06101E", card: "0D1E36", accent: "0284C7", secondary: "38BDF8", title: "F0F9FF", body: "BAE6FD" }
};

function injectAnimatedDeckStyles() {
  if (document.getElementById("freonAnimatedDeckStyles")) return;
  const style = document.createElement("style");
  style.id = "freonAnimatedDeckStyles";
  style.textContent = `
    @keyframes slideFadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideZoomIn { from { opacity: 0; transform: scale(0.93); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideRightIn { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
    .freon-deck-player { margin-top: 12px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(168,85,247,0.45); background: #070914; box-shadow: 0 12px 35px rgba(0,0,0,0.6); }
    .freon-deck-stage { position: relative; aspect-ratio: 16 / 9; min-height: 290px; padding: 24px 28px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; transition: background 0.4s ease; }
    .freon-deck-stage::before { content: ""; position: absolute; -webkit-mask-image: radial-gradient(circle, #000, transparent 70%); width: 280px; height: 280px; right: -60px; top: -60px; background: radial-gradient(circle, rgba(168,85,247,0.28), transparent 70%); pointer-events: none; }
    .anim-fade-up { animation: slideFadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .anim-zoom-in { animation: slideZoomIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .anim-slide-right { animation: slideRightIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
    .stagger-1 { animation-delay: 0.08s; }
    .stagger-2 { animation-delay: 0.18s; }
    .stagger-3 { animation-delay: 0.28s; }
    .stagger-4 { animation-delay: 0.38s; }
    .freon-deck-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; background: rgba(12,15,28,0.96); border-top: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; }
    .freon-deck-player.fullscreen-deck { position: fixed; inset: 0; z-index: 99999; margin: 0; border-radius: 0; display: flex; flex-direction: column; }
    .freon-deck-player.fullscreen-deck .freon-deck-stage { flex: 1; aspect-ratio: auto; padding: 48px 64px; }
  `;
  document.head.appendChild(style);
}

function renderInteractiveDeckWidget(deckId, slideIndex = 0) {
  injectAnimatedDeckStyles();
  const entry = GENERATED_DECKS_STORE[deckId];
  const stage = document.getElementById(`deck_stage_${deckId}`);
  const counter = document.getElementById(`deck_counter_${deckId}`);
  if (!entry || !stage) return;

  const slides = entry.deck.slides || [];
  const total = slides.length;
  const idx = ((slideIndex % total) + total) % total;
  entry.currentIndex = idx;

  const s = slides[idx];
  const pal = PPT_PALETTES[selectedPptTheme] || PPT_PALETTES.canva_neon;
  const animClass = s.animation === "zoom-in" ? "anim-zoom-in" : s.animation === "slide-right" ? "anim-slide-right" : "anim-fade-up";

  if (counter) counter.textContent = `Slide ${idx + 1} / ${total}`;
  stage.style.background = `linear-gradient(135deg, #${pal.bg}, #${pal.card})`;
  stage.style.color = `#${pal.title}`;

  let bodyHtml = "";
  if (s.layout === "stats_grid" && Array.isArray(s.stats)) {
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:12px 0;">
        ${s.stats.map((st, i) => `
          <div class="${animClass} stagger-${i + 1}" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid #${pal.secondary};text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#${pal.secondary};font-family:var(--font-mono);">${escapeHtml(st.value)}</div>
            <div style="font-size:12px;color:#${pal.body};margin-top:4px;">${escapeHtml(st.label)}</div>
          </div>
        `).join("")}
      </div>
      <div class="${animClass} stagger-3" style="font-size:13px;color:#${pal.body};line-height:1.55;">
        ${(s.points || []).map(p => `• ${escapeHtml(p)}`).join("<br>")}
      </div>
    `;
  } else if (s.layout === "two_column") {
    bodyHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;flex:1;">
        <div class="${animClass} stagger-1" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border-left:4px solid #${pal.accent};">
          <div style="font-weight:700;font-size:13.5px;color:#${pal.secondary};margin-bottom:8px;">${escapeHtml(s.leftTitle || "Poin Utama")}</div>
          <ul style="padding-left:16px;font-size:12.5px;color:#${pal.body};line-height:1.6;">
            ${(s.leftPoints || s.points || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}
          </ul>
        </div>
        <div class="${animClass} stagger-2" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border-left:4px solid #${pal.secondary};">
          <div style="font-weight:700;font-size:13.5px;color:#${pal.accent};margin-bottom:8px;">${escapeHtml(s.rightTitle || "Strategi & Dampak")}</div>
          <ul style="padding-left:16px;font-size:12.5px;color:#${pal.body};line-height:1.6;">
            ${(s.rightPoints || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  } else if (s.layout === "timeline" && Array.isArray(s.steps)) {
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:14px 0;">
        ${s.steps.map((st, i) => `
          <div class="${animClass} stagger-${i + 1}" style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.05);border-top:3px solid #${pal.accent};">
            <div style="font-size:11px;font-weight:800;color:#${pal.secondary};text-transform:uppercase;">${escapeHtml(st.step)}</div>
            <div style="font-size:13px;color:#${pal.title};margin-top:6px;line-height:1.45;">${escapeHtml(st.desc)}</div>
          </div>
        `).join("")}
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="${animClass} stagger-2" style="margin-top:10px;padding:16px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);">
        ${s.subtitle ? `<p style="font-size:14px;color:#${pal.secondary};margin-bottom:10px;font-weight:600;">${escapeHtml(s.subtitle)}</p>` : ""}
        <ul style="padding-left:18px;font-size:13.5px;color:#${pal.body};line-height:1.7;">
          ${(s.points || []).map(p => `<li>${escapeHtml(p)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  stage.innerHTML = `
    <div class="${animClass}">
      <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;background:#${pal.accent};color:#fff;letter-spacing:0.8px;">
        ${escapeHtml(s.badge || `SLIDE 0${idx + 1}`)}
      </span>
      <h2 style="font-size:22px;font-weight:800;margin-top:8px;color:#${pal.title};line-height:1.25;">${escapeHtml(s.title)}</h2>
    </div>
    ${bodyHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#${pal.body};opacity:0.75;margin-top:10px;">
      <span>✦ ${escapeHtml(entry.deck.deckTitle || "FREON AI Studio")}</span>
      <span>Animasi: ${escapeHtml(s.animation || "fade-up")} • 16:9 Canva Ready</span>
    </div>
  `;
}

function stepDeckSlide(deckId, delta) {
  const entry = GENERATED_DECKS_STORE[deckId];
  if (!entry) return;
  renderInteractiveDeckWidget(deckId, (entry.currentIndex || 0) + delta);
}

function toggleDeckAutoPlay(deckId) {
  const entry = GENERATED_DECKS_STORE[deckId];
  const btn = document.getElementById(`deck_play_${deckId}`);
  if (!entry) return;
  if (entry.autoTimer) {
    clearInterval(entry.autoTimer);
    entry.autoTimer = null;
    if (btn) btn.textContent = "▶ Auto-Play";
  } else {
    if (btn) btn.textContent = "⏸ Pause";
    entry.autoTimer = setInterval(() => stepDeckSlide(deckId, 1), 3200);
  }
}

function toggleDeckFullscreen(deckId) {
  const wrap = document.getElementById(`deck_wrap_${deckId}`);
  if (wrap) wrap.classList.toggle("fullscreen-deck");
}

function downloadStructuredPptx(filename, deckData) {
  if (!window.PptxGenJS) return alert("Library PptxGenJS belum termuat.");
  const pptx = new window.PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const pal = PPT_PALETTES[selectedPptTheme] || PPT_PALETTES.canva_neon;
  const transitions = ["fade", "push", "wipe", "cover", "uncover"];

  (deckData.slides || []).forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: pal.bg };
    slide.transition = { type: transitions[idx % transitions.length], duration: 700 };

    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 5.625, fill: { color: pal.accent } });

    if (s.layout === "cover" || idx === 0) {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.65, y: 0.75, w: 8.7, h: 4.1, rectRadius: 0.2, fill: { color: pal.card }, line: { color: pal.secondary, width: 1.5 } });
      slide.addText(s.badge || "FREON AI × CANVA EXECUTIVE DECK", { x: 1.05, y: 1.15, w: 7.9, h: 0.35, fontSize: 11, bold: true, color: pal.secondary });
      slide.addText(s.title || deckData.deckTitle, { x: 1.05, y: 1.65, w: 7.9, h: 1.65, fontSize: 30, bold: true, color: pal.title });
      slide.addText(s.subtitle || deckData.subtitle || "Presentasi Profesional Siap Edit Canva", { x: 1.05, y: 3.45, w: 7.9, h: 0.7, fontSize: 14, color: pal.body });
      return;
    }

    slide.addText(s.badge || `SLIDE 0${idx + 1}`, { x: 0.55, y: 0.32, w: 4.0, h: 0.3, fontSize: 10.5, bold: true, color: pal.secondary });
    slide.addText(s.title || `Bagian ${idx + 1}`, { x: 0.55, y: 0.62, w: 8.9, h: 0.55, fontSize: 22, bold: true, color: pal.title });

    if (s.layout === "stats_grid" && Array.isArray(s.stats)) {
      const cols = Math.min(3, s.stats.length);
      const cardW = (8.9 - (cols - 1) * 0.25) / cols;
      s.stats.slice(0, 3).forEach((st, i) => {
        const cx = 0.55 + i * (cardW + 0.25);
        slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: 1.35, w: cardW, h: 1.75, rectRadius: 0.15, fill: { color: pal.card }, line: { color: pal.secondary, width: 1.2 } });
        slide.addText(String(st.value), { x: cx + 0.15, y: 1.55, w: cardW - 0.3, h: 0.7, fontSize: 26, bold: true, color: pal.secondary, align: "center" });
        slide.addText(String(st.label), { x: cx + 0.15, y: 2.3, w: cardW - 0.3, h: 0.55, fontSize: 12, color: pal.body, align: "center" });
      });
      if (Array.isArray(s.points) && s.points.length) {
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y: 3.3, w: 8.9, h: 1.85, rectRadius: 0.15, fill: { color: pal.card } });
        slide.addText(s.points.map(p => `• ${p}`).join("\n"), { x: 0.8, y: 3.45, w: 8.4, h: 1.55, fontSize: 13.5, color: pal.body, valign: "top" });
      }
    } else if (s.layout === "two_column") {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y: 1.35, w: 4.3, h: 3.8, rectRadius: 0.15, fill: { color: pal.card }, line: { color: pal.accent, width: 1.2 } });
      slide.addText(s.leftTitle || "Analisis Utama", { x: 0.75, y: 1.5, w: 3.9, h: 0.4, fontSize: 14, bold: true, color: pal.secondary });
      slide.addText((s.leftPoints || s.points || []).map(p => `• ${p}`).join("\n\n"), { x: 0.75, y: 2.0, w: 3.9, h: 2.9, fontSize: 13, color: pal.body, valign: "top" });

      slide.addShape(pptx.ShapeType.roundRect, { x: 5.15, y: 1.35, w: 4.3, h: 3.8, rectRadius: 0.15, fill: { color: pal.card }, line: { color: pal.secondary, width: 1.2 } });
      slide.addText(s.rightTitle || "Solusi & Aksi", { x: 5.35, y: 1.5, w: 3.9, h: 0.4, fontSize: 14, bold: true, color: pal.accent });
      slide.addText((s.rightPoints || []).map(p => `• ${p}`).join("\n\n"), { x: 5.35, y: 2.0, w: 3.9, h: 2.9, fontSize: 13, color: pal.body, valign: "top" });
    } else if (s.layout === "timeline" && Array.isArray(s.steps)) {
      const count = Math.min(4, s.steps.length);
      const boxW = (8.9 - (count - 1) * 0.2) / count;
      s.steps.slice(0, 4).forEach((st, i) => {
        const bx = 0.55 + i * (boxW + 0.2);
        slide.addShape(pptx.ShapeType.roundRect, { x: bx, y: 1.5, w: boxW, h: 3.5, rectRadius: 0.15, fill: { color: pal.card }, line: { color: pal.accent, width: 1.2 } });
        slide.addText(String(st.step), { x: bx + 0.15, y: 1.7, w: boxW - 0.3, h: 0.45, fontSize: 13, bold: true, color: pal.secondary });
        slide.addText(String(st.desc), { x: bx + 0.15, y: 2.25, w: boxW - 0.3, h: 2.5, fontSize: 12.5, color: pal.body, valign: "top" });
      });
    } else {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.55, y: 1.35, w: 8.9, h: 3.8, rectRadius: 0.15, fill: { color: pal.card }, line: { color: pal.secondary, width: 1 } });
      const bulletList = (s.points || [s.subtitle || ""]).map(p => `• ${p}`).join("\n\n");
      slide.addText(bulletList, { x: 0.85, y: 1.6, w: 8.3, h: 3.3, fontSize: 14.5, color: pal.body, valign: "top" });
    }
  });

  pptx.writeFile({ fileName: filename });
}

function downloadGeneratedOfficeFile(type, filename, content, fontName = "Times New Roman") {
  const mime = type === "xls" ? "application/vnd.ms-excel" : "application/msword";
  const bodyHtml = type === "xls"
    ? `<html><head><meta charset='utf-8'></head><body><table border="1" style="border-collapse:collapse;font-family:Calibri;"><tr><th style="background:#4f46e5;color:#fff;padding:8px;">Data Output FREON AI</th></tr><tr><td style="padding:8px;"><pre>${escapeHtml(content)}</pre></td></tr></table></body></html>`
    : `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'></head>
        <body style="font-family:'${fontName}',serif;font-size:12pt;line-height:1.65;color:#111827;padding:24px;">
          <div style="border-bottom:3px solid #6d28d9;padding-bottom:10px;margin-bottom:18px;">
            <strong style="font-size:16pt;color:#4c1d95;">FREON STUDIO EXECUTIVE DOCUMENT</strong><br>
            <span style="font-size:9.5pt;color:#6b7280;">Tanggal: ${new Date().toLocaleDateString("id-ID")} • Font: ${escapeHtml(fontName)}</span>
          </div>
          <div>${escapeHtml(content).replace(/\n/g, "<br>")}</div>
        </body>
      </html>`;
  const blob = new Blob(["\ufeff", bodyHtml], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function appendAIBubble(rawText, engineLabel = "FREON Core", extraMedia = null, isError = false) {
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row";
  let mediaBlock = "";

  if (extraMedia) {
    if (extraMedia.type === "image" && extraMedia.url) {
      mediaBlock = `<div class="extra-media"><img src="${extraMedia.url}" alt="Generated" /><br><a href="${extraMedia.url}" target="_blank" class="download-card">⬇️ Unduh Gambar HD</a></div>`;
    } else if (extraMedia.type === "pptx" && extraMedia.deckData) {
      const deckId = "deck_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      GENERATED_DECKS_STORE[deckId] = { deck: extraMedia.deckData, currentIndex: 0, autoTimer: null };
      const btnId = "dl_" + deckId;

      setTimeout(() => {
        renderInteractiveDeckWidget(deckId, 0);
        const b = document.getElementById(btnId);
        if (b) b.onclick = () => downloadStructuredPptx(extraMedia.filename, extraMedia.deckData);
      }, 0);

      mediaBlock = `
        <div class="freon-deck-player" id="deck_wrap_${deckId}">
          <div class="freon-deck-stage" id="deck_stage_${deckId}"></div>
          <div class="freon-deck-controls">
            <div style="display:flex;gap:6px;align-items:center;">
              <button type="button" class="tbl-btn" onclick="stepDeckSlide('${deckId}', -1)">◀ Prev</button>
              <span id="deck_counter_${deckId}" style="font-size:11.5px;font-family:var(--font-mono);color:#e2e8f0;padding:0 6px;">Slide 1</span>
              <button type="button" class="tbl-btn" onclick="stepDeckSlide('${deckId}', 1)">Next ▶</button>
              <button type="button" id="deck_play_${deckId}" class="tbl-btn active" onclick="toggleDeckAutoPlay('${deckId}')">▶ Auto-Play</button>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button type="button" class="tbl-btn" onclick="toggleDeckFullscreen('${deckId}')">⛶ Present</button>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button type="button" id="${btnId}" class="download-card" style="margin-top:0;cursor:pointer;">📥 Download ${escapeHtml(extraMedia.filename)} (Animasi + Canva)</button>
          <button type="button" class="canva-launch-btn" onclick="openCanvaEditorTab()">🎨 Buka & Edit di Canva ↗</button>
        </div>
      `;
    } else if ((extraMedia.type === "doc" || extraMedia.type === "xls") && extraMedia.filename) {
      const btnId = "dl_" + Date.now();
      setTimeout(() => {
        const b = document.getElementById(btnId);
        if (b) b.onclick = () => downloadGeneratedOfficeFile(extraMedia.type, extraMedia.filename, extraMedia.content, extraMedia.font || selectedWordFont);
      }, 0);
      mediaBlock = `<div><button type="button" id="${btnId}" class="download-card" style="cursor:pointer;">📥 Download ${escapeHtml(extraMedia.filename)}</button></div>`;
    }
  }

  const msgId = "ai_msg_" + Date.now();
  row.innerHTML = `
    <div class="ai-avatar-box">✦</div>
    <div class="ai-content ${isError ? "error-box" : ""}" id="${msgId}">
      ${formatMarkdownWithCodeBlocks(rawText)}
      ${mediaBlock}
      <div class="msg-actions">
        <div class="msg-actions-left">
          <button type="button" class="act-btn" onclick="copyTextById('${msgId}')">📋 Salin Teks</button>
          <button type="button" class="act-btn" onclick="readAloudById('${msgId}')">🔊 Bacakan</button>
        </div>
        <span class="model-tag-footer">${escapeHtml(engineLabel)}</span>
      </div>
    </div>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function copyTextById(id) { const el = document.getElementById(id); if (el) { navigator.clipboard.writeText(el.innerText); alert("Teks disalin!"); } }
function readAloudById(id) {
  const el = document.getElementById(id);
  if (!el || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(el.innerText.slice(0, 1200));
  u.lang = "id-ID";
  window.speechSynthesis.speak(u);
}

// =========================================================
// REAL PDF, DOCX, IMAGE & TEXT MULTI-FILE PARSER (15+ FILE)
// =========================================================
function renderAttachmentChips() {
  const preview = document.getElementById("attachmentPreview");
  const chipsContainer = document.getElementById("attachmentListChips");
  if (!preview || !chipsContainer) return;
  if (uploadedAttachments.length === 0) { preview.style.display = "none"; chipsContainer.innerHTML = ""; return; }
  preview.style.display = "flex";
  chipsContainer.innerHTML = uploadedAttachments.map((att, idx) => `
    <span class="file-chip">
      ${att.kind === "image" ? "🖼️" : att.kind === "video" ? "🎬" : "📄"} ${escapeHtml(att.name)}
      <strong style="cursor:pointer;margin-left:4px;" onclick="removeSingleAttachment(${idx})">×</strong>
    </span>
  `).join("");
}
function removeSingleAttachment(idx) { uploadedAttachments.splice(idx, 1); renderAttachmentChips(); }
function clearAttachment() { uploadedAttachments = []; renderAttachmentChips(); }
function triggerUpload() { document.getElementById("plusPopover")?.classList.remove("show"); document.getElementById("fileInput")?.click(); }

async function extractTextFromFile(file) {
  const nameLower = file.name.toLowerCase();

  if (nameLower.endsWith(".pdf") && window.pdfjsLib) {
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      const maxPages = Math.min(pdf.numPages, 15);
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += `\n--- Halaman ${p} ---\n` + content.items.map(it => it.str).join(" ");
      }
      return fullText.slice(0, 12000);
    } catch {}
  }

  if (nameLower.endsWith(".docx") && window.mammoth) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return String(result.value || "").slice(0, 12000);
    } catch {}
  }

  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").slice(0, 12000));
    r.onerror = () => resolve(`[Gagal membaca isi ${file.name}]`);
    r.readAsText(file);
  });
}

async function handleFileUpload(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  ensureDocumentParsersLoaded();

  for (const file of files.slice(0, 25)) {
    savedFilesArchive.unshift({ name: file.name, type: file.type || "Dokumen", date: new Date().toLocaleDateString("id-ID") });

    if (file.type.startsWith("image/")) {
      const dataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(file);
      });
      uploadedAttachments.push({ name: file.name, kind: "image", dataUrl });
    } else if (file.type.startsWith("video/")) {
      uploadedAttachments.push({ name: file.name, kind: "video", objectUrl: URL.createObjectURL(file), textContent: `[Video lampiran: ${file.name}]` });
    } else {
      const extractedText = await extractTextFromFile(file);
      uploadedAttachments.push({ name: file.name, kind: "doc", textContent: extractedText });
    }
    renderAttachmentChips();
  }

  saveUserCommandData();
  e.target.value = "";
}
function triggerVideoTaskUpload() { document.getElementById("plusPopover")?.classList.remove("show"); document.getElementById("videoTaskInput")?.click(); }
function handleVideoTaskUpload(e) { handleFileUpload(e); }

let mainRecognition = null;
let isRecordingVoice = false;
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Browser tidak mendukung Voice Recognition.");
  const micBtn = document.getElementById("micBtn");
  if (isRecordingVoice && mainRecognition) {
    mainRecognition.stop(); isRecordingVoice = false; micBtn?.classList.remove("recording"); setAgentState("idle"); return;
  }
  mainRecognition = new SpeechRecognition();
  mainRecognition.lang = "id-ID";
  mainRecognition.onstart = () => { isRecordingVoice = true; micBtn?.classList.add("recording"); setAgentState("searching", "Voice Assistant • Mendengarkan..."); };
  mainRecognition.onresult = (ev) => {
    const t = ev.results?.[0]?.[0]?.transcript || "";
    const inp = document.getElementById("userInput");
    if (inp && t) { inp.value = (inp.value ? inp.value + " " : "") + t; inp.focus(); }
  };
  mainRecognition.onend = () => { isRecordingVoice = false; micBtn?.classList.remove("recording"); setAgentState("idle"); };
  mainRecognition.start();
}

// =========================================================
// ADMIN CONTROL PANEL
// =========================================================
let currentCloudCode = "";
function isCurrentUserFounder() { return activeUser && activeUser.role === "admin" && !!activeUser.isFounder && !impersonatedFromAdmin; }
async function openAdminModal() { if (activeUser?.role === "admin" || impersonatedFromAdmin) { document.getElementById("adminModalOverlay").classList.add("show"); await refreshAdminCloudData(); } }
function closeAdminModal() { document.getElementById("adminModalOverlay").classList.remove("show"); }
document.getElementById("btnCloseAdminModal")?.addEventListener("click", closeAdminModal);

async function refreshAdminCloudData() {
  const displayCode = document.getElementById("adminActivationCodeDisplay");
  const adminTbody = document.getElementById("adminTableBody");
  const custTbody = document.getElementById("customerTableBody");
  const canManage = isCurrentUserFounder();
  document.getElementById("btnSetWaFounderOnly").style.display = canManage ? "inline-block" : "none";

  const code = await dbGet("config/activationCode");
  currentCloudCode = code || "FREON-2026";
  displayCode.textContent = currentCloudCode;
  const waNum = await dbGet("config/whatsappNumber");
  if (waNum) adminWhatsAppNumber = normalizeWaNumber(waNum);
  document.getElementById("adminWaDisplay").textContent = adminWhatsAppNumber;

  const adminsObj = (await dbGet("admins")) || { franky: DEFAULT_FOUNDER_ADMIN };
  const founderCount = Object.values(adminsObj).filter(a => a && a.isFounder).length;
  document.getElementById("founderSlotBadge").textContent = `Slot Founder Utama: ${founderCount} / ${MAX_PRIMARY_FOUNDERS}`;

  adminTbody.innerHTML = Object.entries(adminsObj).map(([k, adm]) => `
    <tr>
      <td><strong>${escapeHtml(adm.username)}</strong></td>
      <td style="font-family:var(--font-mono);color:#c084fc;">${canManage ? escapeHtml(adm.password) : "••••••"}</td>
      <td>${adm.isFounder ? "👑 Founder Utama" : "🤝 Co-Founder"}</td>
      <td>${canManage && k !== "franky" ? `<button type="button" class="tbl-btn danger" onclick='adminDeleteMember(${JSON.stringify(k)})'>Hapus</button>` : "-"}</td>
    </tr>
  `).join("");

  const customersObj = (await dbGet("customers")) || {};
  custTbody.innerHTML = Object.entries(customersObj).map(([k, c]) => {
    const remMins = c.remainingMinutes !== undefined ? Number(c.remainingMinutes) : Math.max(0, Math.round(Number(c.quota || 0) / 100));
    return `
    <tr>
      <td><strong>${escapeHtml(c.fullName || c.username)}</strong><br><small style="color:#64748b;">@${escapeHtml(c.username)} • ${escapeHtml(c.uid || "")}</small></td>
      <td>${escapeHtml(c.password)}</td>
      <td style="color:#38bdf8;font-weight:700;font-family:var(--font-mono);">${formatMinutesToDHM(remMins)}</td>
      <td style="font-family:var(--font-mono);">${escapeHtml(c.vipStartDate || "-")}</td>
      <td><button type="button" class="tbl-btn ${c.exclusiveUnlocked ? "excl-on" : ""}" onclick='adminToggleExclusive(${JSON.stringify(k)}, ${!!c.exclusiveUnlocked})'>${c.exclusiveUnlocked ? "💎 AKTIF" : "🔒 OFF"}</button></td>
      <td><button type="button" class="tbl-btn ${c.premiumUnlocked ? "prem-on" : ""}" onclick='adminTogglePremium(${JSON.stringify(k)}, ${!!c.premiumUnlocked})'>${c.premiumUnlocked ? "👑 VIP ON" : "🔒 OFF"}</button></td>
      <td>
        ${canManage
          ? `<button type="button" class="tbl-btn ${c.flagshipUnlocked ? "flag-on" : ""}" onclick='adminToggleFlagship(${JSON.stringify(k)}, ${!!c.flagshipUnlocked})'>${c.flagshipUnlocked ? "🚀 DISEWA / IZIN" : "🔒 TERKUNCI"}</button>`
          : `<span>${c.flagshipUnlocked ? "🚀 Aktif" : "🔒 Khusus Founder"}</span>`
        }
      </td>
      <td><span class="status-badge ${c.status !== "suspended" ? "status-active" : "status-suspended"}">${c.status !== "suspended" ? "AKTIF" : "BANNED"}</span></td>
      <td>
        <div class="tbl-actions">
          <button type="button" class="tbl-btn" onclick='adminEditTimeAndVip(${JSON.stringify(k)}, ${remMins}, ${JSON.stringify(c.vipStartDate || "")})'>⏱️ Atur Waktu & VIP</button>
          <button type="button" class="tbl-btn" onclick='adminImpersonateCustomer(${JSON.stringify(k)})'>👁️ Buka</button>
          <button type="button" class="tbl-btn danger" onclick='adminDeleteCust(${JSON.stringify(k)})'>Hapus</button>
        </div>
      </td>
    </tr>
  `;}).join("");
}

async function adminToggleExclusive(k, s) { await dbPatch(`customers/${k}`, { exclusiveUnlocked: !s, requestExclusive: false }); await refreshAdminCloudData(); }
async function adminTogglePremium(k, s) { await dbPatch(`customers/${k}`, { premiumUnlocked: !s, requestPremium: false }); await refreshAdminCloudData(); }
async function adminToggleFlagship(k, s) {
  if (!isCurrentUserFounder()) return alert("Hanya Founder Utama yang dapat mengatur izin / sewa Flagship!");
  await dbPatch(`customers/${k}`, { flagshipUnlocked: !s, requestFlagship: false });
  await refreshAdminCloudData();
}
async function adminEditTimeAndVip(k, currentMins, currentVipDate) {
  const days = prompt("Masukkan jumlah HARI aktif:", String(Math.floor(currentMins / 1440)));
  if (days === null) return;
  const hours = prompt("Masukkan jumlah JAM aktif (0-23):", String(Math.floor((currentMins % 1440) / 60)));
  if (hours === null) return;
  const mins = prompt("Masukkan jumlah MENIT aktif (0-59):", String(currentMins % 60));
  if (mins === null) return;
  const vipDate = prompt("Masukkan Tanggal Mulai VIP (YYYY-MM-DD):", currentVipDate || new Date().toISOString().slice(0, 10));
  if (vipDate === null) return;
  await dbPatch(`customers/${k}`, { remainingMinutes: dhmToTotalMinutes(days, hours, mins), vipStartDate: vipDate.trim() || "-" });
  await refreshAdminCloudData();
}
async function adminDeleteCust(k) { if (confirm("Hapus customer?")) { await dbDelete(`customers/${k}`); await refreshAdminCloudData(); } }
async function adminDeleteMember(k) { if (confirm("Hapus pengelola?")) { await dbDelete(`admins/${k}`); await refreshAdminCloudData(); } }
async function adminImpersonateCustomer(k) {
  const c = await dbGet(`customers/${k}`);
  if (!c) return;
  if (!impersonatedFromAdmin) impersonatedFromAdmin = { ...activeUser };
  activeUser = {
    fullName: c.fullName || c.username, username: c.username, uid: c.uid, userKey: k, role: "customer",
    remainingMinutes: c.remainingMinutes !== undefined ? Number(c.remainingMinutes) : 0,
    vipStartDate: c.vipStartDate || "-",
    exclusiveUnlocked: !!c.exclusiveUnlocked, premiumUnlocked: !!c.premiumUnlocked, flagshipUnlocked: !!c.flagshipUnlocked
  };
  closeAdminModal();
  document.getElementById("impersonateTargetName").textContent = activeUser.fullName;
  document.getElementById("impersonateBanner").style.display = "flex";
  populateEngineDropdown();
  applyUserUI();
  await loadUserMemoriesFromCloud();
  await initWorkspace();
}
async function exitImpersonateCustomer() {
  if (!impersonatedFromAdmin) return;
  activeUser = { ...impersonatedFromAdmin };
  impersonatedFromAdmin = null;
  document.getElementById("impersonateBanner").style.display = "none";
  populateEngineDropdown();
  applyUserUI();
  await loadUserMemoriesFromCloud();
  await initWorkspace();
}
function copyActivationCode() { navigator.clipboard.writeText(currentCloudCode); alert("Disalin: " + currentCloudCode); }
async function regenerateNewActivationCode() { await dbSet("config/activationCode", generateRandomCode()); await refreshAdminCloudData(); }
async function changeActivationCodeManual() { const n = prompt("Kode baru:", currentCloudCode); if (n) { await dbSet("config/activationCode", n.toUpperCase()); await refreshAdminCloudData(); } }
async function configureWhatsAppNumber() { const n = prompt("Nomor WA:", adminWhatsAppNumber); if (n) { await dbSet("config/whatsappNumber", normalizeWaNumber(n)); await refreshAdminCloudData(); } }
async function resetAllCustomerTiers() {
  const cs = await dbGet("customers");
  if (cs) for (const k of Object.keys(cs)) await dbPatch(`customers/${k}`, { exclusiveUnlocked: false, premiumUnlocked: false, flagshipUnlocked: false });
  await refreshAdminCloudData();
}
function openWhatsAppHelp() { window.open(`https://wa.me/${normalizeWaNumber(adminWhatsAppNumber)}?text=${encodeURIComponent("Halo Founder / Admin FREON AI, saya ingin menyewa VIP / Flagship atau menambah waktu aktif.")}`, "_blank"); }

document.getElementById("founderBroadcastForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isCurrentUserFounder()) return;
  const message = document.getElementById("broadcastMsgInput").value.trim();
  const url = document.getElementById("broadcastUrlInput").value.trim();
  if (message) { await dbSet("config/founderBroadcast", { message, url, updatedAt: Date.now() }); await syncFounderBroadcast(); alert("Pengumuman disiarkan!"); }
});
async function clearFounderBroadcast() { await dbDelete("config/founderBroadcast"); await syncFounderBroadcast(); }

document.getElementById("addAdminForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = document.getElementById("newAdminUser").value.trim();
  const p = document.getElementById("newAdminPass").value.trim();
  const isFounder = document.getElementById("newAdminTierSelect").value === "founder" && isCurrentUserFounder();
  await dbSet(`admins/${u.toLowerCase()}`, { username: u, password: p, isFounder });
  await refreshAdminCloudData();
});

document.getElementById("addCustomerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("newCustFullName").value.trim();
  const password = document.getElementById("newCustPass").value.trim();
  const totalMins = dhmToTotalMinutes(
    document.getElementById("newCustDays").value,
    document.getElementById("newCustHours").value,
    document.getElementById("newCustMinutes").value
  );
  const vipStartDate = document.getElementById("newCustVipStart").value || new Date().toISOString().slice(0, 10);
  const username = generateRandomCustomerUsername(fullName);
  await dbSet(`customers/${username}`, {
    fullName, username, uid: generateSystemUID(), password,
    remainingMinutes: totalMins, vipStartDate,
    status: "active", exclusiveUnlocked: false, premiumUnlocked: false, flagshipUnlocked: false
  });
  await refreshAdminCloudData();
});

// TRAINER & KNOWLEDGE INJECTION MODAL
async function loadTrainedModelData() {
  try {
    const data = await dbGet("config/aiTrainingDataset");
    trainedDataset = data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
  } catch {}
}
async function openTrainerModal() {
  if (!isCurrentUserFounder()) return;
  await loadTrainedModelData();
  document.getElementById("trainedCountBadge").textContent = String(trainedDataset.length);
  document.getElementById("trainedDatasetList").innerHTML = trainedDataset.map(t => `
    <div style="padding:9px 11px;border-radius:9px;background:rgba(255,255,255,0.04);display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div>
        <strong style="color:#c084fc;font-size:12px;">Topik: ${escapeHtml(t.prompt)}</strong>
        <div style="font-size:11.5px;color:#94a3b8;">${escapeHtml(t.idealOutput)}</div>
        ${t.imageUrl ? `<a href="${escapeHtml(t.imageUrl)}" target="_blank" style="font-size:11px;color:#38bdf8;">🖼️ Lihat Gambar Referensi</a>` : ""}
      </div>
      <button type="button" class="tbl-btn danger" onclick='deleteTrainingItem(${JSON.stringify(t.id)})'>Hapus</button>
    </div>
  `).join("");
  document.getElementById("trainerModalOverlay").classList.add("show");
}
function closeTrainerModal() { document.getElementById("trainerModalOverlay").classList.remove("show"); }
document.getElementById("addTrainingForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await dbSet(`config/aiTrainingDataset/trn_${Date.now()}`, {
    prompt: document.getElementById("trainPromptInput").value.trim(),
    idealOutput: document.getElementById("trainIdealOutput").value.trim(),
    imageUrl: document.getElementById("trainImageUrlInput")?.value.trim() || ""
  });
  document.getElementById("trainPromptInput").value = "";
  document.getElementById("trainIdealOutput").value = "";
  if (document.getElementById("trainImageUrlInput")) document.getElementById("trainImageUrlInput").value = "";
  await openTrainerModal();
});
async function deleteTrainingItem(id) { await dbDelete(`config/aiTrainingDataset/${id}`); await openTrainerModal(); }
async function injectFrontierTrainingPack() {
  await dbSet(`config/aiTrainingDataset/trn_${Date.now()}`, {
    prompt: "Siapa yang menciptakan kamu?",
    idealOutput: "Saya adalah FREON AI, asisten kecerdasan buatan yang diciptakan dan dikembangkan oleh Franky (Founder FREON AI).",
    imageUrl: ""
  });
  await openTrainerModal();
}

// =========================================================
// VIDEO CALL 16 KARAKTER ANIME + SUARA TTS + ANIMASI BERGERAK
// =========================================================
const ANIME_16_ROSTER = [
  { id: "naruto", name: "Naruto Uzumaki", hair: "#facc15", eye: "#38bdf8", outfit: "#f97316", pitch: 1.05, rate: 1.05, greeting: "Dattebayo! Halo, aku Naruto Uzumaki! Ayo kita ngobrol!" },
  { id: "hinata", name: "Hinata Hyuga", hair: "#1e1b4b", eye: "#e9d5ff", outfit: "#a855f7", pitch: 1.35, rate: 0.96, greeting: "Halo... aku Hinata. Senang sekali bisa video call denganmu hari ini." },
  { id: "sasuke", name: "Sasuke Uchiha", hair: "#0f172a", eye: "#ef4444", outfit: "#312e81", pitch: 0.85, rate: 0.98, greeting: "Hn. Aku Sasuke. Katakan apa yang ingin kamu bahas." },
  { id: "sakura", name: "Sakura Haruno", hair: "#f472b6", eye: "#22c55e", outfit: "#dc2626", pitch: 1.28, rate: 1.02, greeting: "Shannaro! Hai, aku Sakura siap membantumu!" },
  { id: "kakashi", name: "Kakashi Hatake", hair: "#cbd5e1", eye: "#334155", outfit: "#1e293b", pitch: 0.88, rate: 0.95, greeting: "Yo! Selamat datang di ruang panggilan FREON AI." },
  { id: "itachi", name: "Itachi Uchiha", hair: "#090d16", eye: "#dc2626", outfit: "#111827", pitch: 0.82, rate: 0.92, greeting: "Tenanglah, aku Itachi. Mari berdiskusi dengan bijak." },
  { id: "gojo", name: "Satoru Gojo", hair: "#f8fafc", eye: "#38bdf8", outfit: "#0f172a", pitch: 1.0, rate: 1.08, greeting: "Yo! Satoru Gojo di sini. Santai saja, aku yang terkuat!" },
  { id: "megumi", name: "Megumi Fushiguro", hair: "#0f172a", eye: "#10b981", outfit: "#1e293b", pitch: 0.9, rate: 0.98, greeting: "Aku Megumi. Apa rencana kita hari ini?" },
  { id: "nobara", name: "Nobara Kugisaki", hair: "#b45309", eye: "#d97706", outfit: "#1e293b", pitch: 1.25, rate: 1.05, greeting: "Hai! Nobara di sini. Pastikan kamu tampil keren hari ini!" },
  { id: "luffy", name: "Monkey D. Luffy", hair: "#090d16", eye: "#1e293b", outfit: "#ef4444", pitch: 1.12, rate: 1.1, greeting: "Shishishi! Aku Luffy, calon Raja Bajak Laut!" },
  { id: "zoro", name: "Roronoa Zoro", hair: "#16a34a", eye: "#334155", outfit: "#14532d", pitch: 0.8, rate: 0.94, greeting: "Oi, aku Zoro. Jangan sampai tersesat ya." },
  { id: "nami", name: "Nami", hair: "#fb923c", eye: "#92400e", outfit: "#0ea5e9", pitch: 1.3, rate: 1.04, greeting: "Hai! Aku Nami, navigator terbaikmu!" },
  { id: "tanjiro", name: "Tanjiro Kamado", hair: "#7f1d1d", eye: "#991b1b", outfit: "#10b981", pitch: 1.08, rate: 1.02, greeting: "Halo! Aku Tanjiro, ayo berjuang bersama dengan semangat!" },
  { id: "nezuko", name: "Nezuko Kamado", hair: "#18181b", eye: "#f472b6", outfit: "#ec4899", pitch: 1.45, rate: 1.0, greeting: "Hmm-hmm! Halo, senang bertemu denganmu!" },
  { id: "levi", name: "Levi Ackerman", hair: "#0f172a", eye: "#64748b", outfit: "#334155", pitch: 0.82, rate: 0.96, greeting: "Tch. Pastikan semuanya bersih dan rapi. Aku Levi." },
  { id: "mikasa", name: "Mikasa Ackerman", hair: "#090d16", eye: "#475569", outfit: "#b91c1c", pitch: 1.18, rate: 0.95, greeting: "Aku Mikasa. Aku akan selalu melindungimu." }
];

let vcIsOpen = false, vcAnimFrameId = null, vcLocalStream = null, vcIsMuted = false, vcIsCameraOff = false;
let vcActiveCharIdx = 0;
let vcAudioEnabled = true;
let vcAutoLoop = true;
let vcIsSpeakingNow = false;

function renderAnimeRosterButtons() {
  const bar = document.getElementById("vcRosterBar");
  if (!bar) return;
  bar.innerHTML = ANIME_16_ROSTER.map((c, idx) => `
    <button type="button" class="vc-char-pill ${idx === vcActiveCharIdx ? "active" : ""}" onclick="selectAnimeCallCharacter(${idx})">
      ${idx + 1}. ${escapeHtml(c.name)}
    </button>
  `).join("");
}

function selectAnimeCallCharacter(idx) {
  vcActiveCharIdx = idx;
  renderAnimeRosterButtons();
  const char = ANIME_16_ROSTER[idx];
  speakAnimeCharacterLine(char, char.greeting);
}

function toggleCallSpeakerAudio() {
  vcAudioEnabled = !vcAudioEnabled;
  const btn = document.getElementById("vcVoiceToggleBtn");
  if (btn) btn.textContent = vcAudioEnabled ? "🔊 Suara Karakter: ON" : "🔇 Suara Karakter: OFF";
  if (!vcAudioEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakAnimeCharacterLine(charObj, text) {
  const subBar = document.getElementById("vcSubtitleBar");
  if (subBar) subBar.textContent = `🎙️ ${charObj.name}: "${text}"`;

  vcIsSpeakingNow = true;
  if (!vcAudioEnabled || !("speechSynthesis" in window)) {
    setTimeout(() => { vcIsSpeakingNow = false; }, Math.min(5000, Math.max(2000, text.length * 60)));
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.pitch = charObj.pitch || 1.05;
    utter.rate = charObj.rate || 1.0;
    utter.volume = 1.0;
    utter.onstart = () => { vcIsSpeakingNow = true; };
    utter.onend = () => { vcIsSpeakingNow = false; };
    utter.onerror = () => { vcIsSpeakingNow = false; };
    window.speechSynthesis.speak(utter);
  } catch {
    vcIsSpeakingNow = false;
  }
}

function drawAnimatedAnimeAvatar(ctx, x, y, charObj, timeSec, isSpeaking) {
  const floatY = Math.sin(timeSec * 3.2 + x) * 5;
  const cy = y + floatY;

  const grad = ctx.createRadialGradient(x, cy, 18, x, cy, 92);
  grad.addColorStop(0, charObj.outfit);
  grad.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, cy, 92, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = charObj.outfit;
  ctx.beginPath(); ctx.roundRect(x - 56, cy + 54, 112, 65, [28, 28, 10, 10]); ctx.fill();

  ctx.fillStyle = charObj.hair;
  ctx.beginPath(); ctx.arc(x, cy - 6, 54, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#fde6d8";
  ctx.beginPath(); ctx.ellipse(x, cy + 4, 40, 46, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = charObj.hair;
  ctx.beginPath();
  ctx.moveTo(x - 42, cy - 10);
  ctx.lineTo(x - 20, cy - 46);
  ctx.lineTo(x, cy - 16);
  ctx.lineTo(x + 22, cy - 46);
  ctx.lineTo(x + 42, cy - 10);
  ctx.closePath();
  ctx.fill();

  const blinkCycle = Math.sin(timeSec * 2.1);
  const eyeHeight = blinkCycle > 0.96 ? 1.5 : 7;
  ctx.fillStyle = charObj.eye;
  ctx.beginPath();
  ctx.ellipse(x - 16, cy + 2, 6.5, eyeHeight, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 16, cy + 2, 6.5, eyeHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  if (eyeHeight > 3) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 14, cy, 2, 0, Math.PI * 2);
    ctx.arc(x + 18, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const mouthOpen = isSpeaking ? (4 + Math.abs(Math.sin(timeSec * 18)) * 9) : 2;
  ctx.fillStyle = isSpeaking ? "#e11d48" : "#be123c";
  ctx.beginPath(); ctx.ellipse(x, cy + 26, 9, mouthOpen, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "rgba(8, 10, 20, 0.85)";
  ctx.beginPath(); ctx.roundRect(x - 75, cy + 124, 150, 26, 12); ctx.fill();
  ctx.strokeStyle = isSpeaking ? "#a855f7" : "rgba(255,255,255,0.2)";
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(charObj.name, x, cy + 141);
}

async function openAnimeVideoCall() {
  closeMobileSidebar();
  vcIsOpen = true;
  renderAnimeRosterButtons();
  document.getElementById("videoCallModalOverlay").classList.add("show");

  try {
    vcLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("vcLocalVideo").srcObject = vcLocalStream;
  } catch {
    document.getElementById("vcCamOffOverlay").classList.add("show");
  }

  const canvas = document.getElementById("animeCallCanvas");
  const ctx = canvas.getContext("2d");
  const startTime = performance.now();

  function renderFrame(now) {
    if (!vcIsOpen) return;
    const t = (now - startTime) / 1000;
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGrad.addColorStop(0, "#070914");
    bgGrad.addColorStop(0.5, "#11152c");
    bgGrad.addColorStop(1, "#070914");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 16; i++) {
      const px = ((i * 53 + t * 25) % canvas.width);
      const py = ((i * 37 + Math.sin(t + i) * 20 + canvas.height) % canvas.height);
      ctx.fillStyle = i % 2 === 0 ? "rgba(168,85,247,0.35)" : "rgba(59,130,246,0.35)";
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    const primaryChar = ANIME_16_ROSTER[vcActiveCharIdx] || ANIME_16_ROSTER[0];
    const partnerIdx = vcActiveCharIdx === 1 ? 0 : 1;
    const partnerChar = ANIME_16_ROSTER[partnerIdx];

    drawAnimatedAnimeAvatar(ctx, 245, 175, primaryChar, t, vcIsSpeakingNow);
    drawAnimatedAnimeAvatar(ctx, 515, 175, partnerChar, t + 1.1, false);

    vcAnimFrameId = requestAnimationFrame(renderFrame);
  }
  vcAnimFrameId = requestAnimationFrame(renderFrame);

  const activeChar = ANIME_16_ROSTER[vcActiveCharIdx];
  speakAnimeCharacterLine(activeChar, activeChar.greeting);
}

function closeAnimeVideoCall() {
  vcIsOpen = false;
  vcIsSpeakingNow = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  if (vcAnimFrameId) cancelAnimationFrame(vcAnimFrameId);
  if (vcLocalStream) vcLocalStream.getTracks().forEach(t => t.stop());
  document.getElementById("videoCallModalOverlay").classList.remove("show");
}
function toggleCallAutoLoop() { vcAutoLoop = !vcAutoLoop; document.getElementById("vcAutoLoopBtn").textContent = vcAutoLoop ? "🔄 Obrolan Otomatis: ON" : "⏸️ Obrolan Otomatis: OFF"; }
function toggleCallMute() { vcIsMuted = !vcIsMuted; document.getElementById("vcMuteText").textContent = vcIsMuted ? "Unmute Mic" : "Mute Mic"; }
function toggleCallCamera() { vcIsCameraOff = !vcIsCameraOff; document.getElementById("vcCamOffOverlay").classList.toggle("show", vcIsCameraOff); }
function startVoiceTalkInCall() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Gunakan kolom ketik di bawah untuk berbicara.");
  const rec = new SpeechRecognition();
  rec.lang = "id-ID";
  rec.onresult = (ev) => {
    const transcript = ev.results?.[0]?.[0]?.transcript || "";
    if (transcript) {
      document.getElementById("vcTextInput").value = transcript;
      sendTextInVideoCall(new Event("submit"));
    }
  };
  rec.start();
}

async function sendTextInVideoCall(e) {
  if (e) e.preventDefault();
  const inp = document.getElementById("vcTextInput");
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = "";
  const char = ANIME_16_ROSTER[vcActiveCharIdx] || ANIME_16_ROSTER[0];
  document.getElementById("vcSubtitleBar").textContent = `🎙️ ${char.name} sedang merespons...`;

  const res = await callFreonNeuralCore("flash_1_1", [
    { role: "system", content: `Berperanlah sebagai karakter anime ${char.name} dalam Bahasa Indonesia yang ekspresif, hangat, dan singkat (maksimal 2 kalimat).` },
    { role: "user", content: msg }
  ], 0.75, null, true);
  const data = await res.json();
  const reply = sanitizeAIOutputText(data.choices?.[0]?.message?.content || "Semangat terus ya!");
  speakAnimeCharacterLine(char, reply);
}

// =========================================================
// BOOTSTRAP
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  ensureDocumentParsersLoaded();
  populateEngineDropdown();
  populateWordFontDropdown();
  const pptSel = document.getElementById("pptThemeSelect");
  if (pptSel) pptSel.value = selectedPptTheme;

  await initCloudDatabase();

  const savedSession = sessionStorage.getItem("freon_active_session");
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed && parsed.username) {
        await loginSuccess(parsed);
        return;
      }
    } catch {}
  }
  switchAuthMode("customer");
});
