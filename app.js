/* =========================================================
   CEMARA — APP.JS
   Homepage + Supabase + Auth + Admin + Upload + Comments
========================================================= */

const C = window.CEMARA_CONFIG || {};
const { createClient } = window.supabase || {};

let db = null;

let works = [];
<<<<<<< HEAD

let filter = 'Semua';
=======
let workEngagement = {};

let filter = "Semua";
>>>>>>> 92de7e3 (amz)

let selected = null;

let current = null;

let user = null;

let isAdmin = false;

let editing = null;

<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
/* =========================================================
   HELPERS
========================================================= */

<<<<<<< HEAD
const $ = selector =>
  document.querySelector(selector);

const $$ = selector =>
  [...document.querySelectorAll(selector)];


const esc = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char])
  );


function formatDate(value) {

  if (!value) {
    return '-';
  }

  const parsed =
    new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );

}


function toast(message) {

  const element =
    $('#toast');

  if (!element) return;

  element.textContent =
    message;

  element.classList.add(
    'show'
  );

  clearTimeout(
    window.cemaraToastTimer
  );

  window.cemaraToastTimer =
    setTimeout(() => {

      element.classList.remove(
        'show'
      );

    }, 2200);

}


=======
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
  const element = $("#toast");

  if (!element) return;

  element.textContent = message;

  element.classList.add("show");

  clearTimeout(window.cemaraToastTimer);

  window.cemaraToastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2200);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   MODAL
========================================================= */

function modal(id, open = true) {
<<<<<<< HEAD

  const element =
    document.getElementById(id);

  if (!element) return;

  element.classList.toggle(
    'open',
    open
  );

  element.setAttribute(
    'aria-hidden',
    open ? 'false' : 'true'
  );

  document.body.style.overflow =
    $$('.modal-overlay.open').length
      ? 'hidden'
      : '';

}


=======
  const element = document.getElementById(id);

  if (!element) return;

  element.classList.toggle("open", open);

  element.setAttribute("aria-hidden", open ? "false" : "true");

  document.body.style.overflow = $$(".modal-overlay.open").length
    ? "hidden"
    : "";
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   SUPABASE CONFIG
========================================================= */

function isReady() {
<<<<<<< HEAD

  return Boolean(
    C.SUPABASE_URL &&
    !C.SUPABASE_URL.includes(
      'YOUR-PROJECT'
    ) &&
    C.SUPABASE_PUBLISHABLE_KEY &&
    !C.SUPABASE_PUBLISHABLE_KEY.includes(
      'YOUR_'
    )
  );

}


=======
  return Boolean(
    C.SUPABASE_URL &&
    !C.SUPABASE_URL.includes("YOUR-PROJECT") &&
    C.SUPABASE_PUBLISHABLE_KEY &&
    !C.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_"),
  );
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   IMAGE PARSER
========================================================= */

