(() => {
  const headers = Array.from(document.querySelectorAll('.site-header'));

  headers.forEach((header) => {
    const nav = header.querySelector('.site-nav');
    const button = header.querySelector('.site-menu-button');
    const categoryToggle = header.querySelector('.site-nav__toggle');
    const categoryDropdown = categoryToggle ? categoryToggle.nextElementSibling : null;

    if (!nav || !button) return;

    const setOpen = (open) => {
      header.dataset.menuOpen = String(open);
      button.setAttribute('aria-expanded', String(open));
      if (!open) setCategoryOpen(false);
    };

    const setCategoryOpen = (open) => {
      if (!categoryToggle || !categoryDropdown || !categoryDropdown.classList.contains('site-nav__dropdown')) return;
      categoryToggle.dataset.open = String(open);
      categoryToggle.setAttribute('aria-expanded', String(open));
    };

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(header.dataset.menuOpen !== 'true');
    });

    if (categoryToggle && categoryDropdown) {
      categoryToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setCategoryOpen(categoryToggle.dataset.open !== 'true');
      });
    }

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
        const categoryToggle = header.querySelector('.site-nav__toggle');
        if (categoryToggle) categoryToggle.dataset.open = 'false';
        if (categoryToggle) categoryToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    headers.forEach((header) => {
      header.dataset.menuOpen = 'false';
      const button = header.querySelector('.site-menu-button');
      if (button) button.setAttribute('aria-expanded', 'false');
      const categoryToggle = header.querySelector('.site-nav__toggle');
      if (categoryToggle) categoryToggle.dataset.open = 'false';
      if (categoryToggle) categoryToggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
