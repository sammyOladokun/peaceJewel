(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";

  if (prefersReducedMotion || !hasGSAP) return;

  const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  gsap.set([
    ".hero-title",
    ".hero-explore",
    ".hero-compare > div"
  ], {
    opacity: 0,
    y: 18
  });

  intro
    .from(".hero-art--ring", { y: 14, duration: 0.65 }, 0)
    .from(".hero-art--ring img", { scale: 0.96, duration: 0.8 }, 0)
    .to(".hero-title", { opacity: 1, y: 0, duration: 0.8 }, 0.05)
    .to(".hero-explore", { opacity: 1, y: 0, duration: 0.55 }, 0.2)
    .to(".hero-compare > div", { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }, 0.25)
    .to(".story-card", { opacity: 1, y: 0, duration: 0.7 }, 0.15);

  const storyCard = document.querySelector(".story-card");
  const storyRing = document.querySelector(".story-ring img");
  const isStoryMobile = () => window.innerWidth <= 768;

  if (storyRing) {
    gsap.set(storyRing, {
      transformOrigin: "50% 50%",
      willChange: "transform"
    });
  }

  const popularRows = Array.from(document.querySelectorAll(".collection-row"));
  popularRows.forEach((section) => {
    const isReverse = section.classList.contains("collection-row--reverse");
    const media = section.querySelector(".collection-row__media img");
    const title = section.querySelector(".collection-row__headline h2");
    const details = Array.from(section.querySelectorAll(".collection-row__details > *")).filter(Boolean);

    if (media) {
      gsap.set(media, {
        opacity: 0,
        y: 40,
        scale: 0.9,
        filter: "blur(18px)"
      });
    }

    if (title) {
      gsap.set(title, {
        opacity: 0,
        x: isReverse ? 72 : -72,
        filter: "blur(6px)"
      });
    }

    if (details.length) {
      gsap.set(details, {
        opacity: 0,
        y: 30,
        filter: "blur(6px)"
      });
    }
  });

  const updatePopularRows = () => {
    if (!popularRows.length) return;

    const viewportHeight = window.innerHeight || 1;

    popularRows.forEach((section) => {
      const isReverse = section.classList.contains("collection-row--reverse");
      const media = section.querySelector(".collection-row__media img");
      const title = section.querySelector(".collection-row__headline h2");
      const details = Array.from(section.querySelectorAll(".collection-row__details > *")).filter(Boolean);
      const rect = section.getBoundingClientRect();
      const entryPoint = viewportHeight * 0.86;
      const exitPoint = -viewportHeight * 0.28;
      const progress = clamp((entryPoint - rect.top) / (entryPoint - exitPoint), 0, 1);
      const fadeOut = progress < 0.82 ? 1 : clamp((1 - progress) / 0.18, 0, 1);
      const imageProgress = clamp((progress - 0.02) / 0.16, 0, 1);
      const titleProgress = clamp((progress - 0.16) / 0.16, 0, 1);

      gsap.set(section, {
        opacity: fadeOut
      });

      if (media) {
        gsap.set(media, {
          opacity: fadeOut * imageProgress,
          y: (1 - imageProgress) * 30,
          scale: 0.92 + imageProgress * 0.08,
          filter: `blur(${(1 - imageProgress) * 14}px)`
        });
      }

      if (title) {
        gsap.set(title, {
          opacity: fadeOut * titleProgress,
          x: (1 - titleProgress) * (isReverse ? 64 : -64),
          filter: `blur(${(1 - titleProgress) * 4}px)`
        });
      }

      details.forEach((detail, index) => {
        const detailProgress = clamp((progress - (0.3 + index * 0.12)) / 0.14, 0, 1);
        gsap.set(detail, {
          opacity: fadeOut * detailProgress,
          y: (1 - detailProgress) * 22,
          filter: `blur(${(1 - detailProgress) * 4}px)`
        });
      });
    });
  };

  const updateStoryRing = () => {
    if (!storyCard || !storyRing) return;

    const viewportHeight = window.innerHeight || 1;
    const rect = storyCard.getBoundingClientRect();
    const mobile = isStoryMobile();
    const startScale = mobile ? 1 : 0.72;
    const peakScale = mobile ? 2.1 : 0.88;
    const centerOffset = Math.abs((rect.top + rect.height / 2) - viewportHeight / 2);
    const maxOffset = viewportHeight / 2 + rect.height / 2;
    const centeredProgress = clamp(1 - centerOffset / maxOffset, 0, 1);
    const easedProgress = centeredProgress * centeredProgress * (3 - 2 * centeredProgress);

    gsap.set(storyRing, {
      opacity: 1,
      scale: startScale + (peakScale - startScale) * easedProgress,
      y: mobile ? 0 : (1 - easedProgress) * 16
    });
  };

  const collectionGrid = document.querySelector(".collection-grid");
  const collectionCards = collectionGrid ? Array.from(collectionGrid.querySelectorAll(".collection-grid__cards > *")) : [];
  const collectionPairs = [];

  for (let index = 0; index < collectionCards.length; index += 2) {
    const firstCard = collectionCards[index];
    const secondCard = collectionCards[index + 1];
    if (!firstCard || !secondCard) continue;

    const firstIsImage = firstCard.classList.contains("grid-card--image");
    const imageCard = firstIsImage ? firstCard : secondCard;
    const textCard = firstIsImage ? secondCard : firstCard;
    const image = imageCard.querySelector("img");
    const heading = textCard.querySelector("h2");
    const body = textCard.querySelector("p");
    const imageDirection = index % 4 === 0 ? -1 : 1;
    const textDirection = imageDirection * -1;
    const pairIndex = collectionPairs.length;

    if (image) {
      gsap.set(image, { opacity: 0, x: 0, y: 26, scale: 0.97, filter: "blur(10px)" });
    }

    if (heading) {
      gsap.set(heading, { opacity: 0, x: textDirection * 52, y: 10 });
    }

    if (body) {
      gsap.set(body, { opacity: 0, y: 24 });
    }

    gsap.set([imageCard, textCard], {
      opacity: 0.9,
      zIndex: 20 + pairIndex
    });

    collectionPairs.push({
      index: pairIndex,
      imageCard,
      textCard,
      image,
      heading,
      body,
      imageDirection,
      textDirection
    });
  }

  const revealTargets = [
    {
      selector: ".trusted-section",
      animate: (section) =>
        gsap.fromTo(
          [section.querySelector("p"), ...section.querySelectorAll(".trusted-logos > *")].filter(Boolean),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" }
        )
    },
    {
      selector: ".newsletter-section",
      animate: (section) =>
        gsap.fromTo(
          [section.querySelector("h2"), section.querySelector(".newsletter-form")].filter(Boolean),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" }
        )
    },
    {
      selector: ".blog-section",
      animate: (section) =>
        gsap.fromTo(
          [section.querySelector("h2"), ...section.querySelectorAll(".blog-card")].filter(Boolean),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.75, stagger: 0.09, ease: "power3.out" }
        )
    },
    {
      selector: ".page-contact",
      animate: (section) =>
        gsap.fromTo(
          Array.from(section.children),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" }
        )
    },
    {
      selector: ".site-footer",
      animate: (section) =>
        gsap.fromTo(
          Array.from(section.children),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.75, stagger: 0.08, ease: "power3.out" }
        )
    },
    {
      selector: ".copyright",
      animate: (section) => gsap.fromTo(section, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" })
    }
  ];

  const revealMap = new WeakMap();

  const updateCollectionCards = () => {
    if (!collectionGrid || !collectionPairs.length) return;

    const viewportHeight = window.innerHeight || 1;
    const rect = collectionGrid.getBoundingClientRect();
    const total = rect.height + viewportHeight * 0.6;
    const progress = clamp((viewportHeight - rect.top) / total, 0, 1);
    const segment = 1 / Math.max(1, collectionPairs.length);
    const activeIndex = clamp(Math.floor(progress / segment), 0, collectionPairs.length - 1);

    collectionPairs.forEach((target) => {
      const start = target.index * segment;
      const local = clamp((progress - start) / Math.max(0.22, segment * 0.92), 0, 1);
      const imageStart = target.index === 0 ? 0.03 : 0.01;
      const textStart = target.index === 0 ? 0.24 : 0.12;
      const bodyStart = target.index === 0 ? 0.5 : 0.36;
      const leadIn = clamp((local - imageStart) / (target.index === 0 ? 0.5 : 0.34), 0, 1);
      const textLeadIn = clamp((local - textStart) / (target.index === 0 ? 0.58 : 0.42), 0, 1);
      const bodyLeadIn = clamp((local - bodyStart) / (target.index === 0 ? 0.66 : 0.5), 0, 1);
      const hold = local < (target.index === 0 ? 0.88 : 0.84) ? 1 : clamp((1 - local) / 0.16, 0, 1);

      gsap.set([target.imageCard, target.textCard], {
        opacity: hold,
        y: 0,
        zIndex: target.index === activeIndex ? 100 : 20 + target.index
      });

      if (target.image) {
        gsap.set(target.image, {
          opacity: hold,
          x: 0,
          y: (1 - leadIn) * 26,
          scale: 0.97 + leadIn * 0.03,
          filter: `blur(${(1 - leadIn) * 10}px)`
        });
      }

      if (target.heading) {
        gsap.set(target.heading, {
          opacity: hold * textLeadIn,
          x: (1 - textLeadIn) * target.textDirection * (target.index === 0 ? 72 : 56),
          y: 0
        });
      }

      if (target.body) {
        gsap.set(target.body, {
          opacity: hold * bodyLeadIn,
          y: (1 - bodyLeadIn) * 30
        });
      }
    });
  };

  const startObserver = () => {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const revealConfig = revealMap.get(entry.target);
        if (revealConfig) {
          revealConfig.animate(entry.target);
        }

        observer.unobserve(entry.target);
      });
    }, { threshold: 0.22, rootMargin: "0px 0px -8% 0px" });

    revealTargets.forEach((entry) => {
      Array.from(document.querySelectorAll(entry.selector)).forEach((element) => {
        if (!element) return;
        revealMap.set(element, entry);
        revealObserver.observe(element);
      });
    });
  };

  const startCollectionMotion = () => {
    if (!collectionGrid || !collectionPairs.length) return;

    let collectionFrame = null;
    const requestCollectionUpdate = () => {
      if (collectionFrame !== null) return;
      collectionFrame = window.requestAnimationFrame(() => {
        collectionFrame = null;
        updateCollectionCards();
      });
    };

    window.addEventListener("scroll", requestCollectionUpdate, { passive: true });
    window.addEventListener("resize", requestCollectionUpdate);
    requestCollectionUpdate();
  };

  const startPopularMotion = () => {
    if (!popularRows.length) return;

    let popularFrame = null;
    const requestPopularUpdate = () => {
      if (popularFrame !== null) return;
      popularFrame = window.requestAnimationFrame(() => {
        popularFrame = null;
        updatePopularRows();
      });
    };

    window.addEventListener("scroll", requestPopularUpdate, { passive: true });
    window.addEventListener("resize", requestPopularUpdate);
    requestPopularUpdate();
  };

  const startStoryMotion = () => {
    if (!storyCard || !storyRing) return;

    let storyFrame = null;
    const requestStoryUpdate = () => {
      if (storyFrame !== null) return;
      storyFrame = window.requestAnimationFrame(() => {
        storyFrame = null;
        updateStoryRing();
      });
    };

    window.addEventListener("scroll", requestStoryUpdate, { passive: true });
    window.addEventListener("resize", requestStoryUpdate);
    requestStoryUpdate();
  };

  if (document.readyState === "complete") {
    window.requestAnimationFrame(() => {
      startObserver();
      startPopularMotion();
      startStoryMotion();
      startCollectionMotion();
    });
  } else {
    window.addEventListener("load", () => {
      window.requestAnimationFrame(() => {
        startObserver();
        startPopularMotion();
        startStoryMotion();
        startCollectionMotion();
      });
    }, { once: true });
  }
})();
