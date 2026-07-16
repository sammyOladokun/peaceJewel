(() => {
  const headers = Array.from(document.querySelectorAll('.site-header'));

  headers.forEach((header) => {
    const nav = header.querySelector('.site-nav');
    const button = header.querySelector('.site-menu-button');

    if (!nav || !button) return;

    const setOpen = (open) => {
      header.dataset.menuOpen = String(open);
      button.setAttribute('aria-expanded', String(open));
    };

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(header.dataset.menuOpen !== 'true');
    });

    nav.addEventListener('click', () => {
      setOpen(false);
    });
  });

  document.addEventListener('pointerdown', (event) => {
    headers.forEach((header) => {
      if (!header.contains(event.target)) {
        header.dataset.menuOpen = 'false';
        const button = header.querySelector('.site-menu-button');
        if (button) button.setAttribute('aria-expanded', 'false');
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    headers.forEach((header) => {
      header.dataset.menuOpen = 'false';
      const button = header.querySelector('.site-menu-button');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  });
})();
