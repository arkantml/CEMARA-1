/* =========================================================
   CEMARA — SHARED.JS
   Shared utilities used by app.js, reader.js, admin.js
========================================================= */

window.CEMARA = window.CEMARA || {};

/* =========================================================
   ESCAPE HTML
========================================================= */

window.CEMARA.esc = function esc(value) {
  return String(value ?? "").replace(
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
};

window.CEMARA.isGoogleDriveUrl = function isGoogleDriveUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      ["drive.google.com", "docs.google.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
};

/* =========================================================
   FORMAT DATE
========================================================= */

window.CEMARA.formatDate = function formatDate(value) {
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
};

/* =========================================================
   TOAST
========================================================= */

window.CEMARA.toast = function toast(message) {
  if (window.CEMARA.ui) {
    window.CEMARA.ui.announce(message);
    return;
  }

  const element = document.querySelector("#toast");

  if (!element) return;

  element.textContent = message;

  element.classList.add("is-visible");

  clearTimeout(window.cemaraToastTimer);

  window.cemaraToastTimer = setTimeout(() => {
    element.classList.remove("is-visible");
  }, 2200);
};

/* =========================================================
   IMAGE PARSER
========================================================= */

window.CEMARA.normalizeImages = function normalizeImages(value) {
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
      /* not JSON */
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
};

/* =========================================================
   KEBIJAKAN GAMBAR — ukuran & resolusi (input → output)
   Setiap gambar diproses di browser SEBELUM diunggah:
     1. divalidasi (tipe JPG/PNG/WebP, ukuran berkas, resolusi minimum),
     2. dipangkas dari tengah ke rasio tetap,
     3. diperkecil ke resolusi tetap (tidak pernah diperbesar),
     4. dikompres ke WebP (cadangan JPEG), metadata EXIF/GPS terbuang.
   Output yang tampil di halaman memakai rasio yang sama (lihat CSS),
   jadi tidak ada gambar raksasa yang terunduh dan tata letak tidak bergeser.
========================================================= */
(function () {
  const KB = 1024;
  const MB = 1024 * KB;

  const SPECS = {
    // Sampul karya: potret 3:4 → 900 × 1200 px
    cover: {
      label: "Sampul karya",
      ratioLabel: "3:4",
      ratio: 3 / 4,
      width: 900,
      height: 1200,
      minWidth: 450,
      minHeight: 600,
      maxInputBytes: 10 * MB,
      targetBytes: 350 * KB,
      maxOutputBytes: 1 * MB,
      quality: 0.82,
    },
    // Gambar karya (seni/komik/foto) pada pengajuan: TIDAK dipangkas,
    // hanya diperkecil agar sisi terpanjang ≤ 2400 px (cukup untuk dibaca layar)
    artwork: {
      label: "Gambar karya",
      ratio: null,
      width: 2400,
      height: 2400,
      minWidth: 300,
      minHeight: 300,
      maxInputBytes: 10 * MB,
      targetBytes: Math.round(1.5 * MB),
      maxOutputBytes: 4 * MB,
      quality: 0.86,
    },
    // Foto profil: persegi 1:1 → 512 × 512 px
    avatar: {
      label: "Foto profil",
      ratioLabel: "1:1",
      ratio: 1,
      width: 512,
      height: 512,
      minWidth: 128,
      minHeight: 128,
      maxInputBytes: 5 * MB,
      targetBytes: 120 * KB,
      maxOutputBytes: 300 * KB,
      quality: 0.85,
    },
  };

  const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    if (bytes < KB) return `${bytes} B`;
    if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
    return `${(bytes / MB).toFixed(1).replace(/\.0$/, "").replace(".", ",")} MB`;
  }

  // Hitung area pangkas (dari tengah) dan ukuran keluaran. Fungsi murni.
  function plan(sourceWidth, sourceHeight, spec) {
    // Tanpa rasio tetap: tidak dipangkas, hanya diperkecil agar muat di kotak.
    if (!spec.ratio) {
      const scale = Math.min(
        1,
        spec.width / sourceWidth,
        spec.height / sourceHeight,
      );
      return {
        cropX: 0,
        cropY: 0,
        cropWidth: sourceWidth,
        cropHeight: sourceHeight,
        outWidth: Math.round(sourceWidth * scale),
        outHeight: Math.round(sourceHeight * scale),
      };
    }

    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;

    if (sourceWidth / sourceHeight > spec.ratio) {
      cropWidth = Math.round(sourceHeight * spec.ratio);
    } else {
      cropHeight = Math.round(sourceWidth / spec.ratio);
    }

    const outWidth = Math.min(spec.width, cropWidth);
    return {
      cropX: Math.floor((sourceWidth - cropWidth) / 2),
      cropY: Math.floor((sourceHeight - cropHeight) / 2),
      cropWidth,
      cropHeight,
      outWidth,
      outHeight: Math.round(outWidth / spec.ratio),
    };
  }

  async function loadSource(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        return {
          image: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          release: () => bitmap.close?.(),
        };
      } catch (_) {
        /* browser lama: pakai <img> di bawah */
      }
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";

    try {
      image.src = url;
      await image.decode();
    } catch (_) {
      URL.revokeObjectURL(url);
      throw new Error("Gambar tidak dapat dibaca. Berkas mungkin rusak.");
    }

    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  }

  const toBlob = (canvas, type, quality) =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  // WebP dulu; jika browser tidak mendukung (mis. Safari lama), pakai JPEG.
  async function encode(canvas, quality) {
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", quality);
    }
    return blob;
  }

  async function prepare(file, specName) {
    const spec = SPECS[specName];
    if (!spec) throw new Error("Jenis gambar tidak dikenal.");
    if (!(file instanceof Blob)) throw new Error("Berkas gambar tidak valid.");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error(
        `${spec.label}: gunakan JPG, PNG, atau WebP (GIF tidak didukung).`,
      );
    }

    if (file.size > spec.maxInputBytes) {
      throw new Error(
        `${spec.label}: ukuran berkas maksimal ${formatBytes(spec.maxInputBytes)} (berkas ini ${formatBytes(file.size)}).`,
      );
    }

    const source = await loadSource(file);

    try {
      if (source.width < spec.minWidth || source.height < spec.minHeight) {
        throw new Error(
          `${spec.label}: resolusi terlalu kecil (${source.width}×${source.height} px). Minimal ${spec.minWidth}×${spec.minHeight} px.`,
        );
      }

      const area = plan(source.width, source.height, spec);
      let outWidth = area.outWidth;
      let outHeight = area.outHeight;
      let quality = spec.quality;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Browser ini tidak mendukung pemrosesan gambar.");
      }

      let blob = null;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        canvas.width = outWidth;
        canvas.height = outHeight;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outWidth, outHeight);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(
          source.image,
          area.cropX,
          area.cropY,
          area.cropWidth,
          area.cropHeight,
          0,
          0,
          outWidth,
          outHeight,
        );

        blob = await encode(canvas, quality);
        if (!blob) throw new Error("Gambar gagal dikompres. Coba berkas lain.");
        if (blob.size <= spec.targetBytes) break;

        if (quality > 0.62) {
          quality = Math.max(0.6, quality - 0.08);
        } else {
          const nextWidth = Math.round(outWidth * 0.9);
          const nextHeight = Math.round((nextWidth * outHeight) / outWidth);
          if (nextWidth < spec.minWidth || nextHeight < spec.minHeight) break;
          outWidth = nextWidth;
          outHeight = nextHeight;
        }
      }

      if (blob.size > spec.maxOutputBytes) {
        throw new Error(
          `${spec.label}: hasil kompresi masih ${formatBytes(blob.size)} (maks. ${formatBytes(spec.maxOutputBytes)}). Coba gambar yang lebih sederhana.`,
        );
      }

      return {
        spec: specName,
        blob,
        type: blob.type,
        ext: blob.type === "image/webp" ? "webp" : "jpg",
        width: outWidth,
        height: outHeight,
        bytes: blob.size,
        sourceWidth: source.width,
        sourceHeight: source.height,
        sourceBytes: file.size,
      };
    } finally {
      source.release();
    }
  }

  function describe(result) {
    return `${result.width}×${result.height} px · ${result.ext.toUpperCase()} · ${formatBytes(result.bytes)} (asli ${result.sourceWidth}×${result.sourceHeight} px, ${formatBytes(result.sourceBytes)})`;
  }

  function hint(specName) {
    const spec = SPECS[specName];
    if (!spec.ratio) {
      return `JPG/PNG/WebP · maks. ${formatBytes(spec.maxInputBytes)} · otomatis diperkecil hingga ${spec.width} px pada sisi terpanjang`;
    }
    return `JPG/PNG/WebP · maks. ${formatBytes(spec.maxInputBytes)} · otomatis dipangkas ${spec.ratioLabel} menjadi ${spec.width}×${spec.height} px`;
  }

  window.CEMARA.IMAGE_SPECS = SPECS;
  window.CEMARA.images = Object.freeze({
    ACCEPT: ACCEPTED_TYPES.join(","),
    specs: SPECS,
    formatBytes,
    plan,
    prepare,
    describe,
    hint,
  });
})();

