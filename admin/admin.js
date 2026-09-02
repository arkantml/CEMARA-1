/* =========================================================
   CEMARA — ADMIN.JS (Classic Theme Edition)
   Logic for Admin & Super Admin Management Portal
========================================================= */

const C = window.CEMARA_CONFIG || {};
let db = null;
let currentUser = null;
let currentProfile = null;
let currentRoleData = null;

let allWorks = [];
let allUsers = [];
let allComments = [];
let pendingAvatarFile = null;
let currentPublishedWorkCount = 0;

/* =========================================================
   HELPERS & TOAST
========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showToast(message) {
  const toastEl = $("#toast");
  const toastMsg = $("#toastMsg");
  if (!toastEl || !toastMsg) return;

  toastMsg.textContent = message;
  toastEl.classList.remove(
    "opacity-0",
    "translate-y-20",
    "pointer-events-none",
  );
  toastEl.classList.add("opacity-100", "translate-y-0");

  clearTimeout(window.adminToastTimer);
  window.adminToastTimer = setTimeout(() => {
    toastEl.classList.add("opacity-0", "translate-y-20", "pointer-events-none");
    toastEl.classList.remove("opacity-100", "translate-y-0");
  }, 2500);
}

/* =========================================================
   THEME TOGGLE
========================================================= */

function setupTheme() {
  const saved = localStorage.getItem("cemara_theme");
  const icon = $("#themeIcon");

  if (saved === "dark") {
    document.documentElement.dataset.theme = "dark";
    if (icon) icon.textContent = "☀";
  } else {
    delete document.documentElement.dataset.theme;
    if (icon) icon.textContent = "☾";
  }

  $("#themeBtn")?.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem("cemara_theme", "light");
      if (icon) icon.textContent = "☾";
    } else {
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("cemara_theme", "dark");
      if (icon) icon.textContent = "☀";
    }
  });
}

/* =========================================================
   TAB SWITCHING
========================================================= */

window.switchTab = function switchTab(tabId) {
  const role = currentRoleData?.role || "user";

  // Permissions validation
  if (tabId === "users" && !(role === "super_admin" || role === "dev")) {
    showToast(
      "Hanya Super Admin atau Developer yang dapat mengelola pengguna.",
    );
    tabId = "dashboard";
  } else if (
    (tabId === "works" || tabId === "upload" || tabId === "comments") &&
    !(role === "admin" || role === "super_admin" || role === "dev")
  ) {
    showToast("Hanya pengelola berwenang yang dapat mengakses menu ini.");
    tabId = "dashboard";
  } else if (tabId === "dev" && !(role === "dev" || role === "super_admin")) {
    showToast(
      "Hanya Developer atau Super Admin yang dapat mengakses menu ini.",
    );
    tabId = "dashboard";
  }

  // Update tabs UI
  $$(".nav-tab").forEach((btn) => {
    const isTarget = btn.dataset.tab === tabId;
    if (isTarget) {
      btn.classList.add("bg-cemara", "text-white", "shadow-sm");
      btn.classList.remove("text-stone-700", "dark:text-stone-300");
      // Change child icon color to white
      const icon = btn.querySelector("i");
      if (icon)
        icon.className = icon.className.replace(/text-\w+-\d+/g, "text-white");
    } else {
      btn.classList.remove("bg-cemara", "text-white", "shadow-sm");
      btn.classList.add("text-stone-700", "dark:text-stone-300");
    }
  });

  // Toggle views
  $$(".tab-view").forEach((view) => {
    if (view.id === `view-${tabId}`) {
      view.classList.remove("hidden");
    } else {
      view.classList.add("hidden");
    }
  });

  // Update headings
  const headings = {
    dashboard: {
      title: "Ikhtisar Ruang Karya",
      sub: "Ringkasan kegiatan literasi dan apresiasi siswa di platform CEMARA.",
    },
    users: {
      title: "Daftar Pengguna & Akun",
      sub: "Lihat statistik penulis dan kelola status akun sesuai kewenangan role.",
    },
    works: {
      title: "Koleksi Seluruh Karya",
      sub: "Daftar semua naskah yang telah dipublikasikan di CEMARA.",
    },
    upload: {
      title: "Publikasi Karya Baru",
      sub: "Formulir kurasi dan penerbitan karya siswa ke ruang publikasi.",
    },
    comments: {
      title: "Komentar & Apresiasi Pembaca",
      sub: "Tinjau tanggapan pembaca dan kelola komentar siswa.",
    },
    dev: {
      title: "Informasi Sistem",
      sub: "Detail teknis integrasi basis data dan konfigurasi platform.",
    },
    profile: {
      title: "Profil & Biodata Penulis",
      sub: "Perbarui nama pena, foto profil avatar, dan minat membacamu.",
    },
  };

  const h = headings[tabId] || headings.dashboard;
  $("#pageHeading").textContent = h.title;
  $("#pageSubHeading").textContent = h.sub;

  if (window.lucide) {
    lucide.createIcons();
  }
};

/* =========================================================
   BOOT & AUTHENTICATION
========================================================= */

