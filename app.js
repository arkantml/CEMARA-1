/* =========================================================
   CEMARA — APP.JS
   Homepage + Supabase + Auth + Admin + Upload + Comments
========================================================= */

const C = window.CEMARA_CONFIG || {};
const { createClient } = window.supabase || {};

let db = null;

let works = [];
let workEngagement = {};

let filter = "Semua";

let selected = null;

let current = null;

let user = null;

let isAdmin = false;

let editing = null;
let publicChangesChannel = null;
let requestedWorkOpened = false;
let readingFullWork = false;

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toast(message) {
  window.CEMARA.ui.announce(message);
}

/* =========================================================
   MODAL
========================================================= */

function modal(id, open = true) {
  if (open) window.CEMARA.ui.openModal(id);
  else window.CEMARA.ui.closeModal(id);
}

/* =========================================================
   SUPABASE CONFIG
========================================================= */

function isReady() {
  return Boolean(
    C.SUPABASE_URL &&
    !C.SUPABASE_URL.includes("YOUR-PROJECT") &&
    C.SUPABASE_PUBLISHABLE_KEY &&
    !C.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_"),
  );
}

/* =========================================================
   COVER (SAMPUL) KARYA
   Sampul = satu gambar unggahan (works.cover_url). Tanpa gambar,
   kartu tidak menampilkan blok visual buatan apa pun.
========================================================= */

const READ_ICON =
  '<svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

function coverMarkup(work, title) {
  const url = String(work.cover_url || "").trim();
  if (!url) return "";

  return `<button class="card-cover" type="button" data-preview="${esc(work.id)}" aria-label="Lihat detail ${esc(title)}"><img src="${esc(url)}" alt="Sampul ${esc(title)}" loading="lazy" decoding="async"></button>`;
}

/* =========================================================
   IMAGE PARSER
========================================================= */

function normalizeImages(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    const text = value.trim();

    try {
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (_) {
      /* bukan JSON */
    }

    if (
      text.startsWith("http://") ||
      text.startsWith("https://") ||
      text.startsWith("/")
    ) {
      return [text];
    }
  }

  return [];
}

/* =========================================================
   BOOT
========================================================= */

async function boot() {
  try {
    if (!isReady()) {
      const grid = $("#worksGrid");
      const skeleton = $("#worksSkeleton");

      skeleton?.classList.add("hidden");
      if (grid) {
        grid.classList.remove("hidden");
        grid.innerHTML = `
          <div class="empty-state">
            <h3>
              Supabase belum dikonfigurasi
            </h3>
            <p>
              Isi <b>config.js</b>
              dengan Project URL
              dan Publishable Key.
            </p>
          </div>
        `;
      }

      updateStatsUI(null, null, null);
      renderFeaturedWorks();
      loadCreatorsSpotlight();
      authUI();
      return;
    }

    if (!createClient) {
      $("#worksSkeleton")?.classList.add("hidden");
      toast("Library Supabase belum dimuat.");
      return;
    }

    db = createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY);

    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) {
      console.warn("Session tidak dapat dipulihkan:", sessionError.message);
      await db.auth.signOut({ scope: "local" });
    }

    user = sessionData?.session?.user || null;

    await adminCheck();

    if (userProfile?.blocked_at) {
      await db.auth.signOut();
      user = null;
      toast("Akun ini sedang diblokir. Hubungi pengelola CEMARA.");
      authUI();
      return;
    }

    await loadWorks();
    authUI();

    db.auth.onAuthStateChange(async (event, session) => {
      // INITIAL_SESSION sudah ditangani boot(); TOKEN_REFRESHED tidak mengubah peran.
      if (event === "INITIAL_SESSION") return;
      user = session?.user || null;
      if (event === "TOKEN_REFRESHED") return;

      await adminCheck();

      authUI();

      if (current) {
        await loadComments();
      }
    });

    subscribeToPublicChanges();
  } catch (error) {
    console.error("CEMARA boot error:", error);
    toast("Terjadi kesalahan saat memuat CEMARA.");
  }
}

function subscribeToPublicChanges() {
  if (!db || publicChangesChannel) return;

  publicChangesChannel = db
    .channel("cemara-public-content")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "works" },
      () =>
        void loadWorks().catch((error) =>
          console.error("Live works refresh failed:", error),
        ),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments" },
      () => void loadDynamicStats(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_profiles" },
      () => {
        void loadCreatorsSpotlight();
        void loadDynamicStats();
      },
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("CEMARA live updates unavailable:", error || status);
      }
    });
}

let userRoleData = {
  role: "user",
  isAdmin: false,
  isSuperAdmin: false,
  isDev: false,
  profile: null,
};
let userProfile = null;

async function adminCheck() {
  isAdmin = false;
  userRoleData = {
    role: "user",
    isAdmin: false,
    isSuperAdmin: false,
    isDev: false,
    profile: null,
  };
  userProfile = null;

  if (!db || !user) {
    return;
  }

  try {
    if (window.CEMARA && window.CEMARA.roleCheck) {
      await window.CEMARA.ensureProfile(db, user);
      userRoleData = await window.CEMARA.roleCheck(db, user);
      userProfile = userRoleData.profile;
      isAdmin = userRoleData.isAdmin;
      return;
    }

    const { data, error } = await db
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Admin check error:", error);
      return;
    }

    isAdmin = Boolean(data);
  } catch (error) {
    console.error("Admin check exception:", error);
  }
}

/* =========================================================
   DYNAMIC STATS
========================================================= */