function normalizeImages(value) {
<<<<<<< HEAD

  if (Array.isArray(value)) {

    return value
      .map(item =>
        String(item || '').trim()
      )
      .filter(Boolean);

  }


  if (
    typeof value === 'string' &&
    value.trim()
  ) {

    const text =
      value.trim();


    try {

      const parsed =
        JSON.parse(text);

      if (Array.isArray(parsed)) {

        return parsed
          .map(item =>
            String(item || '').trim()
          )
          .filter(Boolean);

      }

=======
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
>>>>>>> 92de7e3 (amz)
    } catch (_) {
      /* bukan JSON */
    }

<<<<<<< HEAD

    if (
      text.startsWith('http://') ||
      text.startsWith('https://') ||
      text.startsWith('/')
    ) {

      return [text];

    }

  }


  return [];

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   BOOT
========================================================= */

async function boot() {
<<<<<<< HEAD

  try {

    if (!isReady()) {

      const grid =
        $('#worksGrid');

      if (grid) {

=======
  try {
    if (!isReady()) {
      const grid = $("#worksGrid");

      if (grid) {
>>>>>>> 92de7e3 (amz)
        grid.innerHTML = `

          <div class="empty-state">

            <div>⚙</div>

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
<<<<<<< HEAD

      }

=======
      }

      updateStatsUI(12, 35, 18);
      renderFeaturedWorks();
      loadCreatorsSpotlight();
>>>>>>> 92de7e3 (amz)

      authUI();

      return;
<<<<<<< HEAD

    }


    if (!createClient) {

      toast(
        'Library Supabase belum dimuat.'
      );

      return;

    }


    db =
      createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY
      );


    const {
      data: sessionData
    } =
      await db.auth.getSession();


    user =
      sessionData?.session?.user ||
      null;


    await adminCheck();

=======
    }

    if (!createClient) {
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

    if (user) {
      await db.from("account_activity").insert({
        user_id: user.id,
        activity_type: "login",
        summary: "Masuk ke akun CEMARA.",
      });
    }

>>>>>>> 92de7e3 (amz)
    await loadWorks();

    authUI();

<<<<<<< HEAD

    db.auth.onAuthStateChange(
      async (_, session) => {

        user =
          session?.user || null;

        await adminCheck();

        authUI();

        if (current) {
          await loadComments();
        }

      }
    );


  } catch (error) {

    console.error(
      'CEMARA boot error:',
      error
    );

    toast(
      'Terjadi kesalahan saat memuat CEMARA.'
    );

  }

}


/* =========================================================
   ADMIN CHECK
========================================================= */

async function adminCheck() {

  isAdmin = false;

=======
    db.auth.onAuthStateChange(async (_, session) => {
      user = session?.user || null;

      await adminCheck();

      authUI();

      if (current) {
        await loadComments();
      }
    });
  } catch (error) {
    console.error("CEMARA boot error:", error);

    toast("Terjadi kesalahan saat memuat CEMARA.");
  }
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
>>>>>>> 92de7e3 (amz)

  if (!db || !user) {
    return;
  }

<<<<<<< HEAD

  try {

    const {
      data,
      error
    } =
      await db
        .from('admin_profiles')
        .select('user_id')
        .eq(
          'user_id',
          user.id
        )
        .maybeSingle();


    if (error) {

      console.error(
        'Admin check error:',
        error
      );

      return;

    }


    isAdmin =
      Boolean(data);

  } catch (error) {

    console.error(
      'Admin check exception:',
      error
    );

  }

}


/* =========================================================
   LOAD WORKS
========================================================= */

async function loadWorks() {

  if (!db) return;


  const {
    data,
    error
  } =
    await db
      .from('works')
      .select('*')
      .order(
        'published_at',
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      'Load works error:',
      error
    );


    const grid =
      $('#worksGrid');

    if (grid) {

      grid.innerHTML = `

        <div class="empty-state">

          <div>⚠</div>

          <h3>
            Gagal memuat karya
          </h3>

          <p>
            ${esc(error.message)}
          </p>

        </div>

      `;

    }

    return;

  }


  works =
    data || [];


  const count =
    $('#workCount');

  if (count) {

    count.textContent =
      String(
        works.length
      ).padStart(2, '0');

  }


  render();

}

=======
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
    updateStatsUI(works.length || 12, 35, 18);
    return;
  }

  try {
    let commentsCount = 0;
    let usersCount = 0;

    const { count: cCount } = await db
      .from("comments")
      .select("*", { count: "exact", head: true });
    commentsCount = cCount || 0;

    const { count: uCount } = await db
      .from("user_profiles")
      .select("*", { count: "exact", head: true });
    usersCount = uCount || 0;

    const totalWorks = works.length || 0;
    const finalWorks = totalWorks > 0 ? totalWorks : 12;
    const finalComments = commentsCount > 0 ? commentsCount : 35;
    const finalAuthors =
      usersCount > 0
        ? usersCount
        : totalWorks > 0
          ? new Set(works.map((w) => w.author)).size
          : 18;

    updateStatsUI(finalWorks, finalComments, finalAuthors);
  } catch (err) {
    console.warn("Stats fetch fallback:", err);
    updateStatsUI(works.length || 12, 35, 18);
  }
}

function updateStatsUI(wCount, cCount, aCount) {
  const wEl = $("#statWorkCount");
  const cEl = $("#statCommentCount");
  const aEl = $("#statAuthorCount");

  if (wEl) wEl.textContent = String(wCount).padStart(2, "0");
  if (cEl) cEl.textContent = String(cCount).padStart(2, "0") + "+";
  if (aEl) aEl.textContent = String(aCount).padStart(2, "0") + "+";
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

  // Pick top 3 works as featured
  const featured = works
    .filter((work) => (workEngagement[work.id]?.save_count || 0) > 0)
    .sort(
      (a, b) =>
        (workEngagement[b.id]?.like_count || 0) -
        (workEngagement[a.id]?.like_count || 0),
    )
    .slice(0, 3);

  container.innerHTML = featured
    .map((work, idx) => {
      const title = work.title || "Tanpa Judul";
      const author = work.author || "Penulis Siswa";
      const category = work.category || "Karya";
      const description =
        work.description ||
        "Sebuah karya inspiratif dari siswa yang layak dibaca dan diapresiasi.";
      const symbol = work.cover_symbol || "✦";
      const cover = work.cover || (idx % 2 === 0 ? "cover-green" : "cover-1");

      return `
      <article class="featured-card">
        <span class="featured-badge">✦ Pilihan Kurator</span>
        
        <button
          class="work-cover ${esc(cover)}"
          type="button"
          data-preview="${esc(work.id)}"
          aria-label="Lihat naskah ${esc(title)}"
          style="min-height: 180px;"
        >
          <div class="cover-art" style="font-size: 48px;">
            ${esc(symbol)}
          </div>
          <div class="cover-text">
            <small style="color:var(--accent); font-weight:700;">${esc(category)}</small>
            <strong style="font-size: 1.15rem;">${esc(title)}</strong>
          </div>
        </button>

        <div class="work-info" style="padding: 20px; display:flex; flex-direction:column; flex:1; justify-content:space-between;">
          <div>
            <div class="work-category" style="margin-bottom:6px;">${esc(category)}</div>
            <h3 style="margin: 0 0 8px; font-size: 1.2rem;">${esc(title)}</h3>
            <p style="font-size: 13px; line-height: 1.6; color: var(--muted); margin:0 0 16px;">
              ${esc(description)}
            </p>
          </div>

          <div class="work-footer" style="padding-top: 14px; border-top: 1px solid var(--border);">
            <span class="author" style="font-weight:600;">
              ${esc(author)}
            </span>
            <div class="card-buttons">
              <button class="card-btn" type="button" data-preview="${esc(work.id)}">
                Sinopsis
              </button>
              <button class="card-btn eye" type="button" data-open="${esc(work.id)}" title="Buka Naskah Penuh">
                ◉ Baca
              </button>
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
      const { data } = await db
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });
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
          const bio = p.bio || "Aktif berkarya dan menulis cerita di CEMARA.";
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
            <h3 style="margin:0; font-family:'Playfair Display', serif; font-size:1.15rem; font-weight:700;">
              ${esc(name)}
            </h3>
            <span style="font-size:11px; font-weight:600; padding:2px 10px; border-radius:9999px; background:var(--surface-2); color:var(--primary); border:1px solid var(--border);">
              ${esc(roleLabel)}
            </span>
            <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0; line-height:1.5; font-style:italic;">
              "${esc(bio)}"
            </p>
            <strong style="font-size:12px; color:var(--primary);">${workCount} karya dipublikasikan</strong>
            ${isWriterOfTheWeek && (p.custom_card_emoji || p.custom_card_text) ? `<div class="creator-custom-card">${esc(p.custom_card_emoji || "✦")} ${esc(p.custom_card_text || "Penulis pilihan CEMARA")}</div>` : ""}
          </div>
        `;
        })
        .join("");
      return;
    }

    // Fallback if no profiles yet: extract unique authors from works or show sample creators
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
    const defaultAuthors =
      authors.length > 0
        ? authors
        : ["Alya Ramadhani", "Fauzan Akbar", "Nadia Putri", "Duta Literasi"];

    container.innerHTML = defaultAuthors
      .slice(0, 4)
      .map(
        (name) => `
      <div class="creator-card">
        <div class="creator-avatar">
          <span>${esc(name.charAt(0))}</span>
        </div>
        <h3 style="margin:0; font-family:'Playfair Display', serif; font-size:1.15rem; font-weight:700;">
          ${esc(name)}
        </h3>
        <span style="font-size:11px; font-weight:600; padding:2px 10px; border-radius:9999px; background:var(--surface-2); color:var(--primary); border:1px solid var(--border);">
          Penulis Siswa
        </span>
        <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0; line-height:1.5; font-style:italic;">
          "Menulis adalah cara terbaik menyuarakan isi pikiran dan imajinasi."
        </p>
        <strong style="font-size:12px; color:var(--primary);">${works.filter((work) => work.author === name).length} karya dipublikasikan</strong>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.warn("Creators spotlight error:", err);
  }
}

/* =========================================================
   ACCORDION LOGIC
========================================================= */

function setupAccordion() {
  $$(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.closest(".accordion-item");
      if (!item) return;

      const wasActive = item.classList.contains("active");
      // Close other items
      $$(".accordion-item").forEach((el) => el.classList.remove("active"));

      if (!wasActive) {
        item.classList.add("active");
      }

      $$(".accordion-header").forEach((button) => {
        button.setAttribute(
          "aria-expanded",
          button.closest(".accordion-item")?.classList.contains("active")
            ? "true"
            : "false",
        );
      });
    });
  });
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

  const { data, error } = await db
    .from("works")
    .select("*")
    .order("published_at", {
      ascending: false,
    });

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

    return;
  }

  works = data || [];

  render();
  await loadWorkEngagement();
  renderFeaturedWorks();
  await loadDynamicStats();
  await loadCreatorsSpotlight();
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
>>>>>>> 92de7e3 (amz)

/* =========================================================
   RENDER WORKS
========================================================= */

function render() {
<<<<<<< HEAD

  const grid =
    $('#worksGrid');

  if (!grid) return;


  const search =
    $('#searchInput');


  const query =
    search?.value
      ?.trim()
      ?.toLowerCase() || '';


  const filtered =
    works.filter(work => {

      const categoryMatch =
        filter === 'Semua' ||
        work.category === filter;


      const searchable = [

        work.title,

        work.author,

        work.category,

        work.description

      ]
        .map(value =>
          String(value || '')
        )
        .join(' ')
        .toLowerCase();


      const searchMatch =
        searchable.includes(query);


      return (
        categoryMatch &&
        searchMatch
      );

    });


  if (!filtered.length) {

    grid.innerHTML = '';

    $('#emptyState')?.classList.remove(
      'hidden'
    );

    return;

  }


  $('#emptyState')?.classList.add(
    'hidden'
  );


  grid.innerHTML =
    filtered.map(work => {

      const title =
        work.title ||
        'Tanpa Judul';

      const author =
        work.author ||
        'Anonim';

      const category =
        work.category ||
        'Karya';


      const description =
        work.description ||
        '';


      const symbol =
        work.cover_symbol ||
        '✦';


      const cover =
        work.cover ||
        'cover-green';

=======
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

      const symbol = work.cover_symbol || "✦";

      const cover = work.cover || "cover-green";
>>>>>>> 92de7e3 (amz)

      return `

        <article class="work-card">

          <button
            class="work-cover ${esc(cover)}"
            type="button"
            data-preview="${esc(work.id)}"
            aria-label="Lihat detail ${esc(title)}"
          >

            <div class="cover-art">
              ${esc(symbol)}
            </div>

            <div class="cover-text">

              <small>
                ${esc(category)}
              </small>

              <strong>
                ${esc(title)}
              </strong>

            </div>

          </button>


          <div class="work-info">

            <div class="work-category">
              ${esc(category)}
            </div>

            <h3>
              ${esc(title)}
            </h3>

            <p>
              ${esc(description)}
            </p>


            <div class="work-footer">

              <span class="author">
                ${esc(author)}
                •
<<<<<<< HEAD
                ${esc(
                  formatDate(
                    work.published_at
                  )
                )}
=======
                ${esc(formatDate(work.published_at))}
>>>>>>> 92de7e3 (amz)
              </span>


              <div class="card-buttons">

                <button
                  class="card-btn"
                  type="button"
                  data-preview="${esc(work.id)}"
                >
                  Detail
                </button>


                <button
                  class="card-btn eye"
                  type="button"
                  data-open="${esc(work.id)}"
                  title="Buka karya"
                  aria-label="Buka karya"
                >
                  ◉
                </button>

              </div>

            </div>

          </div>

        </article>

      `;
<<<<<<< HEAD

    }).join('');


  $$('[data-preview]').forEach(
    button => {

      button.addEventListener(
        'click',
        () =>
          preview(
            button.dataset.preview
          )
      );

    }
  );


  $$('[data-open]').forEach(
    button => {

      button.addEventListener(
        'click',
        () =>
          openReader(
            button.dataset.open
          )
      );

    }
  );

}


=======
    })
    .join("");

  $$("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => preview(button.dataset.preview));
  });

  $$("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openReader(button.dataset.open));
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   PREVIEW WORK
========================================================= */

function preview(id) {
<<<<<<< HEAD

  selected =
    works.find(
      work =>
        String(work.id) ===
        String(id)
    );

=======
  selected = works.find((work) => String(work.id) === String(id));
>>>>>>> 92de7e3 (amz)

  if (!selected) {
    return;
  }

<<<<<<< HEAD

  const category =
    $('#modalCategory');

  const title =
    $('#modalTitle');

  const byline =
    $('#modalByline');

  const description =
    $('#modalDescription');

  const date =
    $('#modalDate');

  const cover =
    $('#modalCover');


  if (category) {

    category.textContent =
      selected.category ||
      'Karya';

  }


  if (title) {

    title.textContent =
      selected.title ||
      'Tanpa Judul';

  }


  if (byline) {

    byline.textContent =
      `Karya oleh ${
        selected.author ||
        'Anonim'
      }`;

  }


  if (description) {

    description.textContent =
      selected.description ||
      '';

  }


  if (date) {

    date.textContent =
      `Dipublikasikan ${
        formatDate(
          selected.published_at
        )
      }`;

  }


  if (cover) {

    const coverClass =
      selected.cover ||
      'cover-green';


    cover.className =
      `modal-cover ${esc(
        coverClass
      )}`;

=======
  const category = $("#modalCategory");

  const title = $("#modalTitle");

  const byline = $("#modalByline");

  const description = $("#modalDescription");

  const date = $("#modalDate");

  const cover = $("#modalCover");

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
    const coverClass = selected.cover || "cover-green";

    cover.className = `modal-cover ${esc(coverClass)}`;
>>>>>>> 92de7e3 (amz)

    cover.innerHTML = `

      <span>
<<<<<<< HEAD
        ${esc(
          selected.cover_symbol ||
          '✦'
        )}
      </span>

    `;

  }


  modal(
    'workModal'
  );

}


=======
        ${esc(selected.cover_symbol || "✦")}
      </span>

    `;
  }

  modal("workModal");
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   OPEN READER
========================================================= */

function openReader(id) {
<<<<<<< HEAD

  const work =
    works.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!work) {
    toast(
      'Karya tidak ditemukan.'
    );
=======
  const work = works.find((item) => String(item.id) === String(id));

  if (!work) {
    toast("Karya tidak ditemukan.");
>>>>>>> 92de7e3 (amz)

    return;
  }

<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  /*
    Reader sekarang menggunakan
    reader.html + reader.js.

    Jadi homepage tidak lagi
    membuat reader versi lama.
  */

<<<<<<< HEAD
  const url =
    `reader.html?id=${encodeURIComponent(
      work.id
    )}`;


  window.location.href =
    url;

}


=======
  const url = `reader.html?id=${encodeURIComponent(work.id)}`;

  window.location.href = url;
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  if (!db || !current) {
    return;
  }

<<<<<<< HEAD

  const listElement =
    $('#commentsList');
=======
  const listElement = $("#commentsList");
>>>>>>> 92de7e3 (amz)

  if (!listElement) {
    return;
  }

<<<<<<< HEAD

  try {

    const {
      data,
      error
    } =
      await db
        .from('comments')
        .select('*')
        .eq(
          'work_id',
          current.id
        )
        .order(
          'created_at',
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        'Comments error:',
        error
      );

      listElement.textContent =
        'Komentar belum dapat dimuat.';

      return;

    }


    const comments =
      data || [];


    const count =
      $('#commentCount');

    if (count) {

      count.textContent =
        `${comments.length} komentar`;

    }


    if (!comments.length) {

=======
  try {
    const { data, error } = await db
      .from("comments")
      .select("*")
      .eq("work_id", current.id)
      .order("created_at", {
        ascending: false,
      });

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
>>>>>>> 92de7e3 (amz)
      listElement.innerHTML = `

        <div class="empty-comments">

          Belum ada komentar.<br>

          Jadilah yang pertama
          mengapresiasi karya ini ✦

        </div>

      `;

      return;
<<<<<<< HEAD

    }


    listElement.innerHTML =
      comments.map(
        comment => {

          const canManage =
            isAdmin ||
            (
              user &&
              comment.user_id ===
              user.id
            );


          return `
=======
    }

    listElement.innerHTML = comments
      .map((comment) => {
        const canManage = isAdmin || (user && comment.user_id === user.id);

        return `
>>>>>>> 92de7e3 (amz)

            <div class="comment-item">

              <div class="comment-top">

                <strong>
<<<<<<< HEAD
                  ${esc(
                    comment.name ||
                    'Anonim'
                  )}
                </strong>

                <time>
                  ${esc(
                    formatDate(
                      comment.created_at
                    )
                  )}
=======
                  ${esc(comment.name || "Anonim")}
                </strong>

                <time>
                  ${esc(formatDate(comment.created_at))}
>>>>>>> 92de7e3 (amz)
                </time>

              </div>

              <p>
<<<<<<< HEAD
                ${esc(
                  comment.content ||
                  ''
                )}
=======
                ${esc(comment.content || "")}
>>>>>>> 92de7e3 (amz)
              </p>

              ${
                canManage
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
                  ? `

                    <div class="comment-actions">

                      <button
                        type="button"
<<<<<<< HEAD
                        data-edit="${esc(
                          comment.id
                        )}"
