if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      currentObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  window.observeReveals = (root = document) => {
    root.querySelectorAll("[data-reveal]:not([data-reveal-observed])").forEach((item) => {
      item.dataset.revealObserved = "true";
      observer.observe(item);
    });
  };
  window.observeReveals();
} else {
  window.observeReveals = (root = document) => {
    root.querySelectorAll("[data-reveal]").forEach((item) => item.classList.add("is-in"));
  };
  window.observeReveals();
}
