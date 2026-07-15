// Mobile hamburger — toggles the collapsed nav links; closes on link tap,
// outside tap, or Escape.
(function () {
  const burger = document.querySelector(".nav-burger");
  const menu = document.getElementById("mobile-menu");
  if (!burger || !menu) return;

  const setOpen = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  };

  burger.addEventListener("click", () => {
    setOpen(burger.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", (e) => {
    if (e.target instanceof HTMLAnchorElement) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !e.target.closest("nav.top")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setOpen(false);
  });
})();

// Scroll reveals — sections fade-rise in once, gated by reduced-motion.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".reveal");

  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  targets.forEach((el) => io.observe(el));
})();
