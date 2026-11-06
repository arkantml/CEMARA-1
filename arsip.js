/* =========================================================
   CEMARA — ARSIP.JS
   Arsip proposal, hasil penelitian, presentasi, dan tech stack.
   Dipakai oleh: arsip.html (jelajah + versi) dan admin/index.html (input).
   Bergantung pada: config.js, shared.js, supabase-js. Data: schema_arsip.sql
========================================================= */
(() => {
  const CEMARA = (window.CEMARA = window.CEMARA || {});
  if (CEMARA.archive) return;

  const esc = (value) => CEMARA.esc(value);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  // Portal punya showToast sendiri; halaman publik memakai CEMARA.toast.
  const toast = (message) =>
    typeof window.showToast === "function"
      ? window.showToast(message)
      : CEMARA.toast(message);

  const MB = 1024 * 1024;
  const BUCKET = "arsip";
  const SIGNED_URL_SECONDS = 120;

  /* ---------- Kamus ---------- */

  const KINDS = {
    proposal: {
      label: "Proposal",
      icon: "📝",
      fileHint: "Unggah proposal (PDF atau DOCX).",
      accept: ".pdf,.doc,.docx",
      fileRequired: true,
    },
    penelitian: {
      label: "Hasil Penelitian",
      icon: "🔬",
      fileHint: "Unggah laporan hasil penelitian (PDF, DOCX, atau ZIP data).",
      accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip",
      fileRequired: true,
    },
    presentasi: {
      label: "Presentasi",
      icon: "🎞️",
      fileHint: "Unggah slide (PPTX atau PDF).",
      accept: ".ppt,.pptx,.pdf",
      fileRequired: true,
    },
    tech_stack: {
      label: "Tech Stack",
      icon: "🧩",
      fileHint:
        "Dokumen pendukung bersifat opsional (diagram arsitektur, ADR, dsb.).",
      accept: ".pdf,.png,.jpg,.jpeg,.webp,.zip,.md,.txt",
      fileRequired: false,
    },
  };

  const STATUS = {
    draft: "Draf",
    review: "Ditinjau",
    final: "Final",
    archived: "Diarsipkan",
  };

  const VERIFICATION = {
    pending: "Menunggu verifikasi",
    verified: "Terverifikasi",
    rejected: "Ditolak",
  };

  // Ekstensi → MIME. Diisi manual karena browser sering mengosongkan type
  // untuk .md; bucket `arsip` memeriksa MIME ini.
  const MIME_BY_EXT = {
    pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  const MAX_FILE_BYTES = 50 * MB;
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* ---------- Util ---------- */

  let dbInstance = null;
  function getDb() {
    if (!dbInstance) dbInstance = CEMARA.createDB();
    return dbInstance;
  }

  function extensionOf(name) {
    const match = /\.([A-Za-z0-9]+)$/.exec(String(name || ""));
    return match ? match[1].toLowerCase() : "";
  }

  function safeFileName(name) {
    const ext = extensionOf(name);
    const base = String(name || "berkas")
      .replace(/\.[A-Za-z0-9]+$/, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return `${base || "berkas"}${ext ? `.${ext}` : ""}`;
  }

  function validateFile(file, kind) {
    if (!(file instanceof File)) throw new Error("Berkas belum dipilih.");
    const ext = extensionOf(file.name);
    const rule = KINDS[kind];
    const allowed = new Set(
      (rule?.accept || "").split(",").map((item) => item.replace(".", "")),
    );

    if (!MIME_BY_EXT[ext]) {
      throw new Error(
        `Format .${ext || "?"} tidak didukung. Gunakan: ${Object.keys(MIME_BY_EXT).join(", ")}.`,
      );
    }
    if (rule && !allowed.has(ext)) {
      throw new Error(
        `Untuk ${rule.label}, gunakan berkas ${rule.accept.replaceAll(",", ", ")}.`,
      );
    }
    if (file.size === 0) throw new Error("Berkas kosong.");
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(
        `Ukuran berkas maksimal ${CEMARA.images.formatBytes(MAX_FILE_BYTES)} (berkas ini ${CEMARA.images.formatBytes(file.size)}). Untuk berkas lebih besar, pakai tautan Google Drive.`,
      );
    }
    return { ext, mime: MIME_BY_EXT[ext] };
  }

  // "a, b\nc" → ["a","b","c"]; tanpa duplikat, panjang & jumlah dibatasi.
  function parseList(text, { maxItems, maxLength, label }) {
    const seen = new Set();
    const items = [];
    String(text || "")
      .split(/[,\n]/)
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .forEach((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push(item);
      });

    if (items.length > maxItems) {
      throw new Error(`${label}: maksimal ${maxItems} item.`);
    }
    const tooLong = items.find((item) => item.length > maxLength);
    if (tooLong) {
      throw new Error(
        `${label}: "${tooLong.slice(0, 20)}…" lebih dari ${maxLength} karakter.`,
      );
    }
    return items;
  }

  function httpsUrlOrNull(value, label) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
      const url = new URL(text);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error();
      return url.toString();
    } catch (_) {
      throw new Error(`${label} harus berupa tautan https:// yang valid.`);
    }
  }

  function paragraphs(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  // Tabel belum dibuat / cache skema PostgREST belum dimuat ulang.
  function explainDbError(error, fallback) {
    const text = `${error?.code || ""} ${error?.message || ""}`;
    if (
      error?.code === "PGRST205" ||
      error?.code === "42P01" ||
      /schema cache|archive_overview|public\.archives|does not exist/i.test(
        text,
      )
    ) {
      return "Tabel arsip belum tersedia di database. Jalankan schema_arsip.sql di Supabase SQL Editor, lalu jalankan: NOTIFY pgrst, 'reload schema';";
    }
    return fallback;
  }

  /* ---------- Akses & data ---------- */

  async function getAccess(db) {
    const access = { user: null, role: "user", isStaff: false };
    if (!db) return access;

    try {
      const { data } = await db.auth.getSession();
      access.user = data?.session?.user || null;
      if (access.user) {
        // Peran resmi dari server (fungsi SECURITY DEFINER), bukan dari browser.
        const { data: role, error } = await db.rpc("cemara_role");
        if (!error && typeof role === "string") access.role = role;
        access.isStaff = ["admin", "super_admin", "dev"].includes(access.role);
      }
    } catch (error) {
      console.warn("Gagal membaca sesi arsip:", error);
    }
    return access;
  }

  async function listArchives(db) {
    const { data, error } = await db
      .from("archive_overview")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  }

  async function listFiles(db, archiveId) {
    const { data, error } = await db
      .from("archive_files")
      .select(
        "id, archive_id, version, label, changelog, file_name, mime_type, size_bytes, storage_path, external_url, created_at",
      )
      .eq("archive_id", archiveId)
      .order("version", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addVersion(db, user, archiveId, input) {
    const version = Number(input.version);
    if (!Number.isInteger(version) || version < 1 || version > 999) {
      throw new Error("Nomor versi harus 1–999.");
    }
    const label = String(input.label || "")
      .trim()
      .slice(0, 60);
    const changelog = String(input.changelog || "").trim();
    if (changelog.length > 500)
      throw new Error("Catatan perubahan maksimal 500 karakter.");

    const row = {
      archive_id: archiveId,
      version,
      label,
      changelog,
      created_by: user.id,
    };
    let uploadedPath = null;

    if (input.file) {
      const { ext, mime } = validateFile(input.file, input.kind);
      uploadedPath = `${archiveId}/v${version}-${Date.now()}-${safeFileName(input.file.name)}`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(uploadedPath, input.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: mime,
        });
      if (uploadError)
        throw new Error(`Unggah berkas gagal: ${uploadError.message}`);

      row.file_name = input.file.name.slice(0, 200);
      row.mime_type = mime;
      row.size_bytes = input.file.size;
      row.storage_path = uploadedPath;
      void ext;
    } else if (input.externalUrl) {
      const url = httpsUrlOrNull(input.externalUrl, "Tautan berkas");
      row.file_name = String(input.externalName || new URL(url).hostname).slice(
        0,
        200,
      );
      row.external_url = url;
    } else {
      throw new Error("Pilih berkas atau isi tautan.");
    }

    const { data, error } = await db
      .from("archive_files")
      .insert(row)
      .select()
      .single();
    if (error) {
      if (uploadedPath) {
        const { error: removeError } = await db.storage
          .from(BUCKET)
          .remove([uploadedPath]);
        if (removeError) {
          throw new Error(
            `Gagal mencatat versi: ${error.message}. Berkas sementara juga gagal dihapus: ${removeError.message}`,
          );
        }
      }
      throw new Error(`Gagal mencatat versi: ${error.message}`);
    }
    return data;
  }

  async function createArchive(db, user, input) {
    const kind = input.kind;
    if (!KINDS[kind]) throw new Error("Pilih jenis arsip.");

    const title = String(input.title || "").trim();
    if (title.length < 3 || title.length > 160)
      throw new Error("Judul harus 3–160 karakter.");

    const summary = String(input.summary || "").trim();
    if (summary.length > 500)
      throw new Error("Ringkasan maksimal 500 karakter.");
    const readme = String(input.readme || "").trim();
    if (readme.length > 20000)
      throw new Error("README maksimal 20.000 karakter.");
    const authors = String(input.authors || "").trim();
    if (authors.length > 300)
      throw new Error("Nama penyusun maksimal 300 karakter.");

    const year = input.year ? Number(input.year) : null;
    if (
      year !== null &&
      (!Number.isInteger(year) || year < 2000 || year > 2100)
    ) {
      throw new Error("Tahun harus antara 2000 dan 2100.");
    }

    const tags = parseList(input.tags, {
      maxItems: 10,
      maxLength: 30,
      label: "Tag",
    });
    const stack = parseList(input.stack, {
      maxItems: 20,
      maxLength: 40,
      label: "Tech stack",
    });
    if (kind === "tech_stack" && stack.length === 0) {
      throw new Error("Isi minimal satu teknologi pada Tech Stack.");
    }

    const repoUrl = httpsUrlOrNull(input.repoUrl, "Tautan repositori");
    const demoUrl = httpsUrlOrNull(input.demoUrl, "Tautan demo");

    const hasFile = Boolean(input.file);
    const hasLink = Boolean(String(input.externalUrl || "").trim());
    if (KINDS[kind].fileRequired && !hasFile && !hasLink) {
      throw new Error("Unggah berkas atau isi tautan untuk jenis arsip ini.");
    }
    if (hasFile) validateFile(input.file, kind);
    if (hasLink) httpsUrlOrNull(input.externalUrl, "Tautan berkas");

    const { data: archive, error } = await db
      .from("archives")
      .insert({
        kind,
        title,
        summary,
        readme,
        authors,
        year,
        tags,
        stack,
        status: STATUS[input.status] ? input.status : "final",
        visibility: "public",
        repo_url: repoUrl,
        demo_url: demoUrl,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) {
      throw new Error(
        explainDbError(error, `Gagal menyimpan arsip: ${error.message}`),
      );
    }

    if (hasFile || hasLink) {
      try {
        await addVersion(db, user, archive.id, {
          kind,
          version: 1,
          label: input.versionLabel || "v1",
          changelog: input.changelog || "Versi awal.",
          file: hasFile ? input.file : null,
          externalUrl: hasFile ? "" : input.externalUrl,
        });
      } catch (versionError) {
        const { error: deleteError } = await db
          .from("archives")
          .delete()
          .eq("id", archive.id);
        if (deleteError) {
          throw new Error(
            `Versi arsip gagal disimpan: ${versionError.message}. Arsip kosong juga gagal dibersihkan: ${deleteError.message}`,
          );
        }
        throw versionError;
      }
    }
    return archive;
  }

  async function reviewArchive(db, archiveId, decision, notes = "") {
    if (!UUID.test(archiveId)) throw new Error("Arsip tidak valid.");
    if (!["verified", "rejected"].includes(decision))
      throw new Error("Keputusan verifikasi tidak valid.");

    const reviewNotes = String(notes || "").trim();
    if (reviewNotes.length > 1000)
      throw new Error("Catatan verifikasi maksimal 1000 karakter.");
    if (decision === "rejected" && !reviewNotes)
      throw new Error("Catatan wajib diisi untuk menolak arsip.");

    const { error } = await db.rpc("review_archive", {
      p_archive_id: archiveId,
      p_decision: decision,
      p_review_notes: reviewNotes,
    });
    if (error) throw new Error(`Gagal memverifikasi arsip: ${error.message}`);
  }

  async function deleteArchive(db, archive) {
    const files = await listFiles(db, archive.id);
    const { error } = await db.from("archives").delete().eq("id", archive.id);
    if (error) throw new Error(`Gagal menghapus arsip: ${error.message}`);

    const paths = files.map((file) => file.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: removeError } = await db.storage
        .from(BUCKET)
        .remove(paths);
      if (removeError)
        console.warn(
          "Sebagian berkas belum terhapus dari storage:",
          removeError,
        );
    }
  }

  // mode "download" → paksa unduh; "view" → buka di tab baru (PDF/gambar).
  async function openFile(db, file, mode) {
    if (file.external_url) {
      window.open(file.external_url, "_blank", "noopener,noreferrer");
      return;
    }

    const popup = mode === "view" ? window.open("", "_blank") : null;
    if (popup) popup.opener = null;

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(
        file.storage_path,
        SIGNED_URL_SECONDS,
        mode === "download" ? { download: file.file_name } : undefined,
      );

    if (error || !data?.signedUrl) {
      popup?.close();
      throw new Error(
        "Tautan unduhan tidak dapat dibuat. Anda mungkin tidak berhak mengakses berkas ini.",
      );
    }

    if (popup) popup.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  /* ---------- Tampilan ---------- */

  function chips(items, className) {
    return items
      .map((item) => `<span class="${className}">${esc(item)}</span>`)
      .join("");
  }

  function kindBadge(kind) {
    const info = KINDS[kind] || { label: kind, icon: "📁" };
    return `<span class="arsip-kind arsip-kind-${esc(kind)}"><span aria-hidden="true">${info.icon}</span> ${esc(info.label)}</span>`;
  }

  function metaLine(archive) {
    return [
      archive.year ? esc(archive.year) : "",
      archive.authors ? esc(archive.authors) : "",
      `diperbarui ${esc(CEMARA.formatDate(archive.updated_at))}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function cardHtml(archive) {
    const stack =
      archive.kind === "tech_stack" ? (archive.stack || []).slice(0, 6) : [];
    const tags = (archive.tags || []).slice(0, 4);
    const versionText = archive.latest_version
      ? `v${archive.latest_version} · ${archive.file_count} berkas`
      : "Belum ada berkas";

    return `
      <article class="arsip-card">
        <div class="arsip-card-top">
          ${kindBadge(archive.kind)}
          <span class="arsip-chip arsip-status-${esc(archive.status)}">${esc(STATUS[archive.status] || archive.status)}</span>
          <span class="arsip-chip arsip-visibility">${esc(VERIFICATION[archive.verification_status] || archive.verification_status)}</span>
        </div>
        <h3><a href="#${esc(archive.id)}">${esc(archive.title)}</a></h3>
        ${archive.summary ? `<p class="arsip-summary">${esc(archive.summary)}</p>` : ""}
        ${stack.length ? `<div class="arsip-chips">${chips(stack, "arsip-chip arsip-chip-stack")}</div>` : ""}
        ${tags.length ? `<div class="arsip-chips">${chips(tags, "arsip-chip arsip-chip-tag")}</div>` : ""}
        <p class="arsip-meta">${metaLine(archive)}</p>
        <div class="arsip-card-foot">
          <span class="arsip-version">${esc(versionText)}</span>
          <a class="btn btn-sm btn-primary" href="#${esc(archive.id)}">Buka</a>
        </div>
      </article>
    `;
  }

  function fileRowHtml(file) {
    const size = file.size_bytes
      ? CEMARA.images.formatBytes(file.size_bytes)
      : "";
    const viewable = /\.(pdf|png|jpe?g|webp)$/i.test(file.file_name || "");
    const actions = file.external_url
      ? `<a class="btn btn-sm btn-secondary" href="${esc(file.external_url)}" target="_blank" rel="noopener noreferrer">Buka tautan ↗</a>`
      : `${viewable ? `<button class="btn btn-sm btn-ghost" type="button" data-file="${esc(file.id)}" data-mode="view">Lihat</button>` : ""}
         <button class="btn btn-sm btn-success" type="button" data-file="${esc(file.id)}" data-mode="download">Unduh</button>`;

    return `
      <li class="arsip-file">
        <span class="arsip-file-name">${esc(file.file_name)}${size ? `<small>${esc(size)}</small>` : ""}</span>
        <span class="arsip-file-actions">${actions}</span>
      </li>
    `;
  }

  function versionsHtml(files) {
    if (!files.length)
      return `<p class="arsip-empty">Belum ada berkas pada arsip ini.</p>`;

    const groups = new Map();
    files.forEach((file) => {
      if (!groups.has(file.version)) groups.set(file.version, []);
      groups.get(file.version).push(file);
    });

    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([version, rows], index) => {
        const first = rows[0];
        return `
          <section class="arsip-release">
            <header>
              <h3>v${esc(version)}${first.label && first.label !== `v${version}` ? ` · ${esc(first.label)}` : ""}
                ${index === 0 ? `<span class="arsip-chip arsip-chip-latest">Terbaru</span>` : ""}</h3>
              <time>${esc(CEMARA.formatDate(first.created_at))}</time>
            </header>
            ${first.changelog ? `<p class="arsip-changelog">${esc(first.changelog)}</p>` : ""}
            <ul class="arsip-files">${rows.map(fileRowHtml).join("")}</ul>
          </section>
        `;
      })
      .join("");
  }

  function staffPanelHtml(archive, files) {
    const next =
      files.reduce((max, file) => Math.max(max, file.version), 0) + 1;
    const rule = KINDS[archive.kind];
    return `
      <section class="arsip-staff" aria-label="Pengelolaan arsip">
        <h3>Kelola arsip</h3>
        <form id="versionForm" class="arsip-form" novalidate>
          <div class="arsip-form-row">
            <label>Versi
              <input id="verNumber" type="number" min="1" max="999" value="${next}" required>
            </label>
            <label>Label (opsional)
              <input id="verLabel" type="text" maxlength="60" placeholder="mis. Revisi pembimbing">
            </label>
          </div>
          <label>Catatan perubahan
            <textarea id="verChangelog" rows="2" maxlength="500" placeholder="Apa yang berubah dari versi sebelumnya?"></textarea>
          </label>
          <fieldset class="arsip-source">
            <legend>Sumber berkas</legend>
            <label><input type="radio" name="verSource" value="upload" checked> Unggah berkas</label>
            <label><input type="radio" name="verSource" value="link"> Tautan (Drive, Canva, dll.)</label>
          </fieldset>
          <label id="verFileField">Berkas <small class="field-hint">${esc(rule.fileHint)} Maks. ${esc(CEMARA.images.formatBytes(MAX_FILE_BYTES))}.</small>
            <input id="verFile" type="file" accept="${esc(rule.accept)}">
          </label>
          <label id="verLinkField" class="hidden">Tautan berkas
            <input id="verUrl" type="url" placeholder="https://drive.google.com/…">
          </label>
          <div class="arsip-form-actions">
            <button class="btn btn-primary" type="submit" id="verSubmit">Tambah versi</button>
            <button class="btn btn-danger" type="button" id="deleteArchive">Hapus arsip</button>
          </div>
          <p class="arsip-status-msg" id="verStatus" role="status"></p>
        </form>
      </section>
    `;
  }

  function detailHtml(archive, files, access) {
    const links = [
      archive.repo_url
        ? `<a class="btn btn-sm btn-ghost" href="${esc(archive.repo_url)}" target="_blank" rel="noopener noreferrer">Repositori ↗</a>`
        : "",
      archive.demo_url
        ? `<a class="btn btn-sm btn-secondary" href="${esc(archive.demo_url)}" target="_blank" rel="noopener noreferrer">Demo ↗</a>`
        : "",
    ].join("");

    return `
      <p><a class="arsip-back" href="#">← Semua arsip</a></p>
      <header class="arsip-detail-head">
        <div class="arsip-card-top">
          ${kindBadge(archive.kind)}
          <span class="arsip-chip arsip-status-${esc(archive.status)}">${esc(STATUS[archive.status] || archive.status)}</span>
          <span class="arsip-chip arsip-visibility">${esc(VERIFICATION[archive.verification_status] || archive.verification_status)}</span>
        </div>
        <h1 id="archiveTitle" tabindex="-1">${esc(archive.title)}</h1>
        <p class="arsip-meta">${metaLine(archive)}</p>
        ${archive.summary ? `<p class="arsip-lead">${esc(archive.summary)}</p>` : ""}
        ${links ? `<div class="arsip-links">${links}</div>` : ""}
      </header>

      ${(archive.stack || []).length ? `<section class="arsip-block"><h2>Tech stack</h2><div class="arsip-chips">${chips(archive.stack, "arsip-chip arsip-chip-stack")}</div></section>` : ""}
      ${archive.readme ? `<section class="arsip-block arsip-readme"><h2>README</h2>${paragraphs(archive.readme)}</section>` : ""}
      <section class="arsip-block"><h2>Versi &amp; berkas</h2>${versionsHtml(files)}</section>
      ${(archive.tags || []).length ? `<section class="arsip-block"><h2>Tag</h2><div class="arsip-chips">${chips(archive.tags, "arsip-chip arsip-chip-tag")}</div></section>` : ""}
      ${access.isStaff ? staffPanelHtml(archive, files) : ""}
    `;
  }

  /* ---------- Halaman publik (arsip.html) ---------- */

  async function initPublicPage() {
    const grid = $("#archiveGrid");
    if (!grid) return;

    const listPanel = $("#archiveList");
    const detailPanel = $("#archiveDetail");
    const stateBox = $("#archiveState");
    const search = $("#archiveSearch");

    const state = {
      all: [],
      kind: "semua",
      query: "",
      access: { isStaff: false },
    };
    const db = getDb();

    const setState = (message, isError = false) => {
      stateBox.textContent = message || "";
      stateBox.classList.toggle("hidden", !message);
      stateBox.classList.toggle("is-error", Boolean(isError));
    };

    if (!db) {
      setState(
        "Supabase belum dikonfigurasi. Isi config.js dengan Project URL dan Publishable Key.",
        true,
      );
      return;
    }

    function updateCounts() {
      $$("[data-kind]").forEach((button) => {
        const kind = button.dataset.kind;
        const count =
          kind === "semua"
            ? state.all.length
            : state.all.filter((item) => item.kind === kind).length;
        const badge = $(".count", button);
        if (badge) badge.textContent = String(count);
      });
    }

    function renderList() {
      const query = state.query.trim().toLowerCase();
      const rows = state.all.filter((item) => {
        if (state.kind !== "semua" && item.kind !== state.kind) return false;
        if (!query) return true;
        return [
          item.title,
          item.summary,
          item.authors,
          (item.tags || []).join(" "),
          (item.stack || []).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

      grid.innerHTML = rows.map(cardHtml).join("");
      setState(
        rows.length
          ? ""
          : state.all.length
            ? "Tidak ada arsip yang cocok. Coba kata kunci atau jenis lain."
            : "Belum ada arsip.",
      );
    }

    async function showDetail(id) {
      const archive = state.all.find((item) => item.id === id);
      if (!archive) {
        window.location.hash = "";
        return;
      }

      listPanel.classList.add("hidden");
      detailPanel.classList.remove("hidden");
      detailPanel.innerHTML = `<p class="arsip-empty">Memuat arsip…</p>`;

      try {
        const files = await listFiles(db, id);
        if (window.location.hash.slice(1) !== id) return; // pengguna sudah pindah
        detailPanel.innerHTML = detailHtml(archive, files, state.access);
        document.title = `${archive.title} | Arsip CEMARA`;
        $("#archiveTitle")?.focus();
        bindDetail(archive, files);
      } catch (error) {
        console.error("Gagal memuat berkas arsip:", error);
        detailPanel.innerHTML = `<p class="arsip-empty is-error">Arsip belum dapat dimuat. Coba segarkan halaman.</p>`;
      }
    }

    function showList() {
      detailPanel.classList.add("hidden");
      detailPanel.innerHTML = "";
      listPanel.classList.remove("hidden");
      document.title = "Arsip | CEMARA";
    }

    function route() {
      const id = window.location.hash.slice(1);
      if (UUID.test(id)) void showDetail(id);
      else showList();
    }

    function bindDetail(archive, files) {
      detailPanel.onclick = async (event) => {
        const button = event.target.closest("[data-file]");
        if (!button) return;
        const file = files.find((item) => item.id === button.dataset.file);
        if (!file) return;
        button.disabled = true;
        try {
          await openFile(db, file, button.dataset.mode);
        } catch (error) {
          toast(error.message);
        } finally {
          button.disabled = false;
        }
      };

      const form = $("#versionForm");
      if (!form) return;

      const sourceRadios = $$('input[name="verSource"]', form);
      const syncSource = () => {
        const link =
          sourceRadios.find((radio) => radio.checked)?.value === "link";
        $("#verFileField").classList.toggle("hidden", link);
        $("#verLinkField").classList.toggle("hidden", !link);
      };
      sourceRadios.forEach((radio) =>
        radio.addEventListener("change", syncSource),
      );
      syncSource();

      const status = $("#verStatus");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = $("#verSubmit");
        const link =
          sourceRadios.find((radio) => radio.checked)?.value === "link";

        submit.disabled = true;
        status.textContent = "Menyimpan versi…";
        try {
          await addVersion(db, state.access.user, archive.id, {
            kind: archive.kind,
            version: $("#verNumber").value,
            label: $("#verLabel").value,
            changelog: $("#verChangelog").value,
            file: link ? null : $("#verFile").files[0] || null,
            externalUrl: link ? $("#verUrl").value : "",
          });
          toast("Versi baru ditambahkan.");
          await refresh();
          await showDetail(archive.id);
        } catch (error) {
          status.textContent = error.message;
          toast(error.message);
        } finally {
          submit.disabled = false;
        }
      });

      $("#deleteArchive")?.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Hapus arsip "${archive.title}" beserta semua versinya? Tindakan ini tidak bisa dibatalkan.`,
          )
        )
          return;
        try {
          await deleteArchive(db, archive);
          toast("Arsip dihapus.");
          window.location.hash = "";
          await refresh();
        } catch (error) {
          toast(error.message);
        }
      });
    }

    async function refresh() {
      try {
        state.all = await listArchives(db);
        updateCounts();
        renderList();
      } catch (error) {
        console.error("Gagal memuat arsip:", error);
        setState(
          explainDbError(
            error,
            "Arsip belum dapat dimuat. Coba segarkan halaman.",
          ),
          true,
        );
      }
    }

    $$("[data-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        state.kind = button.dataset.kind;
        $$("[data-kind]").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        renderList();
      });
    });

    let searchTimer;
    search?.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.query = search.value;
        renderList();
      }, 150);
    });

    window.addEventListener("hashchange", route);

    setState("Memuat arsip…");
    state.access = await getAccess(db);
    $("#archiveStaffNote")?.classList.toggle("hidden", !state.access.isStaff);
    await refresh();
    route();
  }

  /* ---------- Formulir input di Portal (admin/index.html) ---------- */

  async function initPortalForm() {
    const form = $("#arsipForm");
    if (!form) return;

    const db = getDb();
    const status = $("#arsStatusMsg");
    const submit = $("#arsSubmit");
    const kindSelect = $("#arsKind");
    const fileInput = $("#arsFile");
    const sourceRadios = $$('input[name="arsSource"]', form);
    const state = { access: { user: null, isStaff: false }, archives: [] };

    const say = (message, isError = false) => {
      status.textContent = message || "";
      status.classList.toggle("text-red-600", Boolean(isError));
    };

    const source = () =>
      sourceRadios.find((radio) => radio.checked)?.value || "upload";

    function syncKind() {
      const rule = KINDS[kindSelect.value];
      if (!rule) return;
      const isStack = kindSelect.value === "tech_stack";

      $("#arsStackField").classList.toggle("hidden", !isStack);
      $("#arsRepoField").classList.toggle("hidden", !isStack);
      $("#arsDemoField").classList.toggle("hidden", !isStack);
      $("#arsFileHint").textContent = rule.fileHint;
      fileInput.accept = rule.accept;
      $("#arsNoneOption").classList.toggle("hidden", !isStack);
      if (!isStack && source() === "none")
        sourceRadios.find((r) => r.value === "upload").checked = true;
      syncSource();
    }

    function syncSource() {
      const mode = source();
      $("#arsFileField").classList.toggle("hidden", mode !== "upload");
      $("#arsLinkField").classList.toggle("hidden", mode !== "link");
      $("#arsVersionFields").classList.toggle("hidden", mode === "none");
    }

    async function loadRecent() {
      const box = $("#arsList");
      if (!box) return;
      try {
        state.archives = await listArchives(db);
        if (!state.archives.length) {
          box.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-xs text-stone-500">Belum ada arsip.</td></tr>`;
          return;
        }
        box.innerHTML = state.archives
          .map(
            (archive) => `
            <tr class="border-t border-black/5 dark:border-white/5">
              <td class="py-2 pr-3 font-semibold text-sm">${esc(archive.title)}</td>
              <td class="py-2 pr-3 text-xs">${esc(KINDS[archive.kind]?.label || archive.kind)}</td>
              <td class="py-2 pr-3 text-xs">v${esc(archive.latest_version || 0)} · ${esc(archive.file_count)} berkas</td>
              <td class="py-2 pr-3 text-xs">${esc(VERIFICATION[archive.verification_status] || archive.verification_status)}</td>
              <td class="py-2 text-right whitespace-nowrap">
                <a class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-cemara-soft text-cemara-dark hover:bg-cemara hover:text-white transition" href="../arsip.html#${esc(archive.id)}" target="_blank" rel="noopener">Buka</a>
                ${archive.verification_status === "pending" ? `<button type="button" data-review-archive="${esc(archive.id)}" data-decision="verified" class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-green-700 text-white">Verifikasi</button><button type="button" data-review-archive="${esc(archive.id)}" data-decision="rejected" class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-700 text-white">Tolak</button>` : ""}
                <button type="button" data-del-archive="${esc(archive.id)}" class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 transition">Hapus</button>
              </td>
            </tr>`,
          )
          .join("");
      } catch (error) {
        console.error("Gagal memuat arsip:", error);
        box.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-xs text-red-600">${esc(explainDbError(error, "Daftar arsip belum dapat dimuat."))}</td></tr>`;
      }
    }

    $("#arsList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-del-archive]");
      const reviewButton = event.target.closest("[data-review-archive]");
      if (reviewButton) {
        const decision = reviewButton.dataset.decision;
        const notes =
          decision === "rejected"
            ? window.prompt("Tuliskan alasan penolakan arsip (wajib):") || ""
            : "";
        if (decision === "rejected" && !notes.trim()) return;

        reviewButton.disabled = true;
        try {
          await reviewArchive(
            db,
            reviewButton.dataset.reviewArchive,
            decision,
            notes,
          );
          toast(
            decision === "verified"
              ? "Arsip diverifikasi dan kini dapat diakses publik."
              : "Arsip ditolak.",
          );
          await loadRecent();
        } catch (error) {
          toast(error.message);
          reviewButton.disabled = false;
        }
        return;
      }
      if (!button) return;
      const archive = state.archives.find(
        (item) => item.id === button.dataset.delArchive,
      );
      if (!archive) return;
      if (
        !window.confirm(
          `Hapus arsip "${archive.title}" beserta semua versinya? Tindakan ini tidak bisa dibatalkan.`,
        )
      )
        return;

      button.disabled = true;
      try {
        await deleteArchive(db, archive);
        toast("Arsip dihapus.");
        await loadRecent();
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    });

    kindSelect.addEventListener("change", syncKind);
    sourceRadios.forEach((radio) =>
      radio.addEventListener("change", syncSource),
    );
    syncKind();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!state.access.isStaff || !state.access.user) {
        say("Hanya pengelola berwenang yang dapat menambah arsip.", true);
        return;
      }

      const mode = source();
      submit.disabled = true;
      say(
        mode === "upload"
          ? "Mengunggah berkas dan menyimpan arsip…"
          : "Menyimpan arsip…",
      );

      try {
        const archive = await createArchive(db, state.access.user, {
          kind: kindSelect.value,
          title: $("#arsTitle").value,
          summary: $("#arsSummary").value,
          authors: $("#arsAuthors").value,
          year: $("#arsYear").value,
          status: $("#arsStatus").value,
          tags: $("#arsTags").value,
          stack: $("#arsStack").value,
          repoUrl: $("#arsRepoUrl").value,
          demoUrl: $("#arsDemoUrl").value,
          readme: $("#arsReadme").value,
          versionLabel: $("#arsVersionLabel").value,
          changelog: $("#arsChangelog").value,
          file: mode === "upload" ? fileInput.files[0] || null : null,
          externalUrl: mode === "link" ? $("#arsExternalUrl").value : "",
        });

        form.reset();
        syncKind();
        say(`Arsip "${archive.title}" menunggu verifikasi sebelum dibuka untuk publik.`);
        toast("Arsip dikirim untuk verifikasi.");
        await loadRecent();
      } catch (error) {
        console.error("Arsip gagal disimpan:", error);
        say(error.message, true);
        toast(error.message);
      } finally {
        submit.disabled = false;
      }
    });

    if (!db) {
      say("Supabase belum dikonfigurasi.", true);
      return;
    }
    state.access = await getAccess(db);
    if (!state.access.isStaff) return;
    await loadRecent();
  }

  /* ---------- Ekspor & mulai ---------- */

  CEMARA.archive = Object.freeze({
    KINDS,
    STATUS,
    VERIFICATION,
    validateFile,
    parseList,
    safeFileName,
    createArchive,
    addVersion,
    reviewArchive,
    deleteArchive,
    listArchives,
    listFiles,
    openFile,
  });

  const start = () => {
    void initPublicPage();
    void initPortalForm();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