async function bootAdmin() {
  setupTheme();

  try {
    if (!window.CEMARA || !window.CEMARA.isSupabaseReady()) {
      showToast("Konfigurasi Supabase belum siap.");
      return;
    }

    db = window.CEMARA.createDB();
    if (!db) {
      showToast("Gagal memuat client Supabase.");
      return;
    }

    // Get current user session
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();
    if (sessionError) {
      console.warn(
        "Session portal tidak dapat dipulihkan:",
        sessionError.message,
      );
      await db.auth.signOut({ scope: "local" });
    }
    currentUser = sessionData?.session?.user || null;

    if (!currentUser) {
      $("#dashboardLoading")?.classList.add("is-hidden");
      showToast("Silakan masuk terlebih dahulu.");
      setTimeout(() => {
        window.location.href = "../index.html";
      }, 1200);
      return;
    }

    // Ensure profile & check role
    await window.CEMARA.ensureProfile(db, currentUser);
    currentRoleData = await window.CEMARA.roleCheck(db, currentUser);
    currentProfile = currentRoleData.profile;

    if (currentProfile?.blocked_at) {
      $("#dashboardLoading")?.classList.add("is-hidden");
      await db.auth.signOut();
      showToast("Akun ini sedang diblokir. Hubungi pengelola CEMARA.");
      setTimeout(() => {
        window.location.href = "../index.html";
      }, 1200);
      return;
    }

    // Apply role-based visibility in UI
    applyRolePermissions(currentRoleData.role);

    // Populate user profile info in UI
    renderProfileInfo();
    await loadAccountInboxActivity();

    // Load Data
    await refreshAllData();
    $("#dashboardLoading")?.classList.add("is-hidden");

    // Listen to tab clicks
    $$(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Default tab
    switchTab("dashboard");
    $("#accountChartUser")?.addEventListener("change", loadAccountStatsChart);
    $("#accountChartRange")?.addEventListener("change", loadAccountStatsChart);
    $("#userSearch")?.addEventListener("input", loadUsersList);
    $("#upAuthorSearch")?.addEventListener("input", (event) =>
      populateAuthorOptions(event.target.value),
    );
  } catch (err) {
    console.error("Admin boot error:", err);
    $("#dashboardLoading")?.classList.add("is-hidden");
    showToast("Terjadi kendala saat memuat data portal.");
  }
}

/* =========================================================
   ROLE PERMISSIONS UI GATING
========================================================= */

function applyRolePermissions(role) {
  const isSuper = role === "super_admin";
  const isAdmin = role === "admin" || role === "dev" || isSuper;
  const isDev = role === "dev" || isSuper;

  // Sidebar sections
  if (isSuper || role === "dev") {
    $("#superAdminMenu")?.classList.remove("hidden");
    $("#mobileNavUsers")?.classList.remove("hidden");
    $("#mobileNavUsers")?.classList.add("flex");
  }
  if (isAdmin) {
    $("#adminMenu")?.classList.remove("hidden");
    $("#mobileNavWorks")?.classList.remove("hidden");
    $("#mobileNavWorks")?.classList.add("flex");
    $("#mobileNavComments")?.classList.remove("hidden");
    $("#mobileNavComments")?.classList.add("flex");
  }
  if (isDev) {
    $("#devMenu")?.classList.remove("hidden");
  }

  // Set single source of truth badge
  const roleConfig = {
    super_admin: { text: "Super Admin", color: "bg-red-700 text-white" },
    admin: { text: "Admin", color: "bg-cemara text-white" },
    dev: { text: "Developer", color: "bg-sky-700 text-white" },
    user: { text: "User / Penulis", color: "bg-stone-600 text-white" },
  }[role] || { text: "User", color: "bg-stone-600 text-white" };

  const sideBadge = $("#sideRoleBadge");
  if (sideBadge) {
    sideBadge.textContent = roleConfig.text;
    sideBadge.className = `inline-block text-xs font-semibold px-3 py-1 rounded-full ${roleConfig.color} shadow-sm`;
  }
}

/* =========================================================
   RENDER PROFILE DATA IN UI
========================================================= */

function renderProfileInfo() {
  const name =
    currentProfile?.display_name ||
    currentUser.user_metadata?.name ||
    currentUser.email?.split("@")[0] ||
    "Penulis";
  const email = currentUser.email || "-";
  const avatarUrl = currentProfile?.avatar_url;

  // Sidebar
  $("#sideUserName").textContent = name;
  $("#sideUserEmail").textContent = email;
  if (avatarUrl) {
    $("#sideUserAvatar").innerHTML =
      `<img src="${window.CEMARA.esc(avatarUrl)}" alt="Avatar" class="w-full h-full object-cover">`;
  }

  // Profile Settings form
  $("#profName").value = name;
  $("#profBio").value = currentProfile?.bio || "";
  $("#profCardEmoji").value = currentProfile?.custom_card_emoji || "★";
  $("#profCardText").value = currentProfile?.custom_card_text || "";

  const roleLabel =
    {
      super_admin: "Super Admin",
      admin: "Admin",
      dev: "Developer",
      user: "User / Penulis",
    }[currentRoleData?.role] || "User";

  $("#profRoleDisplay").value = roleLabel;
  if (avatarUrl) {
    $("#profAvatarPreview").innerHTML =
      `<img src="${window.CEMARA.esc(avatarUrl)}" alt="Avatar" class="w-full h-full object-cover">`;
  }
}

/* =========================================================
   DATA LOADING & REFRESH
========================================================= */

async function refreshAllData() {
  await Promise.all([loadStatsAndWorks(), loadUsersList(), loadCommentsList()]);
  await loadAccountStatsChart();
  renderWriterOfWeek();
  if (window.lucide) {
    lucide.createIcons();
  }
}

async function loadAccountStatsChart() {
  const chart = $("#accountStatsChart");
  const select = $("#accountChartUser");
  if (!db || !chart || !select) return;

  const selectedUserId = select.value;
  const range = Number($("#accountChartRange")?.value || 7);
  select.innerHTML =
    `<option value="">Semua akun</option>` +
    allUsers
      .map(
        (profile) =>
          `<option value="${window.CEMARA.esc(profile.user_id)}">${window.CEMARA.esc(profile.display_name || "Tanpa nama")}</option>`,
      )
      .join("");
  select.value = selectedUserId;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (range - 1));

  const [{ data: activity }, { data: worksData }] = await Promise.all([
    db
      .from("account_activity")
      .select("user_id, activity_type, created_at")
      .gte("created_at", since.toISOString()),
    db
      .from("works")
      .select("author_id, published_at")
      .gte("published_at", since.toISOString()),
  ]);

  const days = Array.from({ length: range }, (_, index) => {
    const date = new Date(since);
    date.setDate(since.getDate() + index);
    return date;
  });
  const isSelected = (userId) => !selectedUserId || userId === selectedUserId;
  const workValues = days.map(
    (day) =>
      (worksData || []).filter(
        (work) => isSelected(work.author_id) && sameDay(work.published_at, day),
      ).length,
  );
  const activityValues = days.map(
    (day) =>
      (activity || []).filter(
        (item) =>
          isSelected(item.user_id) &&
          item.activity_type === "comment_added" &&
          sameDay(item.created_at, day),
      ).length,
  );
  const rangeLabel = $("#accountChartRangeLabel");
  if (rangeLabel)
    rangeLabel.textContent = `Tren karya terbit dan akun yang ditandai dalam ${range === 7 ? "1 minggu" : "1 bulan"} terakhir.`;
  renderAccountChart(chart, days, workValues, activityValues);
}

