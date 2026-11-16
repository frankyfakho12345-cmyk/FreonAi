// =========================================================
// DATABASE FIREBASE OTOMATIS TERHUBUNG (FREON-AI + CLOUD CHAT)
// =========================================================
const FIREBASE_CANDIDATES = [
  "https://freon-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  "https://freon-ai-default-rtdb.firebaseio.com",
  "https://freon-ai-default-rtdb.europe-west1.firebasedatabase.app"
];
let FIREBASE_DB_URL = FIREBASE_CANDIDATES[0];

const API_URL = "https://api.vikey.ai/v1/chat/completions";
const API_KEY = "vk-119ba6a1-753f-4dd3-ad7a-c03b511630ee";
const DEFAULT_FOUNDER_ADMIN = { username: "Franky", password: "123", isFounder: true };

// ==========================================
// 1. KONEKSI DATABASE CLOUD (FIREBASE REST API)
// ==========================================
async function resolveFirebaseUrl() {
  for (const url of FIREBASE_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${url}/config.json`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        FIREBASE_DB_URL = url;
        return url;
      }
    } catch {}
  }
  return FIREBASE_DB_URL;
}

async function dbGet(path) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`);
  if (!res.ok) throw new Error("Gagal membaca database cloud");
  return await res.json();
}

async function dbSet(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Gagal menyimpan ke database cloud");
  return await res.json();
}

async function dbPatch(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Gagal update database cloud");
  return await res.json();
}

async function dbDelete(path) {
  await fetch(`${FIREBASE_DB_URL}/${path}.json`, { method: "DELETE" });
}

function generateRandomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FREON-${suffix}`;
}

async function initCloudDatabase() {
  try {
    await resolveFirebaseUrl();
    const code = await dbGet("config/activationCode");
    if (!code) {
      await dbSet("config/activationCode", "FREON-2026");
    }

    const admins = await dbGet("admins");
    if (!admins || !admins.franky) {
      await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN);
    }

    const customers = await dbGet("customers");
    if (!customers) {
      await dbSet("customers/demo", {
        username: "demo",
        password: "123",
        quota: 20000,
        status: "active"
      });
    }
  } catch (err) {
    console.warn("Pastikan Rules Firebase dalam mode test (read/write: true):", err.message);
  }
}

// ==========================================
// 2. AUTENTIKASI LOGIN & DAFTAR (REAL-TIME CLOUD)
// ==========================================
let currentAuthMode = "customer";
let activeUser = null;
let quotaSyncInterval = null;

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const card = document.getElementById("authCard");
  const badge = document.getElementById("authRoleBadge");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const userLabel = document.getElementById("authUserLabel");
  const submitBtn = document.getElementById("authSubmitBtn");
  const activationGroup = document.getElementById("authActivationGroup");
  const activationInput = document.getElementById("authActivationCode");
  const custToggle = document.getElementById("customerRegisterToggle");
  const adminToggle = document.getElementById("adminSwitchToggle");
  const errBox = document.getElementById("authErrorBox");

  errBox.style.display = "none";
  document.getElementById("authUsername").value = "";
  document.getElementById("authPassword").value = "";
  activationInput.value = "";

  if (mode === "admin") {
    card.classList.add("admin-mode");
    badge.textContent = "ADMIN & PENGELOLA";
    title.textContent = "Login Akun Admin";
    subtitle.textContent = "Kelola akun customer, tim admin & kuota token";
    userLabel.textContent = "Username Admin";
    submitBtn.textContent = "Masuk ke Dashboard Admin";
    activationGroup.style.display = "none";
    activationInput.required = false;
    custToggle.style.display = "none";
    adminToggle.innerHTML = `Bukan pengelola? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Kembali ke Login Customer</button>`;
  } else if (mode === "register") {
    card.classList.remove("admin-mode");
    badge.textContent = "PENDAFTARAN CUSTOMER";
    title.textContent = "Aktivasi Akun Baru";
    subtitle.textContent = "Masukkan data akun & kode aktivasi 1x pakai dari Admin";
    userLabel.textContent = "Pilih Username Baru";
    submitBtn.textContent = "Aktivasi & Masuk";
    activationGroup.style.display = "block";
    activationInput.required = true;
    custToggle.style.display = "block";
    custToggle.innerHTML = `Sudah punya akun? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('customer')">Masuk di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Admin</button>`;
  } else {
    card.classList.remove("admin-mode");
    badge.textContent = "CUSTOMER PORTAL";
    title.textContent = "Masuk ke FREON AI";
    subtitle.textContent = "Gunakan akun customer Anda untuk mengakses AI Studio";
    userLabel.textContent = "Username Customer";
    submitBtn.textContent = "Masuk sebagai Customer";
    activationGroup.style.display = "none";
    activationInput.required = false;
    custToggle.style.display = "block";
    custToggle.innerHTML = `Belum punya akun customer? <button type="button" class="inline-link-btn cyan" onclick="switchAuthMode('register')">Daftar di sini</button>`;
    adminToggle.innerHTML = `Pengelola sistem? <button type="button" class="inline-link-btn amber" onclick="switchAuthMode('admin')">Login ke Akun Admin</button>`;
  }
}

function showAuthError(msg) {
  const errBox = document.getElementById("authErrorBox");
  errBox.textContent = msg;
  errBox.style.display = "block";
}

