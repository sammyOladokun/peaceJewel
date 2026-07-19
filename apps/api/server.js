const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 4000);
const rootDir = __dirname;
const dataDir = path.join(rootDir, "storage");
const uploadsDir = path.join(rootDir, "uploads");
const inventoryPath = path.join(dataDir, "inventory.json");
const cartStatePath = path.join(dataDir, "cart-state.json");
const ordersPath = path.join(dataDir, "orders.json");
const flutterwaveSecretKey = process.env.FLW_SECRET_KEY || "";
const webBaseUrl = (process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

const defaultInventory = [
  {
    id: "PJ-001",
    sku: "PJ-RNG-001",
    slug: "classic-gold-ring",
    name: "Classic Gold Ring",
    category: "rings",
    description: "A polished everyday ring with premium shine and a clean finish.",
    imageUrl: "/assets/Vector.png",
    priceCents: 34900,
    stock: 18,
    status: "In Stock",
    active: true,
    sizes: ["S", "M", "L"],
    colors: ["Gold", "Rose", "Silver"],
    collections: ["new-arrivals", "womens-collection", "best-sellers"],
    benefitPrimaryText: "Polished enough for every day, with a clean finish that feels easy to wear from morning to night.",
    benefitSecondaryText: "Perfect for daily wear, layering, and keeping your look polished without trying too hard."
  },
  {
    id: "PJ-002",
    sku: "PJ-RNG-002",
    slug: "diamond-accent-ring",
    name: "Diamond Accent Ring",
    category: "rings",
    description: "A luminous statement ring made for gifting and special moments.",
    imageUrl: "/assets/Vector(1).png",
    priceCents: 42900,
    stock: 4,
    status: "Low Stock",
    active: true,
    sizes: ["S", "M", "L"],
    colors: ["Gold", "Rose", "Silver"],
    collections: ["new-arrivals", "womens-collection", "best-sellers"],
    benefitPrimaryText: "A gift-ready piece with an elevated look that feels thoughtful the moment it’s unwrapped.",
    benefitSecondaryText: "Perfect for gifting, celebrations, and thoughtful moments that call for something special."
  },
  {
    id: "PJ-003",
    sku: "PJ-BRC-001",
    slug: "woven-chain-bracelet",
    name: "Woven Chain Bracelet",
    category: "bracelets",
    description: "A textured woven bracelet with a stronger, modern silhouette.",
    imageUrl: "/assets/Vector(2).png",
    priceCents: 54929,
    stock: 11,
    status: "In Stock",
    active: true,
    sizes: ["One Size"],
    colors: ["Gold", "Black"],
    collections: ["new-arrivals", "mens-collection", "best-sellers"],
    benefitPrimaryText: "Designed to stack beautifully with your existing pieces for a layered, premium finish.",
    benefitSecondaryText: "Perfect for everyday wear, layering, and adding subtle texture to your look."
  },
  {
    id: "PJ-004",
    sku: "PJ-RNG-003",
    slug: "black-coral-ring",
    name: "Black Coral Ring",
    category: "rings",
    description: "A bold ring with refined contrast and premium everyday appeal.",
    imageUrl: "/assets/Vector(3).png",
    priceCents: 32029,
    stock: 0,
    status: "Out of Stock",
    active: true,
    sizes: ["S", "M", "L"],
    colors: ["Gold", "Black"],
    collections: ["new-arrivals", "mens-collection", "best-sellers"],
    benefitPrimaryText: "Minimal lines and a refined shine create a luxury feel without looking overdone.",
    benefitSecondaryText: "Perfect for special occasions and confident, statement styling."
  }
];

let inventory = [];
let cartStates = {};
let orderHistory = [];

bootstrap().catch((error) => {
  console.error("API failed to start", error);
  process.exit(1);
});

async function bootstrap() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(uploadsDir, { recursive: true });
  inventory = await loadInventory();
  cartStates = await loadCartStates();
  orderHistory = await loadOrders();

  const server = http.createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "peacejewel-api",
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (pathname === "/catalog" && request.method === "GET") {
      sendJson(response, 200, inventory.filter((item) => item.active !== false).map(toCatalogProduct));
      return;
    }

    const catalogMatch = pathname.match(/^\/catalog\/([^/]+)$/);
    if (catalogMatch && request.method === "GET") {
      const product = inventory.find((item) => item.slug === catalogMatch[1]);
      if (!product) {
        sendJson(response, 404, { message: "Product not found" });
        return;
      }

      sendJson(response, 200, toCatalogProduct(product));
      return;
    }

    if (pathname === "/inventory" && request.method === "GET") {
      sendJson(response, 200, inventory);
      return;
    }

    if (pathname === "/cart-state" && request.method === "GET") {
      const cartId = String(new URL(request.url, `http://${request.headers.host}`).searchParams.get("cartId") || "").trim();
      sendJson(response, 200, { cartId, items: cartStates[cartId] || [] });
      return;
    }

    if (pathname === "/cart-state" && request.method === "PUT") {
      const body = await readJsonBody(request);
      const cartId = String(body.cartId || "").trim();
      if (!cartId) {
        sendJson(response, 400, { message: "cartId is required" });
        return;
      }

      const items = Array.isArray(body.items) ? body.items.map(normalizeCartItem) : [];
      cartStates[cartId] = items;
      await saveCartStates();
      sendJson(response, 200, { cartId, items });
      return;
    }

    if (pathname === "/orders" && request.method === "GET") {
      const cartId = String(new URL(request.url, `http://${request.headers.host}`).searchParams.get("cartId") || "").trim();
      const result = cartId ? orderHistory.filter((order) => order.cartId === cartId) : orderHistory;
      sendJson(response, 200, result);
      return;
    }

    if (pathname === "/checkout/initialize" && request.method === "POST") {
      try {
        const body = await readJsonBody(request);
        const responsePayload = await initializeCheckout(body);
        sendJson(response, 201, responsePayload);
      } catch (error) {
        sendJson(response, error.statusCode || 500, { message: error.message || "Unable to start checkout" });
      }
      return;
    }

    if (pathname === "/payments/callback" && request.method === "GET") {
      try {
        await handleFlutterwaveCallback(request, response);
      } catch {
        redirectToCheckout(response, "failed", "unknown");
      }
      return;
    }

    if (pathname === "/inventory" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (Array.isArray(body.inventory)) {
        inventory = body.inventory.map(normalizeInventoryItem);
        await saveInventory();
        sendJson(response, 200, inventory);
        return;
      }

      const created = normalizeInventoryItem({
        ...body,
        id: body.id || generateInventoryId(),
        slug: body.slug || slugify(body.name || "new-product")
      });
      inventory.unshift(created);
      await saveInventory();
      sendJson(response, 201, created);
      return;
    }

    const inventoryMatch = pathname.match(/^\/inventory\/([^/]+)$/);
    if (inventoryMatch && (request.method === "PATCH" || request.method === "PUT")) {
      const body = await readJsonBody(request);
      const item = inventory.find((entry) => entry.id === inventoryMatch[1]);
      if (!item) {
        sendJson(response, 404, { message: "Inventory item not found" });
        return;
      }

      Object.assign(item, sanitizeInventoryPatch(body, item));
      item.slug = item.slug || slugify(item.name);
      item.status = resolveStatus(item.stock);
      await saveInventory();
      sendJson(response, 200, item);
      return;
    }

    if (inventoryMatch && request.method === "DELETE") {
      const itemIndex = inventory.findIndex((entry) => entry.id === inventoryMatch[1]);
      if (itemIndex === -1) {
        sendJson(response, 404, { message: "Inventory item not found" });
        return;
      }

      const deleted = inventory[itemIndex];
      inventory.splice(itemIndex, 1);
      await saveInventory();
      sendJson(response, 200, deleted);
      return;
    }

    if (pathname === "/uploads" && request.method === "POST") {
      const body = await readJsonBody(request);
      const upload = await saveUpload(body);
      sendJson(response, 201, upload);
      return;
    }

    if (pathname.startsWith("/uploads/") && request.method === "GET") {
      const filename = decodeURIComponent(pathname.replace("/uploads/", ""));
      const filePath = path.join(uploadsDir, filename);
      if (!filePath.startsWith(uploadsDir) || !fs.existsSync(filePath)) {
        sendJson(response, 404, { message: "File not found" });
        return;
      }

      response.writeHead(200, { "Content-Type": getMimeType(filePath) });
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    sendJson(response, 404, { message: "Not found" });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`API running on http://localhost:${port}`);
  });
}

