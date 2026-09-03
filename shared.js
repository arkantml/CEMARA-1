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
  const element = document.querySelector("#toast");

  if (!element) return;

  element.textContent = message;

  element.classList.add("show");

  clearTimeout(window.cemaraToastTimer);

  window.cemaraToastTimer = setTimeout(() => {
    element.classList.remove("show");
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
========================================================= */

window.CEMARA.checkCommentContent = function checkCommentContent(text) {
  const trimmed = String(text || "").trim();

  // List of Indonesian & English inappropriate words
  const badWords = [
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
    "kambing",
    "tahi",
    "tai",
    "omdo",
    "nyebur",
    "ngegas",
    "ngancam",
    "cebong",
    "begundal",
    "dalang",
    "puppet",
    "cacat",
    "gila",
    "sakit",
    "penyakit",
  ];

  const textLower = trimmed.toLowerCase();

  // Check 1: Too short
  if (trimmed.length < 2) {
    return { flagged: true, reason: "Komentar terlalu pendek" };
  }

  // Check 2: Excessive capitalization (>70% uppercase)
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  if (text.length > 0 && upperCount / text.length > 0.7) {
    return {
      flagged: true,
      reason: "Komentar menggunakan huruf besar berlebihan",
    };
  }

  // Check 3: Excessive symbols (4+ repetitions: !!!!, ????, etc)
  if (/(.)\1{4,}/.test(text)) {
    return {
      flagged: true,
      reason: "Komentar menggunakan karakter berulang berlebihan",
    };
  }

  // Check 4: Banned words
  for (const word of badWords) {
    if (textLower.includes(word)) {
      return {
        flagged: true,
        reason: "Komentar mengandung bahasa yang tidak pantas",
      };
    }
  }

  // Passed all checks
  return { flagged: false, reason: "" };
};

/* =========================================================
   MODAL HELPER
========================================================= */

window.CEMARA.modal = function modal(id, open) {
  if (open === undefined) {
    open = true;
  }

  const element = document.getElementById(id);

  if (!element) return;

  element.classList.toggle("open", open);

  element.setAttribute("aria-hidden", open ? "false" : "true");

  document.body.style.overflow = [
    ...document.querySelectorAll(".modal-overlay.open"),
  ].length
    ? "hidden"
    : "";
};
