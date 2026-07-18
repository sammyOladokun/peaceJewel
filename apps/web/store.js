(function () {
  const STORAGE_KEYS = {
    cart: "peacejewel.cart.v1",
    inventory: "peacejewel.inventory.v1",
    order: "peacejewel.order.v1"
  };

  const DEFAULT_INVENTORY = [
    {
      id: "PJ-001",
      sku: "PJ-001",
      name: "Classic Gold Ring",
      category: "Rings",
      status: "In Stock",
      stock: 18,
      price: 34900,
      description: "A polished everyday ring with premium shine and a clean finish.",
      image: "/assets/Vector.png",
      active: true
    },
    {
      id: "PJ-002",
      sku: "PJ-002",
      name: "Diamond Accent Ring",
      category: "Rings",
      status: "Low Stock",
      stock: 4,
      price: 42900,
      description: "A luminous statement ring made for gifting and special moments.",
      image: "/assets/Vector(1).png",
      active: true
    },
    {
      id: "PJ-003",
      sku: "PJ-003",
      name: "Woven Chain Bracelet",
      category: "Bracelets",
      status: "In Stock",
      stock: 11,
      price: 54929,
      description: "A textured woven bracelet with a stronger, modern silhouette.",
      image: "/assets/Vector(2).png",
      active: true
    },
    {
      id: "PJ-004",
      sku: "PJ-004",
      name: "Black Coral Ring",
      category: "Rings",
      status: "Out of Stock",
      stock: 0,
      price: 32029,
      description: "A bold ring with refined contrast and premium everyday appeal.",
      image: "/assets/Vector(3).png",
      active: true
    }
  ];

  const state = {
    cart: readJson(STORAGE_KEYS.cart, []),
    inventory: readJson(STORAGE_KEYS.inventory, DEFAULT_INVENTORY),
    selectedInventoryId: null
  };

  init();

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("submit", handleDocumentSubmit);
  window.addEventListener("storage", handleStorageEvent);

  function init() {
    enhanceCartBadge();
    renderAll();
    mountCatalogActions();
    mountProductPage();
    mountCartPage();
    mountCheckoutPage();
    mountAdminPage();
  }

  function renderAll() {
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
      state.inventory = readJson(STORAGE_KEYS.inventory, DEFAULT_INVENTORY);
      renderAdminPage();
    }
  }

  function handleDocumentClick(event) {
    const actionButton = event.target.closest("button");

    if (actionButton) {
      if (actionButton.matches(".site-cart-count")) {
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

      if (actionButton.matches(".shop-chip")) {
        const chipGroup = actionButton.closest(".product-page__options");
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
      saveSelectedInventoryItem();
    }
  }

  function mountCatalogActions() {
    const catalogShell = document.querySelector(".shop-shell");
    if (!catalogShell) return;
    updateCartBadge();
  }

  function mountProductPage() {
    const productPage = document.querySelector(".product-page");
    if (!productPage) return;

    const priceRow = productPage.querySelector(".product-page__price-row");
    if (priceRow) {
      priceRow.setAttribute("aria-label", "Product price");
    }
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
  }

  function mountAdminPage() {
    const adminGrid = document.querySelector(".admin-grid");
    if (!adminGrid) return;

    state.inventory = readJson(STORAGE_KEYS.inventory, DEFAULT_INVENTORY);
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

  function renderAdminPage() {
    const adminGrid = document.querySelector(".admin-grid");
    if (!adminGrid) return;

    const table = document.querySelector(".admin-table");
    const stats = Array.from(document.querySelectorAll(".admin-stat strong"));
    const alertsList = document.querySelector(".admin-list");
    const form = document.querySelector(".admin-form");

    if (!state.inventory.length) {
      state.inventory = structuredClone(DEFAULT_INVENTORY);
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
      const lowStockItems = state.inventory.filter((item) => item.stock > 0 && item.stock <= 5).length;
      const outOfStock = state.inventory.filter((item) => item.stock <= 0).length;
      const weeklyOrders = Math.max(42, state.inventory.reduce((sum, item) => sum + item.stock, 0) * 2);

      stats[0].textContent = String(activeSkus).padStart(2, "0");
      stats[1].textContent = String(lowStockItems).padStart(2, "0");
      stats[2].textContent = String(outOfStock).padStart(2, "0");
      stats[3].textContent = String(weeklyOrders);
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

  function buildAlerts() {
    return state.inventory
      .filter((item) => item.stock <= 5)
      .map((item) => ({
        name: item.name,
        message: item.stock <= 0 ? "Inventory reached zero today." : `Reorder soon — ${item.stock} units left.`
      }));
  }

  function populateAdminForm(item) {
    const form = document.querySelector(".admin-form");
    if (!form || !item) return;

    const fields = getAdminFields(form);
    if (fields.name) fields.name.value = item.name;
    if (fields.sku) fields.sku.value = item.sku;
    if (fields.category) fields.category.value = item.category;
    if (fields.price) fields.price.value = formatMoney(item.priceCents);
    if (fields.stock) fields.stock.value = String(item.stock);
    if (fields.description) fields.description.value = item.description;
  }

  function getAdminFields(form) {
    return {
      name: form.querySelector('[data-admin-field="name"]'),
      sku: form.querySelector('[data-admin-field="sku"]'),
      category: form.querySelector('[data-admin-field="category"]'),
      price: form.querySelector('[data-admin-field="price"]'),
      stock: form.querySelector('[data-admin-field="stock"]'),
      description: form.querySelector('[data-admin-field="description"]')
    };
  }

  function saveSelectedInventoryItem() {
    const form = document.querySelector(".admin-form");
    const item = getSelectedInventoryItem();
    if (!form || !item) return;

    const fields = getAdminFields(form);
    item.name = fields.name?.value.trim() || item.name;
    item.sku = fields.sku?.value.trim() || item.sku;
    item.category = fields.category?.value.trim() || item.category;
    item.priceCents = parseMoney(fields.price?.value || item.priceCents);
    item.stock = clampStock(Number(fields.stock?.value || item.stock));
    item.status = resolveStatus(item.stock);
    item.description = fields.description?.value.trim() || item.description;

    persistInventory();
    renderAdminPage();
    showToast("Inventory item updated.");
  }

  function handleAdminAction(action) {
    switch (action) {
      case "save":
        persistInventory();
        showToast("Inventory saved.");
        break;
      case "duplicate":
        duplicateSelectedInventoryItem();
        break;
      case "update":
        saveSelectedInventoryItem();
        break;
      case "add":
        addInventoryItem();
        break;
      case "archive":
        archiveSelectedInventoryItem();
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
      sku: `${item.sku}-COPY`,
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

  function archiveSelectedInventoryItem() {
    const item = getSelectedInventoryItem();
    if (!item) return;

    state.inventory = state.inventory.filter((entry) => entry.id !== item.id);
    state.selectedInventoryId = state.inventory[0]?.id || null;
    persistInventory();
    renderAdminPage();
    showToast("Product archived.");
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
    const index = state.inventory.length + 1;
    return {
      id: `PJ-${String(index).padStart(3, "0")}`,
      sku: `PJ-${String(index).padStart(3, "0")}`,
      name: "New Product",
      category: "Rings",
      status: "In Stock",
      stock: 1,
      priceCents: 29900,
      description: "Fresh inventory item ready for merchandising.",
      image: "/assets/Vector.png",
      active: true
    };
  }

  function exportInventoryCsv() {
    const header = ["id", "sku", "name", "category", "status", "stock", "price", "description"];
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

  function completeOrder(form) {
    if (!state.cart.length) {
      showToast("Your bag is empty.");
      return;
    }

    const formData = new FormData(form);
    const order = {
      id: `PJ-ORD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      total: getCartTotals().total,
      items: structuredClone(state.cart),
      customer: Object.fromEntries(formData.entries())
    };

    localStorage.setItem(STORAGE_KEYS.order, JSON.stringify(order));
    state.cart = [];
    persistCart();
    renderCartPage();
    renderCheckoutPage();
    updateCartBadge();

    const checkoutSummary = document.querySelector(".checkout-summary");
    if (checkoutSummary) {
      checkoutSummary.innerHTML = `
        <p class="eyebrow">Order Confirmed</p>
        <h3>Thanks — your order is in motion.</h3>
        <p class="checkout-summary__trust">We’ve saved your order details and cleared your bag.</p>
        <a class="button button--dark checkout-summary__submit" href="/catalog">Continue Shopping</a>
      `;
    }

    showToast("Order placed successfully.");
    form.reset();
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
  }

  function persistInventory() {
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(state.inventory));
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

  function parseMoney(value) {
    if (typeof value === "number") return Math.round(value);
    const clean = String(value).replace(/[^0-9.]/g, "");
    const number = Number.parseFloat(clean || "0");
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }

  function formatMoney(cents) {
    return (Number(cents || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function buildProductId(name, variant) {
    return [name, variant]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