=======
                        data-edit="${esc(comment.id)}"
>>>>>>> 92de7e3 (amz)
                      >
                        Edit
                      </button>

                      <button
                        type="button"
<<<<<<< HEAD
                        data-del="${esc(
                          comment.id
                        )}"
=======
                        data-del="${esc(comment.id)}"
>>>>>>> 92de7e3 (amz)
                      >
                        Hapus
                      </button>

                    </div>

                  `
<<<<<<< HEAD

                  : ''
=======
                  : ""
>>>>>>> 92de7e3 (amz)
              }

            </div>

          `;
<<<<<<< HEAD

        }
      ).join('');


    $$('[data-edit]').forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            editComment(
              button.dataset.edit
            )
        );

      }
    );


    $$('[data-del]').forEach(
      button => {

        button.addEventListener(
          'click',
          () =>
            deleteComment(
              button.dataset.del
            )
        );

      }
    );

  } catch (error) {

    console.error(
      'Comments loading error:',
      error
    );

  }

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   EDIT COMMENT
========================================================= */

async function editComment(id) {
<<<<<<< HEAD

  if (!user) {

    toast(
      'Login dulu untuk mengedit komentar.'
    );

    return;

  }


  const {
    data,
    error
  } =
    await db
      .from('comments')
      .select('*')
      .eq('id', id)
      .single();


  if (error || !data) {

    toast(
      'Komentar tidak ditemukan.'
    );

    return;

  }


  const allowed =
    isAdmin ||
    data.user_id === user.id;


  if (!allowed) {

    toast(
      'Kamu tidak dapat mengedit komentar ini.'
    );

    return;

  }


  editing =
    data;


  const name =
    $('#commentName');

  const text =
    $('#commentText');


  if (name) {
    name.value =
      data.name || '';
  }


  if (text) {

    text.value =
      data.content || '';

    text.focus();

  }


  toast(
    'Mode edit aktif.'
  );

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   DELETE COMMENT
========================================================= */

async function deleteComment(id) {
<<<<<<< HEAD

  if (!user) {

    toast(
      'Login dulu untuk menghapus komentar.'
    );

    return;

  }


  const {
    data
  } =
    await db
      .from('comments')
      .select('user_id')
      .eq('id', id)
      .single();


  if (!data) {

    toast(
      'Komentar tidak ditemukan.'
    );

    return;

  }


  const allowed =
    isAdmin ||
    data.user_id === user.id;


  if (!allowed) {

    toast(
      'Kamu tidak dapat menghapus komentar ini.'
    );

    return;

  }


  if (
    !window.confirm(
      'Hapus komentar ini?'
    )
  ) {

    return;

  }


  const {
    error
  } =
    await db
      .from('comments')
      .delete()
      .eq(
        'id',
        id
      );


  if (error) {

    toast(
      error.message
    );

    return;

  }


  toast(
    'Komentar dihapus.'
  );


  await loadComments();

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COMMENT FORM
========================================================= */

function setupCommentForm() {
<<<<<<< HEAD

  const form =
    $('#commentForm');
=======
  const form = $("#commentForm");
>>>>>>> 92de7e3 (amz)

  if (!form) {
    return;
  }

<<<<<<< HEAD

  form.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (!db || !current) {
        return;
      }


      const nameInput =
        $('#commentName');

      const textInput =
        $('#commentText');


      const name =
        nameInput?.value
          ?.trim() || '';


      const content =
        textInput?.value
          ?.trim() || '';


      if (!name) {

        toast(
          'Nama belum diisi.'
        );

        return;

      }


      if (!content) {

        toast(
          'Komentar belum diisi.'
        );

        return;

      }


      try {

        if (editing) {

          const {
            error
          } =
            await db
              .from('comments')
              .update({

                name,

                content,

                updated_at:
                  new Date()
                    .toISOString()

              })
              .eq(
                'id',
                editing.id
              );


          if (error) {

            toast(
              error.message
            );

            return;

          }


          editing =
            null;


          form.reset();


          toast(
            'Komentar berhasil diedit.'
          );


          await loadComments();

          return;

        }


        const {
          error
        } =
          await db
            .from('comments')
            .insert({

              work_id:
                current.id,

              user_id:
                user?.id || null,

              name,

              content

            });


        if (error) {

          toast(
            error.message
          );

          return;

        }


        form.reset();


        toast(
          'Komentar tersimpan. ✦'
        );


        await loadComments();

      } catch (error) {

        console.error(
          'Comment submit error:',
          error
        );

        toast(
          'Komentar gagal diproses.'
        );

      }

    }
  );

}


