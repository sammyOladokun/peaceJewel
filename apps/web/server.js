const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const assetsDir = path.join(rootDir, "..", "..", "assets");
const inventoryPath = path.join(rootDir, "..", "api", "storage", "inventory.json");

const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const catalogHtml = fs.readFileSync(path.join(rootDir, "catalog.html"), "utf8");
const productHtml = fs.readFileSync(path.join(rootDir, "product.html"), "utf8");
const cartHtml = fs.readFileSync(path.join(rootDir, "cart.html"), "utf8");
const checkoutHtml = fs.readFileSync(path.join(rootDir, "checkout.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(rootDir, "admin.html"), "utf8");
const adminLoginHtml = fs.readFileSync(path.join(rootDir, "admin-login.html"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "styles.css"), "utf8");
const homepageJs = fs.readFileSync(path.join(rootDir, "homepage.js"), "utf8");
const menuJs = fs.readFileSync(path.join(rootDir, "menu.js"), "utf8");
const storeJs = fs.readFileSync(path.join(rootDir, "store.js"), "utf8");
const adminKey = process.env.ADMIN_KEY || "peacejewel-admin";
const adminSessionToken = crypto.randomBytes(24).toString("hex");
const clientApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "").replace(/\/+$/, "");
const serverApiBaseUrl = (process.env.API_INTERNAL_URL || clientApiBaseUrl).replace(/\/+$/, "");

const categoryPages = {
  "new-arrivals": {
    title: "New Arrivals",
    eyebrow: "New Arrivals",
    heading: "Fresh pieces for now.",
    description: "Discover the newest jewelry drops with the same PeaceJewel polish — easy to wear, easy to gift, and ready to add to cart.",
    label: "New"
  },
  "mens-collection": {
    title: "Men's Collection",
    eyebrow: "Men's Collection",
    heading: "Clean lines, bold finish.",
    description: "A refined edit of bracelets and rings with a more grounded feel, designed for everyday wear and statement gifting.",
    label: "Men's"
  },
  "womens-collection": {
    title: "Women's Collection",
    eyebrow: "Women's Collection",
    heading: "Soft shine, strong presence.",
    description: "Elegant rings and layered pieces made to feel delicate at first glance and premium in every detail.",
    label: "Women’s"
  },
  "gift-sets": {
    title: "Gift Sets",
    eyebrow: "Gift Sets",
    heading: "Easy wins for gifting.",
    description: "Curated pairings and ready-to-give jewelry picks made for birthdays, anniversaries, and thoughtful surprises.",
    label: "Gift"
  },
  "best-sellers": {
    title: "Best Sellers",
    eyebrow: "Best Sellers",
    heading: "The pieces people keep choosing.",
    description: "Our most-loved jewelry, selected for daily wearability, gifting appeal, and timeless polish.",
    label: "Top"
  }
};

const server = http.createServer(async (request, response) => {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (requestPath === "/catalog" || requestPath === "/catalog/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderCatalogIndexPage(await loadInventorySnapshot()));
    return;
  }

  if (requestPath.startsWith("/catalog/") && requestPath !== "/catalog/") {
    const slug = requestPath.replace("/catalog/", "");
    const page = categoryPages[slug];
    const inventory = await loadInventorySnapshot();

    if (!page) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderCategoryPage(page, inventory));
    return;
  }

  if (requestPath === "/product") {
    const inventory = await loadInventorySnapshot();
    const product = resolveProductFromRequest(request.url, inventory);
    if (!product) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderProductPage(product, inventory));
    return;
  }

  if (requestPath === "/cart") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(cartHtml);
    return;
  }

  if (requestPath === "/checkout") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(checkoutHtml);
    return;
  }

  if (requestPath === "/admin/inventory") {
    if (!isAdminAuthenticated(request.headers.cookie)) {
      response.writeHead(302, { Location: "/admin-login" });
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const filter = url.searchParams.get("filter") || "all";
    const query = url.searchParams.get("q") || "";
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderAdminInventoryPage(await loadInventorySnapshot(), filter, query));
    return;
  }

  if (requestPath === "/admin/orders") {
    if (!isAdminAuthenticated(request.headers.cookie)) {
      response.writeHead(302, { Location: "/admin-login" });
      response.end();
      return;
    }

    const [inventory, orders] = await Promise.all([loadInventorySnapshot(), loadOrdersSnapshot()]);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderAdminOrdersPage(orders, inventory));
    return;
  }

  if (requestPath === "/admin/alerts") {
    if (!isAdminAuthenticated(request.headers.cookie)) {
      response.writeHead(302, { Location: "/admin-login" });
      response.end();
      return;
    }

    const [inventory, orders] = await Promise.all([loadInventorySnapshot(), loadOrdersSnapshot()]);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderAdminAlertsPage(buildAdminAlerts(inventory, orders), inventory, orders));
    return;
  }

  if (requestPath === "/admin") {
    if (!isAdminAuthenticated(request.headers.cookie)) {
      response.writeHead(302, { Location: "/admin-login" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(adminHtml);
    return;
  }

  if (requestPath === "/admin/add" || requestPath === "/admin/edit") {
    if (!isAdminAuthenticated(request.headers.cookie)) {
      response.writeHead(302, { Location: "/admin-login" });
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const mode = requestPath === "/admin/add" ? "add" : "edit";
    const inventory = await loadInventorySnapshot();
    const item = mode === "add"
      ? createAdminEditorSeed()
      : resolveAdminEditorItem(url, inventory);

    if (mode === "edit" && !item) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Product not found");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderAdminEditorPage(mode, item));
    return;
  }

  if (requestPath === "/admin-login") {
    if (request.method === "POST") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const form = new URLSearchParams(body);
        const submittedKey = form.get("adminKey") || "";

        if (submittedKey === adminKey) {
          response.writeHead(302, {
            "Set-Cookie": `pj_admin=${adminSessionToken}; HttpOnly; Path=/; SameSite=Lax`,
            Location: "/admin"
          });
          response.end();
          return;
        }

        response.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
        response.end(renderAdminLoginPage("Incorrect admin key. Please try again."));
      });
      return;
    }

    if (request.method === "GET") {
      if (isAdminAuthenticated(request.headers.cookie)) {
        response.writeHead(302, { Location: "/admin" });
        response.end();
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(adminLoginHtml);
      return;
    }

    response.writeHead(405, { Allow: "GET, POST" });
    response.end("Method not allowed");
    return;
  }

  if (requestPath === "/styles.css") {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
    response.end(css);
    return;
  }

  if (requestPath === "/menu.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(menuJs);
    return;
  }

  if (requestPath === "/homepage.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(homepageJs);
    return;
  }

  if (requestPath === "/store.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(storeJs);
    return;
  }

  if (requestPath === "/favicon.svg") {
    response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
    response.end(fs.readFileSync(path.join(rootDir, "favicon.svg"), "utf8"));
    return;
  }

  if (requestPath.startsWith("/assets/")) {
    const filename = decodeURIComponent(requestPath.replace("/assets/", ""));
    const filePath = path.join(assetsDir, filename);

    if (!filePath.startsWith(assetsDir) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": getMimeType(filePath)
    });
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Web app running on http://localhost:${port}`);
});

function getMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".css":
      return "text/css; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function isAdminAuthenticated(cookieHeader = "") {
  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((accumulator, cookie) => {
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex === -1) return accumulator;
      const name = cookie.slice(0, separatorIndex).trim();
      const value = cookie.slice(separatorIndex + 1).trim();
      accumulator[name] = value;
      return accumulator;
    }, {});

  return cookies.pj_admin === adminSessionToken;
}

function renderAdminLoginPage(message) {
  return adminLoginHtml.replace(
    '<p class="admin-login__message">Use the admin key to enter the inventory dashboard.</p>',
    `<p class="admin-login__message admin-login__message--error">${message}</p>`
  );
}

function renderAdminEditorPage(mode, item) {
  const isAddMode = mode === "add";
  const selectedCollections = normalizeList(item.collections, []);
  const selectedSizes = normalizeList(item.sizes, []);
  const selectedColors = normalizeList(item.colors, []);
  const selectedCategory = String(item.category || "Rings");
  const benefitPrimary = String(item.benefitPrimaryText || "").trim() || getBenefitCards(item).primary;
  const benefitSecondary = String(item.benefitSecondaryText || "").trim() || getBenefitCards(item).secondary;
  const previewImage = String(item.image || item.imageUrl || "").trim();
  const title = isAddMode ? "Add Product" : "Edit Product";
  const heading = isAddMode ? "Add a new item." : "Edit this item.";
  const note = isAddMode
    ? "Create a fresh inventory record, upload the product image, and save it to Neon."
    : "Adjust product details, prices, stock, and imagery for this inventory item.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel Admin — ${escapeHtml(title)}</title>
    <meta name="description" content="PeaceJewel admin product form." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/" aria-label="PeaceJewel home">PJ</a>
        <nav class="site-nav" id="site-nav">
          <a href="/admin">Dashboard</a>
          <a href="/admin/inventory">Inventory</a>
          <a href="/admin/orders">Orders</a>
          <a href="/admin/alerts">Alerts</a>
          <a href="/catalog">View Store</a>
        </nav>
        <div class="site-actions" aria-label="Utilities">
          <button class="icon-button site-menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <main class="landing-shell shop-shell admin-shell">
      <section class="shop-toolbar admin-toolbar">
        <div>
          <p class="eyebrow">Admin Inventory</p>
          <h2>${escapeHtml(heading)}</h2>
          <p class="admin-toolbar__note">${escapeHtml(note)}</p>
        </div>
        <div class="admin-toolbar__actions">
          <a class="button button--ghost" href="/admin">Back to dashboard</a>
          <button class="button button--dark" type="button" data-admin-action="update">${isAddMode ? "Add Item" : "Update Item"}</button>
        </div>
      </section>

      <section class="admin-editor admin-editor--flat">
        <div class="admin-card__heading admin-editor__heading">
          <div>
            <p class="eyebrow">${isAddMode ? "New Product" : "Edit Product"}</p>
            <h3>${escapeHtml(item.name || "Untitled Product")}</h3>
          </div>
          <div class="admin-card__meta">${isAddMode ? "Blank draft" : `SKU ${escapeHtml(item.sku || generateSku(item.name || "Product"))}`}</div>
        </div>

        <form class="admin-form admin-form--flat" data-admin-mode="${isAddMode ? "add" : "edit"}" data-admin-id="${escapeHtml(item.id || "")}">
            <label class="admin-field admin-field--full">
              <span>Product Name</span>
              <input type="text" value="${escapeHtml(isAddMode ? "" : item.name || "")}" placeholder="Enter product name" data-admin-field="name" />
            </label>
            <label class="admin-field admin-field--full">
              <span>Product Image</span>
              <div class="admin-image-picker">
                <img class="admin-image-picker__preview" alt="Selected product preview" data-admin-preview="image"${previewImage ? ` src="${escapeHtml(previewImage)}"` : ""} />
                <div class="admin-image-picker__controls">
                  <input type="file" accept="image/*" data-admin-field="imageFile" />
                  <input type="url" placeholder="Image URL" value="${escapeHtml(isAddMode ? "" : item.image || item.imageUrl || "")}" data-admin-field="imageUrl" />
                </div>
              </div>
            </label>
            <label class="admin-field">
              <span>SKU</span>
              <output class="admin-field__output" data-admin-field="skuDisplay">${escapeHtml(isAddMode ? "Auto-generated" : item.sku || "Auto-generated")}</output>
            </label>
            <label class="admin-field">
              <span>Category</span>
              <select data-admin-field="category">
                ${["Rings", "Bracelets", "Earrings"].map((category) => `<option${selectedCategory === category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}
              </select>
            </label>
            <label class="admin-field">
              <span>Sizes</span>
              <input type="text" value="${escapeHtml(isAddMode ? "" : selectedSizes.join(", "))}" placeholder="Comma separated" data-admin-field="sizes" />
            </label>
            <label class="admin-field">
              <span>Colors</span>
              <input type="text" value="${escapeHtml(isAddMode ? "" : selectedColors.join(", "))}" placeholder="Comma separated" data-admin-field="colors" />
            </label>
            <div class="admin-field admin-field--full">
              <span>Collections</span>
              <input type="hidden" data-admin-field="collections" value="${escapeHtml(selectedCollections.join(","))}" />
              <div class="admin-multiselect" data-admin-field="collectionsPicker">
                <button class="admin-multiselect__toggle" type="button" data-admin-collections-toggle aria-expanded="false">
                  Select collections
                </button>
                <div class="admin-multiselect__menu" hidden>
                  ${renderAdminCollectionOptions(selectedCollections)}
                </div>
              </div>
            </div>
            <label class="admin-field">
              <span>Price</span>
              <input type="text" value="${escapeHtml(isAddMode ? "" : formatMoney(item.priceCents || 0).replace("₦", ""))}" placeholder="0.00" data-admin-field="price" />
            </label>
            <label class="admin-field">
              <span>Stock</span>
              <input type="number" value="${escapeHtml(isAddMode ? "" : String(item.stock ?? 0))}" placeholder="0" data-admin-field="stock" />
            </label>
            <label class="admin-field admin-field--full">
              <span>Description</span>
              <textarea rows="4" placeholder="Write the product description" data-admin-field="description">${escapeHtml(isAddMode ? "" : item.description || "")}</textarea>
            </label>
            <div class="admin-field admin-field--full">
              <span>Why You’ll Love It</span>
              <select data-admin-field="benefitPrimaryPreset">
                <option value="">Pick a preset</option>
                <option value="everyday"${findBenefitPresetValue("primary", benefitPrimary) === "everyday" ? " selected" : ""}>Everyday shine</option>
                <option value="gift-ready"${findBenefitPresetValue("primary", benefitPrimary) === "gift-ready" ? " selected" : ""}>Gift-ready polish</option>
                <option value="stackable"${findBenefitPresetValue("primary", benefitPrimary) === "stackable" ? " selected" : ""}>Stackable statement</option>
                <option value="minimal-luxury"${findBenefitPresetValue("primary", benefitPrimary) === "minimal-luxury" ? " selected" : ""}>Minimal luxury</option>
              </select>
              <textarea rows="3" placeholder="Write the first benefit card copy" data-admin-field="benefitPrimaryText">${escapeHtml(isAddMode ? "" : benefitPrimary)}</textarea>
            </div>
            <div class="admin-field admin-field--full">
              <span>Perfect For</span>
              <select data-admin-field="benefitSecondaryPreset">
                <option value="">Pick a preset</option>
                <option value="daily-wear"${findBenefitPresetValue("secondary", benefitSecondary) === "daily-wear" ? " selected" : ""}>Daily wear</option>
                <option value="gifting"${findBenefitPresetValue("secondary", benefitSecondary) === "gifting" ? " selected" : ""}>Gift-giving moments</option>
                <option value="special-occasion"${findBenefitPresetValue("secondary", benefitSecondary) === "special-occasion" ? " selected" : ""}>Special occasions</option>
                <option value="layering"${findBenefitPresetValue("secondary", benefitSecondary) === "layering" ? " selected" : ""}>Layered looks</option>
              </select>
              <textarea rows="3" placeholder="Write the second benefit card copy" data-admin-field="benefitSecondaryText">${escapeHtml(isAddMode ? "" : benefitSecondary)}</textarea>
            </div>
            <div class="admin-form__actions">
              <a class="button button--ghost" href="/admin">Cancel</a>
              <button class="button button--dark" type="button" data-admin-action="update">${isAddMode ? "Add Item" : "Update Item"}</button>
            </div>
          </form>
      </section>
    </main>
    <script>window.__PEACEJEWEL_API_BASE__ = ${JSON.stringify(clientApiBaseUrl)};</script>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
  </html>`;
}

function renderAdminInventoryPage(inventory, filterName = "all", searchTerm = "") {
  const counts = buildInventoryFilterCounts(inventory);
  const activeFilter = normalizeInventoryFilter(filterName);
  const normalizedSearch = normalizeInventorySearch(searchTerm);
  const filteredInventory = filterInventoryRows(inventory, activeFilter, normalizedSearch);
  const rows = filteredInventory.length
    ? filteredInventory.map(renderAdminInventoryRow).join("")
    : `<div class="admin-table__empty">${normalizedSearch ? "No products match your search." : "No inventory items yet."}</div>`;
  const resultLabel = normalizedSearch
    ? `${filteredInventory.length} product${filteredInventory.length === 1 ? "" : "s"} found`
    : `${inventory.length ? `${filteredInventory.length} products available` : "No products yet"}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel Admin — Inventory List</title>
    <meta name="description" content="PeaceJewel admin inventory list page." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/" aria-label="PeaceJewel home">PJ</a>
        <nav class="site-nav site-nav--inventory" id="site-nav" aria-label="Inventory filters">
          <a class="admin-inventory-filter${activeFilter === "all" ? " is-active" : ""}" href="${escapeHtml(buildInventoryHref("all", normalizedSearch))}" data-filter-count="${counts.all}">All Product</a>
          <a class="admin-inventory-filter${activeFilter === "active" ? " is-active" : ""}" href="${escapeHtml(buildInventoryHref("active", normalizedSearch))}" data-filter-count="${counts.active}">Active SKUs</a>
          <a class="admin-inventory-filter${activeFilter === "low" ? " is-active" : ""}" href="${escapeHtml(buildInventoryHref("low", normalizedSearch))}" data-filter-count="${counts.low}">Low Stock Items</a>
          <a class="admin-inventory-filter${activeFilter === "out" ? " is-active" : ""}" href="${escapeHtml(buildInventoryHref("out", normalizedSearch))}" data-filter-count="${counts.out}">Out of Stock</a>
        </nav>
        <div class="site-actions" aria-label="Utilities">
          <form class="admin-inventory-search admin-inventory-search--header" method="get" action="/admin/inventory" data-admin-inventory-search>
            <input type="hidden" name="filter" value="${escapeHtml(activeFilter)}" />
            <label class="admin-inventory-search__field">
              <span class="sr-only">Search inventory</span>
              <input type="search" name="q" value="${escapeHtml(searchTerm)}" placeholder="Search products, SKU, category..." />
            </label>
          </form>
          <button class="icon-button site-menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <main class="landing-shell shop-shell admin-shell">
      <section class="shop-toolbar admin-toolbar">
        <div>
          <p class="eyebrow">Inventory List</p>
          <h2>All store products.</h2>
          <p class="admin-toolbar__note">Browse every stored product, jump into editing, or return to the dashboard overview.</p>
        </div>
        <div class="admin-toolbar__actions admin-toolbar__actions--inventory">
          <form class="admin-inventory-search admin-inventory-search--toolbar" method="get" action="/admin/inventory" data-admin-inventory-search>
            <input type="hidden" name="filter" value="${escapeHtml(activeFilter)}" />
            <label class="admin-inventory-search__field">
              <span class="sr-only">Search inventory</span>
              <input type="search" name="q" value="${escapeHtml(searchTerm)}" placeholder="Search products, SKU, category..." />
            </label>
            ${normalizedSearch ? `<a class="button button--ghost" href="${escapeHtml(buildInventoryHref(activeFilter, ""))}">Clear</a>` : ""}
          </form>
          <a class="button button--ghost" href="/admin">Back to dashboard</a>
          <a class="button button--dark" href="/admin/add">Add Product</a>
        </div>
      </section>

      <section class="admin-inventory-page">
        <div class="admin-card__heading admin-inventory-page__heading">
          <div>
            <p class="eyebrow">Inventory List</p>
            <h3>${escapeHtml(resultLabel)}</h3>
          </div>
          <div class="admin-card__meta">${normalizedSearch ? `Searching for “${escapeHtml(searchTerm)}”` : inventory.length ? "Click Edit on any row to update it." : "Add your first product to begin."}</div>
        </div>

        <div class="admin-table admin-table--flat">
          <div class="admin-table__row admin-table__row--head">
            <span>Product</span>
            <span>Status</span>
            <span>Stock</span>
            <span>Price</span>
          </div>
          ${rows}
        </div>
      </section>
    </main>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
  </html>`;
}

function renderAdminInventoryRow(item) {
  const statusClass = item.stock <= 0 ? "admin-badge--empty" : item.stock <= 5 ? "admin-badge--warn" : "admin-badge--ok";
  const statusLabel = item.stock <= 0 ? "Out" : item.stock <= 5 ? "Low Stock" : "In Stock";
  const imageUrl = String(item.imageUrl || item.image || "/assets/Vector.png");
  const stockState = item.stock <= 0 ? "out" : item.stock <= 5 ? "low" : "active";

  return `<div class="admin-table__row" data-admin-id="${escapeHtml(item.id)}" data-admin-inventory-state="${stockState}" data-admin-inventory-category="${escapeHtml(slugify(item.category || "products"))}" data-admin-search="${escapeHtml(`${item.name || ""} ${item.sku || ""} ${item.category || ""}`.toLowerCase())}">
    <div class="admin-product">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" />
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>SKU ${escapeHtml(item.sku || generateSku(item.name || "Product"))}</span>
      </div>
    </div>
    <span class="admin-badge ${statusClass}">${statusLabel}</span>
    <div class="admin-stock-control">
      <button type="button" disabled>−</button>
      <strong>${String(Number(item.stock || 0)).padStart(2, "0")}</strong>
      <button type="button" disabled>+</button>
    </div>
    <strong>${formatMoney(item.priceCents || 0)}</strong>
    <div class="admin-row-actions">
      <a class="button button--ghost admin-row-action" href="/admin/edit?id=${encodeURIComponent(item.id)}" aria-label="Edit product">
        Edit
      </a>
      <button class="button button--ghost admin-row-action admin-row-action--danger" type="button" data-admin-delete-id="${escapeHtml(item.id)}" aria-label="Delete product">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-7 0h8m-7 0 .5 13h5L16 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>`;
}

function buildInventoryFilterCounts(inventory) {
  return {
    all: inventory.length,
    active: inventory.filter((item) => item.active !== false && item.stock > 0).length,
    low: inventory.filter((item) => item.active !== false && item.stock > 0 && item.stock <= 5).length,
    out: inventory.filter((item) => item.active !== false && item.stock <= 0).length
  };
}

function buildInventoryHref(filterName, searchTerm = "") {
  const params = new URLSearchParams();
  params.set("filter", normalizeInventoryFilter(filterName));
  const normalizedSearch = normalizeInventorySearch(searchTerm);
  if (normalizedSearch) {
    params.set("q", normalizedSearch);
  }
  const query = params.toString();
  return `/admin/inventory${query ? `?${query}` : ""}`;
}

function normalizeInventoryFilter(filterName) {
  const normalized = String(filterName || "all").trim().toLowerCase();
  return ["all", "active", "low", "out"].includes(normalized) ? normalized : "all";
}

function normalizeInventorySearch(searchTerm) {
  return String(searchTerm || "").trim();
}

function filterInventoryRows(inventory, filterName, searchTerm = "") {
  const normalized = normalizeInventoryFilter(filterName);
  const normalizedSearch = normalizeInventorySearch(searchTerm).toLowerCase();
  return inventory.filter((item) => {
    const stockState = item.stock <= 0 ? "out" : item.stock <= 5 ? "low" : "active";
    if (normalized !== "all" && stockState !== normalized) return false;
    if (!normalizedSearch) return true;

    const searchable = [
      item.name,
      item.sku,
      item.category,
      item.status,
      ...(Array.isArray(item.collections) ? item.collections : []),
      ...(Array.isArray(item.colors) ? item.colors : []),
      ...(Array.isArray(item.sizes) ? item.sizes : [])
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

    return searchable.includes(normalizedSearch);
  });
}

function renderAdminOrderRow(order) {
  const status = normalizeText(order.status) || "pending";
  const statusLabel = status === "paid" ? "Paid" : status === "failed" ? "Failed" : "Pending";
  const total = formatMoney(order.amountCents || 0);
  const customerName = order.customer?.name || "Guest Customer";
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";

  return `<div class="admin-order-item">
    <div>
      <strong>${escapeHtml(customerName)}</strong>
      <span>${escapeHtml(createdAt)} · ${escapeHtml(order.txRef || order.id || "Order")}</span>
    </div>
    <div class="admin-order-item__meta">
      <span class="admin-badge ${status === "paid" ? "admin-badge--ok" : status === "failed" ? "admin-badge--empty" : "admin-badge--warn"}">${statusLabel}</span>
      <strong>${escapeHtml(total)}</strong>
    </div>
  </div>`;
}

function renderAdminAlertRow(alert) {
  return `<li>
    <strong>${escapeHtml(alert.name)}</strong>
    <span>${escapeHtml(alert.message)}</span>
  </li>`;
}

function renderAdminOrdersPage(orders, inventory) {
  const pendingOrders = orders.filter((order) => normalizeText(order.status) === "pending");
  const paidOrders = orders.filter((order) => normalizeText(order.status) === "paid");
  const totalRevenue = orders
    .filter((order) => normalizeText(order.status) === "paid")
    .reduce((sum, order) => sum + Number(order.amountCents || 0), 0);

  const rows = orders.length ? orders.map(renderAdminOrderRow).join("") : `<li class="admin-order-list__empty">No orders yet.</li>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel Admin — Orders</title>
    <meta name="description" content="PeaceJewel admin orders page." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/" aria-label="PeaceJewel home">PJ</a>
        <nav class="site-nav" id="site-nav">
          <a href="/admin">Dashboard</a>
          <a href="/admin/inventory">Inventory</a>
          <a href="/admin/alerts">Alerts</a>
          <a href="/catalog">View Store</a>
        </nav>
        <div class="site-actions" aria-label="Utilities">
          <button class="icon-button site-menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <main class="landing-shell shop-shell admin-shell">
      <section class="shop-toolbar admin-toolbar">
        <div>
          <p class="eyebrow">Orders</p>
          <h2>Track what’s coming in.</h2>
          <p class="admin-toolbar__note">Monitor pending checkouts, successful payments, and the latest order activity.</p>
        </div>
        <div class="admin-toolbar__actions">
          <a class="button button--ghost" href="/admin">Back to dashboard</a>
          <a class="button button--dark" href="/admin/alerts">View alerts</a>
        </div>
      </section>

      <section class="admin-inventory-page">
        <div class="admin-card__heading admin-inventory-page__heading">
          <div>
            <p class="eyebrow">Orders</p>
            <h3>${orders.length ? `${orders.length} orders` : "No orders yet"}</h3>
          </div>
          <div class="admin-card__meta">${pendingOrders.length} pending · ${paidOrders.length} paid · ${formatMoney(totalRevenue)}</div>
        </div>

        <div class="admin-order-stats">
          <article>
            <span>Pending</span>
            <strong>${String(pendingOrders.length).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>Paid</span>
            <strong>${String(paidOrders.length).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>Revenue</span>
            <strong>${formatMoney(totalRevenue)}</strong>
          </article>
        </div>

        <ul class="admin-order-list admin-order-list--flat">
          ${rows}
        </ul>
      </section>
    </main>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function renderAdminAlertsPage(alerts, inventory, orders) {
  const rows = alerts.length ? alerts.map(renderAdminAlertRow).join("") : `<li><strong>All clear</strong><span>No inventory alerts right now.</span></li>`;
  const lowStockCount = inventory.filter((item) => item.stock > 0 && item.stock <= 5).length;
  const outOfStockCount = inventory.filter((item) => item.stock <= 0).length;
  const pendingCount = orders.filter((order) => normalizeText(order.status) === "pending").length;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel Admin — Alerts</title>
    <meta name="description" content="PeaceJewel admin alerts page." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/" aria-label="PeaceJewel home">PJ</a>
        <nav class="site-nav" id="site-nav">
          <a href="/admin">Dashboard</a>
          <a href="/admin/inventory">Inventory</a>
          <a href="/admin/orders">Orders</a>
          <a href="/catalog">View Store</a>
        </nav>
        <div class="site-actions" aria-label="Utilities">
          <button class="icon-button site-menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <main class="landing-shell shop-shell admin-shell">
      <section class="shop-toolbar admin-toolbar">
        <div>
          <p class="eyebrow">Alerts</p>
          <h2>What needs attention.</h2>
          <p class="admin-toolbar__note">Keep an eye on low-stock products, stockouts, and order activity that needs a follow-up.</p>
        </div>
        <div class="admin-toolbar__actions">
          <a class="button button--ghost" href="/admin">Back to dashboard</a>
          <a class="button button--dark" href="/admin/orders">View orders</a>
        </div>
      </section>

      <section class="admin-inventory-page">
        <div class="admin-card__heading admin-inventory-page__heading">
          <div>
            <p class="eyebrow">Alerts</p>
            <h3>${alerts.length ? `${alerts.length} active alerts` : "All clear"}</h3>
          </div>
          <div class="admin-card__meta">${lowStockCount} low stock · ${outOfStockCount} out of stock · ${pendingCount} pending orders</div>
        </div>

        <div class="admin-order-stats">
          <article>
            <span>Low stock</span>
            <strong>${String(lowStockCount).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>Out of stock</span>
            <strong>${String(outOfStockCount).padStart(2, "0")}</strong>
          </article>
          <article>
            <span>Pending orders</span>
            <strong>${String(pendingCount).padStart(2, "0")}</strong>
          </article>
        </div>

        <ul class="admin-list admin-list--flat">
          ${rows}
        </ul>
      </section>
    </main>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function buildAdminAlerts(inventory, orders) {
  const alerts = [];

  for (const item of inventory) {
    if (item.stock <= 0) {
      alerts.push({
        name: item.name,
        message: "Inventory reached zero today."
      });
    } else if (item.stock <= 5) {
      alerts.push({
        name: item.name,
        message: `Reorder soon — ${item.stock} units left.`
      });
    }
  }

  const pendingOrders = orders.filter((order) => normalizeText(order.status) === "pending");
  if (pendingOrders.length) {
    alerts.unshift({
      name: "Pending Orders",
      message: `${pendingOrders.length} order${pendingOrders.length === 1 ? "" : "s"} need review.`
    });
  }

  return alerts;
}

function renderAdminCollectionOptions(selectedCollections) {
  const options = [
    ["new-arrivals", "New Arrivals"],
    ["mens-collection", "Men's Collection"],
    ["womens-collection", "Women's Collection"],
    ["gift-sets", "Gift Sets"],
    ["best-sellers", "Best Sellers"]
  ];

  return options.map(([value, label]) => `<label><input type="checkbox" value="${value}" data-admin-collection-option${selectedCollections.includes(value) ? " checked" : ""} /> ${label}</label>`).join("");
}

function findBenefitPresetValue(group, text) {
  const normalized = String(text || "").trim();
  const presets = {
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

  const entries = presets[group] || {};
  return Object.entries(entries).find(([, value]) => value === normalized)?.[0] || "";
}

function resolveAdminEditorItem(url, inventory) {
  const itemId = String(url.searchParams.get("id") || "").trim();
  const slug = String(url.searchParams.get("slug") || "").trim();
  return inventory.find((item) => (itemId && item.id === itemId) || (slug && item.slug === slug)) || null;
}

function createAdminEditorSeed() {
  return {
    id: `PJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
    sku: "",
    name: "",
    category: "Rings",
    description: "",
    image: "",
    priceCents: 0,
    stock: 0,
    sizes: [],
    colors: [],
    collections: [],
    benefitPrimaryText: "",
    benefitSecondaryText: ""
  };
}

function wrapStorefrontPage(title, description, content) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${renderSiteHeader("/catalog")}
    <main class="landing-shell shop-shell">
      ${content}
    </main>
    <script>window.__PEACEJEWEL_API_BASE__ = ${JSON.stringify(clientApiBaseUrl)};</script>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function renderCatalogIndexPage(inventory) {
  const sections = Object.keys(categoryPages).map((slug) => {
    const page = categoryPages[slug];
    const products = getCollectionProducts(inventory, slug).slice(0, 5);
    return renderCategorySection(page, products, slug);
  }).join("\n        ");

  return wrapStorefrontPage("PeaceJewel Shop", "PeaceJewel shop interface with curated jewelry collections and best-selling pieces.", `
      <section class="shop-toolbar shop-toolbar--intro" id="filters">
        <div>
          <h2>Shop the collection.</h2>
          <p class="checkout-toolbar__note">Browse every category in a single glance, with each row scrolling sideways to reveal more pieces.</p>
        </div>
      </section>

      <section class="shop-category-page" id="shop-products">
        ${sections}
      </section>
      <section class="page-contact">
        <div>
          <p class="eyebrow">Contact</p>
          <h2>Need help with an order?</h2>
          <p>Reach PeaceJewel for sizing help, order updates, gifting questions, or store support.</p>
        </div>
        <a class="button button--dark" href="mailto:hello@peacejewel.com">hello@peacejewel.com</a>
      </section>

      <footer class="site-footer" id="footer">
        <div><h3>Shop</h3><ul><li>Best Sellers</li><li>New Drops</li><li>Gift Sets</li><li>Sale Picks</li></ul></div>
        <div><h3>Support</h3><ul><li>Shipping</li><li>Returns</li><li>Size Guide</li><li>FAQs</li></ul></div>
        <div><h3>Stay Connected</h3><p>Follow PeaceJewel for fresh offers, new arrivals, and limited-time deals you won’t want to miss.</p><div class="footer-social"><svg viewBox="0 0 24 24"><path d="M20.5 7.2c-.6.3-1.2.5-1.9.6.7-.4 1.2-1 1.5-1.8-.7.4-1.4.7-2.2.9a3.3 3.3 0 0 0-5.7 3c-2.7-.1-5.1-1.5-6.7-3.6-.9 1.6-.4 3.5 1 4.5-.5 0-1-.1-1.5-.4 0 1.9 1.3 3.5 3.1 3.9-.5.1-1 .1-1.6 0 .5 1.5 2 2.7 3.8 2.8a6.6 6.6 0 0 1-4.9 1.4 9.3 9.3 0 0 0 5 1.5c6 0 9.3-5 9.3-9.3v-.4c.7-.5 1.3-1.1 1.8-1.8z"/></svg><svg viewBox="0 0 24 24"><path d="M11 3h3v4h3v3h-3v4.9c0 1.1.5 1.6 1.8 1.6h1.4V19c-.6.3-1.8.6-3 .6-2.5 0-3.7-1.3-3.7-3.5V10H8V7.2c2-.2 3-.9 3-4.2z"/></svg><svg viewBox="0 0 24 24"><path d="M6.5 8.6H3.8V19h2.7V8.6zM5.2 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.2 19h-2.7v-5.4c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.8V19h-2.7V8.6h2.6v1.4h0c.4-.8 1.5-1.6 3.2-1.6 3.5 0 4.1 2.3 4.1 5.2V19z"/></svg></div></div>
      </footer>
      <div class="copyright">Copyright 2026 - PeaceJewel.com All rights reserved</div>
  `);
}

function renderCategoryPage(page, inventory) {
  const products = getCollectionProducts(inventory, slugify(page.eyebrow)).slice(0, 8);
  const categorySlug = slugify(page.eyebrow);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel ${page.title}</title>
    <meta name="description" content="${page.description}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${renderSiteHeader("/catalog")}
    <main class="landing-shell shop-shell">
      <section class="shop-toolbar shop-toolbar--category">
        <div>
          <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
          <h2>${escapeHtml(page.heading)}</h2>
          <p class="checkout-toolbar__note">${escapeHtml(page.description)}</p>
        </div>
        <a class="button button--ghost" href="/catalog">Back To Shop</a>
      </section>

      <section class="shop-category-page">
        <div class="shop-category">
          <div class="shop-category__track shop-category__track--page">
            ${products.map((product) => renderProductCard(product, page.label)).join("\n            ")}
          </div>
        </div>
      </section>

      <section class="page-contact">
        <div>
          <p class="eyebrow">Contact</p>
          <h2>Need help with an order?</h2>
          <p>Reach PeaceJewel for sizing help, order updates, gifting questions, or store support.</p>
        </div>
        <a class="button button--dark" href="mailto:hello@peacejewel.com">hello@peacejewel.com</a>
      </section>

      <footer class="site-footer" id="footer">
        <div><h3>Shop</h3><ul><li>Best Sellers</li><li>New Drops</li><li>Gift Sets</li><li>Sale Picks</li></ul></div>
        <div><h3>Support</h3><ul><li>Shipping</li><li>Returns</li><li>Size Guide</li><li>FAQs</li></ul></div>
        <div><h3>Stay Connected</h3><p>Follow PeaceJewel for fresh offers, new arrivals, and limited-time deals you won’t want to miss.</p><div class="footer-social"><svg viewBox="0 0 24 24"><path d="M20.5 7.2c-.6.3-1.2.5-1.9.6.7-.4 1.2-1 1.5-1.8-.7.4-1.4.7-2.2.9a3.3 3.3 0 0 0-5.7 3c-2.7-.1-5.1-1.5-6.7-3.6-.9 1.6-.4 3.5 1 4.5-.5 0-1-.1-1.5-.4 0 1.9 1.3 3.5 3.1 3.9-.5.1-1 .1-1.6 0 .5 1.5 2 2.7 3.8 2.8a6.6 6.6 0 0 1-4.9 1.4 9.3 9.3 0 0 0 5 1.5c6 0 9.3-5 9.3-9.3v-.4c.7-.5 1.3-1.1 1.8-1.8z"/></svg><svg viewBox="0 0 24 24"><path d="M11 3h3v4h3v3h-3v4.9c0 1.1.5 1.6 1.8 1.6h1.4V19c-.6.3-1.8.6-3 .6-2.5 0-3.7-1.3-3.7-3.5V10H8V7.2c2-.2 3-.9 3-4.2z"/></svg><svg viewBox="0 0 24 24"><path d="M6.5 8.6H3.8V19h2.7V8.6zM5.2 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.2 19h-2.7v-5.4c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.8V19h-2.7V8.6h2.6v1.4h0c.4-.8 1.5-1.6 3.2-1.6 3.5 0 4.1 2.3 4.1 5.2V19z"/></svg></div></div>
      </footer>
      <div class="copyright">Copyright 2026 - PeaceJewel.com All rights reserved</div>
    </main>
    <script>window.__PEACEJEWEL_API_BASE__ = ${JSON.stringify(clientApiBaseUrl)};</script>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function renderProductCard(product, label) {
  const detailHref = `/product?slug=${encodeURIComponent(product.slug || product.id)}`;
  return `<article class="shop-product shop-product--carousel" data-product-slug="${escapeHtml(product.slug || product.id)}" data-product-card-href="${escapeHtml(detailHref)}">
            <img class="shop-product__image" src="${escapeHtml(product.imageUrl || product.image || "/assets/Vector.png")}" alt="${escapeHtml(product.name)}" />
            <h3>${escapeHtml(product.name)}</h3>
            <div class="shop-product__meta"><span>Price</span><strong>${escapeHtml(formatMoney(product.priceCents))}</strong></div>
            <a class="shop-product__details" href="${detailHref}">View Details</a>
            <button class="button button--dark" type="button" data-catalog-add>Add To Cart</button>
            <div class="shop-product__popover" hidden></div>
          </article>`;
}

function renderCategorySection(page, products, slug, showMore = true) {
  return `<div class="shop-category">
          <div class="shop-category__head">
            ${showMore ? `<div>
              <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
              <h3>${escapeHtml(page.heading)}</h3>
            </div>` : ""}
            ${showMore ? `<a class="shop-category__more" href="/catalog/${slug}">View more</a>` : ""}
          </div>
          <div class="shop-category__track">
            ${products.map((product) => renderProductCard(product, page.label)).join("\n            ")}
          </div>
        </div>`;
}

function renderProductPage(product, inventory) {
  const related = getRelatedProducts(product, inventory).slice(0, 2);
  const sizes = normalizeList(product.sizes, ["S", "M", "L"]);
  const colors = normalizeList(product.colors, ["Gold"]);
  const benefits = getBenefitCards(product);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel ${escapeHtml(product.name)}</title>
    <meta name="description" content="${escapeHtml(product.description || "PeaceJewel product detail page.")}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${renderSiteHeader("/catalog")}
    <main class="landing-shell shop-shell">
      <section class="product-page">
        <div class="product-page__media">
          <p class="eyebrow product-page__eyebrow">New Arrival</p>
          <img src="${escapeHtml(product.imageUrl || product.image || "/assets/Vector.png")}" alt="${escapeHtml(product.name)}" />
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
        </div>
      </section>
      <section class="product-related">
        <div class="shop-toolbar">
          <div>
            <p class="eyebrow">Complete The Look</p>
            <h2>Pieces that pair beautifully.</h2>
          </div>
        </div>
        <div class="shop-products shop-products--catalog">
          ${related.map((item) => renderProductCard(item, "Related")).join("\n          ")}
        </div>
      </section>
      <section class="page-contact">
        <div>
          <p class="eyebrow">Contact</p>
          <h2>Need help with an order?</h2>
          <p>Reach PeaceJewel for sizing help, order updates, gifting questions, or store support.</p>
        </div>
        <a class="button button--dark" href="mailto:hello@peacejewel.com">hello@peacejewel.com</a>
      </section>
      <footer class="site-footer" id="footer">
        <div><h3>Shop</h3><ul><li>Best Sellers</li><li>New Drops</li><li>Gift Sets</li><li>Sale Picks</li></ul></div>
        <div><h3>Support</h3><ul><li>Shipping</li><li>Returns</li><li>Size Guide</li><li>FAQs</li></ul></div>
        <div><h3>Stay Connected</h3><p>Follow PeaceJewel for fresh offers, new arrivals, and limited-time deals you won’t want to miss.</p><div class="footer-social"><svg viewBox="0 0 24 24"><path d="M20.5 7.2c-.6.3-1.2.5-1.9.6.7-.4 1.2-1 1.5-1.8-.7.4-1.4.7-2.2.9a3.3 3.3 0 0 0-5.7 3c-2.7-.1-5.1-1.5-6.7-3.6-.9 1.6-.4 3.5 1 4.5-.5 0-1-.1-1.5-.4 0 1.9 1.3 3.5 3.1 3.9-.5.1-1 .1-1.6 0 .5 1.5 2 2.7 3.8 2.8a6.6 6.6 0 0 1-4.9 1.4 9.3 9.3 0 0 0 5 1.5c6 0 9.3-5 9.3-9.3v-.4c.7-.5 1.3-1.1 1.8-1.8z"/></svg><svg viewBox="0 0 24 24"><path d="M11 3h3v4h3v3h-3v4.9c0 1.1.5 1.6 1.8 1.6h1.4V19c-.6.3-1.8.6-3 .6-2.5 0-3.7-1.3-3.7-3.5V10H8V7.2c2-.2 3-.9 3-4.2z"/></svg><svg viewBox="0 0 24 24"><path d="M6.5 8.6H3.8V19h2.7V8.6zM5.2 4.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM20.2 19h-2.7v-5.4c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.8V19h-2.7V8.6h2.6v1.4h0c.4-.8 1.5-1.6 3.2-1.6 3.5 0 4.1 2.3 4.1 5.2V19z"/></svg></div></div>
      </footer>
      <div class="copyright">Copyright 2026 - PeaceJewel.com All rights reserved</div>
    </main>
    <script>window.__PEACEJEWEL_API_BASE__ = ${JSON.stringify(clientApiBaseUrl)};</script>
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function renderSiteHeader(currentPath) {
  return `<header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/" aria-label="PeaceJewel home">PJ</a>
        <nav class="site-nav" id="site-nav">
          <button class="site-nav__toggle site-nav__link--dropdown" type="button" aria-expanded="false" aria-controls="site-nav-categories">Categories <span class="site-nav__caret" aria-hidden="true"></span></button>
          <div class="site-nav__dropdown" id="site-nav-categories" aria-label="Categories">
            <a href="/catalog/new-arrivals">New Arrivals</a>
            <a href="/catalog/mens-collection">Men's Collection</a>
            <a href="/catalog/womens-collection">Women's Collection</a>
            <a href="/catalog/gift-sets">Gift Sets</a>
            <a href="/catalog/best-sellers">Best Sellers</a>
          </div>
          <a href="/#story">About</a>
          <a href="${currentPath}" aria-current="page">Shop</a>
          <a href="/#footer">Contact</a>
        </nav>
        <div class="site-actions" aria-label="Utilities">
          <button class="icon-button" type="button" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <a class="icon-button" href="/cart" aria-label="Cart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h2l1.4 8.2a1.5 1.5 0 0 0 1.48 1.24h8.55a1.5 1.5 0 0 0 1.46-1.14l1.36-5.3H7.15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/></svg>
          </a>
          <button class="icon-button site-menu-button" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>`;
}

function renderOptionGroup(label, options) {
  return `<div>
              <p class="eyebrow">${escapeHtml(label)}</p>
              <div class="shop-toolbar__controls">
                ${options.map((option, index) => `<button class="shop-chip${index === 0 ? " shop-chip--active" : ""}" type="button">${escapeHtml(option)}</button>`).join("")}
              </div>
            </div>`;
}

function resolveProductFromRequest(requestUrl, inventory) {
  const url = new URL(requestUrl, "http://localhost");
  const slug = url.searchParams.get("slug");
  const activeInventory = inventory.filter((item) => item.active !== false);
  if (slug) {
    const match = activeInventory.find((item) => item.slug === slug || item.id === slug);
    if (match) return match;
  }
  return activeInventory[0] || null;
}

function getCollectionProducts(inventory, slug) {
  const activeInventory = inventory.filter((item) => item.active !== false);
  const matches = activeInventory.filter((item) => normalizeList(item.collections).includes(slug));
  return matches.length ? matches : activeInventory;
}

function getRelatedProducts(product, inventory) {
  const activeInventory = inventory.filter((item) => item.active !== false && item.id !== product.id);
  const related = activeInventory.filter((item) => shareCollection(item, product));
  return related.length ? related : activeInventory;
}

function shareCollection(left, right) {
  const leftCollections = normalizeList(left.collections);
  const rightCollections = normalizeList(right.collections);
  return leftCollections.some((collection) => rightCollections.includes(collection));
}

async function loadInventorySnapshot() {
  if (serverApiBaseUrl) {
    try {
      const response = await fetch(`${serverApiBaseUrl}/inventory`);
      if (response.ok) {
        const inventory = await response.json();
        if (Array.isArray(inventory)) {
          return inventory.map(normalizeInventoryItem);
        }
      }
    } catch {}
  }

  try {
    const raw = fs.readFileSync(inventoryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeInventoryItem);
    }
  } catch {}

  return [];
}

async function loadOrdersSnapshot() {
  if (serverApiBaseUrl) {
    try {
      const response = await fetch(`${serverApiBaseUrl}/orders`);
      if (response.ok) {
        const orders = await response.json();
        if (Array.isArray(orders)) {
          return orders.map(normalizeOrder);
        }
      }
    } catch {}
  }

  return [];
}

function normalizeInventoryItem(item) {
  const stock = Math.max(0, Math.trunc(Number(item?.stock) || 0));
  const priceCents = Number.isFinite(Number(item?.priceCents)) ? Math.round(Number(item.priceCents)) : 0;
  const imageUrl = String(item?.imageUrl || item?.image || "/assets/Vector.png");
  return {
    ...item,
    id: String(item?.id || ""),
    slug: String(item?.slug || ""),
    name: String(item?.name || "Product"),
    category: String(item?.category || "rings"),
    description: String(item?.description || ""),
    imageUrl,
    priceCents,
    stock,
    status: String(item?.status || "In Stock"),
    active: item?.active !== false,
    sizes: normalizeList(item?.sizes, ["S", "M", "L"]),
    colors: normalizeList(item?.colors, ["Gold"]),
    collections: normalizeList(item?.collections, [])
  };
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return structuredClone(fallback);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(cents) {
  return `₦${(Number(cents || 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getBenefitCards(product) {
  const collections = normalizeList(product.collections, []);
  const primary = String(product.benefitPrimaryText || "").trim();
  const secondary = String(product.benefitSecondaryText || "").trim();

  return {
    primary: primary || `${String(product.description || "A polished piece").trim()} that feels effortless to wear and easy to style every day.`,
    secondary: secondary || (collections.includes("gift-sets")
      ? "Perfect for gifting, celebrations, and thoughtful moments that call for something special."
      : "Perfect for daily wear, layering, and keeping your look polished without trying too hard.")
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