function renderWriterOfWeek() {
  const nameElement = $("#writerOfWeek");
  const metaElement = $("#writerOfWeekMeta");
  if (!nameElement) return;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);
  const counts = new Map();
  allWorks
    .filter((work) => work.published_at && new Date(work.published_at) >= since)
    .forEach((work) => {
      const profile = allUsers.find((item) => item.user_id === work.author_id);
      const key = work.author_id || work.author;
      if (!key) return;
      const current = counts.get(key) || {
        name: profile?.display_name || work.author || "Penulis",
        count: 0,
      };
      current.count += 1;
      counts.set(key, current);
    });

  const winner = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  )[0];
  nameElement.textContent = winner ? winner.name : "Belum ada penulis";
  if (metaElement)
    metaElement.textContent = winner
      ? `${winner.count} karya diterbitkan minggu ini`
      : "Belum ada karya dalam 7 hari terakhir";
}

function sameDay(value, date) {
  const current = new Date(value);
  return (
    current.getFullYear() === date.getFullYear() &&
    current.getMonth() === date.getMonth() &&
    current.getDate() === date.getDate()
  );
}

function renderAccountChart(chart, days, workValues, activityValues) {
  const width = 760;
  const height = 250;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = Math.max(1, ...workValues, ...activityValues);
  const x = (index) => left + (plotWidth * index) / (days.length - 1);
  const y = (value) => top + plotHeight - (value / maximum) * plotHeight;
  const points = (values) =>
    values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const labelStep = days.length > 14 ? 5 : 1;
  const labels = days
    .map((day, index) =>
      index % labelStep === 0 || index === days.length - 1
        ? `<text x="${x(index)}" y="238" text-anchor="middle" class="chart-label">${day.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</text>`
        : "",
    )
    .join("");
  const grid = [0, 0.5, 1]
    .map(
      (ratio) =>
        `<line x1="${left}" y1="${y(maximum * ratio)}" x2="${width - right}" y2="${y(maximum * ratio)}" class="chart-grid"/><text x="${left - 10}" y="${y(maximum * ratio) + 4}" text-anchor="end" class="chart-value">${Math.round(maximum * ratio)}</text>`,
    )
    .join("");
  const axes = `<line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="chart-axis"/><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="chart-axis"/>`;
  const dots = (values, className) =>
    values
      .map(
        (value, index) =>
          `<circle cx="${x(index)}" cy="${y(value)}" r="5" class="chart-dot ${className}"><title>${value} pada ${days[index].toLocaleDateString("id-ID", { day: "2-digit", month: "long" })}</title></circle>`,
      )
      .join("");
  chart.innerHTML = `${grid}${axes}${labels}<polyline points="${points(workValues)}" class="chart-line chart-line-work"/><polyline points="${points(activityValues)}" class="chart-line chart-line-activity"/>${dots(workValues, "chart-dot-work")}${dots(activityValues, "chart-dot-activity")}`;
}

async function recordActivity(activityType, summary, metadata = {}) {
  if (!db || !currentUser) return;
  const { error } = await db.from("account_activity").insert({
    user_id: currentUser.id,
    activity_type: activityType,
    summary,
    metadata,
  });
  if (error) console.warn("Activity log error:", error.message);
}