=======
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

        toast("Komentar berhasil diedit.");

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

      toast("Komentar tersimpan. ✦");

      await loadComments();
    } catch (error) {
      console.error("Comment submit error:", error);

      toast("Komentar gagal diproses.");
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   AUTH UI
========================================================= */

function authUI() {
<<<<<<< HEAD

  const container =
    $('#authView');
=======
  const container = $("#authView");
>>>>>>> 92de7e3 (amz)

  if (!container) {
    return;
  }

<<<<<<< HEAD

  if (!db) {

=======
  if (!db) {
>>>>>>> 92de7e3 (amz)
    container.innerHTML = `

      <p>
        Isi config.js terlebih dahulu.
      </p>

    `;

    return;
<<<<<<< HEAD

  }


  if (user) {

    renderUploadUI();


    const name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      'Pengunjung';


    container.innerHTML = `

      <div class="account-welcome">

        <div class="account-avatar">
          ✦
        </div>

        <h3>
          Halo, ${esc(name)}! 👋
        </h3>

        <p>
          Masuk sebagai
          <b>${esc(
            user.email || ''
          )}</b>.
        </p>


        <div class="admin-note">

          ${
            isAdmin

              ? `
                Akun ini adalah
                <b>Admin CEMARA</b>.
                Kamu dapat mengelola
                karya dan komentar.
              `

              : `
                Akun pengunjung CEMARA.
                Kamu dapat berkomentar
                dan mengelola komentar
                milikmu sendiri.
              `

          }

        </div>

=======
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
              : `<span style="font-size:26px; font-family:'Playfair Display', serif; color:var(--primary);">✦</span>`
          }
        </div>

        <h3 style="margin-bottom:4px; font-family:'Playfair Display', serif; font-size:1.25rem;">
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
>>>>>>> 92de7e3 (amz)

        <button
          class="btn btn-ghost"
          id="logout"
          type="button"
<<<<<<< HEAD
=======
          style="margin-top:12px; width:100%;"
>>>>>>> 92de7e3 (amz)
        >
          Keluar
        </button>

      </div>

    `;

<<<<<<< HEAD

    $('#logout')?.addEventListener(
      'click',
      logout
    );


    return;

  }


  $('#uploadView').innerHTML =
    '';

=======
    $("#logout")?.addEventListener("click", logout);

    return;
  }

  const uploadView = $("#uploadView");
  if (uploadView) {
    uploadView.innerHTML = "";
  }
>>>>>>> 92de7e3 (amz)

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

<<<<<<< HEAD

  $('#loginTab')?.addEventListener(
    'click',
    () => {

      $('#loginTab')
        ?.classList
        .add('active');

      $('#registerTab')
        ?.classList
        .remove('active');

      $('#loginView')
        .style.display =
        'block';

      $('#registerView')
        .style.display =
        'none';

    }
  );


  $('#registerTab')?.addEventListener(
    'click',
    () => {

      $('#registerTab')
        ?.classList
        .add('active');

      $('#loginTab')
        ?.classList
        .remove('active');

      $('#loginView')
        .style.display =
        'none';

      $('#registerView')
        .style.display =
        'block';

    }
  );


  $('#login')?.addEventListener(
    'submit',
    login
  );


  $('#register')?.addEventListener(
    'submit',
    register
  );

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   LOGIN
========================================================= */

async function login(event) {
<<<<<<< HEAD

  event.preventDefault();


  const email =
    $('#email')
      ?.value
      ?.trim() || '';


  const password =
    $('#pass')
      ?.value || '';

=======
  event.preventDefault();

  const email = $("#email")?.value?.trim() || "";

  const password = $("#pass")?.value || "";
>>>>>>> 92de7e3 (amz)

  if (!email || !password) {
    return;
  }

<<<<<<< HEAD

  const {
    error
  } =
    await db.auth.signInWithPassword({

      email,

      password

    });


  if (error) {

    toast(
      error.message
    );

    return;

  }


  toast(
    'Berhasil masuk. ✦'
  );


  modal(
    'adminModal',
    false
  );

}


=======
  const submitButton = event.currentTarget.querySelector(
    'button[type="submit"]',
  );
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Memeriksa akun...";
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    toast(error.message);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Masuk";
    }

    return;
  }

  toast("Berhasil masuk. ✦");

  window.location.href = "admin/index.html";
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   REGISTER
========================================================= */

