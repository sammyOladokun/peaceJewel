const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const assetsDir = path.join(rootDir, "..", "..", "assets");

const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const catalogHtml = fs.readFileSync(path.join(rootDir, "catalog.html"), "utf8");
const productHtml = fs.readFileSync(path.join(rootDir, "product.html"), "utf8");
const cartHtml = fs.readFileSync(path.join(rootDir, "cart.html"), "utf8");
const checkoutHtml = fs.readFileSync(path.join(rootDir, "checkout.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(rootDir, "admin.html"), "utf8");
const adminLoginHtml = fs.readFileSync(path.join(rootDir, "admin-login.html"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "styles.css"), "utf8");
const menuJs = fs.readFileSync(path.join(rootDir, "menu.js"), "utf8");
const storeJs = fs.readFileSync(path.join(rootDir, "store.js"), "utf8");
const adminKey = process.env.ADMIN_KEY || "peacejewel-admin";
const adminSessionToken = crypto.randomBytes(24).toString("hex");

const categoryPages = {
  "new-arrivals": {
    title: "New Arrivals",
    eyebrow: "New Arrivals",
    heading: "Fresh pieces for now.",
    description: "Discover the newest jewelry drops with the same PeaceJewel polish — easy to wear, easy to gift, and ready to add to cart.",
    products: [
      { name: "Classic Gold Ring", image: "/assets/Vector.png", label: "New", price: "349.00" },
      { name: "Diamond Accent Ring", image: "/assets/Vector(1).png", label: "New", price: "429.00" },
      { name: "Woven Chain Bracelet", image: "/assets/Vector(2).png", label: "New", price: "549.29" },
      { name: "Black Coral Ring", image: "/assets/Vector(3).png", label: "New", price: "320.29" },
      { name: "Layered Gold Band", image: "/assets/Vector.png", label: "New", price: "289.00" },
      { name: "Everyday Shine Ring", image: "/assets/Vector(1).png", label: "New", price: "379.00" },
      { name: "Slim Gold Bangle", image: "/assets/Vector(2).png", label: "New", price: "459.00" },
      { name: "Signature Coral Ring", image: "/assets/Vector(3).png", label: "New", price: "339.00" }
    ]
  },
  "mens-collection": {
    title: "Men's Collection",
    eyebrow: "Men's Collection",
    heading: "Clean lines, bold finish.",
    description: "A refined edit of bracelets and rings with a more grounded feel, designed for everyday wear and statement gifting.",
    products: [
      { name: "Woven Chain Bracelet", image: "/assets/Vector(2).png", label: "Men's", price: "549.29" },
      { name: "Black Coral Ring", image: "/assets/Vector(3).png", label: "Men's", price: "320.29" },
      { name: "Classic Gold Ring", image: "/assets/Vector.png", label: "Men's", price: "349.00" },
      { name: "Matte Gold Band", image: "/assets/Vector(1).png", label: "Men's", price: "399.00" },
      { name: "Rope Link Bracelet", image: "/assets/Vector(2).png", label: "Men's", price: "499.00" },
      { name: "Onyx Accent Ring", image: "/assets/Vector(3).png", label: "Men's", price: "359.00" },
      { name: "Gold Signet Ring", image: "/assets/Vector.png", label: "Men's", price: "459.00" },
      { name: "Everyday Band", image: "/assets/Vector(1).png", label: "Men's", price: "279.00" }
    ]
  },
  "womens-collection": {
    title: "Women's Collection",
    eyebrow: "Women's Collection",
    heading: "Soft shine, strong presence.",
    description: "Elegant rings and layered pieces made to feel delicate at first glance and premium in every detail.",
    products: [
      { name: "Diamond Accent Ring", image: "/assets/Vector(1).png", label: "Women’s", price: "429.00" },
      { name: "Classic Gold Ring", image: "/assets/Vector.png", label: "Women’s", price: "349.00" },
      { name: "Layered Gold Ring", image: "/assets/Vector(2).png", label: "Women’s", price: "469.00" },
      { name: "Rose Curve Ring", image: "/assets/Vector(3).png", label: "Women’s", price: "389.00" },
      { name: "Pearl Glow Ring", image: "/assets/Vector(1).png", label: "Women’s", price: "439.00" },
      { name: "Signature Band", image: "/assets/Vector.png", label: "Women’s", price: "299.00" },
      { name: "Gold Layer Necklace", image: "/assets/Vector(2).png", label: "Women’s", price: "579.00" },
      { name: "Fine Coral Ring", image: "/assets/Vector(3).png", label: "Women’s", price: "319.00" }
    ]
  },
  "gift-sets": {
    title: "Gift Sets",
    eyebrow: "Gift Sets",
    heading: "Easy wins for gifting.",
    description: "Curated pairings and ready-to-give jewelry picks made for birthdays, anniversaries, and thoughtful surprises.",
    products: [
      { name: "Signature Duo Set", image: "/assets/Vector.png", label: "Gift", price: "699.00" },
      { name: "Gold & Shine Set", image: "/assets/Vector(1).png", label: "Gift", price: "849.00" },
      { name: "Layered Stack Set", image: "/assets/Vector(2).png", label: "Gift", price: "929.00" },
      { name: "Coral Glow Set", image: "/assets/Vector(3).png", label: "Gift", price: "759.00" },
      { name: "Everyday Gift Pair", image: "/assets/Vector.png", label: "Gift", price: "659.00" },
      { name: "Golden Gesture Set", image: "/assets/Vector(1).png", label: "Gift", price: "899.00" },
      { name: "Elegant Trio", image: "/assets/Vector(2).png", label: "Gift", price: "1,029.00" },
      { name: "Best For Her", image: "/assets/Vector(3).png", label: "Gift", price: "799.00" }
    ]
  },
  "best-sellers": {
    title: "Best Sellers",
    eyebrow: "Best Sellers",
    heading: "The pieces people keep choosing.",
    description: "Our most-loved jewelry, selected for daily wearability, gifting appeal, and timeless polish.",
    products: [
      { name: "Classic Gold Ring", image: "/assets/Vector.png", label: "Top", price: "349.00" },
      { name: "Diamond Accent Ring", image: "/assets/Vector(1).png", label: "Top", price: "429.00" },
      { name: "Woven Chain Bracelet", image: "/assets/Vector(2).png", label: "Top", price: "549.29" },
      { name: "Black Coral Ring", image: "/assets/Vector(3).png", label: "Top", price: "320.29" },
      { name: "Layered Gold Ring", image: "/assets/Vector.png", label: "Top", price: "469.00" },
      { name: "Rose Accent Ring", image: "/assets/Vector(1).png", label: "Top", price: "389.00" },
      { name: "Signature Band", image: "/assets/Vector(2).png", label: "Top", price: "299.00" },
      { name: "Heritage Coral Ring", image: "/assets/Vector(3).png", label: "Top", price: "339.00" }
    ]
  }
};

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (requestPath === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }

  if (requestPath === "/catalog") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(catalogHtml);
    return;
  }

  if (requestPath.startsWith("/catalog/")) {
    const slug = requestPath.replace("/catalog/", "");
    const page = categoryPages[slug];

    if (!page) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(renderCategoryPage(page));
    return;
  }

  if (requestPath === "/product") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(productHtml);
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

  if (requestPath === "/store.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(storeJs);
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

function renderCategoryPage(page) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PeaceJewel ${page.title}</title>
    <meta name="description" content="${page.description}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-brand" href="/">PeaceJewel</a>
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
          <a href="/catalog" aria-current="page">Shop</a>
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
    </header>

    <main class="landing-shell shop-shell">
      <section class="shop-toolbar shop-toolbar--category">
        <div>
          <p class="eyebrow">${page.eyebrow}</p>
          <h2>${page.heading}</h2>
          <p class="checkout-toolbar__note">${page.description}</p>
        </div>
        <a class="button button--ghost" href="/catalog">Back To Shop</a>
      </section>

      <section class="shop-category-page">
        <div class="shop-category">
          <div class="shop-category__head">
            <div>
              <p class="eyebrow">${page.eyebrow}</p>
              <h3>${page.heading}</h3>
            </div>
          </div>
          <div class="shop-category__track shop-category__track--page">
            ${page.products.map((product) => renderProductCard(product)).join("\n            ")}
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
    <script src="/menu.js"></script>
    <script src="/store.js"></script>
  </body>
</html>`;
}

function renderProductCard(product) {
  return `<article class="shop-product shop-product--carousel">
            <img class="shop-product__image" src="${product.image}" alt="${product.name}" />
            <h3>${product.name}</h3>
            <div class="shop-product__meta"><span>${product.label}</span><strong>${product.price}</strong></div>
            <a class="shop-product__details" href="/product">View Details</a>
            <button class="button button--dark" type="button">Add To Cart</button>
          </article>`;
}