async function loadAccountInboxActivity() {
  if (!db || !currentUser) return;

  const [
    { data: inbox },
    { data: activity },
    { count: workCount },
    { count: tagCount },
  ] = await Promise.all([
    db
      .from("account_inbox")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("account_activity")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("author_id", currentUser.id),
    db
      .from("account_activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
      .eq("activity_type", "comment_added"),
  ]);

  const inboxItems = inbox || [];
  const activityItems = activity || [];
  currentPublishedWorkCount = workCount || 0;
  $("#profilePanel")?.classList.toggle(
    "writer-achiever-panel",
    currentPublishedWorkCount >= 10,
  );
  $("#profCardEmoji").disabled = currentPublishedWorkCount < 10;
  $("#profCardText").disabled = currentPublishedWorkCount < 10;
  if ($("#profileWorkCount"))
    $("#profileWorkCount").textContent = String(workCount || 0);
  if ($("#profileTagCount"))
    $("#profileTagCount").textContent = String(tagCount || 0);
  const unread = inboxItems.filter((item) => !item.is_read).length;
  if ($("#inboxUnreadCount"))
    $("#inboxUnreadCount").textContent = unread
      ? `${unread} belum dibaca`
      : "Sudah dibaca";
  if ($("#accountInbox"))
    $("#accountInbox").innerHTML = inboxItems.length
      ? inboxItems
          .map(
            (item) =>
              `<div class="border-b border-black/5 dark:border-white/5 pb-2 ${item.is_read ? "" : "font-semibold text-stone-800 dark:text-stone-200"}"><div>${window.CEMARA.esc(item.subject)}</div><div class="mt-0.5">${window.CEMARA.esc(item.message)}</div></div>`,
          )
          .join("")
      : "Belum ada pesan.";
  if ($("#accountActivity"))
    $("#accountActivity").innerHTML = activityItems.length
      ? activityItems
          .map(
            (item) =>
              `<div class="border-b border-black/5 dark:border-white/5 pb-2"><div>${window.CEMARA.esc(item.summary)}</div><time class="text-[10px]">${window.CEMARA.formatDate(item.created_at)}</time></div>`,
          )
          .join("")
      : "Belum ada aktivitas.";
}

async function loadStatsAndWorks() {
  if (!db) return;

  try {
    const { data: worksData, error } = await db
      .from("works")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) throw error;
    allWorks = worksData || [];

    $("#statWorks").textContent = allWorks.length;

    // Render Dashboard recent works
    const dashTbody = $("#dashWorksTbody");
    if (dashTbody) {
      if (allWorks.length === 0) {
        dashTbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-stone-500">Belum ada karya yang dipublikasikan.</td></tr>`;
      } else {
        dashTbody.innerHTML = allWorks
          .slice(0, 5)
          .map(
            (w) => `
          <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <td class="py-3 font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span class="text-cemara font-serif">${window.CEMARA.esc(w.cover_symbol || "✦")}</span>
              <span>${window.CEMARA.esc(w.title)}</span>
            </td>
            <td class="py-3 text-stone-600 dark:text-stone-400">${window.CEMARA.esc(w.author)}</td>
            <td class="py-3">
              <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cemara-soft dark:bg-cemara/20 text-cemara-dark dark:text-cemara-light">
                ${window.CEMARA.esc(w.category)}
              </span>
            </td>
            <td class="py-3 text-xs text-stone-500">${window.CEMARA.formatDate(w.published_at)}</td>
            <td class="py-3 text-right">
              <a href="../reader.html?id=${encodeURIComponent(w.id)}" target="_blank" class="p-1.5 rounded-lg text-cemara hover:bg-cemara-soft dark:hover:bg-cemara/20 inline-flex items-center" title="Baca Karya">
                <i data-lucide="book-open" class="w-4 h-4"></i>
              </a>
            </td>
          </tr>
        `,
          )
          .join("");
      }
    }

    // Render All Works in Works tab
    const allWorksTbody = $("#allWorksTableBody");
    if (allWorksTbody) {
      if (allWorks.length === 0) {
        allWorksTbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-stone-500">Belum ada karya tersimpan.</td></tr>`;
      } else {
        const canManage = ["admin", "super_admin", "dev"].includes(
          currentRoleData?.role,
        );
        allWorksTbody.innerHTML = allWorks
          .map((w) => {
            const imgCount = (w.image_urls || []).length;
            return `
            <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <td class="py-3 text-cemara font-serif font-bold text-center">${window.CEMARA.esc(w.cover_symbol || "✦")}</td>
              <td class="py-3 font-semibold text-stone-900 dark:text-stone-100">${window.CEMARA.esc(w.title)}</td>
              <td class="py-3 text-stone-600 dark:text-stone-400">${window.CEMARA.esc(w.author)}</td>
              <td class="py-3">
                <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cemara-soft dark:bg-cemara/20 text-cemara-dark dark:text-cemara-light">
                  ${window.CEMARA.esc(w.category)}
                </span>
              </td>
              <td class="py-3 text-xs text-stone-500">${imgCount > 0 ? `${imgCount} gambar` : "Naskah teks"}</td>
              <td class="py-3 text-right space-x-1">
                <a href="../reader.html?id=${encodeURIComponent(w.id)}" target="_blank" class="px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-cemara hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1">
                  <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Baca
                </a>
                ${
                  canManage
                    ? `
                  <button onclick="deleteWork('${w.id}')" class="px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 text-xs font-semibold transition-colors inline-flex items-center gap-1">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus
                  </button>
                `
                    : ""
                }
              </td>
            </tr>
          `;
          })
          .join("");
      }
    }
  } catch (err) {
    console.error("loadStatsAndWorks error:", err);
  }
}

