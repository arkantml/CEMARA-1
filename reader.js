/* =========================================================
   CEMARA — READER.JS
   Reader gambar + tulisan + komentar + zoom
   + Auth + Admin + Edit/Hapus Komentar
========================================================= */

const C = window.CEMARA_CONFIG || {};
const { createClient } = window.supabase || {};

let db = null;
let current = null;
let user = null;
let isAdmin = false;
let editing = null;

let images = [];
let currentPage = 0;

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


function toast(text) {

  const element =
    $('#toast');

  if (!element) return;

  element.textContent =
    text;

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

function toast(text) {
  const element = $("#toast");

  if (!element) return;

  element.textContent = text;

  element.classList.add("show");

  clearTimeout(window.cemaraToastTimer);

  window.cemaraToastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2200);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   SAFE ELEMENT HELPERS
========================================================= */

function setText(selector, value) {
<<<<<<< HEAD

  const element =
    $(selector);

  if (element) {

    element.textContent =
      value;

  }

}


function showElement(selector) {

  const element =
    $(selector);

  if (element) {

    element.classList.remove(
      'hidden'
    );

  }

}


function hideElement(selector) {

  const element =
    $(selector);

  if (element) {

    element.classList.add(
      'hidden'
    );

  }

}


=======
  const element = $(selector);

  if (element) {
    element.textContent = value;
  }
}

function showElement(selector) {
  const element = $(selector);

  if (element) {
    element.classList.remove("hidden");
  }
}

function hideElement(selector) {
  const element = $(selector);

  if (element) {
    element.classList.add("hidden");
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   IMAGE URL PARSER
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


  if (!value) {

    return [];

  }


  if (typeof value === 'string') {

    const trimmed =
      value.trim();

    if (!trimmed) {

      return [];

    }


=======
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

>>>>>>> 92de7e3 (amz)
    /*
      Kalau Supabase mengembalikan
      JSON array sebagai string.
    */

    try {
<<<<<<< HEAD

      const parsed =
        JSON.parse(trimmed);

      if (Array.isArray(parsed)) {

        return parsed
          .map(item =>
            String(item || '').trim()
          )
          .filter(Boolean);

      }

    } catch (_) {

      /* bukan JSON */

    }


=======
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (_) {
      /* bukan JSON */
    }

>>>>>>> 92de7e3 (amz)
    /*
      Kalau ternyata satu URL saja.
    */

    if (
<<<<<<< HEAD
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/')
    ) {

      return [trimmed];

    }

  }


  return [];

}


=======
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      return [trimmed];
    }
  }

  return [];
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   SUPABASE READY CHECK
========================================================= */

function isSupabaseReady() {
<<<<<<< HEAD

  return Boolean(
    C.SUPABASE_URL &&
    C.SUPABASE_PUBLISHABLE_KEY
  );

}


=======
  return Boolean(C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   BOOT
========================================================= */

async function boot() {
<<<<<<< HEAD

  try {

    if (!isSupabaseReady()) {

      showError(
        'Supabase belum dikonfigurasi.'
      );

      return;

    }


    if (!createClient) {

      showError(
        'Library Supabase belum dimuat.'
      );

      return;

    }


    db =
      createClient(
        C.SUPABASE_URL,
        C.SUPABASE_PUBLISHABLE_KEY
      );

=======
  try {
    if (!isSupabaseReady()) {
      showError("Supabase belum dikonfigurasi.");

      return;
    }

    if (!createClient) {
      showError("Library Supabase belum dimuat.");

      return;
    }

    db = createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY);
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       SESSION
    ===================================================== */

<<<<<<< HEAD
    const {
      data: sessionData
    } =
      await db.auth.getSession();

    user =
      sessionData?.session?.user ||
      null;

=======
    const { data: sessionData } = await db.auth.getSession();

    user = sessionData?.session?.user || null;
>>>>>>> 92de7e3 (amz)

    /*
      Cek admin SETELAH session diketahui.
    */

    await adminCheck();

<<<<<<< HEAD
=======
    await loadTaggableProfiles();
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       WORK ID
    ===================================================== */

<<<<<<< HEAD
    const params =
      new URLSearchParams(
        window.location.search
      );

    const id =
      params.get('id');


    if (!id) {

      showError(
        'Karya tidak ditemukan.'
      );

      return;

    }


    await loadWork(id);

=======
    const params = new URLSearchParams(window.location.search);

    const id = params.get("id");

    if (!id) {
      showError("Karya tidak ditemukan.");

      return;
    }

    await loadWork(id);
    setupWorkEngagement();
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       AUTH STATE CHANGE
    ===================================================== */

<<<<<<< HEAD
    db.auth.onAuthStateChange(
      async (_event, session) => {

        user =
          session?.user ||
          null;

        await adminCheck();

        /*
=======
    db.auth.onAuthStateChange(async (_event, session) => {
      user = session?.user || null;

      await adminCheck();

      /*
>>>>>>> 92de7e3 (amz)
          Kalau user berubah,
          komentar dirender ulang supaya
          tombol Edit/Hapus langsung ikut berubah.
        */

<<<<<<< HEAD
        if (current) {

          await loadComments();

        }

      }
    );


  } catch (error) {

    console.error(
      'Reader boot error:',
      error
    );

    showError(
      'Terjadi kesalahan saat membuka karya.'
    );

  }

}


/* =========================================================
   ADMIN CHECK
========================================================= */

async function adminCheck() {

  isAdmin = false;


  if (!db || !user) {

    return;

  }


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


    console.log(
      'CEMARA Admin:',
      isAdmin
    );


  } catch (error) {

    console.error(
      'Admin check exception:',
      error
    );

  }

}

=======
      if (current) {
        await loadComments();
        setupWorkEngagement();
      }
    });
  } catch (error) {
    console.error("Reader boot error:", error);

    showError("Terjadi kesalahan saat membuka karya.");
  }
}

/* =========================================================
  AUTH CHECK
========================================================= */

let userRoleData = {
  role: "user",
  isAdmin: false,
  isSuperAdmin: false,
  isDev: false,
  profile: null,
};