async function register(event) {
<<<<<<< HEAD

  event.preventDefault();


  const name =
    $('#registerName')
      ?.value
      ?.trim() || '';


  const email =
    $('#registerEmail')
      ?.value
      ?.trim() || '';


  const password =
    $('#registerPass')
      ?.value || '';


  const confirmPassword =
    $('#registerPassConfirm')
      ?.value || '';


  if (
    password !==
    confirmPassword
  ) {

    toast(
      'Konfirmasi password tidak sama.'
    );

    return;

  }


  if (password.length < 6) {

    toast(
      'Password minimal 6 karakter.'
    );

    return;

  }


  const {
    data,
    error
  } =
    await db.auth.signUp({

      email,

      password,

      options: {

        data: {
          name
        }

      }

    });


  if (error) {

    toast(
      error.message
    );

    return;

  }


  if (data?.session) {

    toast(
      'Akun berhasil dibuat! 🎉'
    );

    modal(
      'adminModal',
      false
    );

  } else {

    toast(
      'Akun dibuat! Cek email untuk verifikasi. ✉'
    );

  }

}


=======
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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
<<<<<<< HEAD

  const {
    error
  } =
    await db.auth.signOut();


  if (error) {

    toast(
      error.message
    );

    return;

  }


  toast(
    'Berhasil keluar. 👋'
  );

}