/* =========================================================
   SUPABASE READY CHECK
========================================================= */

window.CEMARA.isSupabaseReady = function isSupabaseReady() {
  const C = window.CEMARA_CONFIG || {};

  return Boolean(
    C.SUPABASE_URL &&
    !C.SUPABASE_URL.includes("YOUR-PROJECT") &&
    C.SUPABASE_PUBLISHABLE_KEY &&
    !C.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_"),
  );
};

/* =========================================================
   CREATE SUPABASE CLIENT
========================================================= */

window.CEMARA.createDB = function createDB() {
  const C = window.CEMARA_CONFIG || {};
  const { createClient } = window.supabase || {};

  if (!window.CEMARA.isSupabaseReady() || !createClient) {
    return null;
  }

  return createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY);
};

/* =========================================================
   ROLE DEFINITIONS
========================================================= */

window.CEMARA.ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  DEV: "dev",
  USER: "user",
};

window.CEMARA.ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  dev: "Developer",
  user: "Pengunjung",
};

window.CEMARA.ROLE_COLORS = {
  super_admin: "#e74c3c",
  admin: "#f39c12",
  dev: "#3498db",
  user: "#2ecc71",
};

/* =========================================================
   ROLE CHECK
   Returns { role, isAdmin, isSuperAdmin, isDev, profile }
========================================================= */