async function adminCheck() {
  isAdmin = false;
  userRoleData = {
    role: "user",
    isAdmin: false,
    isSuperAdmin: false,
    isDev: false,
    profile: null,
  };

  if (!db || !user) {
    return;
  }

  try {
    if (window.CEMARA && window.CEMARA.roleCheck) {
      await window.CEMARA.ensureProfile(db, user);
      userRoleData = await window.CEMARA.roleCheck(db, user);
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

async function loadTaggableProfiles() {
  const select = $("#commentTagUser");
  if (!db || !select) return;

  try {
    const { data, error } = await db
      .from("user_profiles")
      .select("user_id, display_name")
      .order("display_name", { ascending: true });
    if (error) throw error;
    select.innerHTML =
      '<option value="">Tandai akun (opsional)</option>' +
      (data || [])
        .map(
          (profile) =>
            `<option value="${esc(profile.user_id)}">${esc(profile.display_name || "Tanpa nama")}</option>`,
        )
        .join("");
  } catch (error) {
    console.warn("Tag profiles error:", error.message);
  }
}
>>>>>>> 92de7e3 (amz)

/* =========================================================
   LOAD WORK
========================================================= */

async function loadWork(id) {
<<<<<<< HEAD

  try {

    const {
      data,
      error
    } =
      await db
        .from('works')
        .select('*')
        .eq(
          'id',
          id
        )
        .single();


    if (error) {

      console.error(
        'Load work error:',
        error
      );

      showError(
        'Karya tidak dapat dimuat.'
      );

      return;

    }


    if (!data) {

      showError(
        'Karya tidak ditemukan.'
      );

      return;

    }


    current =
      data;

=======
  try {
    const { data, error } = await db
      .from("works")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Load work error:", error);

      showError("Karya tidak dapat dimuat.");

      return;
    }

    if (!data) {
      showError("Karya tidak ditemukan.");

      return;
    }

    current = data;
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       BASIC INFO
    ===================================================== */

<<<<<<< HEAD
    setText(
      '#readerTitle',
      data.title ||
      'Tanpa Judul'
    );


    setText(
      '#readerByline',
      `Karya oleh ${
        data.author ||
        'Anonim'
      }`
    );


    setText(
      '#readerDescription',
      data.description ||
      ''
    );

=======
    setText("#readerTitle", data.title || "Tanpa Judul");

    setText("#readerByline", `Karya oleh ${data.author || "Anonim"}`);

    setText("#readerDescription", data.description || "");
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       IMAGES
    ===================================================== */

<<<<<<< HEAD
    images =
      normalizeImages(
        data.image_urls
      );

=======
    images = normalizeImages(data.image_urls);
>>>>>>> 92de7e3 (amz)

    /* =====================================================
       TEXT
    ===================================================== */

    renderText();

<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
    /* =====================================================
       THUMBNAILS
    ===================================================== */

    renderThumbnails();

<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
    /* =====================================================
       READER STATE
    ===================================================== */

<<<<<<< HEAD
    currentPage =
      0;


    setText(
      '#totalPages',
      images.length
    );


    setText(
      '#thumbnailCount',
      `${images.length} halaman`
    );

=======
    currentPage = 0;

    setText("#totalPages", images.length);

    setText("#thumbnailCount", `${images.length} halaman`);
>>>>>>> 92de7e3 (amz)

    /*
      Karya tidak wajib punya gambar.

      Kalau ada gambar:
      → tampilkan halaman gambar.

      Kalau tidak ada gambar tetapi ada tulisan:
      → tulisan tetap tampil.

      Kalau tidak ada keduanya:
      → tampilkan empty state.
    */

    if (images.length > 0) {
<<<<<<< HEAD

      hideElement(
        '#pageEmpty'
      );

      showElement(
        '#comicImage'
      );

      showPage(0);

    } else {

      hideElement(
        '#comicImage'
      );

      hideElement(
        '#pageLoading'
      );
=======
      hideElement("#pageEmpty");

      showElement("#comicImage");

      showPage(0);
    } else {
      hideElement("#comicImage");

      hideElement("#pageLoading");
>>>>>>> 92de7e3 (amz)

      /*
        Kalau tidak ada gambar tetapi
        ada tulisan, jangan tampilkan
        empty state.
      */

<<<<<<< HEAD
      if (
        !String(
          data.content || ''
        ).trim()
      ) {

        showEmpty();

      } else {

        hideElement(
          '#pageEmpty'
        );

      }


      setText(
        '#currentPage',
        '0'
      );

      updateNavigation();

    }


=======
      if (!String(data.content || "").trim()) {
        showEmpty();
      } else {
        hideElement("#pageEmpty");
      }

      setText("#currentPage", "0");

      updateNavigation();
    }

>>>>>>> 92de7e3 (amz)
    /* =====================================================
       COMMENTS
    ===================================================== */

    await loadComments();
<<<<<<< HEAD


  } catch (error) {

    console.error(
      'loadWork error:',
      error
    );

    showError(
      'Terjadi kesalahan saat memuat karya.'
    );

  }

}


=======
  } catch (error) {
    console.error("loadWork error:", error);

    showError("Terjadi kesalahan saat memuat karya.");
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   SHOW PAGE
========================================================= */

function showPage(index) {
<<<<<<< HEAD

  if (!images.length) {

    return;

  }


  currentPage =
    Math.max(
      0,
      Math.min(
        Number(index) || 0,
        images.length - 1
      )
    );


  const image =
    $('#comicImage');

  const loading =
    $('#pageLoading');


  if (!image) {

    return;

  }


  hideElement(
    '#pageEmpty'
  );

  showElement(
    '#comicImage'
  );


  if (loading) {

    loading.classList.add(
      'show'
    );

    loading.textContent =
      'Memuat halaman...';

  }


  image.classList.remove(
    'loaded'
  );


  image.onload = () => {

    if (loading) {

      loading.classList.remove(
        'show'
      );

    }

    image.classList.add(
      'loaded'
    );

  };


  image.onerror = () => {

    if (loading) {

      loading.textContent =
        'Gambar gagal dimuat.';

    }

    image.classList.remove(
      'loaded'
    );

  };


  image.src =
    images[currentPage];


  image.alt =
    `${
      current?.title ||
      'Karya'
    } — Halaman ${
      currentPage + 1
    }`;


  setText(
    '#currentPage',
    currentPage + 1
  );


  setText(
    '#totalPages',
    images.length
  );


  const progress =
    (
      (currentPage + 1) /
      images.length
    ) * 100;


  const progressBar =
    $('#readerProgress');


  if (progressBar) {

    progressBar.style.width =
      `${progress}%`;

  }


  updateNavigation();


  $$('.thumbnail').forEach(
    (thumbnail, index) => {

      thumbnail.classList.toggle(
        'active',
        index === currentPage
      );

    }
  );


  updateZoomPage();

}


=======
  if (!images.length) {
    return;
  }

  currentPage = Math.max(0, Math.min(Number(index) || 0, images.length - 1));

  const image = $("#comicImage");

  const loading = $("#pageLoading");

  if (!image) {
    return;
  }

  hideElement("#pageEmpty");

  showElement("#comicImage");

  if (loading) {
    loading.classList.add("show");

    loading.textContent = "Memuat halaman...";
  }

  image.classList.remove("loaded");

  image.onload = () => {
    if (loading) {
      loading.classList.remove("show");
    }

    image.classList.add("loaded");
  };

  image.onerror = () => {
    if (loading) {
      loading.textContent = "Gambar gagal dimuat.";
    }

    image.classList.remove("loaded");
  };

  image.src = images[currentPage];

  image.alt = `${current?.title || "Karya"} — Halaman ${currentPage + 1}`;

  setText("#currentPage", currentPage + 1);

  setText("#totalPages", images.length);

  const progress = ((currentPage + 1) / images.length) * 100;

  const progressBar = $("#readerProgress");

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  updateNavigation();

  $$(".thumbnail").forEach((thumbnail, index) => {
    thumbnail.classList.toggle("active", index === currentPage);
  });

  updateZoomPage();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   NAVIGATION
========================================================= */

function nextPage() {
<<<<<<< HEAD

  if (!images.length) {

    return;

  }


  if (
    currentPage <
    images.length - 1
  ) {

    showPage(
      currentPage + 1
    );

    scrollReaderIntoView();

  } else {

    toast(
      'Kamu sudah di halaman terakhir ✦'
    );

  }

}


function prevPage() {

  if (!images.length) {

    return;

  }


  if (currentPage > 0) {

    showPage(
      currentPage - 1
    );

    scrollReaderIntoView();

  } else {

    toast(
      'Kamu sudah di halaman pertama.'
    );

  }

}


function firstPage() {

  if (!images.length) {

    return;

  }


  showPage(0);

  scrollReaderIntoView();

}


function lastPage() {

  if (!images.length) {

    return;

  }


  showPage(
    images.length - 1
  );

  scrollReaderIntoView();

}


function scrollReaderIntoView() {

  const reader =
    $('#comicReader');

  if (!reader) {

    return;

  }


  reader.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

}


function updateNavigation() {

  const first =
    !images.length ||
    currentPage === 0;


  const last =
    !images.length ||
    currentPage ===
      images.length - 1;


  const previousButtons = [
    $('#prevPage'),
    $('#prevPageBottom')
  ];


  const nextButtons = [
    $('#nextPage'),
    $('#nextPageBottom')
  ];


  previousButtons.forEach(
    button => {

      if (button) {

        button.disabled =
          first;

      }

    }
  );


  nextButtons.forEach(
    button => {

      if (button) {

        button.disabled =
          last;

      }

    }
  );

}


=======
  if (!images.length) {
    return;
  }

  if (currentPage < images.length - 1) {
    showPage(currentPage + 1);

    scrollReaderIntoView();
  } else {
    toast("Kamu sudah di halaman terakhir ✦");
  }
}

function prevPage() {
  if (!images.length) {
    return;
  }

  if (currentPage > 0) {
    showPage(currentPage - 1);

    scrollReaderIntoView();
  } else {
    toast("Kamu sudah di halaman pertama.");
  }
}

function firstPage() {
  if (!images.length) {
    return;
  }

  showPage(0);

  scrollReaderIntoView();
}

function lastPage() {
  if (!images.length) {
    return;
  }

  showPage(images.length - 1);

  scrollReaderIntoView();
}

function scrollReaderIntoView() {
  const reader = $("#comicReader");

  if (!reader) {
    return;
  }

  reader.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function updateNavigation() {
  const first = !images.length || currentPage === 0;

  const last = !images.length || currentPage === images.length - 1;

  const previousButtons = [$("#prevPage"), $("#prevPageBottom")];

  const nextButtons = [$("#nextPage"), $("#nextPageBottom")];

  previousButtons.forEach((button) => {
    if (button) {
      button.disabled = first;
    }
  });

  nextButtons.forEach((button) => {
    if (button) {
      button.disabled = last;
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   THUMBNAILS
========================================================= */

function renderThumbnails() {
<<<<<<< HEAD

  const container =
    $('#thumbnailList');


  if (!container) {

    return;

  }


  if (!images.length) {

    container.innerHTML =
      '';

    return;

  }


  container.innerHTML =
    images
      .map(
        (url, index) => `

          <button
            class="thumbnail ${
              index === 0
                ? 'active'
                : ''
            }"
            type="button"
            data-page="${index}"
            aria-label="Halaman ${
              index + 1
            }"
=======
  const container = $("#thumbnailList");

  if (!container) {
    return;
  }

  if (!images.length) {
    container.innerHTML = "";

    return;
  }

  container.innerHTML = images
    .map(
      (url, index) => `

          <button
            class="thumbnail ${index === 0 ? "active" : ""}"
            type="button"
            data-page="${index}"
            aria-label="Halaman ${index + 1}"
>>>>>>> 92de7e3 (amz)
          >

            <img
              src="${esc(url)}"
<<<<<<< HEAD
              alt="Thumbnail halaman ${
                index + 1
              }"
=======
              alt="Thumbnail halaman ${index + 1}"
>>>>>>> 92de7e3 (amz)
              loading="lazy"
            >

            <span>
              ${index + 1}
            </span>

          </button>

<<<<<<< HEAD
        `
      )
      .join('');


  $$('.thumbnail').forEach(
    button => {

      button.addEventListener(
        'click',
        () => {

          const page =
            Number(
              button.dataset.page
            );

          showPage(page);

          scrollReaderIntoView();

        }
      );

    }
  );

}


=======
        `,
    )
    .join("");

  $$(".thumbnail").forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);

      showPage(page);

      scrollReaderIntoView();
    });
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   TEXT CONTENT
========================================================= */

function renderText() {
<<<<<<< HEAD

  const wrapper =
    $('#textContent');

  const text =
    $('#readerText');


  if (!wrapper || !text) {

    return;

  }


  const content =
    String(
      current?.content ??
      ''
    ).trim();

=======
  const wrapper = $("#textContent");

  const text = $("#readerText");

  if (!wrapper || !text) {
    return;
  }

  const content = String(current?.content ?? "").trim();
>>>>>>> 92de7e3 (amz)

  /*
    Kalau tidak ada tulisan:
    sembunyikan area tulisan.
  */

  if (!content) {
<<<<<<< HEAD

    wrapper.classList.add(
      'hidden'
    );

    text.innerHTML =
      '';

    return;

  }


=======
    wrapper.classList.add("hidden");

    text.innerHTML = "";

    return;
  }

>>>>>>> 92de7e3 (amz)
  /*
    Kalau ADA tulisan:
    pastikan area tulisan tampil.
  */

<<<<<<< HEAD
  wrapper.classList.remove(
    'hidden'
  );

=======
  wrapper.classList.remove("hidden");
>>>>>>> 92de7e3 (amz)

  /*
    Escape HTML supaya tulisan
    tidak bisa menyisipkan HTML/script.
  */

<<<<<<< HEAD
  const paragraphs =
    content
      .replace(
        /\r\n/g,
        '\n'
      )
      .split(
        /\n{2,}/
      )
      .map(
        paragraph =>
          paragraph.trim()
      )
      .filter(Boolean);


  text.innerHTML =
    paragraphs.length

      ? paragraphs
          .map(
            paragraph => `

              <p>
                ${
                  esc(
                    paragraph
                  ).replace(
                    /\n/g,
                    '<br>'
                  )
                }
              </p>

            `
          )
          .join('')

      : `
=======
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  text.innerHTML = paragraphs.length
    ? paragraphs
        .map(
          (paragraph) => `

              <p>
                ${esc(paragraph).replace(/\n/g, "<br>")}
              </p>

            `,
        )
        .join("")
    : `
>>>>>>> 92de7e3 (amz)
          <p>
            ${esc(content)}
          </p>
        `;
<<<<<<< HEAD

}


=======
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   EMPTY / ERROR
========================================================= */

function showEmpty() {
<<<<<<< HEAD

  hideElement(
    '#pageLoading'
  );

  hideElement(
    '#comicImage'
  );


  const empty =
    $('#pageEmpty');


  if (!empty) {

    return;

  }


  empty.classList.remove(
    'hidden'
  );

=======
  hideElement("#pageLoading");

  hideElement("#comicImage");

  const empty = $("#pageEmpty");

  if (!empty) {
    return;
  }

  empty.classList.remove("hidden");
>>>>>>> 92de7e3 (amz)

  empty.innerHTML = `

    <div>
      📖
    </div>

    <h3>
      Karya ini belum memiliki halaman
    </h3>

    <p>
      Belum ada gambar atau tulisan
      yang dapat ditampilkan.
    </p>

  `;

<<<<<<< HEAD

  setText(
    '#totalPages',
    '0'
  );


  setText(
    '#currentPage',
    '0'
  );

}


function showError(message) {

  hideElement(
    '#pageLoading'
  );

  hideElement(
    '#comicImage'
  );


  const empty =
    $('#pageEmpty');


  if (!empty) {

    return;

  }


  empty.classList.remove(
    'hidden'
  );

=======
  setText("#totalPages", "0");

  setText("#currentPage", "0");
}

function showError(message) {
  hideElement("#pageLoading");

  hideElement("#comicImage");

  const empty = $("#pageEmpty");

  if (!empty) {
    return;
  }

  empty.classList.remove("hidden");
>>>>>>> 92de7e3 (amz)

  empty.innerHTML = `

    <div>
      ⚠
    </div>

    <h3>
      ${esc(message)}
    </h3>

    <a href="index.html">
      Kembali ke CEMARA
    </a>

  `;
<<<<<<< HEAD

}


=======
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {
<<<<<<< HEAD

  if (!current || !db) {

    return;

  }


  const listElement =
    $('#commentsList');


  if (!listElement) {

    return;

  }


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


    const list =
      data || [];


    setText(
      '#commentCount',
      `${list.length} komentar`
    );


    if (!list.length) {

=======
  if (!current || !db) {
    return;
  }

  const listElement = $("#commentsList");

  if (!listElement) {
    return;
  }

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

    const list = data || [];

    setText("#commentCount", `${list.length} komentar`);

    if (!list.length) {
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
      list
        .map(
          comment => {

            const date =
              comment.created_at
                ? new Date(
                    comment.created_at
                  ).toLocaleDateString(
                    'id-ID',
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }
                  )
                : '';


            /*
=======
    }

    listElement.innerHTML = list
      .map((comment) => {
        const date = comment.created_at
          ? new Date(comment.created_at).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "";

        /*
>>>>>>> 92de7e3 (amz)
              ADMIN:
              Bisa mengedit dan menghapus
              semua komentar.

              USER BIASA:
              Hanya bisa mengedit dan
              menghapus komentarnya sendiri.
            */

<<<<<<< HEAD
            const canManage =
              isAdmin ||
              (
                user &&
                comment.user_id ===
                  user.id
              );


            return `
=======
        const canManage = isAdmin || (user && comment.user_id === user.id);

        return `
>>>>>>> 92de7e3 (amz)

              <div
                class="comment-item"
              >

                <div
                  class="comment-top"
                >

                  <strong>
<<<<<<< HEAD
                    ${esc(
                      comment.name ||
                      'Anonim'
                    )}
=======
                    ${esc(comment.name || "Anonim")}
>>>>>>> 92de7e3 (amz)
                  </strong>

                  <time>
                    ${esc(date)}
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

                      <div
                        class="comment-actions"
                      >

                        <button
                          type="button"
<<<<<<< HEAD
                          data-edit-comment="${esc(
                            comment.id
                          )}"
=======
                          data-edit-comment="${esc(comment.id)}"
>>>>>>> 92de7e3 (amz)
                        >
                          Edit
                        </button>


                        <button
                          type="button"
<<<<<<< HEAD
                          data-delete-comment="${esc(
                            comment.id
                          )}"
=======
                          data-delete-comment="${esc(comment.id)}"
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
        )
        .join('');

=======
      })
      .join("");
>>>>>>> 92de7e3 (amz)

    /*
      TOMBOL EDIT
    */

<<<<<<< HEAD
    $$('[data-edit-comment]').forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            editComment(
              button.dataset.editComment
            );

          }
        );

      }
    );

=======
    $$("[data-edit-comment]").forEach((button) => {
      button.addEventListener("click", () => {
        editComment(button.dataset.editComment);
      });
    });
>>>>>>> 92de7e3 (amz)

    /*
      TOMBOL HAPUS
    */

<<<<<<< HEAD
    $$('[data-delete-comment]').forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            deleteComment(
              button.dataset.deleteComment
            );

          }
        );

      }
    );


  } catch (error) {

    console.error(
      'Comment loading error:',
      error
    );

  }

}


=======
    $$("[data-delete-comment]").forEach((button) => {
      button.addEventListener("click", () => {
        deleteComment(button.dataset.deleteComment);
      });
    });
  } catch (error) {
    console.error("Comment loading error:", error);
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


  try {

    const {
      data,
      error
    } =
      await db
        .from('comments')
        .select('*')
        .eq(
          'id',
          id
        )
        .single();


    if (error || !data) {

      toast(
        'Komentar tidak ditemukan.'
      );

      return;

    }


    const allowed =
      isAdmin ||
      data.user_id ===
        user.id;


    if (!allowed) {

      toast(
        'Kamu tidak dapat mengedit komentar ini.'
      );

      return;

    }


    editing =
      data;


    const nameInput =
      $('#commentName');

    const contentInput =
      $('#commentText');


    if (nameInput) {

      nameInput.value =
        data.name || '';

    }


    if (contentInput) {

      contentInput.value =
        data.content || '';

      contentInput.focus();

    }


    const submitButton =
      $('#commentForm')
        ?.querySelector(
          'button[type="submit"]'
        );


    if (submitButton) {

      submitButton.dataset.originalText =
        submitButton.textContent;

      submitButton.textContent =
        'Simpan Perubahan';

    }


    toast(
      'Mode edit aktif. ✦'
    );


  } catch (error) {

    console.error(
      'Edit comment error:',
      error
    );

    toast(
      'Gagal membuka komentar.'
    );

  }

}


=======
  if (!user) {
    toast("Login dulu untuk mengedit komentar.");

    return;
  }

  try {
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

    const nameInput = $("#commentName");

    const contentInput = $("#commentText");

    if (nameInput) {
      nameInput.value = data.name || "";
    }

    if (contentInput) {
      contentInput.value = data.content || "";

      contentInput.focus();
    }

    const submitButton = $("#commentForm")?.querySelector(
      'button[type="submit"]',
    );

    if (submitButton) {
      submitButton.dataset.originalText = submitButton.textContent;

      submitButton.textContent = "Simpan Perubahan";
    }

    toast("Mode edit aktif. ✦");
  } catch (error) {
    console.error("Edit comment error:", error);

    toast("Gagal membuka komentar.");
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   CANCEL EDIT
========================================================= */

function cancelEdit() {
<<<<<<< HEAD

  editing =
    null;


  const form =
    $('#commentForm');


  if (form) {

    form.reset();

  }


  const submitButton =
    form?.querySelector(
      'button[type="submit"]'
    );


  if (submitButton) {

    submitButton.textContent =
      submitButton.dataset.originalText ||
      'Kirim Komentar';

    delete submitButton.dataset.originalText;

  }

}


=======
  editing = null;

  const form = $("#commentForm");

  if (form) {
    form.reset();
  }

  const submitButton = form?.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent =
      submitButton.dataset.originalText || "Kirim Komentar";

    delete submitButton.dataset.originalText;
  }
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


  try {

    const {
      data,
      error
    } =
      await db
        .from('comments')
        .select('user_id')
        .eq(
          'id',
          id
        )
        .single();


    if (error || !data) {

      toast(
        'Komentar tidak ditemukan.'
      );

      return;

    }


    const allowed =
      isAdmin ||
      data.user_id ===
        user.id;


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
      error: deleteError
    } =
      await db
        .from('comments')
        .delete()
        .eq(
          'id',
          id
        );


    if (deleteError) {

      console.error(
        'Delete comment error:',
        deleteError
      );

      toast(
        deleteError.message ||
        'Komentar gagal dihapus.'
      );

      return;

    }


    if (
      editing &&
      String(editing.id) ===
        String(id)
    ) {

      cancelEdit();

    }


    toast(
      'Komentar berhasil dihapus. ✦'
    );


    await loadComments();


  } catch (error) {

    console.error(
      'Delete comment exception:',
      error
    );

    toast(
      'Gagal menghapus komentar.'
    );

  }

}


=======
  if (!user) {
    toast("Login dulu untuk menghapus komentar.");

    return;
  }

  try {
    const { data, error } = await db
      .from("comments")
      .select("user_id")
      .eq("id", id)
      .single();

    if (error || !data) {
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

    const { error: deleteError } = await db
      .from("comments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete comment error:", deleteError);

      toast(deleteError.message || "Komentar gagal dihapus.");

      return;
    }

    if (editing && String(editing.id) === String(id)) {
      cancelEdit();
    }

    toast("Komentar berhasil dihapus. ✦");

    await loadComments();
  } catch (error) {
    console.error("Delete comment exception:", error);

    toast("Gagal menghapus komentar.");
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COMMENT FORM
========================================================= */

function setupCommentForm() {
<<<<<<< HEAD

  const commentForm =
    $('#commentForm');


  if (!commentForm) {

    return;

  }


  commentForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (!db || !current) {

        return;

      }


      const nameInput =
        $('#commentName');

      const contentInput =
        $('#commentText');


      const name =
        nameInput?.value
          ?.trim() || '';


      const content =
        contentInput?.value
          ?.trim() || '';


      if (!name) {

        toast(
          'Nama belum diisi.'
        );

        nameInput?.focus();

        return;

      }


      if (!content) {

        toast(
          'Komentar belum diisi.'
        );

        contentInput?.focus();

        return;

      }


      const submitButton =
        commentForm.querySelector(
          'button[type="submit"]'
        );


      if (submitButton) {

        submitButton.disabled =
          true;

      }


      try {

        /*
=======
  const commentForm = $("#commentForm");

  if (!commentForm) {
    return;
  }

  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db || !current) {
      return;
    }

    const nameInput = $("#commentName");

    const contentInput = $("#commentText");

    const name = nameInput?.value?.trim() || "";

    const content = contentInput?.value?.trim() || "";

    const taggedUserId = $("#commentTagUser")?.value || "";

    if (!name) {
      toast("Nama belum diisi.");

      nameInput?.focus();

      return;
    }

    if (!content) {
      toast("Komentar belum diisi.");

      contentInput?.focus();

      return;
    }

    const submitButton = commentForm.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      /*
>>>>>>> 92de7e3 (amz)
          ==================================================
          MODE EDIT
          ==================================================
        */

<<<<<<< HEAD
        if (editing) {

          /*
=======
      if (editing) {
        /*
>>>>>>> 92de7e3 (amz)
            Cek sekali lagi apakah user
            memang boleh mengubah komentar.
          */

<<<<<<< HEAD
          const {
            data: existing,
            error: existingError
          } =
            await db
              .from('comments')
              .select('user_id')
              .eq(
                'id',
                editing.id
              )
              .single();


          if (
            existingError ||
            !existing
          ) {

            toast(
              'Komentar tidak ditemukan.'
            );

            cancelEdit();

            return;

          }


          const allowed =
            isAdmin ||
            existing.user_id ===
              user.id;


          if (!allowed) {

            toast(
              'Kamu tidak dapat mengedit komentar ini.'
            );

            cancelEdit();

            return;

          }


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

            console.error(
              'Comment update error:',
              error
            );

            toast(
              error.message ||
              'Komentar gagal diedit.'
            );

            return;

          }


          editing =
            null;


          commentForm.reset();


          if (submitButton) {

            submitButton.textContent =
              submitButton.dataset.originalText ||
              'Kirim Komentar';

            delete submitButton.dataset.originalText;

          }


          toast(
            'Komentar berhasil diedit. ✦'
          );


          await loadComments();


          return;

        }


        /*
=======
        const { data: existing, error: existingError } = await db
          .from("comments")
          .select("user_id")
          .eq("id", editing.id)
          .single();

        if (existingError || !existing) {
          toast("Komentar tidak ditemukan.");

          cancelEdit();

          return;
        }

        const allowed = isAdmin || existing.user_id === user.id;

        if (!allowed) {
          toast("Kamu tidak dapat mengedit komentar ini.");

          cancelEdit();

          return;
        }

        const { error } = await db
          .from("comments")
          .update({
            name,

            content,

            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);

        if (error) {
          console.error("Comment update error:", error);

          toast(error.message || "Komentar gagal diedit.");

          return;
        }

        editing = null;

        commentForm.reset();

        if (submitButton) {
          submitButton.textContent =
            submitButton.dataset.originalText || "Kirim Komentar";

          delete submitButton.dataset.originalText;
        }

        toast("Komentar berhasil diedit. ✦");

        await loadComments();

        return;
      }

      /*
>>>>>>> 92de7e3 (amz)
          ==================================================
          KOMENTAR BARU
          ==================================================
        */

<<<<<<< HEAD
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

          console.error(
            'Comment insert error:',
            error
          );

          toast(
            error.message ||
            'Komentar gagal disimpan.'
          );

          return;

        }


        commentForm.reset();


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


      } finally {

        if (submitButton) {

          submitButton.disabled =
            false;

        }

      }

    }
  );

}


=======
      const { error } = await db.from("comments").insert({
        work_id: current.id,

        user_id: user?.id || null,

        name,

        content,

        tagged_user_ids: taggedUserId ? [taggedUserId] : [],
      });

      if (error) {
        console.error("Comment insert error:", error);

        toast(error.message || "Komentar gagal disimpan.");

        return;
      }

      commentForm.reset();

      toast("Komentar tersimpan. ✦");

      await loadComments();
    } catch (error) {
      console.error("Comment submit error:", error);

      toast("Komentar gagal diproses.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   DARK MODE
========================================================= */

function setupTheme() {
<<<<<<< HEAD

  const themeButton =
    $('#readerTheme');


  if (!themeButton) {

    return;

  }


  const savedTheme =
    localStorage.getItem(
      'cemara_reader_theme'
    );


  if (
    savedTheme === 'dark'
  ) {

    document.body.classList.add(
      'reader-dark'
    );

    themeButton.textContent =
      '☀';

  } else {

    themeButton.textContent =
      '☾';

  }


  themeButton.addEventListener(
    'click',
    () => {

      const dark =
        document.body.classList.toggle(
          'reader-dark'
        );


      themeButton.textContent =
        dark
          ? '☀'
          : '☾';


      localStorage.setItem(
        'cemara_reader_theme',
        dark
          ? 'dark'
          : 'light'
      );

    }
  );

}


=======
  const themeButton = $("#readerTheme");

  if (!themeButton) {
    return;
  }

  const savedTheme = localStorage.getItem("cemara_reader_theme");

  if (savedTheme === "dark") {
    document.body.classList.add("reader-dark");

    themeButton.textContent = "☀";
  } else {
    themeButton.textContent = "☾";
  }

  themeButton.addEventListener("click", () => {
    const dark = document.body.classList.toggle("reader-dark");

    themeButton.textContent = dark ? "☀" : "☾";

    localStorage.setItem("cemara_reader_theme", dark ? "dark" : "light");
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   FULLSCREEN
========================================================= */

function setupFullscreen() {
<<<<<<< HEAD

  const button =
    $('#fullscreenBtn');


  if (!button) {

    return;

  }


  button.addEventListener(
    'click',
    async () => {

      const reader =
        $('#comicReader');


      if (!reader) {

        return;

      }


      try {

        if (
          !document.fullscreenElement
        ) {

          await reader.requestFullscreen();

        } else {

          await document.exitFullscreen();

        }

      } catch (error) {

        console.error(
          'Fullscreen error:',
          error
        );

        toast(
          'Fullscreen tidak tersedia di browser ini.'
        );

      }

    }
  );

}


=======
  const button = $("#fullscreenBtn");

  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    const reader = $("#comicReader");

    if (!reader) {
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await reader.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);

      toast("Fullscreen tidak tersedia di browser ini.");
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {
<<<<<<< HEAD

  $('#prevPage')?.addEventListener(
    'click',
    prevPage
  );


  $('#nextPage')?.addEventListener(
    'click',
    nextPage
  );


  $('#prevPageBottom')?.addEventListener(
    'click',
    prevPage
  );


  $('#nextPageBottom')?.addEventListener(
    'click',
    nextPage
  );


  $('#firstPage')?.addEventListener(
    'click',
    firstPage
  );


  $('#lastPage')?.addEventListener(
    'click',
    lastPage
  );

}


=======
  $("#prevPage")?.addEventListener("click", prevPage);

  $("#nextPage")?.addEventListener("click", nextPage);

  $("#prevPageBottom")?.addEventListener("click", prevPage);

  $("#nextPageBottom")?.addEventListener("click", nextPage);

  $("#firstPage")?.addEventListener("click", firstPage);

  $("#lastPage")?.addEventListener("click", lastPage);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   KEYBOARD
========================================================= */

function setupKeyboard() {
<<<<<<< HEAD

  document.addEventListener(
    'keydown',
    event => {

      const target =
        event.target;


      if (
        target &&
        (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      ) {

        return;

      }


      const zoomViewer =
        $('#zoomViewer');


      /*
=======
  document.addEventListener("keydown", (event) => {
    const target = event.target;

    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      return;
    }

    const zoomViewer = $("#zoomViewer");

    /*
>>>>>>> 92de7e3 (amz)
        Kalau zoom viewer sedang terbuka,
        keyboard untuk zoom ditangani
        oleh setupZoomKeyboard().
      */

<<<<<<< HEAD
      if (
        zoomViewer?.classList.contains(
          'open'
        )
      ) {

        return;

      }


      switch (event.key) {

        case 'ArrowLeft':

          event.preventDefault();

          prevPage();

          break;


        case 'ArrowRight':

          event.preventDefault();

          nextPage();

          break;


        case 'Home':

          event.preventDefault();

          firstPage();

          break;


        case 'End':

          event.preventDefault();

          lastPage();

          break;

      }

    }
  );

}


=======
    if (zoomViewer?.classList.contains("open")) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();

        prevPage();

        break;

      case "ArrowRight":
        event.preventDefault();

        nextPage();

        break;

      case "Home":
        event.preventDefault();

        firstPage();

        break;

      case "End":
        event.preventDefault();

        lastPage();

        break;
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   YEAR
========================================================= */

function setupYear() {
<<<<<<< HEAD

  setText(
    '#year',
    new Date().getFullYear()
  );

}


=======
  setText("#year", new Date().getFullYear());
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ZOOM VIEWER
========================================================= */

let zoomLevel = 1;

let zoomX = 0;
let zoomY = 0;

let dragging = false;

let dragStartX = 0;
let dragStartY = 0;

let startZoomX = 0;
let startZoomY = 0;

<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
/* =========================================================
   UPDATE ZOOM
========================================================= */

function updateZoom() {
<<<<<<< HEAD

  const image =
    $('#zoomImage');


  if (!image) {

    return;

  }


  image.style.transform =
    `translate(${zoomX}px, ${zoomY}px) scale(${zoomLevel})`;


  const resetButton =
    $('#zoomReset');


  if (resetButton) {

    resetButton.textContent =
      `${Math.round(
        zoomLevel * 100
      )}%`;

  }

}


=======
  const image = $("#zoomImage");

  if (!image) {
    return;
  }

  image.style.transform = `translate(${zoomX}px, ${zoomY}px) scale(${zoomLevel})`;

  const resetButton = $("#zoomReset");

  if (resetButton) {
    resetButton.textContent = `${Math.round(zoomLevel * 100)}%`;
  }
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   RESET ZOOM
========================================================= */

function resetZoom() {
<<<<<<< HEAD

  zoomLevel =
    1;

  zoomX =
    0;

  zoomY =
    0;


  updateZoom();

}


=======
  zoomLevel = 1;

  zoomX = 0;

  zoomY = 0;

  updateZoom();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   UPDATE ZOOM PAGE
========================================================= */

function updateZoomPage() {
<<<<<<< HEAD

  const viewer =
    $('#zoomViewer');


  if (
    !viewer ||
    !viewer.classList.contains(
      'open'
    ) ||
    !images.length
  ) {

    return;

  }


  const image =
    $('#zoomImage');


  if (image) {

    image.src =
      images[currentPage];


    image.alt =
      `${
        current?.title ||
        'Karya'
      } — Halaman ${
        currentPage + 1
      }`;

  }


  setText(
    '#zoomPageLabel',
    `Halaman ${
      currentPage + 1
    } / ${
      images.length
    }`
  );


  resetZoom();

}


=======
  const viewer = $("#zoomViewer");

  if (!viewer || !viewer.classList.contains("open") || !images.length) {
    return;
  }

  const image = $("#zoomImage");

  if (image) {
    image.src = images[currentPage];

    image.alt = `${current?.title || "Karya"} — Halaman ${currentPage + 1}`;
  }

  setText("#zoomPageLabel", `Halaman ${currentPage + 1} / ${images.length}`);

  resetZoom();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   OPEN ZOOM
========================================================= */

function openZoom() {
<<<<<<< HEAD

  if (!images.length) {

    toast(
      'Karya ini tidak memiliki gambar.'
    );

    return;

  }


  const viewer =
    $('#zoomViewer');

  const image =
    $('#zoomImage');


  if (!viewer || !image) {

    return;

  }


  image.src =
    images[currentPage];


  image.alt =
    `${
      current?.title ||
      'Karya'
    } — Halaman ${
      currentPage + 1
    }`;


  setText(
    '#zoomPageLabel',
    `Halaman ${
      currentPage + 1
    } / ${
      images.length
    }`
  );


  resetZoom();


  viewer.classList.add(
    'open'
  );


  viewer.setAttribute(
    'aria-hidden',
    'false'
  );


  document.body.style.overflow =
    'hidden';

}


=======
  if (!images.length) {
    toast("Karya ini tidak memiliki gambar.");

    return;
  }

  const viewer = $("#zoomViewer");

  const image = $("#zoomImage");

  if (!viewer || !image) {
    return;
  }

  image.src = images[currentPage];

  image.alt = `${current?.title || "Karya"} — Halaman ${currentPage + 1}`;

  setText("#zoomPageLabel", `Halaman ${currentPage + 1} / ${images.length}`);

  resetZoom();

  viewer.classList.add("open");

  viewer.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   CLOSE ZOOM
========================================================= */

function closeZoom() {
<<<<<<< HEAD

  const viewer =
    $('#zoomViewer');


  if (!viewer) {

    return;

  }


  viewer.classList.remove(
    'open'
  );


  viewer.setAttribute(
    'aria-hidden',
    'true'
  );


  document.body.style.overflow =
    '';


  resetZoom();

}


=======
  const viewer = $("#zoomViewer");

  if (!viewer) {
    return;
  }

  viewer.classList.remove("open");

  viewer.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  resetZoom();
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ZOOM BUTTONS
========================================================= */

function setupZoomButtons() {
<<<<<<< HEAD

  const comicImage =
    $('#comicImage');


  if (comicImage) {

    comicImage.addEventListener(
      'click',
      () => {

        if (
          !comicImage.classList.contains(
            'hidden'
          )
        ) {

          openZoom();

        }

      }
    );

  }


  $('#zoomHint')?.addEventListener(
    'click',
    openZoom
  );


  $('#zoomClose')?.addEventListener(
    'click',
    closeZoom
  );


  $('#zoomIn')?.addEventListener(
    'click',
    () => {

      zoomLevel =
        Math.min(
          zoomLevel + 0.25,
          5
        );

      updateZoom();

    }
  );


  $('#zoomOut')?.addEventListener(
    'click',
    () => {

      zoomLevel =
        Math.max(
          zoomLevel - 0.25,
          1
        );


      if (
        zoomLevel === 1
      ) {

        zoomX = 0;
        zoomY = 0;

      }


      updateZoom();

    }
  );


  $('#zoomReset')?.addEventListener(
    'click',
    resetZoom
  );

}


=======
  const comicImage = $("#comicImage");

  if (comicImage) {
    comicImage.addEventListener("click", () => {
      if (!comicImage.classList.contains("hidden")) {
        openZoom();
      }
    });
  }

  $("#zoomHint")?.addEventListener("click", openZoom);

  $("#zoomClose")?.addEventListener("click", closeZoom);

  $("#zoomIn")?.addEventListener("click", () => {
    zoomLevel = Math.min(zoomLevel + 0.25, 5);

    updateZoom();
  });

  $("#zoomOut")?.addEventListener("click", () => {
    zoomLevel = Math.max(zoomLevel - 0.25, 1);

    if (zoomLevel === 1) {
      zoomX = 0;
      zoomY = 0;
    }

    updateZoom();
  });

  $("#zoomReset")?.addEventListener("click", resetZoom);
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ZOOM WHEEL
========================================================= */

function setupZoomWheel() {
<<<<<<< HEAD

  const viewport =
    $('#zoomViewport');


  if (!viewport) {

    return;

  }


  viewport.addEventListener(
    'wheel',
    event => {

      if (
        !$('#zoomViewer')
          ?.classList
          .contains('open')
      ) {

        return;

      }


      event.preventDefault();


      if (
        event.deltaY < 0
      ) {

        zoomLevel =
          Math.min(
            zoomLevel + 0.15,
            5
          );

      } else {

        zoomLevel =
          Math.max(
            zoomLevel - 0.15,
            1
          );

      }


      if (
        zoomLevel === 1
      ) {

        zoomX = 0;
        zoomY = 0;

      }


      updateZoom();

    },
    {
      passive: false
    }
  );

}


=======
  const viewport = $("#zoomViewport");

  if (!viewport) {
    return;
  }

  viewport.addEventListener(
    "wheel",
    (event) => {
      if (!$("#zoomViewer")?.classList.contains("open")) {
        return;
      }

      event.preventDefault();

      if (event.deltaY < 0) {
        zoomLevel = Math.min(zoomLevel + 0.15, 5);
      } else {
        zoomLevel = Math.max(zoomLevel - 0.15, 1);
      }

      if (zoomLevel === 1) {
        zoomX = 0;
        zoomY = 0;
      }

      updateZoom();
    },
    {
      passive: false,
    },
  );
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ZOOM DRAG
========================================================= */

function setupZoomDrag() {
<<<<<<< HEAD

  const viewport =
    $('#zoomViewport');


  if (!viewport) {

    return;

  }


  viewport.addEventListener(
    'pointerdown',
    event => {

      if (
        zoomLevel <= 1
      ) {

        return;

      }


      dragging =
        true;


      viewport.classList.add(
        'dragging'
      );


      dragStartX =
        event.clientX;


      dragStartY =
        event.clientY;


      startZoomX =
        zoomX;


      startZoomY =
        zoomY;


      try {

        viewport.setPointerCapture(
          event.pointerId
        );

      } catch (_) {}

    }
  );


  viewport.addEventListener(
    'pointermove',
    event => {

      if (!dragging) {

        return;

      }


      zoomX =
        startZoomX +
        (
          event.clientX -
          dragStartX
        );


      zoomY =
        startZoomY +
        (
          event.clientY -
          dragStartY
        );


      updateZoom();

    }
  );


  const stopDragging =
    () => {

      dragging =
        false;


      viewport.classList.remove(
        'dragging'
      );

    };


  viewport.addEventListener(
    'pointerup',
    stopDragging
  );


  viewport.addEventListener(
    'pointercancel',
    stopDragging
  );


  viewport.addEventListener(
    'pointerleave',
    () => {

      /*
=======
  const viewport = $("#zoomViewport");

  if (!viewport) {
    return;
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (zoomLevel <= 1) {
      return;
    }

    dragging = true;

    viewport.classList.add("dragging");

    dragStartX = event.clientX;

    dragStartY = event.clientY;

    startZoomX = zoomX;

    startZoomY = zoomY;

    try {
      viewport.setPointerCapture(event.pointerId);
    } catch (_) {}
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    zoomX = startZoomX + (event.clientX - dragStartX);

    zoomY = startZoomY + (event.clientY - dragStartY);

    updateZoom();
  });

  const stopDragging = () => {
    dragging = false;

    viewport.classList.remove("dragging");
  };

  viewport.addEventListener("pointerup", stopDragging);

  viewport.addEventListener("pointercancel", stopDragging);

  viewport.addEventListener("pointerleave", () => {
    /*
>>>>>>> 92de7e3 (amz)
        Jangan langsung membatalkan drag.
        Pointer capture akan menangani
        pergerakan mouse dengan lebih stabil.
      */
<<<<<<< HEAD

    }
  );

}


=======
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   DOUBLE CLICK ZOOM
========================================================= */

function setupZoomDoubleClick() {
<<<<<<< HEAD

  const image =
    $('#zoomImage');


  if (!image) {

    return;

  }


  image.addEventListener(
    'dblclick',
    () => {

      if (
        zoomLevel === 1
      ) {

        zoomLevel =
          2;

      } else {

        resetZoom();

        return;

      }


      updateZoom();

    }
  );

}


=======
  const image = $("#zoomImage");

  if (!image) {
    return;
  }

  image.addEventListener("dblclick", () => {
    if (zoomLevel === 1) {
      zoomLevel = 2;
    } else {
      resetZoom();

      return;
    }

    updateZoom();
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   ZOOM KEYBOARD
========================================================= */

function setupZoomKeyboard() {
<<<<<<< HEAD

  document.addEventListener(
    'keydown',
    event => {

      const viewer =
        $('#zoomViewer');


      if (
        !viewer ||
        !viewer.classList.contains(
          'open'
        )
      ) {

        return;

      }


      if (
        event.key === 'Escape'
      ) {

        event.preventDefault();

        closeZoom();

        return;

      }


      if (
        event.key === '+' ||
        event.key === '='
      ) {

        event.preventDefault();


        zoomLevel =
          Math.min(
            zoomLevel + 0.25,
            5
          );


        updateZoom();

        return;

      }


      if (
        event.key === '-'
      ) {

        event.preventDefault();


        zoomLevel =
          Math.max(
            zoomLevel - 0.25,
            1
          );


        if (
          zoomLevel === 1
        ) {

          zoomX = 0;
          zoomY = 0;

        }


        updateZoom();

      }

    }
  );

}


=======
  document.addEventListener("keydown", (event) => {
    const viewer = $("#zoomViewer");

    if (!viewer || !viewer.classList.contains("open")) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      closeZoom();

      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();

      zoomLevel = Math.min(zoomLevel + 0.25, 5);

      updateZoom();

      return;
    }

    if (event.key === "-") {
      event.preventDefault();

      zoomLevel = Math.max(zoomLevel - 0.25, 1);

      if (zoomLevel === 1) {
        zoomX = 0;
        zoomY = 0;
      }

      updateZoom();
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   CLOSE ZOOM WHEN CLICKING BACKDROP
========================================================= */

function setupZoomBackdrop() {
<<<<<<< HEAD

  const viewer =
    $('#zoomViewer');


  if (!viewer) {

    return;

  }


  viewer.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        viewer
      ) {

        closeZoom();

      }

    }
  );

}


=======
  const viewer = $("#zoomViewer");

  if (!viewer) {
    return;
  }

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) {
      closeZoom();
    }
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   COMMENT CANCEL BUTTON
========================================================= */

function setupCommentCancel() {
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  /*
    Kalau nanti reader.html memiliki
    tombol dengan data-cancel-edit,
    tombol tersebut otomatis berfungsi.

    Kalau tidak ada, tidak masalah.
  */

<<<<<<< HEAD
  $$('[data-cancel-edit]').forEach(
    button => {

      button.addEventListener(
        'click',
        cancelEdit
      );

    }
  );

}


=======
  $$("[data-cancel-edit]").forEach((button) => {
    button.addEventListener("click", cancelEdit);
  });
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   INITIALIZE UI
========================================================= */

function initializeUI() {
<<<<<<< HEAD

=======
>>>>>>> 92de7e3 (amz)
  setupTheme();

  setupFullscreen();

  setupButtons();

  setupKeyboard();

  setupYear();

  setupZoomButtons();

  setupZoomWheel();

  setupZoomDrag();

  setupZoomDoubleClick();

  setupZoomKeyboard();

  setupZoomBackdrop();

  setupCommentForm();

  setupCommentCancel();

  updateNavigation();
<<<<<<< HEAD

}


=======
}

>>>>>>> 92de7e3 (amz)
/* =========================================================
   START
========================================================= */

function startReader() {
<<<<<<< HEAD

  initializeUI();

  boot();

}


if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    startReader
  );

} else {

  startReader();

=======
  initializeUI();

  boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startReader);
} else {
  startReader();
}

function setupWorkEngagement() {
  if (!db || !current) return;
  const likeButton = $("#likeWorkBtn");
  const saveButton = $("#saveWorkBtn");
  if (!likeButton || !saveButton) return;

  const refresh = async () => {
    const [{ data: stats }, { data: liked }, { data: saved }] =
      await Promise.all([
        db
          .from("work_engagement_stats")
          .select("like_count, save_count")
          .eq("work_id", current.id)
          .maybeSingle(),
        user
          ? db
              .from("work_likes")
              .select("work_id")
              .eq("work_id", current.id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? db
              .from("saved_works")
              .select("work_id")
              .eq("work_id", current.id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    $("#workLikeCount").textContent = stats?.like_count || 0;
    $("#workSaveCount").textContent = stats?.save_count || 0;
    likeButton.classList.toggle("is-active", Boolean(liked));
    saveButton.classList.toggle("is-active", Boolean(saved));
    likeButton.setAttribute("aria-pressed", String(Boolean(liked)));
    saveButton.setAttribute("aria-pressed", String(Boolean(saved)));
    likeButton.querySelector("span").textContent = liked ? "♥" : "♡";
    saveButton.querySelector("span").textContent = saved ? "★" : "☆";
  };

  const toggle = async (table, button) => {
    if (!user) {
      toast("Masuk untuk memberi like atau menyimpan karya.");
      return;
    }
    const active = button.classList.contains("is-active");
    const query = db
      .from(table)
      .delete()
      .eq("work_id", current.id)
      .eq("user_id", user.id);
    const result = active
      ? await query
      : await db.from(table).insert({ work_id: current.id, user_id: user.id });
    if (result.error) toast(result.error.message);
    await refresh();
  };

  likeButton.onclick = () => toggle("work_likes", likeButton);
  saveButton.onclick = () => toggle("saved_works", saveButton);
  refresh();
>>>>>>> 92de7e3 (amz)
}
