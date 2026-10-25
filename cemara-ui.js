(() => {
  const CEMARA = (window.CEMARA = window.CEMARA || {});
  if (CEMARA.ui) return;

  const themeKey = "cemara_theme";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modalFocus = new WeakMap();
  let toastTimer;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function announce(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("is-visible"),
      2200,
    );
  }

  function setTheme(theme, persist = true) {
    const normalized = theme === "dark" ? "dark" : "light";
    const toggle = $("#themeToggle");
    const icon = $("#themeIcon", toggle || document);

    document.documentElement.dataset.theme = normalized;
    if (icon) icon.textContent = normalized === "dark" ? "◑" : "◐";
    toggle?.setAttribute(
      "aria-label",
      normalized === "dark" ? "Gunakan mode terang" : "Gunakan mode gelap",
    );

    if (!persist) return;
    try {
      window.localStorage.setItem(themeKey, normalized);
    } catch (error) {
      console.error("Preferensi tema CEMARA tidak dapat disimpan.", error);
      announce("Tema berubah, tetapi preferensi tidak dapat disimpan.");
    }
  }

  function setMenuOpen(open) {
    const nav = $("#mainNav");
    const toggle = $("#menuToggle");
    if (!nav || !toggle) return;

    const expanded = Boolean(open);
    nav.classList.toggle("is-open", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", expanded ? "Tutup menu" : "Buka menu");
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal || !modal.classList.contains("modal-overlay")) return;

    if (modal.getAttribute("aria-hidden") === "false") return;
    modalFocus.set(
      modal,
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    document.dispatchEvent(
      new CustomEvent("cemara:beforeopen", { detail: { id, modal } }),
    );
    modal.classList.add("open", "is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("button, input, select, textarea, a[href]", modal)?.focus();
  }

  function closeModal(modalOrId) {
    const modal =
      typeof modalOrId === "string"
        ? document.getElementById(modalOrId)
        : modalOrId;
    if (!(modal instanceof HTMLElement)) return;

    modal.classList.remove("open", "is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = $(
      '.modal-overlay[aria-hidden="false"]',
    )
      ? "hidden"
      : "";

    const returnFocus = modalFocus.get(modal);
    modalFocus.delete(modal);
    if (returnFocus?.isConnected) returnFocus.focus();
  }

  function toggleAccordion(button) {
    const item = button.closest(".accordion-item");
    if (!item) return;

    const expanded = button.getAttribute("aria-expanded") !== "true";
    $$(".accordion-item").forEach((otherItem) => {
      const otherButton = $(".accordion-header", otherItem);
      const active = otherItem === item && expanded;
      otherItem.classList.toggle("active", active);
      otherButton?.setAttribute("aria-expanded", String(active));
    });
  }

  function handleClick(event) {
    if (!(event.target instanceof Element)) return;
    const target = event.target;

    const themeToggle = target.closest("#themeToggle");
    if (themeToggle) {
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      );
      return;
    }

    const menuToggle = target.closest("#menuToggle");
    if (menuToggle) {
      if (window.matchMedia("(max-width: 900px)").matches) {
        setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
      }
      return;
    }

    const navLink = target.closest("#mainNav a");
    if (navLink) {
      setMenuOpen(false);
      return;
    }

    const accordionButton = target.closest(".accordion-header");
    if (accordionButton) {
      toggleAccordion(accordionButton);
      return;
    }

    const adminButton = target.closest("#adminButton");
    if (adminButton) {
      openModal("adminModal");
      return;
    }

    const closeButton = target.closest("[data-close]");
    if (closeButton) {
      closeModal(closeButton.dataset.close);
      return;
    }

    const overlay = target.closest(".modal-overlay");
    if (overlay && target === overlay) {
      closeModal(overlay);
      return;
    }

    if (target.closest("#copyEmail")) {
      void copyEmail();
      return;
    }

    if (target.closest("#backTop")) {
      window.scrollTo({
        top: 0,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }
  }

  async function copyEmail() {
    const email = $(".contact-box strong")?.textContent.trim();
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      announce("Alamat email berhasil disalin.");
    } catch (error) {
      console.error("Alamat email tidak dapat disalin.", error);
      announce("Email belum tersalin. Salin alamat yang tertera secara manual.");
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      const openModals = $$('.modal-overlay[aria-hidden="false"]');
      openModals.forEach(closeModal);
      setMenuOpen(false);
      return;
    }

    if (event.key !== "Tab") return;
    const modal = $('.modal-overlay[aria-hidden="false"]');
    if (!modal) return;

    const focusable = $$(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      modal,
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateBackTop() {
    $("#backTop")?.classList.toggle("is-visible", window.scrollY > 500);
  }

  function initializeReveals() {
    const revealSelector = [
      ".hero-copy > h1",
      ".hero-copy > p",
      ".hero-actions",
      ".hero-meta",
      ".hero-art",
      ".section-heading > div",
      ".section-heading > p",
      ".featured-grid > *",
      ".event-banner",
      ".explore-catalog-banner",
      ".creators-grid > *",
      ".about-card > h2",
      ".about-card > .lead",
      ".meaning-grid article",
      ".archive-heading > *",
      ".archive-grid figure",
      ".accordion-list > *",
      ".steps > *",
      ".contact-section > *",
      ".summary-section > *",
      ".collection-intro > *",
      ".collection-art",
      ".toolbar > *",
      ".works-grid > *",
      ".empty-state",
    ].join(",");
    const observed = new WeakSet();
    let revealObserver;

    if ("IntersectionObserver" in window && !reducedMotion.matches) {
      revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -5% 0px", threshold: 0.06 },
      );
    }

    function reveal(root = document) {
      const elements = [];
      if (root instanceof Element && root.matches(revealSelector)) {
        elements.push(root);
      }
      elements.push(...root.querySelectorAll(revealSelector));

      elements.forEach((element, index) => {
        if (observed.has(element)) return;
        observed.add(element);
        element.dataset.cemaraReveal = "";
        element.style.setProperty(
          "--cemara-reveal-delay",
          `${Math.min(index % 4, 3) * 70}ms`,
        );
        if (revealObserver) revealObserver.observe(element);
        else element.classList.add("is-revealed");
      });
    }

    reveal();
    document.documentElement.classList.add("cemara-motion-ready");

    const contentObserver = new MutationObserver((records) => {
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) reveal(node);
        }),
      );
    });
    ["#featuredGrid", "#creatorsGrid", "#worksGrid"].forEach((selector) => {
      const root = $(selector);
      if (root) {
        contentObserver.observe(root, { childList: true, subtree: true });
      }
    });
  }

  CEMARA.ui = Object.freeze({
    announce,
    closeModal,
    openModal,
    setTheme,
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    const nav = $("#mainNav");
    const menuToggle = $("#menuToggle");
    if (
      window.matchMedia("(max-width: 900px)").matches &&
      nav?.classList.contains("is-open") &&
      !nav.contains(event.target) &&
      !menuToggle?.contains(event.target)
    ) {
      setMenuOpen(false);
    }
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) setMenuOpen(false);
  });
  window.addEventListener("scroll", updateBackTop, { passive: true });
  setMenuOpen(false);

  try {
    const savedTheme = window.localStorage.getItem(themeKey);
    setTheme(savedTheme === "dark" ? "dark" : "light", false);
  } catch (error) {
    console.error("Preferensi tema CEMARA tidak dapat dibaca.", error);
    setTheme("light", false);
  }

  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
  updateBackTop();
  initializeReveals();
})();