window.CEMARA.roleCheck = async function roleCheck(db, user) {
  const result = {
    role: "user",
    isAdmin: false,
    isSuperAdmin: false,
    isDev: false,
    profile: null,
  };

  if (!db || !user) {
    return result;
  }

  try {
    // 1. Fetch user_profiles
    let profile = null;
    const { data, error } = await db
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      profile = data;
    }

    // 2. Check legacy admin_profiles
    let isLegacyAdmin = false;
    try {
      const { data: oldAdmin } = await db
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      isLegacyAdmin = Boolean(oldAdmin);
    } catch (_) {}

    // Determine final role
    let finalRole = profile?.role || (isLegacyAdmin ? "admin" : "user");

    // If profile says 'user' but user is in admin_profiles, synchronize and upgrade to admin
    if (finalRole === "user" && isLegacyAdmin) {
      finalRole = "admin";
      if (profile) {
        profile.role = "admin";
        try {
          await db
            .from("user_profiles")
            .update({ role: "admin" })
            .eq("user_id", user.id);
        } catch (_) {}
      }
    }

    result.role = finalRole;
    result.profile = profile;
    result.isAdmin = finalRole === "admin" || finalRole === "super_admin";
    result.isSuperAdmin = finalRole === "super_admin";
    result.isDev = finalRole === "dev";
  } catch (error) {
    console.error("Role check exception:", error);
  }

  return result;
};

/* =========================================================
   ENSURE PROFILE EXISTS
   Auto-creates user_profiles row on login
========================================================= */

