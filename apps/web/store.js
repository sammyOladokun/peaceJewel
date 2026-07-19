(function () {
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;
  const STORAGE_KEYS = {
    cart: "peacejewel.cart.v1",
    cartId: "peacejewel.cart.id.v1",
    inventory: "peacejewel.inventory.v1",
    order: "peacejewel.order.v1",
    orders: "peacejewel.orders.v1"
  };

  const CATALOG_SECTIONS = [
    {
      slug: "new-arrivals",
      eyebrow: "New Arrivals",
      heading: "Fresh pieces for now.",
      description: "Discover the newest jewelry drops with the same PeaceJewel polish — easy to wear, easy to gift, and ready to add to cart.",
      label: "New"
    },
    {
      slug: "mens-collection",
      eyebrow: "Men's Collection",
      heading: "Clean lines, bold finish.",
      description: "A refined edit of bracelets and rings with a more grounded feel, designed for everyday wear and statement gifting.",
      label: "Men's"
    },
    {
      slug: "womens-collection",
      eyebrow: "Women's Collection",
      heading: "Soft shine, strong presence.",
      description: "Elegant rings and layered pieces made to feel delicate at first glance and premium in every detail.",
      label: "Women’s"
    },
    {
      slug: "gift-sets",
      eyebrow: "Gift Sets",
      heading: "Easy wins for gifting.",
      description: "Curated pairings and ready-to-give jewelry picks made for birthdays, anniversaries, and thoughtful surprises.",
      label: "Gift"
    },
    {
      slug: "best-sellers",
      eyebrow: "Best Sellers",
      heading: "The pieces people keep choosing.",
      description: "Our most-loved jewelry, selected for daily wearability, gifting appeal, and timeless polish.",
      label: "Top"
    }
  ];

  const COLLECTION_LABELS = {
    "new-arrivals": "New Arrivals",
    "mens-collection": "Men's Collection",
    "womens-collection": "Women's Collection",
    "gift-sets": "Gift Sets",
    "best-sellers": "Best Sellers"
  };

  const BENEFIT_PRESETS = {
    primary: {
      everyday: "Polished enough for every day, with a clean finish that feels easy to wear from morning to night.",
      "gift-ready": "A gift-ready piece with an elevated look that feels thoughtful the moment it’s unwrapped.",
      stackable: "Designed to stack beautifully with your existing pieces for a layered, premium finish.",
      "minimal-luxury": "Minimal lines and a refined shine create a luxury feel without looking overdone."
    },
    secondary: {
      "daily-wear": "Perfect for everyday styling, work looks, and repeat wear without losing its polish.",
      gifting: "Perfect for birthdays, anniversaries, and those last-minute moments when you want something special.",
      "special-occasion": "Perfect for celebrations, dinners, and moments where the details should feel a little more elevated.",
      layering: "Perfect for layering with other rings, chains, or bracelets to create a richer look."
    }
  };

  const state = {
    cart: readJson(STORAGE_KEYS.cart, []),
    inventory: readJson(STORAGE_KEYS.inventory, []),
    orders: readJson(STORAGE_KEYS.orders, []),
    selectedInventoryId: null,
    catalogSelections: {},
    activeCatalogSlug: ""
  };

  let pendingImageUpload = null;

  init();

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("submit", handleDocumentSubmit);
  document.addEventListener("change", handleDocumentChange);
  window.addEventListener("storage", handleStorageEvent);

  function init() {
    state.inventory = state.inventory.map(normalizeInventoryRecord);
    enhanceCartBadge();
    renderAll();
    renderStorefrontPages();
    hydrateCartFromApi();
    mountCatalogActions();
    mountProductPage();
    mountCartPage();
    mountCheckoutPage();
    mountAdminPage();
    void hydrateInventoryFromApi();
    void hydrateOrdersFromApi();
  }

  function renderAll() {
    renderStorefrontPages();
    renderCartPage();
    renderCheckoutPage();
    renderAdminPage();
    updateCartBadge();
  }

  function handleStorageEvent(event) {
    if (event.key === STORAGE_KEYS.cart) {
      state.cart = readJson(STORAGE_KEYS.cart, []);
      renderCartPage();
      renderCheckoutPage();
      updateCartBadge();
    }

    if (event.key === STORAGE_KEYS.inventory) {
      state.inventory = readJson(STORAGE_KEYS.inventory, []);
      renderStorefrontPages();
      renderAdminPage();
    }

    if (event.key === STORAGE_KEYS.orders) {
      state.orders = readJson(STORAGE_KEYS.orders, []);
      renderAdminPage();
    }
  }

  function handleDocumentClick(event) {
    const actionButton = event.target.closest("button");

    if (actionButton) {
      if (actionButton.matches(".site-cart-count")) {
        return;
      }

      if (actionButton.matches("[data-admin-collections-toggle]")) {
        event.preventDefault();
        toggleCollectionsMenu(actionButton);
        return;
      }

      if (actionButton.matches("[data-catalog-option]")) {
        event.preventDefault();
        updateCatalogPopoverSelection(actionButton);
        return;
      }

      if (actionButton.matches(".shop-chip")) {
        const chipGroup = actionButton.closest(".shop-toolbar__controls");
        if (chipGroup) {
          const chips = Array.from(chipGroup.querySelectorAll(".shop-chip"));
          chips.forEach((chip) => chip.classList.remove("shop-chip--active"));
          actionButton.classList.add("shop-chip--active");
        }
        return;
      }

      if (actionButton.matches("[data-cart-qty]")) {
        event.preventDefault();
        const cartItem = actionButton.closest(".cart-item");
        if (!cartItem) return;
        const itemId = cartItem.dataset.cartId;
        if (actionButton.dataset.cartQty === "increase") {
          changeCartQuantity(itemId, 1);
        } else if (actionButton.dataset.cartQty === "decrease") {
          changeCartQuantity(itemId, -1);
        } else if (actionButton.dataset.cartQty === "remove") {
          removeCartItem(itemId);
        }
        return;
      }

      if (actionButton.matches("[data-admin-action]")) {
        event.preventDefault();
        handleAdminAction(actionButton.dataset.adminAction);
        return;
      }

      if (actionButton.matches("[data-catalog-confirm]")) {
        event.preventDefault();
        confirmCatalogSelection(actionButton);
        return;
      }

      if (actionButton.matches("[data-catalog-cancel]")) {
        event.preventDefault();
        closeCatalogPopover();
        return;
      }

      if (actionButton.matches("[data-catalog-add]")) {
        event.preventDefault();
        openOrAddCatalogProduct(actionButton);
        return;
      }

      if (actionButton.matches(".shop-product .button--dark, .collection-row .button--dark, .product-page__add-button")) {
        event.preventDefault();
        const product = extractProductFromButton(actionButton);
        if (product) {
          addToCart(product);
          setButtonFlash(actionButton, "Added");
        }
        return;
      }

      if (actionButton.matches("[data-catalog-close]")) {
        event.preventDefault();
        closeCatalogPopover();
        return;
      }

      if (actionButton.matches("[data-stock-action]")) {
        const row = actionButton.closest(".admin-table__row[data-admin-id]");
        if (!row) return;
        const itemId = row.dataset.adminId;
        const delta = actionButton.dataset.stockAction === "increase" ? 1 : -1;
        adjustInventoryStock(itemId, delta);
        return;
      }
    }

    const adminRow = event.target.closest(".admin-table__row[data-admin-id]");
    if (adminRow && !event.target.closest("[data-stock-action]")) {
      event.preventDefault();
      selectInventoryItem(adminRow.dataset.adminId);
    }

    const collectionsPicker = event.target.closest(".admin-multiselect");
    if (!collectionsPicker) {
      closeCollectionsMenu();
    }

    if (!event.target.closest(".shop-product__popover") && !event.target.closest("[data-catalog-add]")) {
      closeCatalogPopover();
    }
  }

  function handleDocumentSubmit(event) {
    if (event.target.matches(".newsletter-form")) {
      event.preventDefault();
      showToast("Thanks — you’re on the list.");
      event.target.reset();
      return;
    }

    if (event.target.matches(".checkout-form")) {
      event.preventDefault();
      completeOrder(event.target);
      return;
    }

    if (event.target.matches(".admin-form")) {
      event.preventDefault();
      void saveSelectedInventoryItem();
    }
  }

  function handleDocumentChange(event) {
    const target = event.target;
    if (target.matches('.admin-form [data-admin-collection-option]')) {
      const form = target.closest(".admin-form");
      syncCollectionsState(form);
      closeCollectionsMenu(form);
      return;
    }

    if (target.matches('.admin-form [data-admin-field="benefitPrimaryPreset"], .admin-form [data-admin-field="benefitSecondaryPreset"]')) {
      syncBenefitPreset(target.closest(".admin-form"), target);
      return;
    }

    if (target.matches("[data-catalog-option]")) {
      updateCatalogPopoverSelection(target);
      return;
    }

    if (!target.matches('.admin-form [data-admin-field="imageFile"], .admin-form [data-admin-field="imageUrl"]')) return;

    const form = target.closest(".admin-form");
    const preview = form?.querySelector('[data-admin-preview="image"]');
    const urlField = form?.querySelector('[data-admin-field="imageUrl"]');

    if (target.matches('[data-admin-field="imageUrl"]')) {
      pendingImageUpload = null;
      if (preview) preview.src = target.value || preview.src;
      return;
    }

    const file = target.files && target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      pendingImageUpload = {
        itemId: state.selectedInventoryId,
        fileName: file.name,
        mimeType: file.type || "image/png",
        dataUrl: String(reader.result || "")
      };

      if (preview) preview.src = pendingImageUpload.dataUrl;
      if (urlField) urlField.value = pendingImageUpload.dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function hydrateInventoryFromApi() {
    try {
      const response = await fetch(`${API_BASE}/inventory`);
      if (!response.ok) return;
      const inventory = await response.json();
      state.inventory = inventory.map(normalizeInventoryRecord);
      persistInventoryCache();
      renderStorefrontPages();
      renderAdminPage();
    } catch {
      // Keep local fallback.
    }
  }

  async function hydrateOrdersFromApi() {
    try {
      const response = await fetch(`${API_BASE}/orders`);
      if (!response.ok) return;
      const orders = await response.json();
      state.orders = Array.isArray(orders) ? orders.map(normalizeOrderRecord) : [];
      persistOrdersCache();
      renderAdminPage();
    } catch {
      // Keep local fallback.
    }
  }

  async function hydrateCartFromApi() {
    const cartId = getCartId();
    try {
      const response = await fetch(`${API_BASE}/cart-state?cartId=${encodeURIComponent(cartId)}`);
      if (!response.ok) return;
      const payload = await response.json();
      if (Array.isArray(payload.items) && payload.items.length) {
        state.cart = payload.items.map(normalizeCartRecord);
        persistCartCache();
        renderCartPage();
        renderCheckoutPage();
        updateCartBadge();
        return;
      }
      await syncCartToApi();
    } catch {
      // Keep local fallback.
    }
  }

  function mountCatalogActions() {
    const catalogShell = document.querySelector(".shop-shell");
    if (!catalogShell) return;
    renderStorefrontPages();
    updateCartBadge();
  }

  function mountProductPage() {
    const productPage = document.querySelector(".product-page");
    if (!productPage) return;
    renderProductPage();
  }

  function mountCartPage() {
    const cartItems = document.querySelector(".cart-items");
    if (!cartItems) return;
    renderCartPage();
  }

  function mountCheckoutPage() {
    const checkoutForm = document.querySelector(".checkout-form");
    const submitButton = document.querySelector(".checkout-summary__submit");

    if (!checkoutForm || !submitButton) return;

    checkoutForm.id = "checkout-form";
    submitButton.setAttribute("form", "checkout-form");
    submitButton.type = "submit";
    renderCheckoutPage();
    applyCheckoutStatus();
  }

  function mountAdminPage() {
    const adminGrid = document.querySelector(".admin-grid");
    if (!adminGrid) return;

    state.inventory = readJson(STORAGE_KEYS.inventory, []);
    if (!state.selectedInventoryId && state.inventory.length) {
      state.selectedInventoryId = state.inventory[0].id;
    }

    renderAdminPage();
  }

  function renderCartPage() {
    const itemsContainer = document.querySelector(".cart-items");
    if (!itemsContainer) return;

    if (!state.cart.length) {
      itemsContainer.innerHTML = `
        <div class="cart-empty">
          <p class="eyebrow">Your bag is empty</p>
          <h3>Start with a piece you love.</h3>
          <p>Browse the catalog to add rings, bracelets, and gift-ready pieces to your bag.</p>
          <a class="button button--dark" href="/catalog">Shop the catalog</a>
        </div>
      `;
    } else {
      itemsContainer.innerHTML = state.cart.map(renderCartItem).join("");
    }

    const summaryValues = document.querySelectorAll(".cart-summary__rows div");
    if (summaryValues.length >= 3) {
      const totals = getCartTotals();
      summaryValues[0].querySelector("strong").textContent = formatMoney(totals.subtotal);
      summaryValues[1].querySelector("strong").textContent = "Free";
      summaryValues[2].querySelector("strong").textContent = formatMoney(totals.total);
    }

    const summaryButton = document.querySelector(".cart-summary__checkout");
    if (summaryButton) {
      summaryButton.setAttribute("aria-disabled", String(!state.cart.length));
      summaryButton.style.pointerEvents = state.cart.length ? "auto" : "none";
      summaryButton.style.opacity = state.cart.length ? "1" : ".55";
    }

    updateCartBadge();
  }

  function renderCheckoutPage() {
    const checkoutSummary = document.querySelector(".checkout-summary");
    if (!checkoutSummary) return;

    const itemsContainer = checkoutSummary.querySelector(".checkout-summary__items");
    const rows = checkoutSummary.querySelectorAll(".checkout-summary__rows div");
    const submitButton = checkoutSummary.querySelector(".checkout-summary__submit");

    if (itemsContainer) {
      itemsContainer.innerHTML = state.cart.length
        ? state.cart.map(renderCheckoutItem).join("")
        : `
          <div class="checkout-summary__item checkout-summary__item--empty">
            <span>Your bag is empty</span>
            <strong>0.00</strong>
          </div>
        `;
    }

    const totals = getCartTotals();
    if (rows.length >= 3) {
      rows[0].querySelector("strong").textContent = formatMoney(totals.subtotal);
      rows[1].querySelector("strong").textContent = "Free";
      rows[2].querySelector("strong").textContent = formatMoney(totals.total);
    }

    if (submitButton) {
      submitButton.disabled = !state.cart.length;
      submitButton.style.opacity = state.cart.length ? "1" : ".55";
      submitButton.style.pointerEvents = state.cart.length ? "auto" : "none";
    }
  }

  function renderStorefrontPages() {
    renderCatalogPage();
    renderProductPage();
  }

  function renderCatalogPage() {
    const shopProducts = document.querySelector("#shop-products") || document.querySelector(".shop-category-page");
    if (!shopProducts) return;

    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    const collectionSlug = pathname.startsWith("/catalog/") ? pathname.split("/")[2] || "" : "";
    const sections = collectionSlug
      ? CATALOG_SECTIONS.filter((section) => section.slug === collectionSlug)
      : CATALOG_SECTIONS;

    shopProducts.innerHTML = sections
      .map((section) => renderCatalogSection(section, getProductsForCollection(section.slug), collectionSlug))
      .join("");
  }

  function renderCatalogSection(section, products, collectionSlug) {
    const visibleProducts = products.length ? products : getActiveInventory().slice(0, 4);
    const moreLink = `/catalog/${section.slug}`;
    return `<div class="shop-category">
      ${collectionSlug ? "" : `<div class="shop-category__head">
        <div>
          <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
          <h3>${escapeHtml(section.heading)}</h3>
        </div>
        <a class="shop-category__more" href="${moreLink}">View more</a>
      </div>`}
      <div class="shop-category__track${collectionSlug ? " shop-category__track--page" : ""}">
        ${visibleProducts.map((product) => renderCatalogProductCard(product, section.label)).join("")}
      </div>
    </div>`;
  }

  function renderCatalogProductCard(product, label) {
    const detailHref = `/product?slug=${encodeURIComponent(product.slug || product.id)}`;
    return `<article class="shop-product shop-product--carousel" data-product-slug="${escapeHtml(product.slug || product.id)}">
      <img class="shop-product__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <h3>${escapeHtml(product.name)}</h3>
      <div class="shop-product__meta"><span>Price</span><strong>${formatMoney(product.priceCents)}</strong></div>
      <a class="shop-product__details" href="${detailHref}">View Details</a>
      <button class="button button--dark" type="button" data-catalog-add>Add To Cart</button>
      <div class="shop-product__popover" hidden></div>
    </article>`;
  }

  function renderProductPage() {
    const productPage = document.querySelector(".product-page");
    if (!productPage) return;

    const product = getStorefrontProduct();
    if (!product) return;

    const sizes = product.sizes?.length ? product.sizes : ["One Size"];
    const colors = product.colors?.length ? product.colors : ["Gold"];
    const related = getRelatedInventory(product).slice(0, 2);
    const benefits = getBenefitCards(product);

    productPage.innerHTML = `
      <div class="product-page__media">
        <p class="eyebrow product-page__eyebrow">New Arrival</p>
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />

        <ul class="product-page__benefits">
          <li>
            <span class="eyebrow">Why You’ll Love It</span>
            <p>${escapeHtml(benefits.primary)}</p>
          </li>
          <li>
            <span class="eyebrow">Perfect For</span>
            <p>${escapeHtml(benefits.secondary)}</p>
          </li>
        </ul>
      </div>

      <div class="product-page__content">
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-page__lead">${escapeHtml(product.description || "A polished PeaceJewel piece made to feel special from the first glance.")}</p>

        <div class="product-page__options">
          ${renderOptionGroup("Size", sizes)}
          ${renderOptionGroup("Color", colors)}
        </div>

        <div class="product-page__purchase-row">
          <div class="product-page__purchase-top">
              <div class="product-page__price-row">
                <strong>Price:</strong>
                <span>${formatMoney(product.priceCents)}</span>
              </div>
            </div>
          <div class="shop-hero__actions product-page__actions">
            <a class="button button--ghost product-page__back-button" href="/catalog">Back To Shop</a>
            <button class="button button--dark product-page__add-button" type="button">Add To Bag</button>
          </div>
        </div>
      </div>`;

    const relatedSection = document.querySelector(".product-related");
    if (relatedSection) {
      relatedSection.innerHTML = `
        <div class="shop-toolbar">
          <div>
            <p class="eyebrow">Complete The Look</p>
            <h2>Pieces that pair beautifully.</h2>
          </div>
        </div>
        <div class="shop-products shop-products--catalog">
          ${related.map((item) => renderRelatedProductCard(item)).join("")}
        </div>
      `;
    }
  }

  function renderOptionGroup(label, options) {
    const values = options.length ? options : [label];
    return `<div>
      <p class="eyebrow">${escapeHtml(label)}</p>
      <div class="shop-toolbar__controls">
        ${values
          .map((value, index) => `<button class="shop-chip${index === 0 ? " shop-chip--active" : ""}" type="button">${escapeHtml(value)}</button>`)
          .join("")}
      </div>
    </div>`;
  }

  function renderRelatedProductCard(product) {
    const detailHref = `/product?slug=${encodeURIComponent(product.slug || product.id)}`;
    return `<article class="shop-product">
      <img class="shop-product__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
      <h3>${escapeHtml(product.name)}</h3>
      <div class="shop-product__meta"><span>Price</span><strong>${formatMoney(product.priceCents)}</strong></div>
      <a class="shop-product__details" href="${detailHref}">View Details</a>
      <button class="button button--dark" type="button">Add To Cart</button>
    </article>`;
  }

  function renderAdminPage() {
    const adminGrid = document.querySelector(".admin-grid");
    if (!adminGrid) return;

    const table = document.querySelector(".admin-table");
    const stats = Array.from(document.querySelectorAll(".admin-stat strong"));
    const alertsList = document.querySelector(".admin-list");
    const ordersList = document.querySelector("[data-admin-orders-list]");
    const ordersMeta = document.querySelector("[data-admin-orders-meta]");
    const orderStats = {
      pending: document.querySelector('[data-admin-order-stat="pending"]'),
      paid: document.querySelector('[data-admin-order-stat="paid"]'),
      revenue: document.querySelector('[data-admin-order-stat="revenue"]')
    };
    const form = document.querySelector(".admin-form");

    if (!state.inventory.length) {
      state.inventory = [];
    }

    if (!state.selectedInventoryId || !state.inventory.some((item) => item.id === state.selectedInventoryId)) {
      state.selectedInventoryId = state.inventory[0]?.id || null;
    }

    if (table) {
      table.innerHTML = [
        `<div class="admin-table__row admin-table__row--head">
          <span>Product</span>
          <span>Status</span>
          <span>Stock</span>
          <span>Price</span>
        </div>`,
        ...state.inventory.map(renderAdminRow)
      ].join("");
    }

    if (stats.length >= 4) {
      const activeSkus = state.inventory.filter((item) => item.active).length;
      const pendingOrders = state.orders.filter((order) => normalizeText(order.status) === "pending").length;
      const lowStockItems = state.inventory.filter((item) => item.stock > 0 && item.stock <= 5).length;
      const outOfStock = state.inventory.filter((item) => item.stock <= 0).length;
      const paidOrders = state.orders.filter((order) => normalizeText(order.status) === "paid").length;

      stats[0].textContent = String(activeSkus).padStart(2, "0");
      stats[1].textContent = String(pendingOrders).padStart(2, "0");
      stats[2].textContent = String(lowStockItems).padStart(2, "0");
      stats[3].textContent = String(outOfStock).padStart(2, "0");
    }

    if (ordersMeta || ordersList || orderStats.pending || orderStats.paid || orderStats.revenue) {
      const pendingOrders = state.orders.filter((order) => normalizeText(order.status) === "pending");
      const paidOrders = state.orders.filter((order) => normalizeText(order.status) === "paid");
      const totalRevenue = state.orders
        .filter((order) => normalizeText(order.status) === "paid")
        .reduce((sum, order) => sum + Number(order.amountCents || 0), 0);

      if (ordersMeta) {
        ordersMeta.textContent = `${state.orders.length} orders`;
      }

      if (orderStats.pending) orderStats.pending.textContent = String(pendingOrders.length).padStart(2, "0");
      if (orderStats.paid) orderStats.paid.textContent = String(paidOrders.length).padStart(2, "0");
      if (orderStats.revenue) orderStats.revenue.textContent = formatMoney(totalRevenue);

      if (ordersList) {
        const items = [...pendingOrders, ...paidOrders.slice(0, 3), ...state.orders.filter((order) => !["pending", "paid"].includes(normalizeText(order.status))).slice(0, 2)];
        ordersList.innerHTML = items.length
          ? items.slice(0, 6).map(renderAdminOrderItem).join("")
          : `<li class="admin-order-list__empty">No orders yet.</li>`;
      }
    }

    if (alertsList) {
      const alerts = buildAlerts();
      alertsList.innerHTML = alerts.length
        ? alerts.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.message)}</span></li>`).join("")
        : `<li><strong>All clear</strong><span>No inventory alerts right now.</span></li>`;
    }

    if (form) {
      populateAdminForm(getSelectedInventoryItem());
    }

    syncSelectedAdminRow();
  }

  function renderCartItem(item) {
    return `<article class="cart-item" data-cart-id="${escapeHtml(item.id)}">
      <img class="cart-item__image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      <div class="cart-item__body">
        <div class="cart-item__top">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.variant)}</p>
          </div>
          <strong>${formatMoney(item.priceCents)}</strong>
        </div>
        <div class="cart-item__actions">
          <div class="cart-qty" aria-label="Quantity selector">
            <button type="button" data-cart-qty="decrease" aria-label="Decrease quantity">−</button>
            <span>${String(item.quantity).padStart(2, "0")}</span>
            <button type="button" data-cart-qty="increase" aria-label="Increase quantity">+</button>
          </div>
          <button class="cart-item__remove" type="button" data-cart-qty="remove">Remove</button>
        </div>
      </div>
    </article>`;
  }

  function renderCheckoutItem(item) {
    return `<div class="checkout-summary__item">
      <span>${escapeHtml(item.name)}${item.variant ? ` · ${escapeHtml(item.variant)}` : ""}</span>
      <strong>${formatMoney(item.priceCents)}</strong>
    </div>`;
  }

  function renderAdminRow(item) {
    const statusClass = item.stock <= 0 ? "admin-badge--empty" : item.stock <= 5 ? "admin-badge--warn" : "admin-badge--ok";
    const statusLabel = item.stock <= 0 ? "Out" : item.stock <= 5 ? "Low Stock" : "In Stock";
    const selectedClass = item.id === state.selectedInventoryId ? " admin-table__row--selected" : "";

    return `<div class="admin-table__row${selectedClass}" data-admin-id="${escapeHtml(item.id)}">
      <div class="admin-product">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>SKU ${escapeHtml(item.sku)}</span>
        </div>
      </div>
      <span class="admin-badge ${statusClass}">${statusLabel}</span>
      <div class="admin-stock-control">
        <button type="button" data-stock-action="decrease" aria-label="Decrease stock">−</button>
        <strong>${String(item.stock).padStart(2, "0")}</strong>
        <button type="button" data-stock-action="increase" aria-label="Increase stock">+</button>
      </div>
      <strong>${formatMoney(item.priceCents)}</strong>
    </div>`;
  }

  function renderAdminOrderItem(order) {
    const status = normalizeText(order.status) || "pending";
    const statusLabel = status === "paid" ? "Paid" : status === "failed" ? "Failed" : "Pending";
    const total = formatMoney(order.amountCents || 0);
    const customerName = order.customer?.name || "Guest Customer";
    const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";

    return `<li class="admin-order-item">
      <div>
        <strong>${escapeHtml(customerName)}</strong>
        <span>${escapeHtml(createdAt)} · ${escapeHtml(order.txRef || order.id || "Order")}</span>
      </div>
      <div class="admin-order-item__meta">
        <span class="admin-badge ${status === "paid" ? "admin-badge--ok" : status === "failed" ? "admin-badge--empty" : "admin-badge--warn"}">${statusLabel}</span>
        <strong>${escapeHtml(total)}</strong>
      </div>
    </li>`;
  }

  function buildAlerts() {
    return state.inventory
      .filter((item) => item.stock <= 5)
      .map((item) => ({
        name: item.name,
        message: item.stock <= 0 ? "Inventory reached zero today." : `Reorder soon — ${item.stock} units left.`
      }));
  }

  function getActiveInventory() {
    return state.inventory.filter((item) => item.active !== false);
  }

  function getProductsForCollection(collectionSlug) {
    const activeInventory = getActiveInventory();
    const matches = activeInventory.filter((item) => normalizeList(item.collections).includes(collectionSlug));
    return matches.length ? matches : activeInventory;
  }

  function getStorefrontProduct() {
    const slug = getStorefrontSlug();
    const activeInventory = getActiveInventory();
    if (slug) {
      const match = activeInventory.find((item) => item.slug === slug || item.id === slug);
      if (match) return match;
    }

    return activeInventory[0] || state.inventory[0] || null;
  }

  function getRelatedInventory(product) {
    const activeInventory = getActiveInventory();
    const related = activeInventory.filter((item) => item.id !== product.id && shareCollection(item, product));
    return related.length ? related : activeInventory.filter((item) => item.id !== product.id);
  }

  function shareCollection(left, right) {
    const leftCollections = normalizeList(left.collections);
    const rightCollections = normalizeList(right.collections);
    return leftCollections.some((collection) => rightCollections.includes(collection));
  }

  function getStorefrontSlug() {
    const searchParams = new URLSearchParams(window.location.search);
    const querySlug = searchParams.get("slug");
    if (querySlug) return querySlug;

    const pathParts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (pathParts[0] === "product" && pathParts[1]) {
      return decodeURIComponent(pathParts[1]);
    }

    return "";
  }

  function getCatalogProductFromCard(card) {
    const slug = card?.dataset.productSlug || "";
    if (!slug) return null;
    return getActiveInventory().find((item) => item.slug === slug || item.id === slug) || null;
  }

  function getCatalogSelection(product) {
    const slug = product.slug || product.id;
    const existing = state.catalogSelections[slug];
    if (existing) return existing;

    return {
      size: normalizeList(product.sizes, ["One Size"])[0] || "One Size",
      color: normalizeList(product.colors, ["Gold"])[0] || "Gold"
    };
  }

  function needsCatalogSelection(product) {
    return normalizeList(product.sizes, []).length > 1 || normalizeList(product.colors, []).length > 1;
  }

  function openOrAddCatalogProduct(button) {
    const card = button.closest(".shop-product");
    const product = getCatalogProductFromCard(card);
    if (!card || !product) return;

    const slug = product.slug || product.id;
    if (state.activeCatalogSlug === slug && card.classList.contains("shop-product--popover-open")) {
      closeCatalogPopover();
      return;
    }

    if (needsCatalogSelection(product)) {
      openCatalogPopover(card, product);
      return;
    }

    addCatalogProductToCart(product, getCatalogSelection(product));
    setButtonFlash(button, "Added");
  }

  function openCatalogPopover(card, product) {
    if (!card || !product) return;

    closeCatalogPopover();
    const slug = product.slug || product.id;
    const selection = getCatalogSelection(product);
    state.activeCatalogSlug = slug;
    state.catalogSelections[slug] = selection;

    const popover = card.querySelector(".shop-product__popover");
    if (!popover) return;

    popover.hidden = false;
    card.classList.add("shop-product--popover-open");
    popover.innerHTML = renderCatalogPopover(product, selection);
  }

  function closeCatalogPopover() {
    const openCards = document.querySelectorAll(".shop-product--popover-open");
    openCards.forEach((card) => {
      card.classList.remove("shop-product--popover-open");
      const popover = card.querySelector(".shop-product__popover");
      if (popover) {
        popover.hidden = true;
        popover.innerHTML = "";
      }
    });
    state.activeCatalogSlug = "";
  }

  function updateCatalogPopoverSelection(target) {
    const card = target.closest(".shop-product");
    const product = getCatalogProductFromCard(card);
    if (!card || !product) return;

    const slug = product.slug || product.id;
    const current = getCatalogSelection(product);
    const nextSelection = {
      ...current,
      [target.dataset.catalogOptionType]: target.dataset.value
    };

    state.catalogSelections[slug] = nextSelection;
    const popover = card.querySelector(".shop-product__popover");
    if (!popover || popover.hidden) return;
    popover.innerHTML = renderCatalogPopover(product, nextSelection);
  }

  function confirmCatalogSelection(button) {
    const card = button.closest(".shop-product");
    const product = getCatalogProductFromCard(card);
    if (!card || !product) return;

    const selection = getCatalogSelection(product);
    addCatalogProductToCart(product, selection);
    closeCatalogPopover();
    setButtonFlash(card.querySelector("[data-catalog-add]"), "Added");
  }

  function addCatalogProductToCart(product, selection = {}) {
    const size = selection.size || normalizeList(product.sizes, ["One Size"])[0] || "One Size";
    const color = selection.color || normalizeList(product.colors, ["Gold"])[0] || "Gold";
    const variant = [size, color].filter(Boolean).join(" · ") || "Selected options";

    addToCart({
      id: buildProductId(product.name, variant),
      name: product.name,
      image: product.image,
      priceCents: product.priceCents,
      quantity: 1,
      variant,
      source: "/catalog"
    });
  }

  function renderCatalogPopover(product, selection) {
    const sizes = normalizeList(product.sizes, ["One Size"]);
    const colors = normalizeList(product.colors, ["Gold"]);
    const hasMultipleSizes = sizes.length > 1;
    const hasMultipleColors = colors.length > 1;
    const sizeGroup = sizes.length > 1 ? `
      <div class="shop-product__popover-group">
        <span>Size</span>
        <div class="shop-product__popover-options">
          ${sizes.map((size) => `<button type="button" class="shop-chip${selection.size === size ? " shop-chip--active" : ""}" data-catalog-option data-catalog-option-type="size" data-value="${escapeHtml(size)}" aria-pressed="${selection.size === size ? "true" : "false"}">${escapeHtml(size)}</button>`).join("")}
        </div>
      </div>` : "";
    const colorGroup = colors.length > 1 ? `
      <div class="shop-product__popover-group">
        <span>Color</span>
        <div class="shop-product__popover-options">
          ${colors.map((color) => `<button type="button" class="shop-chip${selection.color === color ? " shop-chip--active" : ""}" data-catalog-option data-catalog-option-type="color" data-value="${escapeHtml(color)}" aria-pressed="${selection.color === color ? "true" : "false"}">${escapeHtml(color)}</button>`).join("")}
        </div>
      </div>` : "";

    return `
      <div class="shop-product__popover-panel">
        <div class="shop-product__popover-group">
          <span>Select options</span>
          <strong>${escapeHtml(product.name)}</strong>
        </div>
        ${sizeGroup}
        ${colorGroup}
        ${!hasMultipleSizes && !hasMultipleColors ? "" : `<p class="shop-product__popover-note">Your choices are applied to the cart item before checkout.</p>`}
        <div class="shop-product__popover-actions">
          <button class="button button--ghost" type="button" data-catalog-cancel>Cancel</button>
          <button class="button button--dark" type="button" data-catalog-confirm>Add To Cart</button>
        </div>
      </div>
    `;
  }

  function getBenefitCards(product) {
    const collections = normalizeList(product.collections, []);
    return {
      primary: normalizeText(product.benefitPrimaryText) || `${normalizeText(product.description) || "A polished piece"} that feels effortless to wear and easy to style every day.`,
      secondary: normalizeText(product.benefitSecondaryText) || (collections.includes("gift-sets")
        ? "Perfect for gifting, celebrations, and thoughtful moments that call for something special."
        : "Perfect for daily wear, layering, and keeping your look polished without trying too hard.")
    };
  }

  function findBenefitPresetValue(group, text) {
    const presets = BENEFIT_PRESETS[group] || {};
    const normalizedText = normalizeText(text);
    return Object.keys(presets).find((key) => normalizeText(presets[key]) === normalizedText) || "";
  }

  function toggleCollectionsMenu(toggleButton) {
    const form = toggleButton.closest(".admin-form");
    if (!form) return;

    const picker = form.querySelector('[data-admin-field="collectionsPicker"]');
    const menu = picker?.querySelector(".admin-multiselect__menu");
    if (!menu) return;

    const isOpen = toggleButton.getAttribute("aria-expanded") === "true";
    closeCollectionsMenu();
    if (!isOpen) openCollectionsMenu(form);
  }

  function openCollectionsMenu(form) {
    const picker = form?.querySelector('[data-admin-field="collectionsPicker"]');
    const toggleButton = picker?.querySelector("[data-admin-collections-toggle]");
    const menu = picker?.querySelector(".admin-multiselect__menu");
    if (!menu || !toggleButton) return;

    menu.hidden = false;
    picker.dataset.open = "true";
    toggleButton.setAttribute("aria-expanded", "true");
  }

  function closeCollectionsMenu(form = document.querySelector(".admin-form")) {
    const picker = form?.querySelector('[data-admin-field="collectionsPicker"]');
    const toggleButton = picker?.querySelector("[data-admin-collections-toggle]");
    const menu = picker?.querySelector(".admin-multiselect__menu");
    if (menu) menu.hidden = true;
    if (picker) delete picker.dataset.open;
    if (toggleButton) toggleButton.setAttribute("aria-expanded", "false");
  }

  function syncCollectionsState(form) {
    const fields = getAdminFields(form);
    const selected = fields.collectionOptions
      .filter((option) => option.checked)
      .map((option) => option.value);

    if (fields.collections) {
      fields.collections.value = selected.join(",");
    }

    if (fields.collectionsToggle) {
      fields.collectionsToggle.textContent = selected.length
        ? selected.map((value) => COLLECTION_LABELS[value] || value).join(", ")
        : "Select collections";
    }
  }

  function syncCollectionsPicker(form, selectedValues) {
    const fields = getAdminFields(form);
    const values = new Set(selectedValues);

    fields.collectionOptions.forEach((option) => {
      option.checked = values.has(option.value);
    });

    if (fields.collections) {
      fields.collections.value = Array.from(values).join(",");
    }

    if (fields.collectionsToggle) {
      const selectedLabels = Array.from(values).map((value) => COLLECTION_LABELS[value] || value);
      fields.collectionsToggle.textContent = selectedLabels.length ? selectedLabels.join(", ") : "Select collections";
    }
  }

  function syncBenefitPreset(form, target) {
    const fields = getAdminFields(form);
    const presetGroup = target.matches('[data-admin-field="benefitPrimaryPreset"]') ? "primary" : "secondary";
    const presetValue = target.value;
    const presets = BENEFIT_PRESETS[presetGroup];
    const textField = presetGroup === "primary" ? fields.benefitPrimaryText : fields.benefitSecondaryText;

    if (!presetValue || !textField || !presets[presetValue]) return;
    textField.value = presets[presetValue];
  }

  function getSelectedCollections(form) {
    const fields = getAdminFields(form);
    return fields.collectionOptions.filter((option) => option.checked).map((option) => option.value);
  }

  function populateAdminForm(item) {
    const form = document.querySelector(".admin-form");
    if (!form || !item) return;

    const fields = getAdminFields(form);
    if (fields.name) fields.name.value = item.name;
    if (fields.imageUrl) fields.imageUrl.value = item.image || item.imageUrl || "";
    if (fields.imageFile) fields.imageFile.value = "";
    if (fields.skuDisplay) fields.skuDisplay.textContent = item.sku || generateSku(item.name);
    if (fields.category) fields.category.value = item.category;
    if (fields.sizes) fields.sizes.value = normalizeList(item.sizes, []).join(", ");
    if (fields.colors) fields.colors.value = normalizeList(item.colors, []).join(", ");
    syncCollectionsPicker(form, normalizeList(item.collections, []));
    if (fields.benefitPrimaryText) fields.benefitPrimaryText.value = item.benefitPrimaryText || getBenefitCards(item).primary;
    if (fields.benefitSecondaryText) fields.benefitSecondaryText.value = item.benefitSecondaryText || getBenefitCards(item).secondary;
    if (fields.benefitPrimaryPreset) fields.benefitPrimaryPreset.value = findBenefitPresetValue("primary", fields.benefitPrimaryText.value);
    if (fields.benefitSecondaryPreset) fields.benefitSecondaryPreset.value = findBenefitPresetValue("secondary", fields.benefitSecondaryText.value);
    if (fields.price) fields.price.value = formatMoney(item.priceCents);
    if (fields.stock) fields.stock.value = String(item.stock);
    if (fields.description) fields.description.value = item.description;
    const preview = form.querySelector('[data-admin-preview="image"]');
    if (preview) {
      const pendingForItem = pendingImageUpload && pendingImageUpload.itemId === item.id ? pendingImageUpload.dataUrl : null;
      preview.src = pendingForItem || item.image || item.imageUrl || preview.src;
    }
  }

  function getAdminFields(form) {
    return {
      name: form.querySelector('[data-admin-field="name"]'),
      imageFile: form.querySelector('[data-admin-field="imageFile"]'),
      imageUrl: form.querySelector('[data-admin-field="imageUrl"]'),
      skuDisplay: form.querySelector('[data-admin-field="skuDisplay"]'),
      category: form.querySelector('[data-admin-field="category"]'),
      sizes: form.querySelector('[data-admin-field="sizes"]'),
      colors: form.querySelector('[data-admin-field="colors"]'),
      collections: form.querySelector('[data-admin-field="collections"]'),
      collectionsPicker: form.querySelector('[data-admin-field="collectionsPicker"]'),
      collectionsToggle: form.querySelector('[data-admin-collections-toggle]'),
      collectionOptions: Array.from(form.querySelectorAll('[data-admin-collection-option]')),
      benefitPrimaryPreset: form.querySelector('[data-admin-field="benefitPrimaryPreset"]'),
      benefitSecondaryPreset: form.querySelector('[data-admin-field="benefitSecondaryPreset"]'),
      benefitPrimaryText: form.querySelector('[data-admin-field="benefitPrimaryText"]'),
      benefitSecondaryText: form.querySelector('[data-admin-field="benefitSecondaryText"]'),
      price: form.querySelector('[data-admin-field="price"]'),
      stock: form.querySelector('[data-admin-field="stock"]'),
      description: form.querySelector('[data-admin-field="description"]')
    };
  }

  async function saveSelectedInventoryItem() {
    const form = document.querySelector(".admin-form");
    const item = getSelectedInventoryItem();
    if (!form || !item) return;

    const fields = getAdminFields(form);
    item.name = fields.name?.value.trim() || item.name;
    item.sku = item.sku || generateSku(item.name);
    item.category = fields.category?.value.trim() || item.category;
    item.sizes = parseListField(fields.sizes?.value, item.sizes);
    item.colors = parseListField(fields.colors?.value, item.colors);
    item.collections = getSelectedCollections(form);
    item.benefitPrimaryText = normalizeText(fields.benefitPrimaryText?.value) || item.benefitPrimaryText || getBenefitCards(item).primary;
    item.benefitSecondaryText = normalizeText(fields.benefitSecondaryText?.value) || item.benefitSecondaryText || getBenefitCards(item).secondary;
    item.priceCents = parseMoney(fields.price?.value || item.priceCents);
    item.stock = clampStock(Number(fields.stock?.value || item.stock));
    item.status = resolveStatus(item.stock);
    item.description = fields.description?.value.trim() || item.description;
    item.image = await resolveAdminImage(fields, item);

    pendingImageUpload = null;
    persistInventory();
    renderAdminPage();
    showToast("Inventory item updated.");
  }

  async function resolveAdminImage(fields, item) {
    const fallbackUrl = fields.imageUrl?.value.trim() || item.image || item.imageUrl || "";

    if (!pendingImageUpload || pendingImageUpload.itemId !== item.id) {
      return fallbackUrl;
    }

    const uploaded = await uploadAdminImage(pendingImageUpload).catch(() => null);
    return uploaded?.url || pendingImageUpload.dataUrl || fallbackUrl;
  }

  async function uploadAdminImage(upload) {
    const response = await fetch(`${API_BASE}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        data: upload.dataUrl
      })
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const payload = await response.json();
    return {
      ...payload,
      url: `${API_BASE}${payload.url}`
    };
  }

  function handleAdminAction(action) {
    switch (action) {
      case "save":
        void saveSelectedInventoryItem();
        break;
      case "duplicate":
        duplicateSelectedInventoryItem();
        break;
      case "update":
        void saveSelectedInventoryItem();
        break;
      case "add":
        addInventoryItem();
        break;
      case "delete":
        void deleteSelectedInventoryItem();
        break;
      case "export":
        exportInventoryCsv();
        break;
      default:
        break;
    }
  }

  function duplicateSelectedInventoryItem() {
    const item = getSelectedInventoryItem();
    if (!item) return;

    const duplicate = {
      ...structuredClone(item),
      id: `${item.id}-copy`,
      sku: generateSku(`${item.name} copy`),
      name: `${item.name} Copy`,
      stock: item.stock,
      active: item.active
    };

    state.inventory.unshift(duplicate);
    state.selectedInventoryId = duplicate.id;
    persistInventory();
    renderAdminPage();
    showToast("Product duplicated.");
  }

  function addInventoryItem() {
    const seed = createInventorySeed();
    state.inventory.unshift(seed);
    state.selectedInventoryId = seed.id;
    persistInventory();
    renderAdminPage();
    showToast("New product added.");
  }

  async function deleteSelectedInventoryItem() {
    const item = getSelectedInventoryItem();
    if (!item) return;

    try {
      await fetch(`${API_BASE}/inventory/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    } catch {
      // Local state still updates below.
    }

    state.inventory = state.inventory.filter((entry) => entry.id !== item.id);
    state.selectedInventoryId = state.inventory[0]?.id || null;
    persistInventory();
    renderAdminPage();
    renderStorefrontPages();
    showToast("Product deleted.");
  }

  function adjustInventoryStock(itemId, delta) {
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item) return;

    item.stock = clampStock(item.stock + delta);
    item.status = resolveStatus(item.stock);
    persistInventory();
    renderAdminPage();
  }

  function selectInventoryItem(itemId) {
    state.selectedInventoryId = itemId;
    renderAdminPage();
  }

  function syncSelectedAdminRow() {
    const rows = document.querySelectorAll(".admin-table__row[data-admin-id]");
    rows.forEach((row) => {
      row.classList.toggle("admin-table__row--selected", row.dataset.adminId === state.selectedInventoryId);
    });
  }

  function getSelectedInventoryItem() {
    return state.inventory.find((item) => item.id === state.selectedInventoryId) || state.inventory[0] || null;
  }

  function createInventorySeed() {
    const seedId = `PJ-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return {
      id: seedId,
      sku: generateSku("New Product"),
      name: "New Product",
      category: "Rings",
      status: "In Stock",
      stock: 1,
      priceCents: 29900,
      description: "Fresh inventory item ready for merchandising.",
      image: "/assets/Vector.png",
      sizes: ["S", "M", "L"],
      colors: ["Gold"],
      collections: ["new-arrivals"],
      benefitPrimaryText: BENEFIT_PRESETS.primary.everyday,
      benefitSecondaryText: BENEFIT_PRESETS.secondary["daily-wear"],
      active: true
    };
  }

  function normalizeOrderRecord(order) {
    return {
      ...order,
      id: String(order.id || ""),
      txRef: String(order.txRef || ""),
      cartId: String(order.cartId || ""),
      status: String(order.status || "pending"),
      amountCents: Math.max(0, Math.round(Number(order.amountCents || 0))),
      createdAt: String(order.createdAt || ""),
      customer: order.customer || {},
      items: Array.isArray(order.items) ? order.items : []
    };
  }

  function persistOrdersCache() {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(state.orders));
  }

  function exportInventoryCsv() {
    const header = ["id", "sku", "name", "category", "status", "stock", "price", "sizes", "colors", "collections", "description"];
    const rows = [header.join(",")];
    state.inventory.forEach((item) => {
      rows.push([
        csvEscape(item.id),
        csvEscape(item.sku),
        csvEscape(item.name),
        csvEscape(item.category),
        csvEscape(item.status),
        csvEscape(String(item.stock)),
        csvEscape(formatMoney(item.priceCents)),
        csvEscape(normalizeList(item.sizes, []).join("|")),
        csvEscape(normalizeList(item.colors, []).join("|")),
        csvEscape(normalizeList(item.collections, []).join("|")),
        csvEscape(item.description)
      ].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "peacejewel-inventory.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Inventory exported.");
  }

  function addToCart(product) {
    if (!product) return;

    const cart = readJson(STORAGE_KEYS.cart, []);
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        image: product.image,
        priceCents: product.priceCents,
        quantity: 1,
        variant: product.variant,
        source: product.source
      });
    }

    state.cart = cart;
    persistCart();
    renderCartPage();
    renderCheckoutPage();
    updateCartBadge();
    showToast(`${product.name} added to cart.`);
  }

  function changeCartQuantity(itemId, delta) {
    const item = state.cart.find((entry) => entry.id === itemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter((entry) => entry.id !== itemId);
    }

    persistCart();
    renderCartPage();
    renderCheckoutPage();
    updateCartBadge();
  }

  function removeCartItem(itemId) {
    state.cart = state.cart.filter((entry) => entry.id !== itemId);
    persistCart();
    renderCartPage();
    renderCheckoutPage();
    updateCartBadge();
  }

  async function completeOrder(form) {
    if (!state.cart.length) {
      showToast("Your bag is empty.");
      return;
    }

    const formData = new FormData(form);
    const customer = buildCheckoutCustomer(formData);

    try {
      const response = await fetch(`${API_BASE}/checkout/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: getCartId(),
          items: state.cart.map(normalizeCartRecord),
          customer,
          currency: "NGN"
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Unable to start secure checkout.");
      }

      if (payload.order) {
        localStorage.setItem(STORAGE_KEYS.order, JSON.stringify(payload.order));
      }

      if (!payload.paymentLink) {
        throw new Error("Payment link was not returned.");
      }

      window.location.assign(payload.paymentLink);
    } catch (error) {
      showToast(error.message || "Unable to start checkout.");
    }
  }

  function getCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    return {
      subtotal,
      shipping: 0,
      total: subtotal
    };
  }

  function extractProductFromButton(button) {
    const productPage = button.closest(".product-page");
    if (productPage) {
      const name = normalizeText(productPage.querySelector(".product-page__content h1")?.textContent || "Product");
      const priceText = normalizeText(productPage.querySelector(".product-page__price-row span")?.textContent || "0");
      const image = productPage.querySelector(".product-page__media img")?.getAttribute("src") || "";
      const size = normalizeText(productPage.querySelector('.product-page__options [data-selected-group="size"]')?.textContent || getActiveChipText(productPage, "Size"));
      const color = normalizeText(productPage.querySelector('.product-page__options [data-selected-group="color"]')?.textContent || getActiveChipText(productPage, "Color"));
      const variant = [size, color].filter(Boolean).join(" · ");

      return {
        id: buildProductId(name, variant || priceText),
        name,
        image,
        priceCents: parseMoney(priceText),
        variant: variant || "Selected options",
        source: "/product"
      };
    }

    const collectionRow = button.closest(".collection-row");
    if (collectionRow) {
      const name = normalizeText(collectionRow.querySelector(".collection-row__headline h2")?.textContent || "Product");
      const priceText = normalizeText(collectionRow.querySelector(".price")?.textContent || "0");
      const image = collectionRow.querySelector(".collection-row__media img")?.getAttribute("src") || "";
      return {
        id: buildProductId(name, priceText),
        name,
        image,
        priceCents: parseMoney(priceText),
        variant: "Featured selection",
        source: "/"
      };
    }

    const shopProduct = button.closest(".shop-product");
    if (shopProduct) {
      const name = normalizeText(shopProduct.querySelector("h3")?.textContent || "Product");
      const priceText = normalizeText(shopProduct.querySelector(".shop-product__meta strong")?.textContent || "0");
      const image = shopProduct.querySelector("img")?.getAttribute("src") || "";
      const label = normalizeText(shopProduct.querySelector(".shop-product__meta span")?.textContent || "Selected");
      return {
        id: buildProductId(name, label),
        name,
        image,
        priceCents: parseMoney(priceText),
        variant: label,
        source: "/catalog"
      };
    }

    return null;
  }

  function getActiveChipText(productPage, labelText) {
    const groups = Array.from(productPage.querySelectorAll(".product-page__options > div"));
    const group = groups.find((node) => normalizeText(node.querySelector(".eyebrow")?.textContent || "") === labelText);
    if (!group) return "";
    const activeChip = group.querySelector(".shop-chip--active");
    return normalizeText(activeChip?.textContent || "");
  }

  function updateCartBadge() {
    const cartLink = document.querySelector('.site-actions .icon-button[href="/cart"]');
    if (!cartLink) return;

    let badge = cartLink.querySelector(".site-cart-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "site-cart-count";
      cartLink.appendChild(badge);
    }

    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function enhanceCartBadge() {
    const cartLink = document.querySelector('.site-actions .icon-button[href="/cart"]');
    if (cartLink) {
      cartLink.classList.add("site-cart-link");
    }
  }

  function setButtonFlash(button, label) {
    if (!button) return;
    const originalText = button.textContent;
    button.textContent = label;
    window.clearTimeout(button.__flashTimer);
    button.__flashTimer = window.setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  }

  function resolveStatus(stock) {
    if (stock <= 0) return "Out of Stock";
    if (stock <= 5) return "Low Stock";
    return "In Stock";
  }

  function clampStock(stock) {
    return Math.max(0, Math.trunc(Number(stock) || 0));
  }

  function persistCart() {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
    void syncCartToApi();
  }

  function persistCartCache() {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
  }

  function getCartId() {
    let cartId = localStorage.getItem(STORAGE_KEYS.cartId);
    if (!cartId) {
      cartId = generateCartId();
      localStorage.setItem(STORAGE_KEYS.cartId, cartId);
    }

    return cartId;
  }

  function persistInventory() {
    const normalized = state.inventory.map(normalizeInventoryRecord);
    state.inventory = normalized;
    persistInventoryCache();
    void syncInventoryToApi(normalized);
  }

  function persistInventoryCache() {
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(state.inventory));
  }

  async function syncCartToApi() {
    try {
      await fetch(`${API_BASE}/cart-state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: getCartId(),
          items: state.cart.map(normalizeCartRecord)
        })
      });
    } catch {
      // Local fallback remains in place.
    }
  }

  async function syncInventoryToApi(nextInventory) {
    try {
      await fetch(`${API_BASE}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory: nextInventory })
      });
    } catch {
      // local fallback remains in place
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(fallback);
      return JSON.parse(raw);
    } catch {
      return structuredClone(fallback);
    }
  }

  function normalizeInventoryRecord(item) {
    const stock = clampStock(item.stock);
    const rawImage = item.image || item.imageUrl || "/assets/Vector.png";
    const image = rawImage.startsWith("/uploads/") ? `${API_BASE}${rawImage}` : rawImage;
    const priceCents = Number.isFinite(Number(item.priceCents))
      ? Math.round(Number(item.priceCents))
      : parseMoney(item.price || 0);

    return {
      ...item,
      image,
      imageUrl: image,
      priceCents,
      stock,
      status: item.status || resolveStatus(stock),
      active: item.active !== false,
      sizes: normalizeList(item.sizes, ["S", "M", "L"]),
      colors: normalizeList(item.colors, ["Gold"]),
      collections: normalizeList(item.collections, [])
    };
  }

  function normalizeCartRecord(item) {
    return {
      id: String(item.id || ""),
      name: String(item.name || "Product"),
      image: String(item.image || item.imageUrl || "/assets/Vector.png"),
      priceCents: Math.max(0, Math.round(Number(item.priceCents ?? item.price ?? 0))),
      quantity: Math.max(1, clampStock(item.quantity || 1)),
      variant: String(item.variant || ""),
      source: String(item.source || "")
    };
  }

  function buildCheckoutCustomer(formData) {
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    return {
      name: [firstName, lastName].filter(Boolean).join(" ") || "PeaceJewel Customer",
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      firstName,
      lastName,
      address: String(formData.get("address") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      postalCode: String(formData.get("postalCode") || "").trim(),
      country: String(formData.get("country") || "").trim()
    };
  }

  function applyCheckoutStatus() {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const txRef = params.get("tx_ref");

    if (payment === "success") {
      state.cart = [];
      persistCartCache();
      void syncCartToApi();
      renderCartPage();
      renderCheckoutPage();
      updateCartBadge();

      const checkoutSummary = document.querySelector(".checkout-summary");
      if (checkoutSummary) {
        checkoutSummary.innerHTML = `
          <p class="eyebrow">Payment Confirmed</p>
          <h3>Thanks — your order is confirmed.</h3>
          <p class="checkout-summary__trust">Reference ${escapeHtml(txRef || "pending")} has been saved in your order history.</p>
          <a class="button button--dark checkout-summary__submit" href="/catalog">Continue Shopping</a>
        `;
      }
    }

    if (payment === "failed") {
      showToast("Payment verification failed. Please try again.");
    }
  }

  function normalizeList(value, fallback = []) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return structuredClone(fallback);
  }

  function parseListField(value, fallback = []) {
    const parsed = normalizeList(value, fallback);
    return parsed.length ? parsed : structuredClone(fallback);
  }

  function parseMoney(value) {
    if (typeof value === "number") return Math.round(value);
    const clean = String(value).replace(/[^0-9.]/g, "");
    const number = Number.parseFloat(clean || "0");
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }

  function formatMoney(cents) {
    return `₦${(Number(cents || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function buildProductId(name, variant) {
    return [name, variant]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function generateCartId() {
    if (window.crypto?.randomUUID) {
      return `CART-${window.crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    }

    return `CART-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function generateSku(name) {
    const prefix = normalizeText(name).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "PJ";
    return `PJ-${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function csvEscape(value) {
    return `"${String(value || "").replaceAll('"', '""')}"`;
  }

  function showToast(message) {
    let toast = document.querySelector(".store-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "store-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("store-toast--visible");

    window.clearTimeout(toast.__hideTimer);
    toast.__hideTimer = window.setTimeout(() => {
      toast.classList.remove("store-toast--visible");
    }, 1800);
  }
})();