async function loadDynamicStats() {
  if (!db) {
    updateStatsUI(null, null, null);
    return;
  }

  try {
    const [commentsResult, usersResult] = await Promise.all([
      db
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      db
        .from("user_profiles")
        .select("user_id", { count: "exact", head: true })
        .in("role", ["user", "admin"]),
    ]);

    if (commentsResult.error) {
      console.error("Comment count error:", commentsResult.error);
    }
    if (usersResult.error) {
      console.error("Creator count error:", usersResult.error);
    }

    updateStatsUI(
      works.length,
      commentsResult.error ? null : (commentsResult.count ?? 0),
      usersResult.error ? null : (usersResult.count ?? 0),
    );
  } catch (error) {
    console.error("Stats fetch error:", error);
    updateStatsUI(works.length, null, null);
  }
}

function updateStatsUI(wCount, cCount, aCount) {
  const wEl = $("#statWorkCount");
  const cEl = $("#statCommentCount");
  const aEl = $("#statAuthorCount");

  if (wEl) wEl.textContent = wCount == null ? "—" : String(wCount);
  if (cEl) cEl.textContent = cCount == null ? "—" : String(cCount);
  if (aEl) aEl.textContent = aCount == null ? "—" : String(aCount);
}

/* =========================================================
   FEATURED WORKS (SOROTAN KURATOR)
========================================================= */

function renderFeaturedWorks() {
  const container = $("#featuredGrid");
  if (!container) return;

  if (!works.length) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--muted);">
        Belum ada karya pilihan yang disorot.
      </div>
    `;
    return;
  }

  const featured = [...works]
    .sort((a, b) => {
      const aEngagement =
        (workEngagement[a.id]?.like_count || 0) +
        (workEngagement[a.id]?.save_count || 0);
      const bEngagement =
        (workEngagement[b.id]?.like_count || 0) +
        (workEngagement[b.id]?.save_count || 0);
      return (
        bEngagement - aEngagement ||
        new Date(b.published_at || 0) - new Date(a.published_at || 0)
      );
    })
    .slice(0, 3);

  container.innerHTML = featured
    .map((work) => {
      const title = work.title || "Tanpa Judul";
      const author = work.author || "Penulis Siswa";
      const category = work.category || "Karya";
      const description =
        work.description ||
        "Sebuah karya inspiratif dari siswa yang layak dibaca dan diapresiasi.";
      const engagement = workEngagement[work.id] || {};
      const badge =
        (engagement.like_count || 0) + (engagement.save_count || 0) > 0
          ? "Apresiasi pembaca"
          : "Karya terbaru";
      const coverHtml = coverMarkup(work, title);

      return `
      <article class="featured-card ${coverHtml ? "has-cover" : "no-cover"}">
        <span class="featured-badge">${esc(badge)}</span>
        ${coverHtml}
        <div class="work-info">
          <div class="work-category">${esc(category)}</div>
          <h3>${esc(title)}</h3>
          <p>${esc(description)}</p>
          <div class="work-footer">
            <span class="author">${esc(author)}</span>
            <div class="card-buttons">
              <button class="card-btn" type="button" data-preview="${esc(work.id)}">Sinopsis</button>
              <button class="card-btn card-btn-read" type="button" data-open="${esc(work.id)}" aria-label="Baca naskah lengkap ${esc(title)}">${READ_ICON}<span>Baca</span></button>
            </div>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  // Re-bind preview & open buttons
  container.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => preview(btn.dataset.preview));
  });
  container.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openReader(btn.dataset.open));
  });
}

/* =========================================================
   CREATOR SPOTLIGHT
========================================================= */