window.CEMARA.ensureProfile = async function ensureProfile(db, user) {
  if (!db || !user) return null;

  try {
    // 1. Check existing
    const { data: existing } = await db
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // 2. Check legacy admin_profiles
    let isLegacyAdmin = false;
    try {
      const { data: adminData } = await db
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      isLegacyAdmin = Boolean(adminData);
    } catch (_) {}

    if (existing) {
      if (existing.role === "user" && isLegacyAdmin) {
        existing.role = "admin";
        try {
          await db
            .from("user_profiles")
            .update({ role: "admin" })
            .eq("user_id", user.id);
        } catch (_) {}
      }
      return existing;
    }

    const name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Pengunjung";

    const defaultRole = isLegacyAdmin ? "admin" : "user";

    const { data: created, error } = await db
      .from("user_profiles")
      .insert({
        user_id: user.id,
        display_name: name,
        role: defaultRole,
      })
      .select()
      .single();

    if (error) {
      console.error("Profile create error:", error);
      return null;
    }

    return created;
  } catch (error) {
    console.error("ensureProfile error:", error);

    return null;
  }
};

/* =========================================================
   CONTENT FILTER - CHECK FOR INAPPROPRIATE CONTENT
   Harus selaras dengan public.check_comment_content() di
   schema_v3_comment_filter.sql. Cek ini hanya untuk umpan balik
   cepat; keputusan akhir ada di trigger database.
========================================================= */

window.CEMARA.BAD_WORDS = [
  "kontol",
  "bitch",
  "fuck",
  "damn",
  "hell",
  "ass",
  "bodoh",
  "goblok",
  "bangsat",
  "brengsek",
  "setan",
  "anjing",
  "monyet",
  "babi",
  "tahi",
  "tai",
  "bajingan",
  "keparat",
  "sialan",
  "jancok",
  "dancok",
  "asu",
  "pantek",
  "memek",
  "pepek",
  "peler",
  "ngentot",
  "jembut",
  "lonte",
  "pelacur",
  "tolol",
  "bego",
  "dungu",
  "kampret",
  "celeng",
  "shit",
  "dick",
  "cunt",
  "bastard",
  "asshole",
  "motherfucker",
];

// Kata < 5 huruf dicocokkan utuh; kata >= 5 huruf dicocokkan sebagai awalan kata.
// Mencegah "assalamualaikum", "hello", "pantai", "asumsi" ikut terblokir.
window.CEMARA.BAD_WORD_PATTERN = new RegExp(
  window.CEMARA.BAD_WORDS.map(
    (word) => "\\b" + word + (word.length >= 5 ? "" : "\\b"),
  ).join("|"),
  "i",
);

window.CEMARA.checkCommentContent = function checkCommentContent(text) {
  const trimmed = String(text || "").trim();

  // Check 1: Too short
  if (trimmed.length < 2) {
    return { flagged: true, reason: "Komentar terlalu pendek" };
  }

  // Check 2: Excessive capitalization (>70% of letters, min. 8 letters)
  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
  if (letters >= 8 && upperCount / letters > 0.7) {
    return {
      flagged: true,
      reason: "Komentar menggunakan huruf besar berlebihan",
    };
  }

  // Check 3: Excessive repeated characters (5+ in a row)
  if (/(.)\1{4,}/.test(trimmed)) {
    return {
      flagged: true,
      reason: "Komentar menggunakan karakter berulang berlebihan",
    };
  }

  // Check 4: Banned words
  if (window.CEMARA.BAD_WORD_PATTERN.test(trimmed)) {
    return {
      flagged: true,
      reason: "Komentar mengandung bahasa yang tidak pantas",
    };
  }

  return { flagged: false, reason: "" };
};

/* =========================================================
   MODAL HELPER
========================================================= */

window.CEMARA.modal = function modal(id, open) {
  if (open === undefined) {
    open = true;
  }

  if (window.CEMARA.ui) {
    if (open) window.CEMARA.ui.openModal(id);
    else window.CEMARA.ui.closeModal(id);
    return;
  }

  const element = document.getElementById(id);

  if (!element) return;

  element.classList.toggle("open", open);
  element.classList.toggle("is-open", open);

  element.setAttribute("aria-hidden", open ? "false" : "true");

  document.body.style.overflow = [
    ...document.querySelectorAll(".modal-overlay.open"),
  ].length
    ? "hidden"
    : "";
};