async function loadUsersList() {
  if (!db) return;

  try {
    const { error: syncError } = await db.rpc("cemara_sync_user_profiles");
    if (syncError)
      console.warn("Could not sync auth users:", syncError.message);

    const { data: usersData, error } = await db
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not load user_profiles:", error.message);
      return;
    }

    allUsers = usersData || [];
    $("#statUsers").textContent = allUsers.length;

    const authorSelect = $("#upAuthor");
    if (authorSelect) {
      populateAuthorOptions($("#upAuthorSearch")?.value || "");
    }

    const usersTbody = $("#usersTableBody");
    if (!usersTbody) return;

    if (allUsers.length === 0) {
      usersTbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-stone-500">Belum ada data anggota.</td></tr>`;
      return;
    }

    const actorRole = currentRoleData?.role;
    const isSuper = actorRole === "super_admin";
    const isDev = actorRole === "dev";

    const userQuery = $("#userSearch")?.value.trim().toLowerCase() || "";
    const visibleUsers = allUsers.filter(
      (user) =>
        !userQuery ||
        (user.display_name || "").toLowerCase().includes(userQuery),
    );

    if (visibleUsers.length === 0) {
      usersTbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-stone-500">Nama siswa atau penulis tidak ditemukan.</td></tr>`;
      return;
    }

    usersTbody.innerHTML = visibleUsers
      .map((u) => {
        const avatar = u.avatar_url
          ? `<img src="${window.CEMARA.esc(u.avatar_url)}" class="w-8 h-8 rounded-xl object-cover border border-black/10 dark:border-white/10">`
          : `<div class="w-8 h-8 rounded-xl bg-cemara-soft dark:bg-cemara/20 text-cemara font-bold flex items-center justify-center text-xs">✦</div>`;

        const roleBadge =
          {
            super_admin:
              "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300",
            admin:
              "bg-cemara-soft text-cemara-dark dark:bg-cemara/20 dark:text-cemara-light border-cemara/30",
            dev: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300",
            user: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-300",
          }[u.role] || "bg-stone-100 text-stone-700";

        const roleLabel =
          {
            super_admin: "Super Admin",
            admin: "Admin",
            dev: "Developer",
            user: "User",
          }[u.role] || "User";
        const publishedCount = allWorks.filter(
          (work) =>
            work.author_id === u.user_id ||
            (!work.author_id &&
              work.author?.trim().toLowerCase() ===
                u.display_name?.trim().toLowerCase()),
        ).length;
        const canBlock =
          u.user_id !== currentUser.id &&
          ((isSuper && (u.role === "user" || u.role === "admin")) ||
            (isDev && (u.role === "user" || u.role === "admin")));

        return `
        <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
          <td class="py-3 flex items-center gap-3">
            ${avatar}
            <div>
              <div class="font-semibold text-stone-900 dark:text-stone-100">${window.CEMARA.esc(u.display_name || "Penulis")}</div>
              <div class="text-[11px] text-stone-500 truncate max-w-[180px]">ID: ${u.user_id}</div>
            </div>
          </td>
          <td class="py-3">
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${roleBadge}">
              ${roleLabel}
            </span>
          </td>
          <td class="py-3">
            ${
              isSuper || isDev
                ? `
              <select onchange="changeUserRole('${u.user_id}', this.value)" class="bg-white dark:bg-paper-800 border border-black/10 dark:border-white/10 text-xs text-stone-700 dark:text-stone-300 rounded-xl px-3 py-1 focus:border-cemara focus:outline-none font-semibold">
                <option value="user" ${u.role === "user" ? "selected" : ""}>User</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                <option value="dev" ${u.role === "dev" ? "selected" : ""}>Developer</option>
                <option value="super_admin" ${u.role === "super_admin" ? "selected" : ""}>Super Admin</option>
              </select>
            `
                : `<span class="text-xs text-stone-500">Hanya Super Admin</span>`
            }
          </td>
          <td class="py-3 text-xs text-stone-500">${window.CEMARA.formatDate(u.created_at)}</td>
          <td class="py-3 text-xs font-semibold text-cemara">${publishedCount} karya</td>
          <td class="py-3 text-right">
            ${
              canBlock
                ? `
              <button onclick="toggleUserBlock('${u.user_id}', ${u.blocked_at ? "false" : "true"})" class="px-2.5 py-1 rounded-xl ${u.blocked_at ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"} text-xs font-semibold transition-colors inline-flex items-center gap-1">
                <i data-lucide="${u.blocked_at ? "unlock" : "ban"}" class="w-3.5 h-3.5"></i> ${u.blocked_at ? "Buka Blokir" : "Blokir"}
              </button>
            `
                : ""
            }
            ${
              isSuper && u.user_id !== currentUser.id
                ? `
              <button onclick="deleteUserProfile('${u.user_id}')" class="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-xs font-semibold text-red-700 dark:text-red-300 transition-colors inline-flex items-center gap-1">
                <i data-lucide="user-x" class="w-3.5 h-3.5"></i> Hapus
              </button>
            `
                : `<span class="text-xs text-stone-400">-</span>`
            }
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("loadUsersList error:", err);
  }
}

function populateAuthorOptions(query = "") {
  const authorSelect = $("#upAuthor");
  if (!authorSelect) return;
  const normalizedQuery = query.trim().toLowerCase();
  const selectedValue = authorSelect.value;
  const profiles = allUsers.filter(
    (profile) =>
      !profile.blocked_at &&
      !["dev", "super_admin"].includes(profile.role) &&
      (!normalizedQuery ||
        (profile.display_name || "").toLowerCase().includes(normalizedQuery)),
  );
  authorSelect.innerHTML =
    `<option value="">Pilih akun penulis terdaftar</option>` +
    profiles
      .map(
        (profile) =>
          `<option value="${window.CEMARA.esc(profile.user_id)}">${window.CEMARA.esc(profile.display_name || "Tanpa nama")}</option>`,
      )
      .join("");
  if (profiles.some((profile) => profile.user_id === selectedValue))
    authorSelect.value = selectedValue;
}

async function loadCommentsList() {
  if (!db) return;

  try {
    // Load approved comments
    const { data: approvedData, error: approvedError } = await db
      .from("comments")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (approvedError) throw approvedError;

    // Load flagged/pending comments (danger box)
    const { data: flaggedData, error: flaggedError } = await db
      .from("comments")
      .select("*")
      .in("status", ["flagged", "pending"])
      .order("created_at", { ascending: false });

    if (flaggedError) throw flaggedError;

    allComments = approvedData || [];
    const flaggedComments = flaggedData || [];

    $("#statComments").textContent =
      (approvedData?.length || 0) + (flaggedData?.length || 0);

    const canModerate = ["admin", "super_admin", "dev"].includes(
      currentRoleData?.role,
    );

    // Render approved comments
    const commentsTbody = $("#commentsTableBody");
    if (commentsTbody) {
      if (allComments.length === 0) {
        commentsTbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-stone-500">Belum ada komentar apresiasi.</td></tr>`;
      } else {
        commentsTbody.innerHTML = allComments
          .map(
            (c) => `
          <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <td class="py-3 font-semibold text-stone-900 dark:text-stone-100">${window.CEMARA.esc(c.name || "Anonim")}</td>
            <td class="py-3 text-stone-700 dark:text-stone-300 max-w-sm truncate">${window.CEMARA.esc(c.content)}</td>
            <td class="py-3 text-xs text-stone-500">${window.CEMARA.formatDate(c.created_at)}</td>
            <td class="py-3 text-right">
              ${
                canModerate
                  ? `
                <button onclick="deleteComment('${c.id}')" class="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-xs font-semibold text-red-700 dark:text-red-300 transition-colors inline-flex items-center gap-1">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus
                </button>
              `
                  : `<span class="text-xs text-stone-400">-</span>`
              }
            </td>
          </tr>
        `,
          )
          .join("");
      }
    }

    // Render danger box (flagged comments)
    const dangerBoxTbody = $("#dangerBoxTableBody");
    if (dangerBoxTbody) {
      if (flaggedComments.length === 0) {
        dangerBoxTbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-stone-500">Belum ada komentar yang terindikasi.</td></tr>`;
      } else {
        dangerBoxTbody.innerHTML = flaggedComments
          .map(
            (c) => `
          <tr class="hover:bg-red-50/50 dark:hover:bg-red-950/30 transition-colors">
            <td class="py-3 font-semibold text-stone-900 dark:text-stone-100">${window.CEMARA.esc(c.name || "Anonim")}</td>
            <td class="py-3 text-stone-700 dark:text-stone-300 max-w-xs truncate line-clamp-2">${window.CEMARA.esc(c.content)}</td>
            <td class="py-3 text-xs text-red-600 dark:text-red-400 max-w-sm">
              <span class="inline-block bg-red-50 dark:bg-red-950/50 px-2 py-1 rounded-lg">
                ${window.CEMARA.esc(c.flagged_reason || c.is_inappropriate ? "Konten Tidak Pantas" : "Pending Review")}
              </span>
            </td>
            <td class="py-3 text-xs text-stone-500">${window.CEMARA.formatDate(c.created_at)}</td>
            <td class="py-3 text-right space-x-2">
              ${
                canModerate
                  ? `
                <button onclick="approveFlaggedComment('${c.id}')" class="px-2.5 py-1 rounded-xl bg-green-50 dark:bg-green-950/40 hover:bg-green-100 text-xs font-semibold text-green-700 dark:text-green-300 transition-colors inline-flex items-center gap-1">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i> Terima
                </button>
                <button onclick="deleteFlaggedComment('${c.id}')" class="px-2.5 py-1 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-xs font-semibold text-red-700 dark:text-red-300 transition-colors inline-flex items-center gap-1">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus
                </button>
              `
                  : `<span class="text-xs text-stone-400">-</span>`
              }
            </td>
          </tr>
        `,
          )
          .join("");
      }
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("loadCommentsList error:", err);
  }
}