=======
  const { error } = await db.auth.signOut();

  if (error) {
    toast(error.message);

    return;
  }

  toast("Berhasil keluar. 👋");
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ADMIN UPLOAD UI
========================================================= */

function renderUploadUI() {
<<<<<<< HEAD

  const container =
    $('#uploadView');
=======
  const container = $("#uploadView");
>>>>>>> 92de7e3 (amz)

  if (!container) {
    return;
  }

<<<<<<< HEAD

  if (!user || !isAdmin) {

    container.innerHTML =
      '';

    return;

  }


=======
  if (!user || !isAdmin) {
    container.innerHTML = "";

    return;
  }

>>>>>>> 92de7e3 (amz)
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


        <textarea
          id="uploadContent"
          placeholder="Isi karya / teks. Untuk komik boleh dikosongkan."
        ></textarea>


        <label>

          Gambar / halaman komik

          <input
            id="workImages"
            type="file"
            accept="image/*"
            multiple
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

<<<<<<< HEAD

  setupUploadForm();

}


=======
  setupUploadForm();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   UPLOAD FORM
========================================================= */

function setupUploadForm() {
<<<<<<< HEAD

  const form =
    $('#workUploadForm');

  const input =
    $('#workImages');

  const preview =
    $('#uploadPreview');

  const status =
    $('#uploadStatus');

=======
  const form = $("#workUploadForm");

  const input = $("#workImages");

  const preview = $("#uploadPreview");

  const status = $("#uploadStatus");
>>>>>>> 92de7e3 (amz)

  if (!form || !input) {
    return;
  }

<<<<<<< HEAD

  input.addEventListener(
    'change',
    () => {

      const files =
        [...input.files];


      if (!preview) {
        return;
      }


      preview.innerHTML =
        files.map(
          (file, index) => `
=======
  input.addEventListener("change", () => {
    const files = [...input.files];

    if (!preview) {
      return;
    }

    preview.innerHTML = files
      .map(
        (file, index) => `
>>>>>>> 92de7e3 (amz)

            <div class="upload-item">

              <img
<<<<<<< HEAD
                src="${URL.createObjectURL(
                  file
                )}"
=======
                src="${URL.createObjectURL(file)}"
>>>>>>> 92de7e3 (amz)
                alt="Preview ${index + 1}"
              >

              <span>
                ${index + 1}.
                ${esc(file.name)}
              </span>

            </div>

<<<<<<< HEAD
          `
        ).join('');

    }
  );


  form.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (!user || !isAdmin) {

        toast(
          'Hanya admin yang dapat mengunggah karya.'
        );

        return;

      }


      const title =
        $('#uploadTitle')
          ?.value
          ?.trim() || '';


      const author =
        $('#uploadAuthor')
          ?.value
          ?.trim() || '';


      const category =
        $('#uploadCategory')
          ?.value || '';


      const description =
        $('#uploadDescription')
          ?.value
          ?.trim() || '';


      const content =
        $('#uploadContent')
          ?.value
          ?.trim() || '';


      const files =
        [...input.files];


      if (
        !title ||
        !author ||
        !category ||
        !description
      ) {

        toast(
          'Lengkapi data karya terlebih dahulu.'
        );

        return;

      }


      /*
=======
          `,
      )
      .join("");
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

    const files = [...input.files];

    if (!title || !author || !category || !description) {
      toast("Lengkapi data karya terlebih dahulu.");

      return;
    }

    /*
>>>>>>> 92de7e3 (amz)
        HANYA KOMIK yang wajib
        memiliki gambar.

        Cerpen / Puisi / Esai /
        Seni boleh hanya berupa teks.
      */

<<<<<<< HEAD
      if (
        category === 'Komik' &&
        !files.length
      ) {

        toast(
          'Komik harus memiliki minimal satu gambar.'
        );

        return;

      }


      if (
        !content &&
        !files.length
      ) {

        toast(
          'Isi karya atau gambar belum ditambahkan.'
        );

        return;

      }


      const submitButton =
        $('#uploadImagesBtn');


      if (submitButton) {
        submitButton.disabled = true;
      }


      try {

        if (status) {

          status.textContent =
            files.length
              ? 'Mengupload gambar...'
              : 'Menyimpan karya...';

        }


        const imageUrls =
          [];


        /*
          UPLOAD GAMBAR
        */

        for (
          let index = 0;
          index < files.length;
          index++
        ) {

          const file =
            files[index];


          const extension =
            (
              file.name
                .split('.')
                .pop() || 'jpg'
            )
              .toLowerCase()
              .replace(
                /[^a-z0-9]/g,
                ''
              );


          const filename =
            `${user.id}/${Date.now()}-${index + 1}.${extension}`;


          const {
            error
          } =
            await db.storage
              .from('karya')
              .upload(
                filename,
                file,
                {
                  cacheControl: '3600',
                  upsert: false
                }
              );


          if (error) {

            if (status) {

              status.textContent =
                'Gagal upload: ' +
                error.message;

            }

            return;

          }


          const {
            data
          } =
            db.storage
              .from('karya')
              .getPublicUrl(
                filename
              );


          if (data?.publicUrl) {

            imageUrls.push(
              data.publicUrl
            );

          }

        }


        if (status) {

          status.textContent =
            'Menyimpan karya...';

        }


        /*
          SIMPAN KE DATABASE
        */

        const {
          error
        } =
          await db
            .from('works')
            .insert({

              title,

              author,

              category,

              description,

              content,

              cover:
                'cover-green',

              cover_symbol:
                category === 'Komik'
                  ? '📖'
                  : '✦',

              published_at:
                new Date()
                  .toISOString(),

              image_urls:
                imageUrls

            });


        if (error) {

          if (status) {

            status.textContent =
              'Gagal menyimpan karya: ' +
              error.message;

          }

          return;

        }


        toast(
          'Karya berhasil dipublikasikan! 🎉'
        );


        form.reset();


        if (preview) {
          preview.innerHTML =
            '';
        }


        if (status) {

          status.textContent =
            'Karya berhasil ditambahkan.';

        }


        await loadWorks();

      } catch (error) {

        console.error(
          'Upload error:',
          error
        );


        if (status) {

          status.textContent =
            'Terjadi kesalahan: ' +
            error.message;

        }


        toast(
          'Upload gagal.'
        );

      } finally {

        if (submitButton) {
          submitButton.disabled = false;
        }

      }

    }
  );

}