async function loadInventory() {
  try {
    const raw = await fsp.readFile(inventoryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      const normalized = parsed.map(normalizeInventoryItem);
      await saveInventory(normalized);
      return normalized;
    }
  } catch {}

  await saveInventory(defaultInventory);
  return structuredClone(defaultInventory).map(normalizeInventoryItem);
}

async function loadCartStates() {
  try {
    const raw = await fsp.readFile(cartStatePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed).reduce((accumulator, [cartId, items]) => {
        accumulator[cartId] = Array.isArray(items) ? items.map(normalizeCartItem) : [];
        return accumulator;
      }, {});
    }
  } catch {}

  await saveCartStates({});
  return {};
}

async function loadOrders() {
  try {
    const raw = await fsp.readFile(ordersPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeOrder);
    }
  } catch {}

  await saveOrders([]);
  return [];
}

async function saveInventory(nextInventory = inventory) {
  await fsp.writeFile(inventoryPath, JSON.stringify(nextInventory, null, 2));
}

async function saveCartStates(nextCartStates = cartStates) {
  await fsp.writeFile(cartStatePath, JSON.stringify(nextCartStates, null, 2));
}

async function saveOrders(nextOrders = orderHistory) {
  await fsp.writeFile(ordersPath, JSON.stringify(nextOrders, null, 2));
}