/* =========================================================
   FLAGGED COMMENTS ACTIONS
========================================================= */

window.approveFlaggedComment = async function approveFlaggedComment(commentId) {
  if (!db) return;

  const confirmed = confirm(
    "Terima komentar ini? Komentar akan ditampilkan di halaman.",
  );
  if (!confirmed) return;

  try {
    const { error } = await db
      .from("comments")
      .update({ status: "approved", is_inappropriate: false })
      .eq("id", commentId);

    if (error) throw error;

    showToast("Komentar diterima dan ditampilkan! ✓");
    await loadCommentsList();
  } catch (err) {
    console.error("approveFlaggedComment error:", err);
    showToast(`Gagal: ${err.message}`);
  }
};

window.deleteFlaggedComment = async function deleteFlaggedComment(commentId) {
  if (!db) return;

  const confirmed = confirm("Hapus komentar ini secara permanen?");
  if (!confirmed) return;

  try {
    const { error } = await db.from("comments").delete().eq("id", commentId);

    if (error) throw error;

    showToast("Komentar berhasil dihapus.");
    await loadCommentsList();
  } catch (err) {
    console.error("deleteFlaggedComment error:", err);
    showToast(`Gagal: ${err.message}`);
  }
};

/* =========================================================
   ACTIONS
========================================================= */