=======
    if (category === "Komik" && !files.length) {
      toast("Komik harus memiliki minimal satu gambar.");

      return;
    }

    if (!content && !files.length) {
      toast("Isi karya atau gambar belum ditambahkan.");

      return;
    }

    const submitButton = $("#uploadImagesBtn");

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      if (status) {
        status.textContent = files.length
          ? "Mengupload gambar..."
          : "Menyimpan karya...";
      }

      const imageUrls = [];

      /*
          UPLOAD GAMBAR
        */

      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        const extension = (file.name.split(".").pop() || "jpg")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const filename = `${user.id}/${Date.now()}-${index + 1}.${extension}`;

        const { error } = await db.storage
          .from("karya")
          .upload(filename, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          if (status) {
            status.textContent = "Gagal upload: " + error.message;
          }

          return;
        }

        const { data } = db.storage.from("karya").getPublicUrl(filename);

        if (data?.publicUrl) {
          imageUrls.push(data.publicUrl);
        }
      }

      if (status) {
        status.textContent = "Menyimpan karya...";
      }

      /*
          SIMPAN KE DATABASE
        */

      const { error } = await db.from("works").insert({
        title,

        author,

        category,

        description,

        content,

        cover: "cover-green",

        cover_symbol: category === "Komik" ? "📖" : "✦",

        published_at: new Date().toISOString(),

        image_urls: imageUrls,
      });

      if (error) {
        if (status) {
          status.textContent = "Gagal menyimpan karya: " + error.message;
        }

        return;
      }

      toast("Karya berhasil dipublikasikan! 🎉");

      form.reset();

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

>>>>>>> 92de7e3 (amz)
/* =========================================================
   HEADER / NAVIGATION
========================================================= */

function setupNavigation() {
<<<<<<< HEAD

  $('#adminButton')?.addEventListener(
    'click',
    () => {

      authUI();

      modal(
        'adminModal'
      );

    }
  );


  $$('[data-close]').forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          modal(
            button.dataset.close,
            false
          );

        }
      );

    }
  );


  $$('.modal-overlay').forEach(
    overlay => {

      overlay.addEventListener(
        'click',
        event => {

          if (
            event.target ===
            overlay
          ) {

            modal(
              overlay.id,
              false
            );

          }

        }
      );

    }
  );

=======
  $("#adminButton")?.addEventListener("click", () => {
    authUI();

    modal("adminModal");
  });

  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      modal(button.dataset.close, false);
    });
  });

  $$(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        modal(overlay.id, false);
      }
    });
  });
>>>>>>> 92de7e3 (amz)

  /*
    Detail karya:
    tetap buka preview modal.
  */

<<<<<<< HEAD
  $('#openWorkBtn')?.addEventListener(
    'click',
    () => {

      if (!selected) return;

      openReader(
        selected.id
      );

    }
  );

=======
  $("#openWorkBtn")?.addEventListener("click", () => {
    if (!selected) return;

    openReader(selected.id);
  });
>>>>>>> 92de7e3 (amz)

  /*
    Komentar:
    langsung menuju reader.
  */

<<<<<<< HEAD
  $('#modalCommentBtn')?.addEventListener(
    'click',
    () => {

      if (!selected) return;

      openReader(
        selected.id
      );

    }
  );

=======
  $("#modalCommentBtn")?.addEventListener("click", () => {
    if (!selected) return;

    openReader(selected.id);
  });
>>>>>>> 92de7e3 (amz)

  /*
    Search
  */

<<<<<<< HEAD
  $('#searchInput')?.addEventListener(
    'input',
    render
  );

=======
  $("#searchInput")?.addEventListener("input", render);
>>>>>>> 92de7e3 (amz)

  /*
    Filter kategori
  */

<<<<<<< HEAD
  $$('.filter-btn').forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          filter =
            button.dataset.filter ||
            'Semua';


          $$('.filter-btn')
            .forEach(
              item =>
                item.classList.toggle(
                  'active',
                  item === button
                )
            );


          render();

        }
      );

    }
  );

=======
  $$(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter || "Semua";

      $$(".filter-btn").forEach((item) =>
        item.classList.toggle("active", item === button),
      );

      render();
    });
  });
>>>>>>> 92de7e3 (amz)

  /*
    Reset search
  */