async function loadCreatorsSpotlight() {
  const container = $("#creatorsGrid");
  if (!container) return;

  try {
    let profiles = [];
    if (db) {
      const { data, error } = await db
        .from("user_profiles")
        .select(
          "user_id, display_name, bio, avatar_url, role, blocked_at, custom_card_emoji, custom_card_text, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      profiles = data || [];
    }

    const hiddenCreatorNames = new Set(
      profiles
        .filter((profile) => ["dev", "super_admin"].includes(profile.role))
        .map((profile) => profile.display_name?.trim().toLowerCase())
        .filter(Boolean),
    );
    profiles = profiles
      .filter(
        (profile) =>
          !profile.blocked_at && !["dev", "super_admin"].includes(profile.role),
      )
      .map((profile) => ({
        ...profile,
        workCount: works.filter(
          (work) =>
            work.author_id === profile.user_id ||
            (!work.author_id &&
              work.author?.trim().toLowerCase() ===
                profile.display_name?.trim().toLowerCase()),
        ).length,
      }))
      .filter((profile) => profile.workCount > 0);

    // If database has profiles, render them
    if (profiles.length > 0) {
      container.innerHTML = profiles
        .map((p) => {
          const name = p.display_name || "Penulis Siswa";
          const bio = p.bio?.trim();
          const avatar = p.avatar_url;
          const role = p.role || "user";
          const roleLabel =
            role === "super_admin"
              ? "Super Admin"
              : role === "admin"
                ? "Duta Literasi"
                : "Penulis Siswa";
          const workCount = p.workCount;
          const isWriterOfTheWeek = workCount >= 10;

          return `
          <div class="creator-card ${isWriterOfTheWeek ? "writer-achiever" : ""}">
            ${isWriterOfTheWeek ? '<span class="creator-star" aria-label="Penulis dengan 10 karya atau lebih">★</span>' : ""}
            <div class="creator-avatar">
              ${avatar ? `<img src="${esc(avatar)}" alt="${esc(name)}" style="width:100%; height:100%; object-fit:cover;">` : `<span>✦</span>`}
            </div>
            <h3 style="margin:0; font-family:'Erode', Georgia, serif; font-size:1.15rem; font-weight:700;">
              ${esc(name)}
            </h3>
            <span style="font-size:11px; font-weight:600; padding:2px 10px; border-radius:9999px; background:var(--surface-2); color:var(--primary); border:1px solid var(--border);">
              ${esc(roleLabel)}
            </span>
            ${bio ? `<p style="font-size:12.5px; color:var(--muted); margin:4px 0 0; line-height:1.5; font-style:italic;">${esc(bio)}</p>` : ""}
            <strong style="font-size:12px; color:var(--primary);">${workCount} karya dipublikasikan</strong>
            ${isWriterOfTheWeek && (p.custom_card_emoji || p.custom_card_text) ? `<div class="creator-custom-card">${esc(p.custom_card_emoji || "✦")} ${esc(p.custom_card_text || "Penulis pilihan CEMARA")}</div>` : ""}
          </div>
        `;
        })
        .join("");
      return;
    }

    // Use published work authors when profile rows are not available.
    const authors = [
      ...new Set(
        works
          .map((w) => w.author)
          .filter(
            (author) =>
              author && !hiddenCreatorNames.has(author.trim().toLowerCase()),
          ),
      ),
    ];
    if (!authors.length) {
      container.innerHTML =
        '<p class="creator-empty">Belum ada profil kreator yang ditampilkan.</p>';
      return;
    }

    container.innerHTML = authors
      .slice(0, 4)
      .map(
        (name) => `
      <div class="creator-card">
        <div class="creator-avatar">
          <span>${esc(name.charAt(0))}</span>
        </div>
        <h3 style="margin:0; font-family:'Erode', Georgia, serif; font-size:1.15rem; font-weight:700;">
          ${esc(name)}
        </h3>
        <span style="font-size:11px; font-weight:600; padding:2px 10px; border-radius:9999px; background:var(--surface-2); color:var(--primary); border:1px solid var(--border);">
          Penulis Siswa
        </span>
        <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0; line-height:1.5;">
          Kreator dengan karya yang tersedia di katalog CEMARA.
        </p>
        <strong style="font-size:12px; color:var(--primary);">${works.filter((work) => work.author === name).length} karya dipublikasikan</strong>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.error("Creators spotlight error:", err);
    container.innerHTML =
      '<p class="creator-empty">Profil kreator belum dapat dimuat.</p>';
  }
}

/* =========================================================
   LOAD WORKS (WITH SKELETON)
========================================================= */

async function loadWorks() {
  if (!db) return;

  const skeleton = $("#worksSkeleton");
  const grid = $("#worksGrid");

  if (skeleton) skeleton.classList.remove("hidden");
  if (grid) grid.classList.add("hidden");

  const listColumns =
    "id, title, author, author_id, category, description, cover_url, published_at, image_urls";
  let { data, error } = await db
    .from("works")
    .select(listColumns)
    .order("published_at", { ascending: false });

  if (error) {
    // Nama kolom di database mungkin berbeda: coba lagi dengan semua kolom.
    console.warn(
      "Select kolom daftar gagal, mencoba select(*):",
      error.message,
    );
    ({ data, error } = await db
      .from("works")
      .select("*")
      .order("published_at", { ascending: false }));
  }

  if (skeleton) skeleton.classList.add("hidden");
  if (grid) grid.classList.remove("hidden");

  if (error) {
    console.error("Load works error:", error);

    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <div>⚠</div>
          <h3>Gagal memuat karya</h3>
          <p>${esc(error.message)}</p>
        </div>
      `;
    }

    const featuredGrid = $("#featuredGrid");
    if (featuredGrid) {
      featuredGrid.innerHTML =
        '<p class="work-load-error">Karya belum dapat dimuat. Coba segarkan halaman.</p>';
    }
    const creatorsGrid = $("#creatorsGrid");
    if (creatorsGrid) {
      creatorsGrid.innerHTML =
        '<p class="creator-empty">Profil kreator belum dapat dimuat.</p>';
    }
    updateStatsUI(null, null, null);
    toast("Data karya belum dapat dimuat.");
    return;
  }

  works = data || [];

  render();
  await loadWorkEngagement();
  renderFeaturedWorks();
  await loadDynamicStats();
  await loadCreatorsSpotlight();

  const requestedWork = new URLSearchParams(window.location.search).get("work");
  if (requestedWork && !requestedWorkOpened) {
    requestedWorkOpened = true;
    openReader(requestedWork);
  }
}

async function loadWorkEngagement() {
  if (!db) return;
  const { data, error } = await db
    .from("work_engagement_stats")
    .select("work_id, like_count, save_count");
  if (error) {
    console.warn("Engagement stats unavailable:", error.message);
    workEngagement = {};
    return;
  }
  workEngagement = Object.fromEntries(
    (data || []).map((item) => [item.work_id, item]),
  );
}

/* =========================================================
   RENDER WORKS
========================================================= */

function render() {
  const grid = $("#worksGrid");

  if (!grid) return;

  const search = $("#searchInput");

  const query = search?.value?.trim()?.toLowerCase() || "";

  const filtered = works.filter((work) => {
    const categoryMatch = filter === "Semua" || work.category === filter;

    const searchable = [
      work.title,

      work.author,

      work.category,

      work.description,
    ]
      .map((value) => String(value || ""))
      .join(" ")
      .toLowerCase();

    const searchMatch = searchable.includes(query);

    return categoryMatch && searchMatch;
  });

  if (!filtered.length) {
    grid.innerHTML = "";

    $("#emptyState")?.classList.remove("hidden");

    return;
  }

  $("#emptyState")?.classList.add("hidden");

  grid.innerHTML = filtered
    .map((work) => {
      const title = work.title || "Tanpa Judul";
      const author = work.author || "Anonim";
      const category = work.category || "Karya";
      const description = work.description || "";
      const coverHtml = coverMarkup(work, title);

      return `
        <article class="work-card ${coverHtml ? "has-cover" : "no-cover"}">
          ${coverHtml}
          <div class="work-info">
            <div class="work-category">${esc(category)}</div>
            <h3>${esc(title)}</h3>
            <p>${esc(description)}</p>
            <div class="work-footer">
              <span class="author">${esc(author)} • ${esc(formatDate(work.published_at))}</span>
              <div class="card-buttons">
                <button class="card-btn" type="button" data-preview="${esc(work.id)}">Detail</button>
                <button class="card-btn card-btn-read" type="button" data-open="${esc(work.id)}" aria-label="Baca naskah lengkap ${esc(title)}">${READ_ICON}<span>Baca</span></button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  $$("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => preview(button.dataset.preview));
  });

  $$("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openReader(button.dataset.open));
  });
}

/* =========================================================
   PREVIEW WORK
========================================================= */

function preview(id, readFull = false) {
  selected = works.find((work) => String(work.id) === String(id));

  if (!selected) {
    toast("Karya tidak ditemukan.");
    return;
  }

  if (editing || String(current?.id) !== String(selected.id)) {
    // Jangan bawa mode edit atau draf komentar ke karya lain.
    editing = null;
    const commentText = $("#commentText");
    if (commentText) commentText.value = "";
  }
  if (String(current?.id) !== String(selected.id)) {
    const staleComments = $("#commentsList");
    if (staleComments) staleComments.innerHTML = "";
  }

  current = selected;
  readingFullWork = readFull;
  const category = $("#modalCategory");

  const title = $("#modalTitle");

  const byline = $("#modalByline");

  const description = $("#modalDescription");

  const date = $("#modalDate");

  const cover = $("#modalCover");
  const readerPanel = $("#readerPanel");
  const fullText = $("#modalFullText");
  const imageContainer = $("#modalImages");
  const readButton = $("#openWorkBtn");
  const commentName = $("#commentName");

  if (category) {
    category.textContent = selected.category || "Karya";
  }

  if (title) {
    title.textContent = selected.title || "Tanpa Judul";
  }

  if (byline) {
    byline.textContent = `Karya oleh ${selected.author || "Anonim"}`;
  }

  if (description) {
    description.textContent = selected.description || "";
  }

  if (date) {
    date.textContent = `Dipublikasikan ${formatDate(selected.published_at)}`;
  }

  if (cover) {
    const coverUrl = String(selected.cover_url || "").trim();

    cover.className = "modal-cover";
    cover.classList.toggle("hidden", !coverUrl);
    cover.innerHTML = coverUrl
      ? `<img src="${esc(coverUrl)}" alt="Sampul ${esc(selected.title || "karya")}">`
      : "";
  }

  readerPanel?.classList.toggle("hidden", !readFull);
  renderFullText(selected);
  if (readFull && selected.content === undefined)
    void loadWorkContent(selected);

  if (imageContainer) {
    const images = normalizeImages(selected.image_urls);
    imageContainer.innerHTML = images
      .map(
        (image, index) =>
          `<img src="${esc(image)}" alt="Halaman ${index + 1} karya ${esc(selected.title || "siswa")}" loading="lazy">`,
      )
      .join("");
    imageContainer.classList.toggle("hidden", images.length === 0);
  }

  if (readButton) {
    readButton.textContent = readFull
      ? "Kembali ke ringkasan"
      : "Baca naskah lengkap";
  }

  if (commentName && user) {
    commentName.value =
      userProfile?.display_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "";
  }

  modal("workModal");
  if (readFull) void loadComments();
}

function renderFullText(work) {
  const fullText = $("#modalFullText");
  if (!fullText) return;

  if (work.content === undefined) {
    fullText.innerHTML = "<p>Memuat naskah…</p>";
    return;
  }

  if (work.submission_type === "drive") {
    fullText.innerHTML = window.CEMARA.isGoogleDriveUrl(work.drive_url)
      ? `<p>Karya ini dibagikan melalui Google Drive.</p><a href="${esc(work.drive_url)}" target="_blank" rel="noopener noreferrer">Buka karya di Google Drive ↲</a>`
      : "<p>Link Google Drive belum tersedia atau tidak valid.</p>";
    return;
  }

  fullText.innerHTML = work.content
    ? esc(work.content).replace(/\r?\n/g, "<br>")
    : "<p>Naskah lengkap belum tersedia.</p>";
}

async function loadWorkContent(work) {
  if (!db || work.content !== undefined) return;

  const { data, error } = await db
    .from("works")
    .select("content, submission_type, drive_url")
    .eq("id", work.id)
    .maybeSingle();

  if (error) {
    console.warn("Naskah tidak dapat dimuat:", error.message);
    const fullText = $("#modalFullText");
    if (current?.id === work.id && fullText) {
      fullText.innerHTML = "<p>Naskah belum dapat dimuat. Coba buka lagi.</p>";
    }
    return;
  }

  work.content = data?.content ?? null;
  work.submission_type = data?.submission_type ?? "text";
  work.drive_url = data?.drive_url ?? null;
  if (current?.id === work.id) renderFullText(work);
}

/* =========================================================
   OPEN READER
========================================================= */

function openReader(id) {
  const work = works.find((item) => String(item.id) === String(id));

  if (!work) {
    toast("Karya tidak ditemukan.");

    return;
  }

  preview(work.id, true);
}

/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {
  if (!db || !current) {
    return;
  }

  const listElement = $("#commentsList");

  if (!listElement) {
    return;
  }

  try {
    const requestedWorkId = current.id;
    const { data, error } = await db
      .from("comments")
      .select("*")
      .eq("work_id", requestedWorkId)
      .eq("status", "approved")
      .order("created_at", {
        ascending: false,
      });

    if (!current || current.id !== requestedWorkId) return;

    if (error) {
      console.error("Comments error:", error);

      listElement.textContent = "Komentar belum dapat dimuat.";

      return;
    }

    const comments = data || [];

    const count = $("#commentCount");

    if (count) {
      count.textContent = `${comments.length} komentar`;
    }

    if (!comments.length) {
      listElement.innerHTML = `

        <div class="empty-comments">

          Belum ada komentar.<br>

          Jadilah yang pertama
          mengapresiasi karya ini ✦

        </div>

      `;

      return;
    }

    listElement.innerHTML = comments
      .map((comment) => {
        const canManage = isAdmin || (user && comment.user_id === user.id);

        return `

            <div class="comment-item">

              <div class="comment-top">

                <strong>
                  ${esc(comment.name || "Anonim")}
                </strong>

                <time>
                  ${esc(formatDate(comment.created_at))}
                </time>

              </div>

              <p>
                ${esc(comment.content || "")}
              </p>

              ${
                canManage
                  ? `

                    <div class="comment-actions">

                      <button
                        type="button"
                        data-edit="${esc(comment.id)}"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        data-del="${esc(comment.id)}"
                      >
                        Hapus
                      </button>

                    </div>

                  `
                  : ""
              }

            </div>

          `;
      })
      .join("");

    $$("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => editComment(button.dataset.edit));
    });

    $$("[data-del]").forEach((button) => {
      button.addEventListener("click", () => deleteComment(button.dataset.del));
    });
  } catch (error) {
    console.error("Comments loading error:", error);
  }
}

/* =========================================================
   EDIT COMMENT
========================================================= */

async function editComment(id) {
  if (!user) {
    toast("Login dulu untuk mengedit komentar.");

    return;
  }

  const { data, error } = await db
    .from("comments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    toast("Komentar tidak ditemukan.");

    return;
  }

  const allowed = isAdmin || data.user_id === user.id;

  if (!allowed) {
    toast("Kamu tidak dapat mengedit komentar ini.");

    return;
  }

  editing = data;

  const name = $("#commentName");

  const text = $("#commentText");

  if (name) {
    name.value = data.name || "";
  }

  if (text) {
    text.value = data.content || "";

    text.focus();
  }

  toast("Mode edit aktif.");
}

/* =========================================================
   DELETE COMMENT
========================================================= */

async function deleteComment(id) {
  if (!user) {
    toast("Login dulu untuk menghapus komentar.");

    return;
  }

  const { data } = await db
    .from("comments")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!data) {
    toast("Komentar tidak ditemukan.");

    return;
  }

  const allowed = isAdmin || data.user_id === user.id;

  if (!allowed) {
    toast("Kamu tidak dapat menghapus komentar ini.");

    return;
  }

  if (!window.confirm("Hapus komentar ini?")) {
    return;
  }

  const { error } = await db.from("comments").delete().eq("id", id);

  if (error) {
    toast(error.message);

    return;
  }

  toast("Komentar dihapus.");

  await loadComments();
}

/* =========================================================
   COMMENT FORM
========================================================= */

function setupCommentForm() {
  const form = $("#commentForm");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db || !current) {
      return;
    }

    const nameInput = $("#commentName");

    const textInput = $("#commentText");

    const name = nameInput?.value?.trim() || "";

    const content = textInput?.value?.trim() || "";

    if (!name) {
      toast("Nama belum diisi.");

      return;
    }

    if (!content) {
      toast("Komentar belum diisi.");

      return;
    }

    // Check content for inappropriate words
    const contentCheck = window.CEMARA.checkCommentContent(content);
    if (contentCheck.flagged) {
      toast(`⚠️ ${contentCheck.reason}. Harap perbaiki komentar Anda.`);
      return;
    }

    try {
      if (editing) {
        const { error } = await db
          .from("comments")
          .update({
            name,

            content,

            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);

        if (error) {
          toast(error.message);

          return;
        }

        editing = null;

        form.reset();

        toast(
          "Komentar diperbarui. Komentar akan tampil jika lolos pemeriksaan.",
        );

        await loadComments();

        return;
      }

      const { error } = await db.from("comments").insert({
        work_id: current.id,

        user_id: user?.id || null,

        name,

        content,
      });

      if (error) {
        toast(error.message);

        return;
      }

      form.reset();

      toast(
        "Komentar terkirim. Komentar akan tampil jika lolos pemeriksaan. ✦",
      );

      await loadComments();
    } catch (error) {
      console.error("Comment submit error:", error);

      toast("Komentar gagal diproses.");
    }
  });
}

/* =========================================================
   AUTH UI
========================================================= */

function authUI() {
  const container = $("#authView");

  if (!container) {
    return;
  }

  if (!db) {
    container.innerHTML = `

      <p>
        Isi config.js terlebih dahulu.
      </p>

    `;

    return;
  }

  if (user) {
    const uploadView = $("#uploadView");
    if (uploadView) {
      uploadView.innerHTML = "";
    }

    const name =
      userProfile?.display_name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Pengunjung";

    const role = userRoleData?.role || "user";
    const roleLabels = {
      super_admin: "Super Admin",
      admin: "Admin",
      dev: "Developer",
      user: "User / Penulis",
    };
    const roleBadges = {
      super_admin: "background:#991b1b; color:#ffffff;",
      admin: "background:#2e7d32; color:#ffffff;",
      dev: "background:#0369a1; color:#ffffff;",
      user: "background:#57534e; color:#ffffff;",
    };

    const avatarUrl = userProfile?.avatar_url;

    container.innerHTML = `

      <div class="account-welcome" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding: 10px 0;">

        <div class="account-avatar" style="width:76px; height:76px; border-radius:18px; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:12px; border:2px solid var(--primary); background:var(--surface-2); box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
          ${
            avatarUrl
              ? `<img src="${esc(avatarUrl)}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`
              : `<span style="font-size:26px; font-family:'Erode', Georgia, serif; color:var(--primary);">✦</span>`
          }
        </div>

        <h3 style="margin-bottom:4px; font-family:'Erode', Georgia, serif; font-size:1.25rem;">
          Halo, ${esc(name)}!
        </h3>

        <div style="margin-bottom:10px;">
          <span style="font-size:11px; font-weight:600; padding:3px 12px; border-radius:9999px; ${roleBadges[role] || roleBadges.user}">
            ${roleLabels[role] || "User"}
          </span>
        </div>

        <p style="font-size:13px; color:var(--muted); margin-bottom:12px;">
          ${esc(user.email || "")}
        </p>

        ${
          userProfile?.bio
            ? `<p style="font-size:12px; font-style:italic; background:var(--surface-2); padding:10px 14px; border-radius:12px; border:1px solid var(--border); margin-bottom:14px; max-width:90%;">"${esc(userProfile.bio)}"</p>`
            : ""
        }

        <!-- Direct Portal Pengelola Button -->
        <a
          href="admin/index.html"
          class="btn btn-primary"
          style="width:100%; margin-bottom:10px; display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:12px;"
        >
          <span>Buka Portal Pengelola & Profil</span> →
        </a>

        <div class="admin-note" style="margin-top:6px; font-size:12px; line-height:1.5;">
          ${
            role === "super_admin"
              ? `Hak akses <b>Super Admin</b> aktif. Anda dapat mengelola seluruh pengguna, karya, dan komentar.`
              : role === "admin"
                ? `Hak akses <b>Admin</b> aktif. Anda dapat menerbitkan dan mengelola karya siswa.`
                : role === "dev"
                  ? `Hak akses <b>Developer</b> aktif.`
                  : `Anda dapat memperbarui foto profil avatar dan biodata di Portal Profil.`
          }
        </div>

        <button
          class="btn btn-ghost"
          id="logout"
          type="button"
          style="margin-top:12px; width:100%;"
        >
          Keluar
        </button>

      </div>

    `;

    $("#logout")?.addEventListener("click", logout);

    return;
  }

  const uploadView = $("#uploadView");
  if (uploadView) {
    uploadView.innerHTML = "";
  }

  container.innerHTML = `

    <div class="auth-tabs">

      <button
        type="button"
        class="auth-tab active"
        id="loginTab"
      >
        Masuk
      </button>

      <button
        type="button"
        class="auth-tab"
        id="registerTab"
      >
        Daftar
      </button>

    </div>


    <div id="loginView">

      <p>
        Masuk ke akun CEMARA
        untuk mengelola komentar
        milikmu.
      </p>


      <form
        id="login"
        class="comment-form"
      >

        <input
          id="email"
          type="email"
          required
          placeholder="Email"
          autocomplete="email"
        >


        <input
          id="pass"
          type="password"
          required
          placeholder="Password"
          autocomplete="current-password"
        >


        <button
          class="btn btn-primary"
          type="submit"
        >
          Masuk
        </button>

      </form>

    </div>


    <div
      id="registerView"
      style="display:none;"
    >

      <p>
        Buat akun CEMARA untuk
        ikut berinteraksi dan
        mengapresiasi karya siswa.
      </p>


      <form
        id="register"
        class="comment-form"
      >

        <input
          id="registerName"
          type="text"
          maxlength="60"
          required
          placeholder="Nama kamu"
          autocomplete="name"
        >


        <input
          id="registerEmail"
          type="email"
          required
          placeholder="Email"
          autocomplete="email"
        >


        <input
          id="registerPass"
          type="password"
          minlength="6"
          required
          placeholder="Password (minimal 6 karakter)"
          autocomplete="new-password"
        >


        <input
          id="registerPassConfirm"
          type="password"
          minlength="6"
          required
          placeholder="Ulangi password"
          autocomplete="new-password"
        >


        <button
          class="btn btn-primary"
          type="submit"
        >
          Buat Akun
        </button>

      </form>


      <small class="auth-info">

        Gunakan email yang bisa
        kamu akses karena Supabase
        mungkin meminta verifikasi email.

      </small>

    </div>

  `;

  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");
  const loginView = $("#loginView");
  const registerView = $("#registerView");

  loginTab?.addEventListener("click", () => {
    loginTab.classList.add("active");
    registerTab?.classList.remove("active");
    if (loginView) loginView.style.display = "block";
    if (registerView) registerView.style.display = "none";
  });

  registerTab?.addEventListener("click", () => {
    registerTab.classList.add("active");
    loginTab?.classList.remove("active");
    if (loginView) loginView.style.display = "none";
    if (registerView) registerView.style.display = "block";
  });

  $("#login")?.addEventListener("submit", login);
  $("#register")?.addEventListener("submit", register);
}

/* =========================================================
   LOGIN
========================================================= */

async function login(event) {
  event.preventDefault();

  const email = $("#email")?.value?.trim() || "";

  const password = $("#pass")?.value || "";

  if (!email || !password) {
    return;
  }

  const submitButton = event.currentTarget.querySelector(
    'button[type="submit"]',
  );
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Memeriksa akun...";
  }

  const { data: signInData, error } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    toast(error.message);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Masuk";
    }

    return;
  }

  toast("Berhasil masuk. ✦");

  if (signInData?.user?.id) {
    const { error: activityError } = await db.from("account_activity").insert({
      user_id: signInData.user.id,
      activity_type: "login",
      summary: "Masuk ke akun CEMARA.",
    });
    if (activityError) {
      console.warn("Aktivitas login tidak tercatat:", activityError.message);
    }
  }

  window.location.href = "admin/index.html";
}

/* =========================================================
   REGISTER
========================================================= */

async function register(event) {
  event.preventDefault();

  const name = $("#registerName")?.value?.trim() || "";

  const email = $("#registerEmail")?.value?.trim() || "";

  const password = $("#registerPass")?.value || "";

  const confirmPassword = $("#registerPassConfirm")?.value || "";

  if (password !== confirmPassword) {
    toast("Konfirmasi password tidak sama.");

    return;
  }

  if (password.length < 6) {
    toast("Password minimal 6 karakter.");

    return;
  }

  const { data, error } = await db.auth.signUp({
    email,

    password,

    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    toast(error.message);

    return;
  }

  if (data?.session) {
    toast("Akun berhasil dibuat! 🎉");

    modal("adminModal", false);
  } else {
    toast("Akun dibuat! Cek email untuk verifikasi. ✉");
  }
}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    toast(error.message);

    return;
  }

  toast("Berhasil keluar. 👋");
}

/* =========================================================
   ADMIN UPLOAD UI
========================================================= */

function renderUploadUI() {
  const container = $("#uploadView");

  if (!container) {
    return;
  }

  if (!user || !isAdmin) {
    container.innerHTML = "";

    return;
  }

  container.innerHTML = `

    <div class="upload-panel">

      <div class="eyebrow">

        <span></span>
        UPLOAD KARYA

      </div>


      <h3>
        Tambahkan Karya
      </h3>


      <p>
        Upload karya teks, gambar,
        atau komik beberapa halaman.
      </p>


      <form
        id="workUploadForm"
        class="comment-form"
      >

        <input
          id="uploadTitle"
          type="text"
          maxlength="120"
          required
          placeholder="Judul karya"
        >


        <input
          id="uploadAuthor"
          type="text"
          maxlength="80"
          required
          placeholder="Nama penulis"
        >


        <select
          id="uploadCategory"
          required
        >

          <option value="">
            Pilih kategori
          </option>

          <option value="Cerpen">
            Cerpen
          </option>

          <option value="Puisi">
            Puisi
          </option>

          <option value="Esai">
            Esai
          </option>

          <option value="Seni">
            Seni
          </option>

          <option value="Komik">
            Komik
          </option>

        </select>


        <textarea
          id="uploadDescription"
          maxlength="500"
          required
          placeholder="Deskripsi singkat karya"
        ></textarea>

        <fieldset class="upload-type-options">
          <legend>Jenis unggahan</legend>
          <label>
            <input type="radio" name="uploadType" value="text" checked>
            Teks langsung
          </label>
          <label>
            <input type="radio" name="uploadType" value="drive">
            Link Google Drive
          </label>
        </fieldset>

        <label id="uploadTextField">
          Isi karya
          <textarea
            id="uploadContent"
            required
            placeholder="Tulis isi karya di sini"
          ></textarea>
        </label>

        <label id="uploadDriveField" class="hidden">
          Link Google Drive
          <input
            id="uploadDriveUrl"
            type="url"
            placeholder="https://drive.google.com/..."
            disabled
          >
        </label>


        <label>

          Sampul karya (opsional, satu gambar, maks. 5 MB)

          <input
            id="workCover"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
          >

        </label>


        <div
          id="uploadPreview"
          class="upload-preview"
        ></div>


        <button
          class="btn btn-primary"
          id="uploadImagesBtn"
          type="submit"
        >
          Publikasikan Karya
        </button>


        <div
          id="uploadStatus"
          class="upload-status"
        ></div>

      </form>

    </div>

  `;

  setupUploadForm();
}

/* =========================================================
   UPLOAD FORM
========================================================= */

function setupUploadForm() {
  const form = $("#workUploadForm");

  const input = $("#workCover");

  const preview = $("#uploadPreview");

  const status = $("#uploadStatus");
  const contentInput = $("#uploadContent");
  const driveInput = $("#uploadDriveUrl");
  const textField = $("#uploadTextField");
  const driveField = $("#uploadDriveField");

  if (!form || !input) {
    return;
  }

  const updateSubmissionFields = () => {
    const isDriveSubmission =
      form.querySelector('input[name="uploadType"]:checked')?.value === "drive";

    textField?.classList.toggle("hidden", isDriveSubmission);
    driveField?.classList.toggle("hidden", !isDriveSubmission);

    if (contentInput) {
      contentInput.required = !isDriveSubmission;
      contentInput.disabled = isDriveSubmission;
    }

    if (driveInput) {
      driveInput.required = isDriveSubmission;
      driveInput.disabled = !isDriveSubmission;
    }
  };

  form
    .querySelectorAll('input[name="uploadType"]')
    .forEach((radio) =>
      radio.addEventListener("change", updateSubmissionFields),
    );
  updateSubmissionFields();

  input.addEventListener("change", () => {
    const file = input.files[0];

    if (!preview) {
      return;
    }

    preview.innerHTML = file
      ? `
          <div class="upload-item">
            <img src="${URL.createObjectURL(file)}" alt="Pratinjau sampul">
            <span>${esc(file.name)}</span>
          </div>
        `
      : "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!user || !isAdmin) {
      toast("Hanya admin yang dapat mengunggah karya.");

      return;
    }

    const title = $("#uploadTitle")?.value?.trim() || "";

    const author = $("#uploadAuthor")?.value?.trim() || "";

    const category = $("#uploadCategory")?.value || "";

    const description = $("#uploadDescription")?.value?.trim() || "";

    const content = $("#uploadContent")?.value?.trim() || "";
    const submissionType =
      form.querySelector('input[name="uploadType"]:checked')?.value || "text";
    const driveUrl = $("#uploadDriveUrl")?.value?.trim() || "";

    const files = [...input.files];

    if (!title || !author || !category || !description) {
      toast("Lengkapi data karya terlebih dahulu.");

      return;
    }

    if (submissionType === "text" && !content) {
      toast("Isi karya belum ditambahkan.");

      return;
    }

    if (
      submissionType === "drive" &&
      !window.CEMARA.isGoogleDriveUrl(driveUrl)
    ) {
      toast("Masukkan link Google Drive atau Google Docs yang valid.");

      return;
    }

    const coverFile = files[0] || null;

    if (coverFile && !coverFile.type.startsWith("image/")) {
      toast("Sampul harus berupa gambar.");

      return;
    }

    if (coverFile && coverFile.size > 5 * 1024 * 1024) {
      toast("Ukuran sampul maksimal 5 MB.");

      return;
    }

    const submitButton = $("#uploadImagesBtn");

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      if (status) {
        status.textContent = files.length
          ? "Mengunggah sampul..."
          : "Menyimpan karya...";
      }

      let coverUrl = null;

      if (coverFile) {
        const extension = (coverFile.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const filename = `${user.id}/cover-${Date.now()}.${extension || "jpg"}`;

        const { error: uploadError } = await db.storage
          .from("karya")
          .upload(filename, coverFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          if (status) {
            status.textContent = "Gagal upload sampul: " + uploadError.message;
          }

          return;
        }

        coverUrl =
          db.storage.from("karya").getPublicUrl(filename).data?.publicUrl ||
          null;
      }

      if (status) {
        status.textContent = "Menyimpan karya...";
      }

      const { error } = await db.from("works").insert({
        title,
        author,
        category,
        description,
        content: submissionType === "text" ? content : "",
        submission_type: submissionType,
        drive_url: submissionType === "drive" ? driveUrl : null,
        cover_url: coverUrl,
        published_at: new Date().toISOString(),
      });

      if (error) {
        if (status) {
          status.textContent = "Gagal menyimpan karya: " + error.message;
        }

        return;
      }

      toast("Karya berhasil dipublikasikan! 🎉");

      form.reset();
      updateSubmissionFields();

      if (preview) {
        preview.innerHTML = "";
      }

      if (status) {
        status.textContent = "Karya berhasil ditambahkan.";
      }

      await loadWorks();
    } catch (error) {
      console.error("Upload error:", error);

      if (status) {
        status.textContent = "Terjadi kesalahan: " + error.message;
      }

      toast("Upload gagal.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

/* =========================================================
   HEADER / NAVIGATION
========================================================= */

function setupNavigation() {
  document.addEventListener("cemara:beforeopen", (event) => {
    if (event.detail?.id === "adminModal") authUI();
  });

  /*
    Detail karya:
    tetap buka preview modal.
  */

  $("#openWorkBtn")?.addEventListener("click", () => {
    if (!selected) return;

    if (readingFullWork) {
      preview(selected.id);
    } else {
      openReader(selected.id);
    }
  });

  /*
    Komentar:
    langsung menuju reader.
  */

  $("#modalCommentBtn")?.addEventListener("click", () => {
    if (!selected) return;

    openReader(selected.id);
    $("#commentText")?.focus();
  });

  /*
    Search
  */

  $("#searchInput")?.addEventListener("input", render);

  /*
    Filter kategori
  */

  $$(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter || "Semua";

      $$(".filter-btn").forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      render();
    });
  });

  /*
    Reset search
  */

  $("#resetSearch")?.addEventListener("click", () => {
    const search = $("#searchInput");

    if (search) {
      search.value = "";
    }

    filter = "Semua";

    $$(".filter-btn").forEach((button) => {
      const active = button.dataset.filter === "Semua";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    render();
  });
}

/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {
  setupNavigation();

  setupCommentForm();

  setupEventDeadline();

  boot();
}

/* =========================================================
   START
========================================================= */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

function setupEventDeadline() {
  const deadline = $("#eventDeadline");
  if (!deadline) return;

  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const month = now.toLocaleDateString("id-ID", { month: "long" });

  deadline.innerHTML = `Kirim sebelum ${lastDay} ${month} <span>↗</span>`;
}