window.changeUserRole = async function changeUserRole(targetUserId, newRole) {
  if (
    !["super_admin", "dev"].includes(currentRoleData?.role) ||
    targetUserId === currentUser?.id
  ) {
    showToast("Role akun sendiri tidak dapat diubah.");
    return;
  }

  try {
    const { error } = await db.rpc("cemara_set_role", {
      target_user_id: targetUserId,
      new_role: newRole,
    });

    if (error) throw error;

    showToast(
      `Role pengguna berhasil diubah menjadi ${newRole.toUpperCase()}! ✦`,
    );
    await loadUsersList();
  } catch (err) {
    console.error("changeUserRole error:", err);
    showToast(`Gagal: ${err.message}`);
  }
};

window.toggleUserBlock = async function toggleUserBlock(
  targetUserId,
  shouldBlock,
) {
  if (!db || targetUserId === currentUser?.id) {
    showToast("Akun sendiri tidak dapat diblokir.");
    return;
  }

  const reason = shouldBlock ? prompt("Alasan pemblokiran (opsional):") : null;
  if (shouldBlock && reason === null) return;

  try {
    const { error } = await db.rpc("cemara_set_blocked", {
      target_user_id: targetUserId,
      should_block: shouldBlock,
      reason,
    });
    if (error) throw error;
    showToast(shouldBlock ? "Akun berhasil diblokir." : "Blokir akun dicabut.");
    await loadUsersList();
  } catch (err) {
    console.error("toggleUserBlock error:", err);
    showToast(`Gagal mengubah status akun: ${err.message}`);
  }
};

window.deleteWork = async function deleteWork(workId) {
  if (!confirm("Hapus karya ini dari CEMARA?")) return;

  try {
    const { error } = await db.from("works").delete().eq("id", workId);

    if (error) throw error;

    showToast("Karya berhasil dihapus.");
    await loadStatsAndWorks();
  } catch (err) {
    console.error("deleteWork error:", err);
    showToast(`Gagal menghapus: ${err.message}`);
  }
};

window.deleteComment = async function deleteComment(commentId) {
  if (!confirm("Hapus komentar apresiasi ini?")) return;

  try {
    const { error } = await db.from("comments").delete().eq("id", commentId);

    if (error) throw error;

    showToast("Komentar berhasil dihapus.");
    await loadCommentsList();
  } catch (err) {
    console.error("deleteComment error:", err);
    showToast(`Gagal menghapus: ${err.message}`);
  }
};

window.deleteUserProfile = async function deleteUserProfile(targetUserId) {
  if (!confirm("Hapus data profil pengguna ini?")) return;

  try {
    const { error } = await db
      .from("user_profiles")
      .delete()
      .eq("user_id", targetUserId);

    if (error) throw error;

    showToast("Profil pengguna telah dihapus.");
    await loadUsersList();
  } catch (err) {
    console.error("deleteUserProfile error:", err);
    showToast(`Gagal: ${err.message}`);
  }
};

/* =========================================================
   WORK UPLOAD
========================================================= */

const uploadForm = $("#adminWorkUploadForm");
const fileInput = $("#upFiles");
const filePreview = $("#upFilesPreview");

if (fileInput && filePreview) {
  fileInput.addEventListener("change", () => {
    const files = [...fileInput.files];
    filePreview.innerHTML = files
      .map(
        (file, i) => `
      <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-cemara/30 bg-stone-100 shadow-sm">
        <img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover">
        <span class="absolute bottom-0 right-0 bg-black/70 text-[9px] px-1 text-white font-bold">${i + 1}</span>
      </div>
    `,
      )
      .join("");
  });
}

