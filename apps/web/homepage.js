(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";

  if (prefersReducedMotion || !hasGSAP) return;

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  gsap.set([
    ".hero-art--ring",
    ".hero-title",
    ".hero-explore",
    ".hero-compare > div",
    ".story-card",
    ".collection-section__eyebrow",
    ".collection-row",
    ".collection-grid",
    ".trusted-section",
    ".newsletter-section",
    ".blog-section",
    ".page-contact",
    ".site-footer",
    ".copyright"
  ], {
    opacity: 0,
    y: 18
  });

  gsap.set(".hero-art--ring img", { scale: 0.92, opacity: 0 });

  intro
    .to(".hero-art--ring", { opacity: 1, y: 0, duration: 0.7 })
    .to(".hero-art--ring img", { scale: 1, opacity: 1, duration: 0.9 }, "<0.05")
    .to(".hero-title", { opacity: 1, y: 0, duration: 0.8 }, "-=0.45")
    .to(".hero-explore", { opacity: 1, y: 0, duration: 0.6 }, "-=0.35")
    .to(".hero-compare > div", { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 }, "-=0.25")
    .to(".story-card", { opacity: 1, y: 0, duration: 0.75 }, "-=0.15");

  const revealTargets = [
    ".collection-section__eyebrow",
    ".collection-row",
    ".collection-grid",
    ".trusted-section",
    ".newsletter-section",
    ".blog-section",
    ".page-contact",
    ".site-footer",
    ".copyright"
  ];

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      gsap.to(entry.target, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out"
      });

      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18 });

  revealTargets
    .map((selector) => Array.from(document.querySelectorAll(selector)))
    .flat()
    .forEach((element) => {
      if (element) revealObserver.observe(element);
    });
})();