async function saveUpload(body) {
  const name = sanitizeFilename(body.fileName || `upload-${Date.now()}.png`);
  const mimeType = body.mimeType || "image/png";
  const data = String(body.data || body.base64 || "");
  const payload = data.includes(",") ? data.split(",").pop() : data;
  const buffer = Buffer.from(payload, "base64");
  const extension = mimeTypeToExtension(mimeType) || path.extname(name) || ".png";
  const safeName = name.replace(path.extname(name), "") + extension;
  const filePath = path.join(uploadsDir, `${Date.now()}-${safeName}`);
  await fsp.writeFile(filePath, buffer);
  return {
    url: `/uploads/${path.basename(filePath)}`,
    name: path.basename(filePath),
    mimeType
  };
}

function normalizeCartItem(item) {
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

function normalizeOrder(order) {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items.map(normalizeCartItem) : [],
    amountCents: clampStock(order.amountCents || order.totalCents || 0)
  };
}

async function initializeCheckout(body) {
  if (!flutterwaveSecretKey) {
    const error = new Error("Flutterwave is not configured");
    error.statusCode = 503;
    throw error;
  }

  const cartId = String(body.cartId || "").trim() || generateCartId();
  const items = Array.isArray(body.items) ? body.items.map(normalizeCartItem) : [];
  if (!items.length) {
    const error = new Error("Cart is empty");
    error.statusCode = 400;
    throw error;
  }

  const customer = sanitizeCustomer(body.customer);
  const amountCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const txRef = body.txRef || generateTxRef();
  const order = normalizeOrder({
    id: `ORD-${txRef}`,
    txRef,
    cartId,
    items,
    customer,
    currency: String(body.currency || "NGN").toUpperCase(),
    amountCents,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  orderHistory.unshift(order);
  cartStates[cartId] = items;
  await saveOrders();
  await saveCartStates();

  const paymentLink = await createFlutterwavePaymentLink(order);
  order.paymentLink = paymentLink;
  await saveOrders();

  return { order, paymentLink };
}

async function createFlutterwavePaymentLink(order) {
  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${flutterwaveSecretKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tx_ref: order.txRef,
      amount: String(order.amountCents / 100),
      currency: order.currency,
      redirect_url: `${webBaseUrl}/checkout?payment=callback`,
      customer: {
        email: order.customer.email,
        name: order.customer.name,
        phonenumber: order.customer.phone
      },
      customizations: {
        title: "PeaceJewel Checkout",
        description: `Order ${order.txRef}`
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.data?.link) {
    throw new Error(payload?.message || "Unable to initialize Flutterwave payment");
  }

  return payload.data.link;
}

async function handleFlutterwaveCallback(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const txRef = String(url.searchParams.get("tx_ref") || "").trim();
  const transactionId = String(url.searchParams.get("transaction_id") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const order = orderHistory.find((entry) => entry.txRef === txRef);

  if (!order) {
    redirectToCheckout(response, "failed", txRef || "unknown");
    return { handled: true };
  }

  if (status !== "successful" || !transactionId) {
    await markOrder(order.txRef, { status: "failed", paymentStatus: status || "unknown", updatedAt: new Date().toISOString() });
    redirectToCheckout(response, "failed", order.txRef);
    return { handled: true };
  }

  const verification = await verifyFlutterwaveTransaction(transactionId);
  const verified = verification?.data;
  const isSuccessful =
    verified?.status === "successful" &&
    verified?.tx_ref === order.txRef &&
    verified?.currency === order.currency &&
    Number(verified?.amount) * 100 === Number(order.amountCents);

  if (!isSuccessful) {
    await markOrder(order.txRef, {
      status: "failed",
      paymentStatus: verified?.status || "failed",
      transactionId,
      updatedAt: new Date().toISOString()
    });
    redirectToCheckout(response, "failed", order.txRef);
    return { handled: true };
  }

  await markOrder(order.txRef, {
    status: "paid",
    paymentStatus: "successful",
    transactionId,
    updatedAt: new Date().toISOString(),
    paidAt: new Date().toISOString()
  });
  delete cartStates[order.cartId];
  await saveCartStates();
  redirectToCheckout(response, "success", order.txRef);
  return { handled: true };
}

async function verifyFlutterwaveTransaction(transactionId) {
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: {
      Authorization: `Bearer ${flutterwaveSecretKey}`
    }
  });

  if (!response.ok) {
    throw new Error("Unable to verify Flutterwave transaction");
  }

  return response.json();
}

async function markOrder(txRef, updates) {
  const index = orderHistory.findIndex((order) => order.txRef === txRef);
  if (index === -1) return;
  orderHistory[index] = { ...orderHistory[index], ...updates };
  await saveOrders();
}

function redirectToCheckout(response, payment, txRef) {
  response.writeHead(302, {
    Location: `${webBaseUrl}/checkout?payment=${encodeURIComponent(payment)}&tx_ref=${encodeURIComponent(txRef)}`
  });
  response.end();
}

function sanitizeCustomer(customer = {}) {
  return {
    name: String(customer.name || "").trim(),
    email: String(customer.email || "").trim(),
    phone: String(customer.phone || customer.phonenumber || "").trim()
  };
}

function generateCartId() {
  return `CART-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function generateTxRef() {
  return `PJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function normalizeInventoryItem(item) {
  const stock = clampStock(item.stock);
  const priceCents = Math.trunc(Number(item.priceCents ?? item.price ?? 0));
  const name = String(item.name || "Product");
  const category = String(item.category || "rings");
  return {
    id: String(item.id || `PJ-${crypto.randomBytes(3).toString("hex")}`),
    sku: String(item.sku || generateSku(name)),
    slug: String(item.slug || slugify(name)),
    name,
    category,
    description: String(item.description || ""),
    imageUrl: String(item.imageUrl || item.image || "/assets/Vector.png"),
    priceCents,
    stock,
    status: item.status || resolveStatus(stock),
    active: item.active !== false,
    sizes: normalizeList(item.sizes, ["S", "M", "L"]),
    colors: normalizeList(item.colors, ["Gold"]),
    collections: normalizeList(item.collections, []),
    benefitPrimaryText: String(item.benefitPrimaryText || "").trim() || "",
    benefitSecondaryText: String(item.benefitSecondaryText || "").trim() || ""
  };
}

function sanitizeInventoryPatch(body, item) {
  const next = {};
  if (typeof body.name === "string") next.name = body.name.trim();
  if (typeof body.slug === "string") next.slug = slugify(body.slug);
  if (typeof body.category === "string") next.category = body.category.trim();
  if (typeof body.description === "string") next.description = body.description.trim();
  if (typeof body.imageUrl === "string") next.imageUrl = body.imageUrl.trim();
  if (body.priceCents !== undefined || body.price !== undefined) next.priceCents = Math.trunc(Number(body.priceCents ?? body.price));
  if (body.stock !== undefined) next.stock = clampStock(body.stock);
  if (body.active !== undefined) next.active = Boolean(body.active);
  if (body.sizes !== undefined) next.sizes = normalizeList(body.sizes, item.sizes);
  if (body.colors !== undefined) next.colors = normalizeList(body.colors, item.colors);
  if (body.collections !== undefined) next.collections = normalizeList(body.collections, item.collections);
  if (typeof body.benefitPrimaryText === "string") next.benefitPrimaryText = body.benefitPrimaryText.trim();
  if (typeof body.benefitSecondaryText === "string") next.benefitSecondaryText = body.benefitSecondaryText.trim();
  return { ...item, ...next };
}

function toCatalogProduct(item) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: item.category,
    description: item.description,
    imageUrl: item.imageUrl,
    priceCents: item.priceCents,
    price: formatMoney(item.priceCents),
    stock: item.stock,
    status: item.status,
    active: item.active,
    sizes: item.sizes,
    colors: item.colors,
    collections: item.collections,
    benefitPrimaryText: item.benefitPrimaryText,
    benefitSecondaryText: item.benefitSecondaryText
  };
}

function resolveStatus(stock) {
  if (stock <= 0) return "Out of Stock";
  if (stock <= 5) return "Low Stock";
  return "In Stock";
}

function clampStock(stock) {
  return Math.max(0, Math.trunc(Number(stock) || 0));
}

function generateInventoryId() {
  return `PJ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function generateSku(name) {
  const prefix = slugify(name).slice(0, 4).toUpperCase() || "PJ";
  return `PJ-${prefix}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
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

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(cents) {
  return `₦${(Number(cents || 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function sanitizeFilename(value) {
  return String(value)
    .replace(/[^\w.\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `upload-${Date.now()}.png`;
}

function mimeTypeToExtension(mimeType) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    default:
      return "";
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