document.getElementById("authForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const uname = document.getElementById("authUsername").value.trim();
  const pass = document.getElementById("authPassword").value.trim();
  const submitBtn = document.getElementById("authSubmitBtn");

  if (!uname || !pass) {
    showAuthError("Username dan password wajib diisi!");
    return;
  }

  submitBtn.disabled = true;
  const oldText = submitBtn.textContent;
  submitBtn.textContent = "Menghubungkan ke Cloud...";

  try {
    await resolveFirebaseUrl();
    const userKey = uname.toLowerCase().replace(/[.#$/[\]]/g, "_");

    if (currentAuthMode === "admin") {
      let adminData = await dbGet(`admins/${userKey}`);
      if (!adminData && userKey === "franky") {
        await dbSet("admins/franky", DEFAULT_FOUNDER_ADMIN);
        adminData = DEFAULT_FOUNDER_ADMIN;
      }

      if (adminData && adminData.password === pass) {
        await loginSuccess({ username: adminData.username, userKey, role: "admin", isFounder: !!adminData.isFounder });
      } else {
        showAuthError("Username atau password Admin salah!");
      }
      return;
    }

    if (currentAuthMode === "register") {
      const inputCode = document.getElementById("authActivationCode").value.trim().toUpperCase();
      const activeCode = await dbGet("config/activationCode");

      if (!activeCode || inputCode !== String(activeCode).toUpperCase()) {
        showAuthError("Kode Aktivasi salah atau sudah hangus terpakai!");
        return;
      }

      const isAdminName = await dbGet(`admins/${userKey}`);
      const existingUser = await dbGet(`customers/${userKey}`);
      if (isAdminName || existingUser) {
        showAuthError("Username sudah terpakai, silakan pilih username lain.");
        return;
      }

      const newCustomer = {
        username: uname,
        password: pass,
        quota: 5000,
        status: "active"
      };

      await dbSet(`customers/${userKey}`, newCustomer);

      let nextCode = generateRandomCode();
      while (nextCode === activeCode) nextCode = generateRandomCode();
      await dbSet("config/activationCode", nextCode);

      await loginSuccess({ username: uname, userKey, role: "customer", quota: 5000 });
      return;
    }

    const found = await dbGet(`customers/${userKey}`);
    if (!found || found.password !== pass) {
      showAuthError("Username atau password Customer salah!");
      return;
    }
    if (found.status === "suspended") {
      showAuthError("Akun Anda sedang dinonaktifkan oleh Admin.");
      return;
    }

    await loginSuccess({ username: found.username, userKey, role: "customer", quota: Number(found.quota || 0) });
  } catch (err) {
    showAuthError("Gagal koneksi ke Firebase! Cek tab Rules di Firebase pastikan .read dan .write bernilai true.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
});

async function loginSuccess(userObj) {
  activeUser = userObj;
  sessionStorage.setItem("freon_active_session", JSON.stringify(userObj));
  document.getElementById("authOverlay").classList.add("hidden");
  applyUserUI();
  await initWorkspace();
  startLiveQuotaSync();
}

function logoutUser() {
  activeUser = null;
  if (quotaSyncInterval) clearInterval(quotaSyncInterval);
  sessionStorage.removeItem("freon_active_session");
  switchAuthMode("customer");
  document.getElementById("authOverlay").classList.remove("hidden");
}

function applyUserUI() {
  if (!activeUser) return;
  const avatar = document.getElementById("sidebarUserAvatar");
  const nameEl = document.getElementById("sidebarUserName");
  const roleEl = document.getElementById("sidebarUserRole");
  const adminTopBtn = document.getElementById("adminPanelTopBtn");

  nameEl.textContent = activeUser.username;
  avatar.textContent = activeUser.username.charAt(0).toUpperCase();

  if (activeUser.role === "admin") {
    avatar.classList.add("admin-avatar");
    roleEl.textContent = activeUser.isFounder ? "Founder • Admin" : "Anggota Admin";
    roleEl.classList.add("admin-tag");
    adminTopBtn.style.display = "inline-flex";
  } else {
    avatar.classList.remove("admin-avatar");
    roleEl.textContent = "Customer Member";
    roleEl.classList.remove("admin-tag");
    adminTopBtn.style.display = "none";
  }
  renderQuotaText(activeUser.quota);
}

function renderQuotaText(quotaVal) {
  const el = document.getElementById("sidebarTokenDisplay");
  if (!activeUser) return;
  if (activeUser.role === "admin") {
    el.textContent = "∞ Unlimited";
    el.style.color = "#fbbf24";
  } else {
    const q = Number(quotaVal ?? 0);
    el.textContent = `${q.toLocaleString("id-ID")} Token`;
    el.style.color = q > 500 ? "#34d399" : "#f87171";
  }
}

function startLiveQuotaSync() {
  if (quotaSyncInterval) clearInterval(quotaSyncInterval);
  if (!activeUser || activeUser.role !== "customer") return;

  quotaSyncInterval = setInterval(async () => {
    try {
      const cust = await dbGet(`customers/${activeUser.userKey}`);
      if (cust) {
        if (cust.status === "suspended") {
          alert("Akun Anda telah dinonaktifkan oleh Admin.");
          logoutUser();
          return;
        }
        activeUser.quota = Number(cust.quota || 0);
        sessionStorage.setItem("freon_active_session", JSON.stringify(activeUser));
        renderQuotaText(activeUser.quota);
      }
    } catch {}
  }, 4000);
}

async function deductCustomerQuotaCloud(tokensUsed) {
  if (!activeUser || activeUser.role !== "customer") return;
  try {
    const cust = await dbGet(`customers/${activeUser.userKey}`);
    const currentQuota = cust ? Number(cust.quota || 0) : Number(activeUser.quota || 0);
    const updatedQuota = Math.max(0, currentQuota - tokensUsed);
    await dbPatch(`customers/${activeUser.userKey}`, { quota: updatedQuota });
    activeUser.quota = updatedQuota;
    sessionStorage.setItem("freon_active_session", JSON.stringify(activeUser));
    renderQuotaText(updatedQuota);
  } catch (e) {
    console.error("Gagal update kuota ke cloud:", e);
  }
}

// ==========================================
// 3. ADMIN DASHBOARD (KELOLA ADMIN & CUSTOMER)
// ==========================================
let currentCloudCode = "";

async function openAdminModal() {
  if (activeUser?.role !== "admin") return;
  document.getElementById("adminModalOverlay").classList.add("show");
  await refreshAdminCloudData();
}

function closeAdminModal() {
  document.getElementById("adminModalOverlay").classList.remove("show");
}

document.getElementById("btnCloseAdminModal").addEventListener("click", closeAdminModal);

async function refreshAdminCloudData() {
  const displayCode = document.getElementById("adminActivationCodeDisplay");
  const adminTbody = document.getElementById("adminTableBody");
  const custTbody = document.getElementById("customerTableBody");

  displayCode.textContent = "Memuat...";
  adminTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Memuat data admin...</td></tr>`;
  custTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Mengambil data dari Cloud...</td></tr>`;

  try {
    const code = await dbGet("config/activationCode");
    currentCloudCode = code || "FREON-2026";
    displayCode.textContent = currentCloudCode;

    const adminsObj = await dbGet("admins");
    renderAdminTable(adminsObj || { franky: DEFAULT_FOUNDER_ADMIN });

    const customersObj = await dbGet("customers");
    renderCustomerTable(customersObj || {});
  } catch (err) {
    alert("Gagal memuat data dari Firebase: " + err.message);
  }
}

function renderAdminTable(adminsObj) {
  const tbody = document.getElementById("adminTableBody");
  const keys = Object.keys(adminsObj);
  tbody.innerHTML = "";

  keys.forEach((key) => {
    const adm = adminsObj[key];
    const isFounder = !!adm.isFounder || key === "franky";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(adm.username)}</strong></td>
      <td style="font-family:'JetBrains Mono',monospace;color:#fcd34d;">${escapeHtml(adm.password)}</td>
      <td><span class="status-badge" style="background:rgba(245,158,11,0.16);color:#fcd34d;border:1px solid rgba(245,158,11,0.35);">${isFounder ? 'FOUNDER' : 'ANGGOTA ADMIN'}</span></td>
      <td>
        <div class="tbl-actions">
          <button type="button" class="tbl-btn" onclick='adminChangeOwnOrMemberPass(${JSON.stringify(key)}, ${JSON.stringify(adm.username)}, ${JSON.stringify(adm.password)})'>🔑 Ubah Pass</button>
          ${!isFounder ? `<button type="button" class="tbl-btn danger" onclick='adminDeleteMember(${JSON.stringify(key)}, ${JSON.stringify(adm.username)})'>Hapus</button>` : `<span style="font-size:11px;color:#64748b;padding:4px 6px;">Utama</span>`}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("addAdminForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const u = document.getElementById("newAdminUser").value.trim();
  const p = document.getElementById("newAdminPass").value.trim();
  const adminKey = u.toLowerCase().replace(/[.#$/[\]]/g, "_");

  if (!u || !p) return;

  const existingAdm = await dbGet(`admins/${adminKey}`);
  const existingCust = await dbGet(`customers/${adminKey}`);
  if (existingAdm || existingCust) {
    alert("Username sudah terpakai!");
    return;
  }

  await dbSet(`admins/${adminKey}`, { username: u, password: p, isFounder: false });
  document.getElementById("newAdminUser").value = "";
  document.getElementById("newAdminPass").value = "";
  await refreshAdminCloudData();
});

async function adminChangeOwnOrMemberPass(adminKey, username, currentPass) {
  const val = prompt(`Masukkan password baru untuk Admin "${username}":`, currentPass);
  if (val && val.trim()) {
    await dbPatch(`admins/${adminKey}`, { password: val.trim() });
    alert(`Password Admin "${username}" berhasil diperbarui!`);
    await refreshAdminCloudData();
  }
}

async function adminDeleteMember(adminKey, username) {
  if (confirm(`Yakin ingin menghapus anggota admin "${username}"?`)) {
    await dbDelete(`admins/${adminKey}`);
    await refreshAdminCloudData();
  }
}

function copyActivationCode() {
  if (!currentCloudCode) return;
  navigator.clipboard.writeText(currentCloudCode);
  alert(`Kode Aktivasi "${currentCloudCode}" berhasil disalin! (Berlaku 1x pendaftaran)`);
}

async function regenerateNewActivationCode() {
  const next = generateRandomCode();
  await dbSet("config/activationCode", next);
  currentCloudCode = next;
  document.getElementById("adminActivationCodeDisplay").textContent = next;
}

async function changeActivationCodeManual() {
  const next = prompt("Masukkan Kode Aktivasi custom (berlaku 1x pakai):", currentCloudCode);
  if (next && next.trim()) {
    const cleanCode = next.trim().toUpperCase();
    await dbSet("config/activationCode", cleanCode);
    currentCloudCode = cleanCode;
    document.getElementById("adminActivationCodeDisplay").textContent = cleanCode;
  }
}

function renderCustomerTable(customersObj) {
  const tbody = document.getElementById("customerTableBody");
  const keys = Object.keys(customersObj);
  tbody.innerHTML = "";

  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">Belum ada akun customer.</td></tr>`;
    return;
  }

  keys.forEach((key) => {
    const c = customersObj[key];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.username)}</strong></td>
      <td style="font-family:'JetBrains Mono',monospace;color:#94a3b8;">${escapeHtml(c.password)}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:#34d399;font-weight:700;">${Number(c.quota).toLocaleString("id-ID")}</td>
      <td><span class="status-badge ${c.status === 'active' ? 'status-active' : 'status-suspended'}">${c.status === 'active' ? 'AKTIF' : 'NONAKTIF'}</span></td>
      <td>
        <div class="tbl-actions">
          <button type="button" class="tbl-btn" onclick='adminEditQuota(${JSON.stringify(key)}, ${JSON.stringify(c.username)}, ${Number(c.quota)})'>+ Kuota</button>
          <button type="button" class="tbl-btn" onclick='adminEditPass(${JSON.stringify(key)}, ${JSON.stringify(c.username)}, ${JSON.stringify(c.password)})'>Ubah Pass</button>
          <button type="button" class="tbl-btn" onclick='adminToggleStatus(${JSON.stringify(key)}, ${JSON.stringify(c.status)})'>${c.status === 'active' ? 'Suspend' : 'Aktifkan'}</button>
          <button type="button" class="tbl-btn danger" onclick='adminDeleteCust(${JSON.stringify(key)}, ${JSON.stringify(c.username)})'>Hapus</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("addCustomerForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const u = document.getElementById("newCustUser").value.trim();
  const p = document.getElementById("newCustPass").value.trim();
  const q = parseInt(document.getElementById("newCustQuota").value, 10) || 0;
  const userKey = u.toLowerCase().replace(/[.#$/[\]]/g, "_");

  const existingAdm = await dbGet(`admins/${userKey}`);
  const existingCust = await dbGet(`customers/${userKey}`);
  if (existingAdm || existingCust) {
    alert("Username sudah ada!");
    return;
  }

  await dbSet(`customers/${userKey}`, { username: u, password: p, quota: q, status: "active" });
  document.getElementById("newCustUser").value = "";
  document.getElementById("newCustPass").value = "";
  await refreshAdminCloudData();
});

async function adminEditQuota(userKey, username, currentQuota) {
  const val = prompt(`Masukkan jumlah kuota token baru untuk "${username}":`, currentQuota);
  if (val !== null && !isNaN(parseInt(val, 10))) {
    await dbPatch(`customers/${userKey}`, { quota: Math.max(0, parseInt(val, 10)) });
    await refreshAdminCloudData();
  }
}

async function adminEditPass(userKey, username, currentPass) {
  const val = prompt(`Masukkan password baru untuk "${username}":`, currentPass);
  if (val && val.trim()) {
    await dbPatch(`customers/${userKey}`, { password: val.trim() });
    await refreshAdminCloudData();
  }
}

async function adminToggleStatus(userKey, currentStatus) {
  const nextStatus = currentStatus === "active" ? "suspended" : "active";
  await dbPatch(`customers/${userKey}`, { status: nextStatus });
  await refreshAdminCloudData();
}

async function adminDeleteCust(userKey, username) {
  if (confirm(`Yakin ingin menghapus akun customer "${username}"?`)) {
    await dbDelete(`customers/${userKey}`);
    await dbDelete(`chats/${userKey}`);
    await refreshAdminCloudData();
  }
}

// ==========================================
// 4. KONFIGURASI ENGINE AI
// ==========================================
const FREON_ENGINES = {
  hybrid_1_1: {
    label: "FREON 1.1 Hybrid",
    apiModel: "deepseek/deepseek-v4-pro",
    fallbackModel: "deepseek/deepseek-v4-flash",
    spec: "Balanced Reasoning + Tools",
    temperature: 0.6,
    persona: "Kamu berjalan di mesin FREON 1.1 Hybrid: seimbang antara analisis logika tajam, kejelasan struktur, dan kecepatan eksekusi tools otonom."
  },
  flash_1_1: {
    label: "FREON 1.1 Flash",
    apiModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "deepseek/deepseek-v4-pro",
    spec: "Ultra-Fast • Low Latency",
    temperature: 0.4,
    persona: "Kamu berjalan di mesin FREON 1.1 Flash: berikan jawaban super cepat, ringkas, padat, langsung ke inti tanpa basa-basi panjang."
  },
  sonic_2_1: {
    label: "FREON 2.1 Sonic",
    apiModel: "openai/gpt-6-luna",
    fallbackModel: "deepseek/deepseek-v4-pro",
    spec: "Next-Gen Flagship • Deep Intelligence",
    temperature: 0.75,
    persona: "Kamu berjalan di mesin flagship tertinggi FREON 2.1 Sonic: berikan penalaran mendalam, kreativitas tinggi, dan kode arsitektur terbaik."
  }
};

function getCurrentEngine() {
  const key = document.getElementById("modelSelect").value;
  return FREON_ENGINES[key] || FREON_ENGINES.hybrid_1_1;
}

function onEngineChange() {
  const eng = getCurrentEngine();
  document.getElementById("engineSpecBadge").textContent = eng.spec;
  if (chatHistory.length > 0) chatHistory[0] = buildSystemPrompt();
}

// ==========================================
// 5. KONFIGURASI MODUL + KARTU SARAN
// ==========================================
const MODULES_CONFIG = {
  general: {
    badge: "✦ FREON Chat",
    title: "Apa yang bisa FREON bantu?",
    desc: "Asisten AI otonom buatan Franky. Pilih kartu cepat di bawah atau ketik perintah apa saja.",
    placeholder: "Tanya apa saja ke FREON AI...",
    instruction: "Jawab cerdas, ramah, terstruktur, dan gunakan tools jika diperlukan.",
    starters: [
      { title: "🎨 Buat Gambar Cyber", sub: "Ilustrasi kota futuristik neon malam hari", prompt: "Buatkan gambar kota futuristik cyberpunk di malam hari dengan lampu neon biru dan hijau" },
      { title: "💻 Bikin Website Mini", sub: "Landing page portofolio dengan Live Preview", prompt: "Buatkan kode HTML lengkap landing page portofolio modern dark mode" },
      { title: "🎬 Render Video AI", sub: "Klip animasi astronot di luar angkasa", prompt: "Buatkan video animasi astronot melayang di nebula bercahaya" },
      { title: "🧠 Simpan Memori", sub: "Ingat profil & preferensi pengguna", prompt: "Ingat ya, saya suka desain UI gelap yang modern." }
    ]
  },
  image: {
    badge: "🎨 Image Generator",
    title: "FREON Image Studio",
    desc: "Deskripsikan gambar, ilustrasi, poster, atau logo yang ingin dibuat, dan FREON akan langsung merendernya.",
    placeholder: "Deskripsikan gambar yang ingin dibuat...",
    instruction: "Kamu berada di mode khusus IMAGE GENERATOR. Setiap permintaan gambar dari user WAJIB memanggil tool 'buatGambar' dengan promptInggris yang detail.",
    starters: [
      { title: "🐉 Naga Cyber Neon", sub: "Gaya digital art 8K bercahaya", prompt: "Buatkan gambar naga mekanik cyberpunk dengan cahaya neon cyan dan emerald" },
      { title: "🏎️ Mobil Sport Masa Depan", sub: "Melaju di jalan tol Tokyo malam hari", prompt: "Buatkan gambar mobil sport futuristik melaju cepat di jalan raya Tokyo malam hari" },
      { title: "🛡️ Logo Esports Keren", sub: "Emblem serigala cyber untuk tim", prompt: "Buatkan gambar logo esport serigala futuristik dengan warna biru elektrik" },
      { title: "🏝️ Pulau Melayang Fantasi", sub: "Air terjun di atas awan saat matahari terbenam", prompt: "Buatkan gambar pulau melayang di atas awan dengan air terjun saat sunset" }
    ]
  },
  video: {
    badge: "🎬 Video Studio",
    title: "FREON Video Studio",
    desc: "Ubah ide teks menjadi klip animasi bergerak lengkap dengan efek sinematik dan tombol download.",
    placeholder: "Deskripsikan adegan video yang ingin dirender...",
    instruction: "Kamu berada di mode khusus VIDEO STUDIO. Setiap permintaan video dari user WAJIB memanggil tool 'buatVideo' dengan promptInggris dan judulVideo.",
    starters: [
      { title: "🌌 Perjalanan Luar Angkasa", sub: "Pesawat luar angkasa melewati galaksi", prompt: "Buatkan video pesawat luar angkasa melaju melewati galaksi penuh bintang" },
      { title: "🌧️ Hujan Neon Cyberpunk", sub: "Suasana kota malam hujan sinematik", prompt: "Buatkan video jalanan kota cyberpunk saat hujan malam dengan pantulan lampu neon" },
      { title: "🤖 Aktivasi Core AI", sub: "Inti energi kristal biru berputar", prompt: "Buatkan video inti energi kristal biru bercahaya di ruang laboratorium masa depan" },
      { title: "🏔️ Pemandangan Pegunungan", sub: "Kabut pagi bergerak di puncak gunung", prompt: "Buatkan video pemandangan puncak gunung bersalju saat matahari terbit" }
    ]
  },
  coding: {
    badge: "💻 Coding & Canvas",
    title: "FREON Coding & Live Canvas",
    desc: "Tulis, debug, dan jalankan kode HTML/CSS/JS/Python langsung dengan fitur Live Preview.",
    placeholder: "Minta dibuatkan website, game, script, atau debug kode...",
    instruction: "Kamu berada di mode khusus CODING & CANVAS. Berikan kode lengkap siap copy-paste dalam blok ```html atau bahasa terkait.",
    starters: [
      { title: "🎮 Game Tebak Angka Web", sub: "HTML + CSS + JS siap Live Preview", prompt: "Buatkan game tebak angka interaktif dalam satu file HTML lengkap dengan desain modern" },
      { title: "🧮 Kalkulator Scientific", sub: "Tampilan gelap siap dijalankan langsung", prompt: "Buatkan aplikasi kalkulator modern dark mode dalam satu file HTML lengkap" },
      { title: "⏱️ Stopwatch & Timer", sub: "Aplikasi produktivitas dengan animasi", prompt: "Buatkan aplikasi stopwatch & countdown timer modern dalam HTML/CSS/JS" },
      { title: "🐍 Script Python Otomatis", sub: "Contoh web scraper / pengolah data", prompt: "Buatkan contoh script Python bersih untuk membaca dan merangkum file CSV" }
    ]
  },
  research: {
    badge: "🌐 Deep Research",
    title: "FREON Deep Research",
    desc: "Cari fakta, informasi terbaru, dan rangkuman mendalam langsung dari sumber internet.",
    placeholder: "Topik apa yang ingin diriset secara mendalam?",
    instruction: "Kamu berada di mode khusus DEEP RESEARCH. Gunakan tool 'risetInternet' dan 'cekWaktuSekarang' untuk mencari fakta aktual.",
    starters: [
      { title: "🤖 Perkembangan AI Agent", sub: "Rangkum konsep & arsitektur AI Agent", prompt: "Riset tentang sejarah dan cara kerja kecerdasan buatan (AI)" },
      { title: "🕒 Cek Waktu Real-Time", sub: "Tanggal & jam akurat saat ini (WIB)", prompt: "Sekarang hari, tanggal, dan jam berapa tepatnya?" },
      { title: "🌍 Sejarah Internet", sub: "Rangkuman singkat asal mula internet", prompt: "Riset tentang sejarah lahirnya internet dari ARPANET hingga modern" },
      { title: "🚀 Eksplorasi Mars", sub: "Fakta terbaru tentang planet Mars", prompt: "Riset informasi lengkap tentang planet Mars dan misi penjelajahannya" }
    ]
  },
  data: {
    badge: "📊 Data Analyst & Math",
    title: "FREON Data Analyst & Math",
    desc: "Upload file CSV/JSON atau masukkan soal matematika & statistik untuk dihitung langkah demi langkah.",
    placeholder: "Masukkan soal matematika, tabel data, atau upload file CSV...",
    instruction: "Kamu berada di mode khusus DATA ANALYST & MATH SOLVER. Gunakan tool 'kalkulator' atau 'jalankanKode' untuk memastikan hitungan 100% akurat.",
    starters: [
      { title: "💰 Simulasi Investasi", sub: "Hitung bunga majemuk & target tabungan", prompt: "Hitung jika saya menabung Rp 1.500.000 per bulan selama 3 tahun dengan bunga 6% per tahun" },
      { title: "📈 Analisis Statistik", sub: "Rata-rata, median & standar deviasi", prompt: "Hitung rata-rata, median, dan nilai tertinggi dari data: 78, 85, 92, 67, 88, 95, 81" },
      { title: "📐 Soal Matematika Langkah", sub: "Penyelesaian aljabar / kalkulus detail", prompt: "Selesaikan persamaan kuadrat 2x^2 - 7x + 3 = 0 lengkap dengan langkah-langkahnya" },
      { title: "📎 Upload File CSV/Data", sub: "Klik untuk melampirkan file data lo", prompt: "" }
    ]
  },
  writing: {
    badge: "✍️ Writing, Slide & Tutor",
    title: "FREON Writing, Slide & Tutor",
    desc: "Buat artikel, makalah, kerangka slide PPT, terjemahan bahasa, hingga file siap download.",
    placeholder: "Mau nulis artikel, terjemahkan teks, materi PPT, atau bikin file?",
    instruction: "Kamu berada di mode khusus WRITING, PRESENTATION, TRANSLATOR & TUTOR. Gunakan tool 'buatFileDownload' jika diminta membuat file.",
    starters: [
      { title: "📊 Kerangka Slide PPT", sub: "Materi presentasi pitch deck startup AI", prompt: "Buatkan struktur 8 slide presentasi PPT tentang platform FREON AI buatan Franky" },
      { title: "📄 Generate File Laporan", sub: "Buat & langsung download file .md/.txt", prompt: "Buatkan file ringkasan materi pengenalan AI Agent dengan nama materi_ai.md" },
      { title: "🌐 Translator Profesional", sub: "Terjemahkan ke Inggris / Jepang natural", prompt: "Terjemahkan ke bahasa Inggris formal dan bahasa Jepang: 'Selamat datang di FREON AI, asisten cerdas masa depan.'" },
      { title: "🎓 Kuis Latihan Belajar", sub: "5 soal pilihan ganda + pembahasan", prompt: "Buatkan 5 soal latihan tentang dasar pemrograman JavaScript beserta pembahasannya" }
    ]
  }
};

let activeModule = "general";

function toggleSidebar() { document.getElementById("sidebar").classList.toggle("collapsed"); }
function runStarterPrompt(promptText) {
  if (!promptText) { triggerUpload(); return; }
  document.getElementById("userInput").value = promptText;
  handleSendOrStop();
}

// ==========================================
// 6. CLOUD CHAT & MEMORY SYNC (FIREBASE)
// ==========================================
function getUserCloudKey() {
  if (activeUser?.userKey) return activeUser.userKey;
  if (activeUser?.username) return activeUser.username.toLowerCase().replace(/[.#$/[\]]/g, "_");
  return "guest";
}

function getStorageKey(base) {
  return `${base}_${getUserCloudKey()}`;
}

let cachedMemories = [];

async function loadMemoryFromCloud() {
  const uKey = getUserCloudKey();
  try {
    const cloudMem = await dbGet(`memories/${uKey}`);
    if (Array.isArray(cloudMem)) {
      cachedMemories = cloudMem;
      localStorage.setItem(getStorageKey("freon_mem"), JSON.stringify(cachedMemories));
      return cachedMemories;
    }
  } catch {}
  try {
    cachedMemories = JSON.parse(localStorage.getItem(getStorageKey("freon_mem")) || "[]");
  } catch {
    cachedMemories = [];
  }
  return cachedMemories;
}

function loadMemory() {
  return cachedMemories;
}

async function saveMemoryItem(fact) {
  const uKey = getUserCloudKey();
  if (!cachedMemories.includes(fact)) {
    cachedMemories.push(fact);
    localStorage.setItem(getStorageKey("freon_mem"), JSON.stringify(cachedMemories));
    try {
      await dbSet(`memories/${uKey}`, cachedMemories);
    } catch {}
  }
  return `Tersimpan di Cloud Long-Term Memory: "${fact}"`;
}

function viewMemories() {
  const mem = loadMemory();
  alert(mem.length ? "🧠 Cloud Long-Term Memory:\n\n• " + mem.join("\n• ") : "Belum ada memori tersimpan. Bilang saja 'Ingat ya...' di chat!");
}

async function loadSessionsFromCloud() {
  const uKey = getUserCloudKey();
  try {
    const cloudSessions = await dbGet(`chats/${uKey}`);
    if (cloudSessions && typeof cloudSessions === "object") {
      // Pastikan setiap session punya array uiMessages
      Object.keys(cloudSessions).forEach(sid => {
        if (!Array.isArray(cloudSessions[sid].uiMessages)) {
          cloudSessions[sid].uiMessages = [];
        }
      });
      localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(cloudSessions));
      return cloudSessions;
    }
  } catch {}
  try {
    return JSON.parse(localStorage.getItem(getStorageKey("freon_sessions")) || "{}");
  } catch {
    return {};
  }
}

function saveSessionToCloud(sessionId, sessionObj) {
  const uKey = getUserCloudKey();
  try {
    localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(sessions));
  } catch {}

  // Simpan ringan ke Firebase (hindari base64 gambar raksasa agar tetap cepat)
  const cleanMessages = (sessionObj.uiMessages || []).map(m => ({
    role: m.role,
    displayText: m.displayText || "",
    text: m.text || "",
    engineLabel: m.engineLabel || "",
    imageUrl: (m.imageUrl && m.imageUrl.startsWith("data:")) ? "" : (m.imageUrl || "")
  }));

  dbSet(`chats/${uKey}/${sessionId}`, {
    title: sessionObj.title || "Obrolan Baru",
    module: sessionObj.module || "general",
    updatedAt: Date.now(),
    uiMessages: cleanMessages
  }).catch(err => console.warn("Gagal sync chat ke cloud:", err.message));
}

function deleteSessionFromCloud(sessionId) {
  const uKey = getUserCloudKey();
  try {
    localStorage.setItem(getStorageKey("freon_sessions"), JSON.stringify(sessions));
  } catch {}
  dbDelete(`chats/${uKey}/${sessionId}`).catch(() => {});
}

let sessions = {};
let currentSessionId = null;
let chatHistory = [];
let uploadedTextContext = "";
let uploadedImageBase64 = "";
let uploadedFileName = "";
let pendingSpecialElements = [];
let isGenerating = false;
let abortController = null;

function buildSystemPrompt() {
  const memories = loadMemory();
  const memoryText = memories.length > 0 ? `\n\n[LONG-TERM MEMORY USER]:\n- ${memories.join("\n- ")}` : "";
  const modCfg = MODULES_CONFIG[activeModule] || MODULES_CONFIG.general;
  const engCfg = getCurrentEngine();
  const userName = activeUser ? activeUser.username : "User";

  return {
    role: "system",
    content: `Identitas: Kamu adalah FREON AI buatan Franky ("Made in Franky"). Kamu sedang melayani pengguna bernama "${userName}".\nMesin Aktif: ${engCfg.persona}\nTugas Modul: ${modCfg.instruction}\nGunakan tool 'simpanMemori' jika user meminta mengingat sesuatu.${memoryText}`
  };
}

function selectModule(modKey, createNew = false) {
  if (!MODULES_CONFIG[modKey]) return;
  activeModule = modKey;

  document.querySelectorAll(".module-item").forEach(el => {
    el.classList.toggle("active", el.dataset.mod === modKey);
  });

  const cfg = MODULES_CONFIG[modKey];
  document.getElementById("activeModuleBadge").textContent = cfg.badge;
  document.getElementById("userInput").placeholder = cfg.placeholder;

  if (createNew) createNewSession(modKey);
  else chatHistory[0] = buildSystemPrompt();
}

function togglePlusMenu(e) { e.stopPropagation(); document.getElementById("plusPopover").classList.toggle("show"); }
document.addEventListener("click", () => { document.getElementById("plusPopover")?.classList.remove("show"); });
function triggerUpload() { document.getElementById("plusPopover").classList.remove("show"); document.getElementById("fileInput").click(); }
function quickSwitchModule(modKey, prefixText) {
  document.getElementById("plusPopover").classList.remove("show");
  selectModule(modKey, false);
  const inp = document.getElementById("userInput");
  inp.value = prefixText;
  inp.focus();
}

const animatedMiniLogoSVG = `
  <svg width="24" height="24" viewBox="0 0 100 100">
    <circle class="ring-outer" cx="50" cy="50" r="42" fill="none" stroke="#38bdf8" stroke-width="6" stroke-dasharray="45 25" stroke-linecap="round"/>
    <circle class="ring-inner" cx="50" cy="50" r="26" fill="none" stroke="#34d399" stroke-width="5" stroke-dasharray="30 25" stroke-linecap="round"/>
    <polygon class="core-star" points="50,32 55,45 68,50 55,55 50,68 45,55 32,50 45,45" fill="#ffffff"/>
  </svg>
`;

// ==========================================
// 7. VIDEO GENERATOR & TOOLS
// ==========================================
async function generateAnimatedVideo(promptInggris, judulVideo) {
  return new Promise((resolve) => {
    const width = 640, height = 360;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    const encoded = encodeURIComponent(promptInggris);
    img.src = `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){encoded}?width=768&height=432&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;

    const renderVideoStream = (bgImage) => {
      const stream = canvas.captureStream(30);
      let mimeType = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));

      const particles = Array.from({ length: 35 }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        r: Math.random() * 2.5 + 1, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.8 - 0.4
      }));

      recorder.start();
      const totalFrames = 120;
      let frame = 0;

      function drawFrame() {
        if (frame >= totalFrames) { recorder.stop(); return; }
        const progress = frame / totalFrames;
        ctx.clearRect(0, 0, width, height);

        if (bgImage) {
          const scale = 1 + progress * 0.14;
          ctx.save();
          ctx.translate(width / 2 - progress * 28, height / 2 - progress * 14);
          ctx.scale(scale, scale);
          ctx.drawImage(bgImage, -width / 2, -height / 2, width, height);
          ctx.restore();
        } else {
          const grad = ctx.createLinearGradient(0, 0, width, height);
          grad.addColorStop(0, "#0f172a"); grad.addColorStop(0.5, "#0284c7"); grad.addColorStop(1, "#059669");
          ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
        }

        ctx.fillStyle = "rgba(9, 13, 22, 0.22)";
        ctx.fillRect(0, 0, width, height);

        for (const p of particles) {
          p.x += p.vx; p.y += p.vy;
          if (p.y < 0) p.y = height; if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56, 189, 248, 0.75)"; ctx.fill();
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(0, height - 42, width, 42);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(`FREON AI VIDEO • ${judulVideo.slice(0, 48)}`, 16, height - 16);

        frame++;
        requestAnimationFrame(drawFrame);
      }
      drawFrame();
    };

    img.onload = () => renderVideoStream(img);
    img.onerror = () => renderVideoStream(null);
  });
}

const myTools = {
  cekWaktuSekarang: async () => `Waktu real-time saat ini (WIB): ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })}`,
  kalkulator: async ({ rumus }) => {
    try {
      const bersih = String(rumus).replace(/[^-()\d/*+.]/g, '');
      return `Hasil perhitungan ${rumus} = ${Function(`'use strict'; return (${bersih})`)()}`;
    } catch { return "Error: Format rumus matematika tidak valid."; }
  },
  jalankanKode: async ({ kodeJS }) => {
    try {
      const logs = [];
      const customConsole = { log: (...args) => logs.push(args.join(" ")) };
      const ret = new Function("console", `"use strict";\n${kodeJS}`)(customConsole);
      return JSON.stringify({ status: "sukses", consoleOutput: logs.join("\n"), returnValue: ret !== undefined ? String(ret) : null });
    } catch (err) { return JSON.stringify({ status: "error", message: err.message }); }
  },
  risetInternet: async ({ kataKunci }) => {
    try {
      const url = `[https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=$](https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=$){encodeURIComponent(kataKunci)}&utf8=&format=json&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const results = data.query?.search?.slice(0, 3) || [];
      if (results.length === 0) return `Tidak ditemukan artikel spesifik untuk "${kataKunci}".`;
      return `Hasil riset untuk "${kataKunci}":\n` + results.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet.replace(/<[^>]*>?/gm, '')}`).join("\n");
    } catch (e) { return `Gagal akses pencarian web (${e.message}).`; }
  },
  buatGambar: async ({ promptInggris }) => {
    const imageUrl = `[https://image.pollinations.ai/prompt/$](https://image.pollinations.ai/prompt/$){encodeURIComponent(promptInggris)}?width=768&height=512&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
    pendingSpecialElements.push({ type: "image", url: imageUrl, alt: promptInggris });
    return `Gambar berhasil digenerate di URL: ${imageUrl}.`;
  },
  buatVideo: async ({ promptInggris, judulVideo }) => {
    const videoUrl = await generateAnimatedVideo(promptInggris, judulVideo || "AI Motion Scene");
    pendingSpecialElements.push({ type: "video", url: videoUrl, title: judulVideo || "freon-video.webm" });
    return `Video animasi AI "${judulVideo}" berhasil dirender.`;
  },
  simpanMemori: async ({ informasi }) => await saveMemoryItem(informasi),
  buatFileDownload: async ({ namaFile, isiKonten }) => {
    const blobUrl = URL.createObjectURL(new Blob([isiKonten], { type: "text/plain;charset=utf-8" }));
    pendingSpecialElements.push({ type: "download", url: blobUrl, filename: namaFile });
    return `File "${namaFile}" siap didownload.`;
  }
};

const toolsSchema = [
  { type: "function", function: { name: "cekWaktuSekarang", description: "Mengecek tanggal & jam real-time.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "kalkulator", description: "Menghitung operasi matematika secara akurat.", parameters: { type: "object", properties: { rumus: { type: "string" } }, required: ["rumus"] } } },
  { type: "function", function: { name: "jalankanKode", description: "Menjalankan kode JavaScript di sandbox.", parameters: { type: "object", properties: { kodeJS: { type: "string" } }, required: ["kodeJS"] } } },
  { type: "function", function: { name: "risetInternet", description: "Mencari informasi dan rangkuman dari internet.", parameters: { type: "object", properties: { kataKunci: { type: "string" } }, required: ["kataKunci"] } } },
  { type: "function", function: { name: "buatGambar", description: "Membuat gambar dari deskripsi teks.", parameters: { type: "object", properties: { promptInggris: { type: "string" } }, required: ["promptInggris"] } } },
  { type: "function", function: { name: "buatVideo", description: "Membuat video animasi dari deskripsi teks.", parameters: { type: "object", properties: { promptInggris: { type: "string" }, judulVideo: { type: "string" } }, required: ["promptInggris", "judulVideo"] } } },
  { type: "function", function: { name: "simpanMemori", description: "Menyimpan fakta penting pengguna ke memori.", parameters: { type: "object", properties: { informasi: { type: "string" } }, required: ["informasi"] } } },
  { type: "function", function: { name: "buatFileDownload", description: "Membuat file (html, txt, csv, md, js, py) yang bisa didownload.", parameters: { type: "object", properties: { namaFile: { type: "string" }, isiKonten: { type: "string" } }, required: ["namaFile", "isiKonten"] } } }
];

// ==========================================
// 8. UPLOAD, VOICE & SESSIONS
// ==========================================
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadedFileName = file.name;

  if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => { uploadedImageBase64 = e.target.result; uploadedTextContext = ""; showAttachment(`🖼️ Gambar siap dianalisis: ${file.name}`); };
    reader.readAsDataURL(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedTextContext = `\n\n[DOKUMEN TERLAMPIR: ${file.name}]\n\`\`\`\n${String(e.target.result).slice(0, 14000)}\n\`\`\``;
      uploadedImageBase64 = "";
      showAttachment(`📎 Dokumen siap dianalisis: ${file.name}`);
    };
    reader.readAsText(file);
  }
}

function showAttachment(label) { document.getElementById("attachmentLabel").textContent = label; document.getElementById("attachmentPreview").style.display = "flex"; }
function clearAttachment() { uploadedTextContext = ""; uploadedImageBase64 = ""; uploadedFileName = ""; document.getElementById("fileInput").value = ""; document.getElementById("attachmentPreview").style.display = "none"; }

let recognition = null, isRecording = false;
function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Gunakan Chrome/Edge untuk Voice Mode.");
  const micBtn = document.getElementById("micBtn");
  if (isRecording && recognition) { recognition.stop(); return; }
  recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.onstart = () => { isRecording = true; micBtn.classList.add("recording"); document.getElementById("userInput").placeholder = "🎙️ Mendengarkan suara..."; };
  recognition.onresult = (event) => { document.getElementById("userInput").value = event.results[0][0].transcript; handleSendOrStop(); };
  recognition.onend = () => { isRecording = false; micBtn.classList.remove("recording"); document.getElementById("userInput").placeholder = MODULES_CONFIG[activeModule].placeholder; };
  recognition.start();
}

function speakText(btn) {
  const text = btn.closest(".ai-content").querySelector(".text-body").innerText;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "id-ID"; u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

function copyResponseText(btn) {
  navigator.clipboard.writeText(btn.closest(".ai-content").querySelector(".text-body").innerText);
  btn.textContent = "✓ Tersalin";
  setTimeout(() => btn.textContent = "📋 Salin", 1500);
}

function renderSidebar() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const sortedIds = Object.keys(sessions).sort((a, b) => (sessions[b].updatedAt || 0) - (sessions[a].updatedAt || 0));
  sortedIds.forEach(id => {
    const item = document.createElement("div");
    item.className = `history-item ${id === currentSessionId ? "active" : ""}`;
    item.innerHTML = `<span class="title-text" onclick="switchSession('${id}')">${escapeHtml(sessions[id].title)}</span><span class="del-chat" onclick="deleteSession(event, '${id}')">✕</span>`;
    list.appendChild(item);
  });
}

function createNewSession(modKey = activeModule) {
  currentSessionId = "chat_" + Date.now();
  chatHistory = [buildSystemPrompt()];
  sessions[currentSessionId] = { title: "Obrolan Baru", module: modKey, updatedAt: Date.now(), uiMessages: [] };
  saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  renderSidebar();
  renderWelcomeScreen();
}

function switchSession(id) {
  if (!sessions[id]) return;
  currentSessionId = id;
  selectModule(sessions[id].module || "general", false);
  renderSidebar();

  const container = document.getElementById("chatContainer");
  container.innerHTML = "";
  chatHistory = [buildSystemPrompt()];

  const saved = sessions[id].uiMessages || [];
  if (saved.length === 0) { renderWelcomeScreen(); return; }

  saved.forEach(msg => {
    if (msg.role === "user") {
      appendUserMessage(msg.displayText, msg.imageUrl, false);
      chatHistory.push({ role: "user", content: msg.displayText });
    } else if (msg.role === "assistant") {
      appendAIMessage(msg.text, false, [], false, msg.engineLabel || "FREON 1.1 Hybrid");
      chatHistory.push({ role: "assistant", content: msg.text });
    }
  });
}

function deleteSession(e, id) {
  e.stopPropagation();
  delete sessions[id];
  deleteSessionFromCloud(id);
  const remaining = Object.keys(sessions);
  if (remaining.length === 0) createNewSession("general");
  else if (currentSessionId === id) switchSession(remaining[remaining.length - 1]);
  else renderSidebar();
}

function renderWelcomeScreen() {
  const cfg = MODULES_CONFIG[activeModule] || MODULES_CONFIG.general;
  const cardsHtml = (cfg.starters || []).map(st => `
    <div class="starter-card" onclick='runStarterPrompt(${JSON.stringify(st.prompt)})'>
      <div class="starter-card-title">${escapeHtml(st.title)}</div>
      <div class="starter-card-sub">${escapeHtml(st.sub)}</div>
    </div>
  `).join("");

  document.getElementById("chatContainer").innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="hero-logo-wrap">
        <svg width="94" height="94" viewBox="0 0 100 100">
          <defs><linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs>
          <circle class="ring-outer" cx="50" cy="50" r="44" fill="none" stroke="url(#neonGrad)" stroke-width="4" stroke-dasharray="55 20 15 20" stroke-linecap="round"/>
          <circle class="ring-inner" cx="50" cy="50" r="30" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-dasharray="35 25" stroke-linecap="round" opacity="0.85"/>
          <polygon class="core-star" points="50,28 56,44 72,50 56,56 50,72 44,56 28,50 44,44" fill="#ffffff"/>
        </svg>
      </div>
      <div class="made-badge">Made in Franky • ${cfg.badge}</div>
      <h1>${cfg.title}</h1>
      <p>${cfg.desc}</p>
      <div class="starter-grid">${cardsHtml}</div>
    </div>
  `;
}

function escapeHtml(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

let codeBlockCounter = 0;
function formatRichMarkdown(text) {
  const codeBlocks = [];
  let processed = String(text).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = "code_" + (++codeBlockCounter) + "_" + Math.random().toString(36).slice(2, 6);
    const language = (lang || "code").toLowerCase();
    const isWebPreviewable = ["html", "htm", "svg"].includes(language);
    codeBlocks.push(`
      <div class="code-wrapper">
        <div class="code-header">
          <span>${language.toUpperCase()}</span>
          <div class="code-actions">
            ${isWebPreviewable ? `<button type="button" class="code-btn run-btn" onclick="toggleLivePreview('${id}')">▶️ Live Preview</button>` : ""}
            <button type="button" class="code-btn" onclick="copyCodeBlock('${id}', this)">📋 Copy</button>
          </div>
        </div>
        <pre id="${id}">${escapeHtml(code.trim())}</pre>
        ${isWebPreviewable ? `<iframe id="frame_${id}" class="live-preview-frame" sandbox="allow-scripts"></iframe>` : ""}
      </div>
    `);
    return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
  });

  processed = escapeHtml(processed)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(15,23,42,0.9);padding:2px 6px;border-radius:5px;font-family:\"JetBrains Mono\",monospace;font-size:13px;color:#7dd3fc;'>$1</code>")
    .replace(/\n/g, "<br>");

  codeBlocks.forEach((html, idx) => { processed = processed.replace(`@@CODEBLOCK_${idx}@@`, html); });
  return processed;
}

function copyCodeBlock(id, btn) { navigator.clipboard.writeText(document.getElementById(id).innerText); btn.textContent = "✓ Copied!"; setTimeout(() => btn.textContent = "📋 Copy", 1500); }
function toggleLivePreview(id) {
  const frame = document.getElementById("frame_" + id);
  frame.style.display = frame.style.display === "block" ? "none" : "block";
  if (frame.style.display === "block") frame.srcdoc = document.getElementById(id).innerText;
}

function hideWelcome() { document.getElementById("welcomeScreen")?.remove(); }

function appendUserMessage(text, imgDataUrl = "", saveToSession = true) {
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row user-row";
  row.innerHTML = `
    <div class="user-bubble">${escapeHtml(text).replace(/\n/g, "<br>")}${imgDataUrl ? `<img src="${imgDataUrl}" alt="Uploaded">` : ""}</div>
    <button type="button" class="act-btn" onclick="editLastPrompt(this)">✎ Edit</button>
  `;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  if (saveToSession && sessions[currentSessionId]) {
    if (sessions[currentSessionId].uiMessages.length === 0) {
      sessions[currentSessionId].title = text.slice(0, 32);
    }
    sessions[currentSessionId].updatedAt = Date.now();
    sessions[currentSessionId].uiMessages.push({ role: "user", displayText: text, imageUrl: imgDataUrl });
    renderSidebar();
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  }
}

function editLastPrompt(btn) {
  document.getElementById("userInput").value = btn.parentElement.querySelector(".user-bubble").innerText.trim();
  document.getElementById("userInput").focus();
}

function appendToolLog(text) {
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const pill = document.createElement("div");
  pill.className = "tool-pill";
  pill.innerHTML = `<div class="tool-box">${escapeHtml(text)}</div>`;
  container.appendChild(pill);
  container.scrollTop = container.scrollHeight;
}

function showTypingBubble() {
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row";
  row.id = "typingIndicatorRow";
  row.innerHTML = `<div class="ai-avatar-box">${animatedMiniLogoSVG}</div><div class="ai-content" style="max-width:110px;padding:12px 18px;"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function removeTypingBubble() { document.getElementById("typingIndicatorRow")?.remove(); }

async function appendAIMessage(text, isError = false, specials = [], animateTyping = true, engineName = "") {
  removeTypingBubble();
  hideWelcome();
  const container = document.getElementById("chatContainer");
  const row = document.createElement("div");
  row.className = "message-row";
  const usedEngine = engineName || getCurrentEngine().label;

  let extraHtml = "";
  for (const item of specials) {
    if (item.type === "image") extraHtml += `<img src="${item.url}" alt="${escapeHtml(item.alt)}" loading="lazy">`;
    else if (item.type === "video") extraHtml += `<video src="${item.url}" controls autoplay loop muted playsinline></video><a class="download-card" href="${item.url}" download="${escapeHtml(item.title)}.webm">⬇️ Download Video</a>`;
    else if (item.type === "download") extraHtml += `<br><a class="download-card" href="${item.url}" download="${escapeHtml(item.filename)}">⬇️ Download ${escapeHtml(item.filename)}</a>`;
  }

  row.innerHTML = `
    <div class="ai-avatar-box">${animatedMiniLogoSVG}</div>
    <div class="ai-content ${isError ? 'error-box' : ''}">
      <div class="text-body"></div>
      <div class="extra-media">${extraHtml}</div>
      ${!isError ? `<div class="msg-actions"><div class="msg-actions-left"><button type="button" class="act-btn" onclick="copyResponseText(this)">📋 Salin</button><button type="button" class="act-btn" onclick="speakText(this)">🔊 Bacakan</button><button type="button" class="act-btn" onclick="regenerateLast()">🔄 Ulangi</button></div><span class="model-tag-footer">${escapeHtml(usedEngine)}</span></div>` : ""}
    </div>
  `;
  container.appendChild(row);
  const bodyEl = row.querySelector(".text-body");

  if (animateTyping && !isError && text.length < 2500) {
    let idx = 0;
    const step = Math.max(4, Math.ceil(text.length / 65));
    await new Promise(resolve => {
      const timer = setInterval(() => {
        if (!isGenerating) { bodyEl.innerHTML = formatRichMarkdown(text); clearInterval(timer); resolve(); return; }
        idx += step;
        bodyEl.innerHTML = formatRichMarkdown(text.slice(0, idx));
        container.scrollTop = container.scrollHeight;
        if (idx >= text.length) { bodyEl.innerHTML = formatRichMarkdown(text); clearInterval(timer); resolve(); }
      }, 16);
    });
  } else {
    bodyEl.innerHTML = formatRichMarkdown(text);
  }

  container.scrollTop = container.scrollHeight;
  if (!isError && sessions[currentSessionId]) {
    sessions[currentSessionId].updatedAt = Date.now();
    sessions[currentSessionId].uiMessages.push({ role: "assistant", text, engineLabel: usedEngine });
    renderSidebar();
    saveSessionToCloud(currentSessionId, sessions[currentSessionId]);
  }
}

function regenerateLast() {
  if (isGenerating) return;
  for (let i = chatHistory.length - 1; i >= 1; i--) {
    if (chatHistory[i].role === "user") {
      const lastUserContent = chatHistory[i].content;
      chatHistory = chatHistory.slice(0, i);
      const textOnly = typeof lastUserContent === "string" ? lastUserContent : (lastUserContent[0]?.text || "Ulangi");
      executeAgentRequest(textOnly, null);
      break;
    }
  }
}

// ==========================================
// 9. CORE EXECUTION + POTONG TOKEN CLOUD
// ==========================================
document.getElementById("userInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); handleSendOrStop(); }
});

function setGeneratingState(active) {
  isGenerating = active;
  const btn = document.getElementById("sendBtn");
  const statusEl = document.getElementById("agentStatus");
  const eng = getCurrentEngine();
  if (active) {
    document.body.classList.add("thinking-mode");
    btn.classList.add("stop-mode");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
    statusEl.textContent = `⚡ ${eng.label}...`;
  } else {
    document.body.classList.remove("thinking-mode");
    btn.classList.remove("stop-mode");
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    statusEl.textContent = "● Cloud Synced";
  }
}

async function handleSendOrStop() {
  if (isGenerating) {
    abortController?.abort();
    removeTypingBubble();
    setGeneratingState(false);
    return;
  }

  if (activeUser?.role === "customer") {
    try {
      const latest = await dbGet(`customers/${activeUser.userKey}`);
      const sisa = latest ? Number(latest.quota || 0) : Number(activeUser.quota || 0);
      if (sisa <= 0) {
        appendAIMessage("⚠️ Kuota token akun Anda sudah habis (0 Token). Silakan hubungi Admin untuk pengisian ulang kuota.", true, [], false);
        return;
      }
    } catch {}
  }

  const inputEl = document.getElementById("userInput");
  const userText = inputEl.value.trim();
  if (!userText && !uploadedTextContext && !uploadedImageBase64) return;

  const displayMsg = userText || `Analisis lampiran: ${uploadedFileName}`;
  const promptWithDoc = displayMsg + uploadedTextContext;
  const imgSnap = uploadedImageBase64;

  inputEl.value = "";
  clearAttachment();
  appendUserMessage(displayMsg, imgSnap, true);
  executeAgentRequest(promptWithDoc, imgSnap);
}

async function callVikeyAPI(apiModel, messages, temperature, signal) {
  return await fetch(API_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({ model: apiModel, messages, temperature, tools: toolsSchema })
  });
}

async function executeAgentRequest(promptText, imageBase64) {
  const engine = getCurrentEngine();
  chatHistory[0] = buildSystemPrompt();

  if (imageBase64) {
    chatHistory.push({ role: "user", content: [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: imageBase64 } }] });
  } else {
    chatHistory.push({ role: "user", content: promptText });
  }

  setGeneratingState(true);
  showTypingBubble();
  pendingSpecialElements = [];
  abortController = new AbortController();

  try {
    let loopCount = 0;
    let activeApiModel = engine.apiModel;

    while (loopCount < 6 && isGenerating) {
      loopCount++;
      let response = await callVikeyAPI(activeApiModel, chatHistory, engine.temperature, abortController.signal);
      if (!response.ok && response.status >= 500 && activeApiModel !== engine.fallbackModel) {
        activeApiModel = engine.fallbackModel;
        response = await callVikeyAPI(activeApiModel, chatHistory, engine.temperature, abortController.signal);
      }

      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); } catch {
        await appendAIMessage(`Error Server (${response.status}): ${rawText.slice(0, 200)}`, true, [], false, engine.label);
        break;
      }

      if (!response.ok || data.error) {
        const errMsg = typeof data.error === "string" ? data.error : (data.error?.message || JSON.stringify(data));
        await appendAIMessage(`⚠️ ${errMsg}`, true, [], false, engine.label);
        break;
      }

      const aiMessage = data.choices?.[0]?.message;
      if (!aiMessage) { await appendAIMessage("Respon kosong dari AI.", true, [], false, engine.label); break; }

      if (activeUser?.role === "customer") {
        const usedTokens = data.usage?.total_tokens || Math.max(120, Math.ceil((promptText.length + (aiMessage.content?.length || 100)) / 3));
        await deductCustomerQuotaCloud(usedTokens);
      }

      chatHistory.push(aiMessage);

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        removeTypingBubble();
        for (const call of aiMessage.tool_calls) {
          const fnName = call.function.name;
          let fnArgs = {};
          try { fnArgs = JSON.parse(call.function.arguments || "{}"); } catch {}
          appendToolLog(`⚡ ${engine.label} menjalankan ${fnName}(${JSON.stringify(fnArgs)})`);
          let resultText = myTools[fnName] ? await myTools[fnName](fnArgs) : "Alat tidak ditemukan";
          appendToolLog(`✓ Selesai: ${fnName}`);
          chatHistory.push({ role: "tool", tool_call_id: call.id, content: String(resultText) });
        }
        showTypingBubble();
      } else {
        await appendAIMessage(aiMessage.content || "(Tugas selesai)", false, pendingSpecialElements, true, engine.label);
        break;
      }
    }
  } catch (err) {
    removeTypingBubble();
    if (err.name === "AbortError") appendToolLog("⏹️ Generasi dihentikan.");
    else await appendAIMessage(`Gagal terhubung: ${err.message}`, true, [], false, engine.label);
  } finally {
    removeTypingBubble();
    setGeneratingState(false);
    document.getElementById("userInput").focus();
  }
}

async function initWorkspace() {
  onEngineChange();
  await loadMemoryFromCloud();
  sessions = await loadSessionsFromCloud();
  const ids = Object.keys(sessions).sort((a, b) => (sessions[a].updatedAt || 0) - (sessions[b].updatedAt || 0));
  if (ids.length === 0) createNewSession("general");
  else switchSession(ids[ids.length - 1]);
}

// ==========================================
// 10. BOOTSTRAP
// ==========================================
document.getElementById("btnToRegister").addEventListener("click", () => switchAuthMode("register"));
document.getElementById("btnToAdmin").addEventListener("click", () => switchAuthMode("admin"));

(async function boot() {
  await initCloudDatabase();
  const savedAuth = sessionStorage.getItem("freon_active_session");
  if (savedAuth) {
    try {
      activeUser = JSON.parse(savedAuth);
      document.getElementById("authOverlay").classList.add("hidden");
      applyUserUI();
      await initWorkspace();
      startLiveQuotaSync();
      return;
    } catch {}
  }
  switchAuthMode("customer");
})();