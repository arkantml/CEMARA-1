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


/* =========================================================
   HELPERS
========================================================= */

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


/* =========================================================
   SAFE ELEMENT HELPERS
========================================================= */

function setText(selector, value) {

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


/* =========================================================
   IMAGE URL PARSER
========================================================= */

function normalizeImages(value) {

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


    /*
      Kalau Supabase mengembalikan
      JSON array sebagai string.
    */

    try {

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


    /*
      Kalau ternyata satu URL saja.
    */

    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/')
    ) {

      return [trimmed];

    }

  }


  return [];

}


/* =========================================================
   SUPABASE READY CHECK
========================================================= */

function isSupabaseReady() {

  return Boolean(
    C.SUPABASE_URL &&
    C.SUPABASE_PUBLISHABLE_KEY
  );

}


/* =========================================================
   BOOT
========================================================= */

async function boot() {

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


    /* =====================================================
       SESSION
    ===================================================== */

    const {
      data: sessionData
    } =
      await db.auth.getSession();

    user =
      sessionData?.session?.user ||
      null;


    /*
      Cek admin SETELAH session diketahui.
    */

    await adminCheck();


    /* =====================================================
       WORK ID
    ===================================================== */

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


    /* =====================================================
       AUTH STATE CHANGE
    ===================================================== */

    db.auth.onAuthStateChange(
      async (_event, session) => {

        user =
          session?.user ||
          null;

        await adminCheck();

        /*
          Kalau user berubah,
          komentar dirender ulang supaya
          tombol Edit/Hapus langsung ikut berubah.
        */

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


/* =========================================================
   LOAD WORK
========================================================= */

async function loadWork(id) {

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


    /* =====================================================
       BASIC INFO
    ===================================================== */

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


    /* =====================================================
       IMAGES
    ===================================================== */

    images =
      normalizeImages(
        data.image_urls
      );


    /* =====================================================
       TEXT
    ===================================================== */

    renderText();


    /* =====================================================
       THUMBNAILS
    ===================================================== */

    renderThumbnails();


    /* =====================================================
       READER STATE
    ===================================================== */

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

      /*
        Kalau tidak ada gambar tetapi
        ada tulisan, jangan tampilkan
        empty state.
      */

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


    /* =====================================================
       COMMENTS
    ===================================================== */

    await loadComments();


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


/* =========================================================
   SHOW PAGE
========================================================= */

function showPage(index) {

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


/* =========================================================
   NAVIGATION
========================================================= */

function nextPage() {

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


/* =========================================================
   THUMBNAILS
========================================================= */

function renderThumbnails() {

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
          >

            <img
              src="${esc(url)}"
              alt="Thumbnail halaman ${
                index + 1
              }"
              loading="lazy"
            >

            <span>
              ${index + 1}
            </span>

          </button>

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


/* =========================================================
   TEXT CONTENT
========================================================= */

function renderText() {

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


  /*
    Kalau tidak ada tulisan:
    sembunyikan area tulisan.
  */

  if (!content) {

    wrapper.classList.add(
      'hidden'
    );

    text.innerHTML =
      '';

    return;

  }


  /*
    Kalau ADA tulisan:
    pastikan area tulisan tampil.
  */

  wrapper.classList.remove(
    'hidden'
  );


  /*
    Escape HTML supaya tulisan
    tidak bisa menyisipkan HTML/script.
  */

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
          <p>
            ${esc(content)}
          </p>
        `;

}


/* =========================================================
   EMPTY / ERROR
========================================================= */

function showEmpty() {

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

}


/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {

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

      listElement.innerHTML = `

        <div class="empty-comments">

          Belum ada komentar.<br>

          Jadilah yang pertama
          mengapresiasi karya ini ✦

        </div>

      `;

      return;

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
              ADMIN:
              Bisa mengedit dan menghapus
              semua komentar.

              USER BIASA:
              Hanya bisa mengedit dan
              menghapus komentarnya sendiri.
            */

            const canManage =
              isAdmin ||
              (
                user &&
                comment.user_id ===
                  user.id
              );


            return `

              <div
                class="comment-item"
              >

                <div
                  class="comment-top"
                >

                  <strong>
                    ${esc(
                      comment.name ||
                      'Anonim'
                    )}
                  </strong>

                  <time>
                    ${esc(date)}
                  </time>

                </div>


                <p>
                  ${esc(
                    comment.content ||
                    ''
                  )}
                </p>


                ${
                  canManage

                    ? `

                      <div
                        class="comment-actions"
                      >

                        <button
                          type="button"
                          data-edit-comment="${esc(
                            comment.id
                          )}"
                        >
                          Edit
                        </button>


                        <button
                          type="button"
                          data-delete-comment="${esc(
                            comment.id
                          )}"
                        >
                          Hapus
                        </button>

                      </div>

                    `

                    : ''
                }

              </div>

            `;

          }
        )
        .join('');


    /*
      TOMBOL EDIT
    */

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


    /*
      TOMBOL HAPUS
    */

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


/* =========================================================
   EDIT COMMENT
========================================================= */

async function editComment(id) {

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


/* =========================================================
   CANCEL EDIT
========================================================= */

function cancelEdit() {

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


/* =========================================================
   DELETE COMMENT
========================================================= */

async function deleteComment(id) {

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


/* =========================================================
   COMMENT FORM
========================================================= */

function setupCommentForm() {

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
          ==================================================
          MODE EDIT
          ==================================================
        */

        if (editing) {

          /*
            Cek sekali lagi apakah user
            memang boleh mengubah komentar.
          */

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
          ==================================================
          KOMENTAR BARU
          ==================================================
        */

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


/* =========================================================
   DARK MODE
========================================================= */

function setupTheme() {

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


/* =========================================================
   FULLSCREEN
========================================================= */

function setupFullscreen() {

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


/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {

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


/* =========================================================
   KEYBOARD
========================================================= */

function setupKeyboard() {

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
        Kalau zoom viewer sedang terbuka,
        keyboard untuk zoom ditangani
        oleh setupZoomKeyboard().
      */

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


/* =========================================================
   YEAR
========================================================= */

function setupYear() {

  setText(
    '#year',
    new Date().getFullYear()
  );

}


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


/* =========================================================
   UPDATE ZOOM
========================================================= */

function updateZoom() {

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


/* =========================================================
   RESET ZOOM
========================================================= */

function resetZoom() {

  zoomLevel =
    1;

  zoomX =
    0;

  zoomY =
    0;


  updateZoom();

}


/* =========================================================
   UPDATE ZOOM PAGE
========================================================= */

function updateZoomPage() {

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


/* =========================================================
   OPEN ZOOM
========================================================= */

function openZoom() {

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


/* =========================================================
   CLOSE ZOOM
========================================================= */

function closeZoom() {

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


/* =========================================================
   ZOOM BUTTONS
========================================================= */

function setupZoomButtons() {

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


/* =========================================================
   ZOOM WHEEL
========================================================= */

function setupZoomWheel() {

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


/* =========================================================
   ZOOM DRAG
========================================================= */

function setupZoomDrag() {

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
        Jangan langsung membatalkan drag.
        Pointer capture akan menangani
        pergerakan mouse dengan lebih stabil.
      */

    }
  );

}


/* =========================================================
   DOUBLE CLICK ZOOM
========================================================= */

function setupZoomDoubleClick() {

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


/* =========================================================
   ZOOM KEYBOARD
========================================================= */

function setupZoomKeyboard() {

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


/* =========================================================
   CLOSE ZOOM WHEN CLICKING BACKDROP
========================================================= */

function setupZoomBackdrop() {

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


/* =========================================================
   COMMENT CANCEL BUTTON
========================================================= */

function setupCommentCancel() {

  /*
    Kalau nanti reader.html memiliki
    tombol dengan data-cancel-edit,
    tombol tersebut otomatis berfungsi.

    Kalau tidak ada, tidak masalah.
  */

  $$('[data-cancel-edit]').forEach(
    button => {

      button.addEventListener(
        'click',
        cancelEdit
      );

    }
  );

}


/* =========================================================
   INITIALIZE UI
========================================================= */

function initializeUI() {

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

}


/* =========================================================
   START
========================================================= */

function startReader() {

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

}