if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!["admin", "super_admin", "dev"].includes(currentRoleData?.role)) {
      showToast("Hanya pengelola berwenang yang dapat mempublikasikan karya.");
      return;
    }

    const title = $("#upTitle")?.value.trim();
    const authorId = $("#upAuthor")?.value;
    const authorProfile = allUsers.find(
      (profile) => profile.user_id === authorId,
    );
    const author = authorProfile?.display_name?.trim() || "";
    const category = $("#upCategory")?.value;
    const coverSymbol = $("#upSymbol")?.value.trim() || "✦";
    const description = $("#upDescription")?.value.trim();
    const content = $("#upContent")?.value.trim();
    const files = fileInput ? [...fileInput.files] : [];

    if (!title || !author || !category || !description) {
      showToast("Mohon lengkapi seluruh isian bertanda bintang (*).");
      return;
    }

    if (category === "Komik" && files.length === 0) {
      showToast("Kategori Komik memerlukan minimal 1 gambar/halaman komik.");
      return;
    }

    const submitBtn = $("#upSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Menyimpan Karya...</span>`;

    try {
      const imageUrls = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `${currentUser.id}/${Date.now()}-${i + 1}.${ext}`;

        const { error: storageError } = await db.storage
          .from("karya")
          .upload(filename, file, { cacheControl: "3600", upsert: false });

        if (storageError) {
          throw new Error(`Unggah gambar gagal: ${storageError.message}`);
        }

        const { data: urlData } = db.storage
          .from("karya")
          .getPublicUrl(filename);

        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
        }
      }

      const { error: insertError } = await db.from("works").insert({
        title,
        author,
        author_id: authorId || null,
        category,
        description,
        content,
        cover: "cover-green",
        cover_symbol: coverSymbol,
        image_urls: imageUrls,
        published_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      await recordActivity(
        "work_published",
        `Karya "${title}" dipublikasikan.`,
        { title, category },
      );

      showToast("Karya berhasil dipublikasikan ke CEMARA! ✦");
      uploadForm.reset();
      if (filePreview) filePreview.innerHTML = "";

      await loadStatsAndWorks();
      switchTab("works");
    } catch (err) {
      console.error("Work upload error:", err);
      showToast(`Gagal publikasi: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Publikasikan Karya</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

/* =========================================================
   PROFILE & AVATAR EDITING
========================================================= */

const avatarInput = $("#avatarInput");
if (avatarInput) {
  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Ukuran foto maksimal 2MB.");
      return;
    }

    pendingAvatarFile = file;
    const previewUrl = URL.createObjectURL(file);
    $("#profAvatarPreview").innerHTML =
      `<img src="${previewUrl}" class="w-full h-full object-cover">`;
    showToast('Foto dipilih! Klik "Simpan Foto Avatar" di samping.');
  });
}

const uploadAvatarBtn = $("#uploadAvatarBtn");
if (uploadAvatarBtn) {
  uploadAvatarBtn.addEventListener("click", async () => {
    if (!pendingAvatarFile) {
      showToast("Silakan pilih berkas foto terlebih dahulu.");
      return;
    }

    uploadAvatarBtn.disabled = true;
    uploadAvatarBtn.innerHTML = `<span>Menyimpan...</span>`;

    try {
      const ext = pendingAvatarFile.name.split(".").pop() || "jpg";
      const filename = `${currentUser.id}/avatar-${Date.now()}.${ext}`;

      const { error: storageError } = await db.storage
        .from("avatars")
        .upload(filename, pendingAvatarFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (storageError) {
        throw new Error(
          `Penyimpanan foto gagal: ${storageError.message}. Pastikan bucket 'avatars' sudah ada di Supabase.`,
        );
      }

      const { data: urlData } = db.storage
        .from("avatars")
        .getPublicUrl(filename);

      const avatarUrl = urlData?.publicUrl;

      const { error: profileError } = await db
        .from("user_profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("user_id", currentUser.id);

      if (profileError) throw profileError;

      currentProfile.avatar_url = avatarUrl;
      renderProfileInfo();
      showToast("Foto profil avatar berhasil disimpan! ✦");
      pendingAvatarFile = null;
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast(err.message);
    } finally {
      uploadAvatarBtn.disabled = false;
      uploadAvatarBtn.innerHTML = `<i data-lucide="upload" class="w-3.5 h-3.5"></i> <span>Simpan Foto Avatar</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

const profileForm = $("#profileForm");
if (profileForm) {
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const displayName = $("#profName")?.value.trim();
    const bio = $("#profBio")?.value.trim();
    const customCardEmoji = $("#profCardEmoji")?.value.trim() || "★";
    const customCardText = $("#profCardText")?.value.trim() || "";

    if (!displayName) {
      showToast("Nama tampilan tidak boleh kosong.");
      return;
    }

    const saveBtn = $("#profSaveBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>Menyimpan...</span>`;

    try {
      const { error } = await db
        .from("user_profiles")
        .update({
          display_name: displayName,
          bio: bio,
          custom_card_emoji:
            currentPublishedWorkCount >= 10
              ? customCardEmoji
              : currentProfile.custom_card_emoji,
          custom_card_text:
            currentPublishedWorkCount >= 10
              ? customCardText
              : currentProfile.custom_card_text,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.id);

      if (error) throw error;

      currentProfile.display_name = displayName;
      currentProfile.bio = bio;
      currentProfile.custom_card_emoji = customCardEmoji;
      currentProfile.custom_card_text = customCardText;
      await recordActivity("profile_updated", "Profil akun diperbarui.");
      await loadAccountInboxActivity();
      renderProfileInfo();

      showToast("Profil berhasil disimpan! ✦");
    } catch (err) {
      console.error("Profile update error:", err);
      showToast(`Gagal: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Simpan Perubahan Profil</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });
}

/* =========================================================
   REFRESH & LOGOUT
========================================================= */

$("#refreshBtn")?.addEventListener("click", async () => {
  showToast("Menyegarkan data...");
  await refreshAllData();
  showToast("Data diperbarui! ✦");
});

$("#logoutBtn")?.addEventListener("click", async () => {
  if (db) {
    await db.auth.signOut();
  }
  showToast("Keluar akun...");
  setTimeout(() => {
    window.location.href = "../index.html";
  }, 600);
});

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", bootAdmin);
