/* =========================================================
   CEMARA — APP.JS
   Homepage + Supabase + Auth + Admin + Upload + Comments
========================================================= */

const C = window.CEMARA_CONFIG || {};
const { createClient } = window.supabase || {};

let db = null;

let works = [];

let filter = 'Semua';

let selected = null;

let current = null;

let user = null;

let isAdmin = false;

let editing = null;


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


/* =========================================================
   MODAL
========================================================= */

function modal(id, open = true) {

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


/* =========================================================
   SUPABASE CONFIG
========================================================= */

function isReady() {

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


/* =========================================================
   IMAGE PARSER
========================================================= */

function normalizeImages(value) {

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

    } catch (_) {
      /* bukan JSON */
    }


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


/* =========================================================
   BOOT
========================================================= */

async function boot() {

  try {

    if (!isReady()) {

      const grid =
        $('#worksGrid');

      if (grid) {

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

      }


      authUI();

      return;

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

    await loadWorks();

    authUI();


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


/* =========================================================
   RENDER WORKS
========================================================= */

function render() {

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
                ${esc(
                  formatDate(
                    work.published_at
                  )
                )}
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


/* =========================================================
   PREVIEW WORK
========================================================= */

function preview(id) {

  selected =
    works.find(
      work =>
        String(work.id) ===
        String(id)
    );


  if (!selected) {
    return;
  }


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


    cover.innerHTML = `

      <span>
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


/* =========================================================
   OPEN READER
========================================================= */

function openReader(id) {

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

    return;
  }


  /*
    Reader sekarang menggunakan
    reader.html + reader.js.

    Jadi homepage tidak lagi
    membuat reader versi lama.
  */

  const url =
    `reader.html?id=${encodeURIComponent(
      work.id
    )}`;


  window.location.href =
    url;

}


/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {

  if (!db || !current) {
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


    const comments =
      data || [];


    const count =
      $('#commentCount');

    if (count) {

      count.textContent =
        `${comments.length} komentar`;

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

            <div class="comment-item">

              <div class="comment-top">

                <strong>
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

                    <div class="comment-actions">

                      <button
                        type="button"
                        data-edit="${esc(
                          comment.id
                        )}"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        data-del="${esc(
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


/* =========================================================
   COMMENT FORM
========================================================= */

function setupCommentForm() {

  const form =
    $('#commentForm');

  if (!form) {
    return;
  }


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


/* =========================================================
   AUTH UI
========================================================= */

function authUI() {

  const container =
    $('#authView');

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


        <button
          class="btn btn-ghost"
          id="logout"
          type="button"
        >
          Keluar
        </button>

      </div>

    `;


    $('#logout')?.addEventListener(
      'click',
      logout
    );


    return;

  }


  $('#uploadView').innerHTML =
    '';


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


/* =========================================================
   LOGIN
========================================================= */

async function login(event) {

  event.preventDefault();


  const email =
    $('#email')
      ?.value
      ?.trim() || '';


  const password =
    $('#pass')
      ?.value || '';


  if (!email || !password) {
    return;
  }


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


/* =========================================================
   REGISTER
========================================================= */

async function register(event) {

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


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

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


/* =========================================================
   ADMIN UPLOAD UI
========================================================= */

function renderUploadUI() {

  const container =
    $('#uploadView');

  if (!container) {
    return;
  }


  if (!user || !isAdmin) {

    container.innerHTML =
      '';

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


  setupUploadForm();

}


/* =========================================================
   UPLOAD FORM
========================================================= */

function setupUploadForm() {

  const form =
    $('#workUploadForm');

  const input =
    $('#workImages');

  const preview =
    $('#uploadPreview');

  const status =
    $('#uploadStatus');


  if (!form || !input) {
    return;
  }


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

            <div class="upload-item">

              <img
                src="${URL.createObjectURL(
                  file
                )}"
                alt="Preview ${index + 1}"
              >

              <span>
                ${index + 1}.
                ${esc(file.name)}
              </span>

            </div>

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
        HANYA KOMIK yang wajib
        memiliki gambar.

        Cerpen / Puisi / Esai /
        Seni boleh hanya berupa teks.
      */

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


/* =========================================================
   HEADER / NAVIGATION
========================================================= */

function setupNavigation() {

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


  /*
    Detail karya:
    tetap buka preview modal.
  */

  $('#openWorkBtn')?.addEventListener(
    'click',
    () => {

      if (!selected) return;

      openReader(
        selected.id
      );

    }
  );


  /*
    Komentar:
    langsung menuju reader.
  */

  $('#modalCommentBtn')?.addEventListener(
    'click',
    () => {

      if (!selected) return;

      openReader(
        selected.id
      );

    }
  );


  /*
    Search
  */

  $('#searchInput')?.addEventListener(
    'input',
    render
  );


  /*
    Filter kategori
  */

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


  /*
    Reset search
  */

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


  /*
    Mobile menu
  */

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


  /*
    Copy email
  */

  $('#copyEmail')?.addEventListener(
    'click',
    copyEmail
  );

}


/* =========================================================
   THEME
========================================================= */

function setupTheme() {

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


/* =========================================================
   COPY EMAIL
========================================================= */

async function copyEmail() {

  /*
    Mengikuti email yang tampil
    di index.html.
  */

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


/* =========================================================
   BACK TO TOP
========================================================= */

function setupBackTop() {

  const button =
    $('#backTop');


  if (!button) {
    return;
  }


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


/* =========================================================
   YEAR
========================================================= */

function setupYear() {

  const year =
    $('#year');

  if (year) {

    year.textContent =
      new Date()
        .getFullYear();

  }

}


/* =========================================================
   ESCAPE KEY
========================================================= */

function setupEscape() {

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


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

  setupNavigation();

  setupCommentForm();

  setupTheme();

  setupBackTop();

  setupYear();

  setupEscape();

  boot();

}


/* =========================================================
   START
========================================================= */

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

}