<<<<<<< HEAD
  $('#resetSearch')?.addEventListener(
    'click',
    () => {

      const search =
        $('#searchInput');

      if (search) {
        search.value = '';
      }


      filter =
        'Semua';


      $$('.filter-btn')
        .forEach(
          button =>
            button.classList.toggle(
              'active',
              button.dataset.filter ===
              'Semua'
            )
        );


      render();

    }
  );

=======
  $("#resetSearch")?.addEventListener("click", () => {
    const search = $("#searchInput");

    if (search) {
      search.value = "";
    }

    filter = "Semua";

    $$(".filter-btn").forEach((button) =>
      button.classList.toggle("active", button.dataset.filter === "Semua"),
    );

    render();
  });
>>>>>>> 92de7e3 (amz)

  /*
    Mobile menu
  */

<<<<<<< HEAD
  $('#menuToggle')?.addEventListener(
    'click',
    () => {

      $('.main-nav')
        ?.classList
        .toggle('open');

    }
  );


  $$('.main-nav a').forEach(
    link => {

      link.addEventListener(
        'click',
        () => {

          $('.main-nav')
            ?.classList
            .remove('open');

        }
      );

    }
  );

=======
  const nav = $("#mainNav");
  const menuToggle = $("#menuToggle");

  const setMenuState = (isOpen) => {
    nav?.classList.toggle("open", isOpen);
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Tutup menu" : "Buka menu",
      );
    }
  };

  setMenuState(false);
  nav?.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");

  menuToggle?.addEventListener("click", () => {
    if (window.innerWidth > 800) return;

    const isOpen = !nav?.classList.contains("open");
    setMenuState(isOpen);
  });

  $$(".main-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 800) {
        setMenuState(false);
      }
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Node)) return;

    const clickedInsideNav = nav?.contains(target);
    const clickedToggle = menuToggle?.contains(target);

    if (
      window.innerWidth <= 800 &&
      !clickedInsideNav &&
      !clickedToggle &&
      nav?.classList.contains("open")
    ) {
      setMenuState(false);
    }
  });

  window.addEventListener("resize", () => {
    nav?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Buka menu");
  });
>>>>>>> 92de7e3 (amz)

  /*
    Copy email
  */

<<<<<<< HEAD
  $('#copyEmail')?.addEventListener(
    'click',
    copyEmail
  );

}


=======
  $("#copyEmail")?.addEventListener("click", copyEmail);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   THEME
========================================================= */

function setupTheme() {
<<<<<<< HEAD

  const saved =
    localStorage.getItem(
      'cemara_theme'
    );


  const icon =
    $('#themeIcon');


  if (
    saved === 'dark'
  ) {

    document.documentElement.dataset.theme =
      'dark';


    if (icon) {
      icon.textContent =
        '☀';
    }

  } else {

    delete document
      .documentElement
      .dataset
      .theme;


    if (icon) {
      icon.textContent =
        '☾';
    }

  }


  $('#themeToggle')?.addEventListener(
    'click',
    () => {

      const isDark =
        document.documentElement
          .dataset
          .theme === 'dark';


      if (isDark) {

        delete document
          .documentElement
          .dataset
          .theme;


        localStorage.setItem(
          'cemara_theme',
          'light'
        );


        if (icon) {
          icon.textContent =
            '☾';
        }

      } else {

        document.documentElement.dataset.theme =
          'dark';


        localStorage.setItem(
          'cemara_theme',
          'dark'
        );


        if (icon) {
          icon.textContent =
            '☀';
        }

      }

    }
  );

}


=======
  const icon = $("#themeIcon");
  const toggle = $("#themeToggle");

  const applyTheme = () => {
    const isDark = document.documentElement.dataset.theme === "dark";

    if (icon) {
      icon.textContent = isDark ? "☀" : "☾";
    }
  };

  const saved = localStorage.getItem("cemara_theme");

  if (saved === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.setItem("cemara_theme", "light");
  }

  applyTheme();

  toggle?.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";

    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem("cemara_theme", "light");
    } else {
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("cemara_theme", "dark");
    }

    applyTheme();
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COPY EMAIL
========================================================= */

async function copyEmail() {
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  /*
    Mengikuti email yang tampil
    di index.html.
  */

<<<<<<< HEAD
  const email =
    'duta.literasi.icpp@gmail.com';


  try {

    await navigator.clipboard.writeText(
      email
    );

    toast(
      'Email disalin. ✦'
    );

  } catch (_) {

    toast(
      email
    );

  }

}


=======
  const email = "duta.literasi.icpp@gmail.com";

  try {
    await navigator.clipboard.writeText(email);

    toast("Email disalin. ✦");
  } catch (_) {
    toast(email);
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   BACK TO TOP
========================================================= */

function setupBackTop() {
<<<<<<< HEAD

  const button =
    $('#backTop');

=======
  const button = $("#backTop");
>>>>>>> 92de7e3 (amz)

  if (!button) {
    return;
  }

<<<<<<< HEAD

  button.addEventListener(
    'click',
    () => {

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

    }
  );


  window.addEventListener(
    'scroll',
    () => {

      button.classList.toggle(
        'show',
        window.scrollY > 500
      );

    }
  );

}


=======
  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  window.addEventListener("scroll", () => {
    button.classList.toggle("show", window.scrollY > 500);
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   YEAR
========================================================= */

function setupYear() {
<<<<<<< HEAD

  const year =
    $('#year');

  if (year) {

    year.textContent =
      new Date()
        .getFullYear();

  }

}


=======
  const year = $("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ESCAPE KEY
========================================================= */

function setupEscape() {
<<<<<<< HEAD

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key !== 'Escape'
      ) {
        return;
      }


      $$('.modal-overlay.open')
        .forEach(
          overlay =>
            modal(
              overlay.id,
              false
            )
        );

    }
  );

}


=======
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    $$(".modal-overlay.open").forEach((overlay) => modal(overlay.id, false));
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  setupNavigation();

  setupCommentForm();

<<<<<<< HEAD
=======
  setupAccordion();

>>>>>>> 92de7e3 (amz)
  setupTheme();

  setupBackTop();

  setupYear();

<<<<<<< HEAD
  setupEscape();

  boot();

}


=======
  setupEventDeadline();

  setupEscape();

  boot();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   START
========================================================= */

<<<<<<< HEAD
if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initialize
  );

} else {

  initialize();

=======
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
>>>>>>> 92de7e3 (amz)
}
