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
