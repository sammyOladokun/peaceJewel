const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const crypto = require("node:crypto");
const tls = require("node:tls");
const postgres = require("postgres");

const port = Number(process.env.PORT || 4000);
const rootDir = __dirname;
const dataDir = path.join(rootDir, "storage");
const uploadsDir = path.join(rootDir, "uploads");
const inventoryPath = path.join(dataDir, "inventory.json");
const cartStatePath = path.join(dataDir, "cart-state.json");
const ordersPath = path.join(dataDir, "orders.json");
const flutterwaveSecretKey = process.env.FLW_SECRET_KEY || "";
const cloudinaryUrl = process.env.CLOUDINARY_URL || "";
const redisUrl = String(process.env.REDIS_URL || process.env.REDIS_CACHE_URL || "").trim();
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const sql = databaseUrl
  ? postgres(databaseUrl, {
      ssl: "require",
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10
    })
  : null;
const webBaseUrl = (process.env.WEB_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const redisCache = createRedisCache(redisUrl);
const REDIS_CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 350);
const REDIS_COMMAND_TIMEOUT_MS = Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 350);
const REDIS_CACHE_TTL_SECONDS = {
  inventory: 120,
  orders: 60
};
const REDIS_CACHE_KEYS = {
  inventory: "peacejewel:cache:inventory:v1",
  orders: "peacejewel:cache:orders:v1"
};

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
  const cachedInventory = await readCachedJson(REDIS_CACHE_KEYS.inventory);
  if (Array.isArray(cachedInventory) && cachedInventory.length) {
    return cachedInventory.map(normalizeInventoryItem);
  }

  if (sql) {
    try {
      const rows = await sql`
        SELECT
          p.id,
          p.sku,
          p.slug,
          p.name,
          p.category,
          p.description,
          p.price_cents,
          p.stock,
          p.status,
          p.active,
          p.sizes,
          p.colors,
          p.collections,
          p.benefit_primary_text,
          p.benefit_secondary_text,
          COALESCE(
            NULLIF(p.cover_image_url, ''),
            (
              SELECT pi.image_url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
              LIMIT 1
            ),
            '/assets/Vector.png'
          ) AS image_url
        FROM products p
        ORDER BY p.created_at ASC, p.name ASC
      `;

      if (rows.length) {
        const inventoryRows = rows.map(mapProductRowToInventoryItem);
        await writeCachedJson(REDIS_CACHE_KEYS.inventory, inventoryRows, REDIS_CACHE_TTL_SECONDS.inventory);
        return inventoryRows;
      }

      const seeded = structuredClone(defaultInventory).map(normalizeInventoryItem);
      await saveInventory(seeded);
      return seeded;
    } catch (error) {
      console.error("Failed to load inventory from Neon", error);
    }
  }

  try {
    const raw = await fsp.readFile(inventoryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      const normalized = parsed.map(normalizeInventoryItem);
      await saveInventory(normalized);
      await writeCachedJson(REDIS_CACHE_KEYS.inventory, normalized, REDIS_CACHE_TTL_SECONDS.inventory);
      return normalized;
    }
  } catch {}

  await saveInventory(defaultInventory);
  const fallbackInventory = structuredClone(defaultInventory).map(normalizeInventoryItem);
  await writeCachedJson(REDIS_CACHE_KEYS.inventory, fallbackInventory, REDIS_CACHE_TTL_SECONDS.inventory);
  return fallbackInventory;
}

async function loadCartStates() {
  if (sql) {
    try {
      const rows = await sql`
        SELECT cart_id, id, product_id, product_name, image_url, price_cents, quantity, variant, source, created_at
        FROM cart_items
        ORDER BY created_at ASC, id ASC
      `;

      return rows.reduce((accumulator, row) => {
        const cartId = String(row.cart_id || "");
        if (!cartId) return accumulator;
        if (!accumulator[cartId]) accumulator[cartId] = [];
        accumulator[cartId].push({
          id: String(row.product_id || row.id || ""),
          name: String(row.product_name || "Product"),
          image: String(row.image_url || "/assets/Vector.png"),
          priceCents: Math.max(0, Math.round(Number(row.price_cents || 0))),
          quantity: Math.max(1, clampStock(row.quantity || 1)),
          variant: String(row.variant || ""),
          source: String(row.source || "")
        });
        return accumulator;
      }, {});
    } catch (error) {
      console.error("Failed to load cart state from Neon", error);
    }
  }

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
  const cachedOrders = await readCachedJson(REDIS_CACHE_KEYS.orders);
  if (Array.isArray(cachedOrders)) {
    return cachedOrders.map(normalizeOrder);
  }

  if (sql) {
    try {
      const [orderRows, itemRows] = await Promise.all([
        sql`
          SELECT id, tx_ref, cart_id, customer_name, customer_email, customer_phone, currency, amount_cents, status, payment_status, transaction_id, paid_at, created_at, updated_at
          FROM orders
          ORDER BY created_at DESC, id DESC
        `,
        sql`
          SELECT order_id, product_id, product_name, image_url, price_cents, quantity, variant
          FROM order_items
          ORDER BY id ASC
        `
      ]);

      const itemsByOrderId = itemRows.reduce((accumulator, item) => {
        if (!accumulator[item.order_id]) accumulator[item.order_id] = [];
        accumulator[item.order_id].push(normalizeCartItem({
          id: item.product_id,
          name: item.product_name,
          image: item.image_url,
          priceCents: item.price_cents,
          quantity: item.quantity,
          variant: item.variant
        }));
        return accumulator;
      }, {});

      const orders = orderRows.map((row) => normalizeOrder({
        id: String(row.id || ""),
        txRef: String(row.tx_ref || ""),
        cartId: String(row.cart_id || ""),
        customer: {
          name: String(row.customer_name || ""),
          email: String(row.customer_email || ""),
          phone: String(row.customer_phone || "")
        },
        currency: String(row.currency || "NGN"),
        amountCents: Number(row.amount_cents || 0),
        status: String(row.status || "pending"),
        paymentStatus: String(row.payment_status || ""),
        transactionId: String(row.transaction_id || ""),
        paidAt: row.paid_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        items: itemsByOrderId[row.id] || []
      }));
      await writeCachedJson(REDIS_CACHE_KEYS.orders, orders, REDIS_CACHE_TTL_SECONDS.orders);
      return orders;
    } catch (error) {
      console.error("Failed to load orders from Neon", error);
    }
  }

  try {
    const raw = await fsp.readFile(ordersPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const orders = parsed.map(normalizeOrder);
      await writeCachedJson(REDIS_CACHE_KEYS.orders, orders, REDIS_CACHE_TTL_SECONDS.orders);
      return orders;
    }
  } catch {}

  await saveOrders([]);
  await writeCachedJson(REDIS_CACHE_KEYS.orders, [], REDIS_CACHE_TTL_SECONDS.orders);
  return [];
}

async function saveInventory(nextInventory = inventory) {
  const normalized = nextInventory.map(normalizeInventoryItem);

  if (sql) {
    try {
      await sql.begin(async (trx) => {
        for (const item of normalized) {
          await trx`
            INSERT INTO products (
              id, sku, slug, name, category, description, price_cents, stock, status, active,
              sizes, colors, collections, benefit_primary_text, benefit_secondary_text, cover_image_url,
              updated_at
            ) VALUES (
              ${item.id}, ${item.sku}, ${item.slug}, ${item.name}, ${item.category}, ${item.description},
              ${item.priceCents}, ${item.stock}, ${item.status}, ${item.active},
              ${item.sizes}, ${item.colors}, ${item.collections}, ${item.benefitPrimaryText},
              ${item.benefitSecondaryText}, ${item.imageUrl}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              sku = EXCLUDED.sku,
              slug = EXCLUDED.slug,
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              description = EXCLUDED.description,
              price_cents = EXCLUDED.price_cents,
              stock = EXCLUDED.stock,
              status = EXCLUDED.status,
              active = EXCLUDED.active,
              sizes = EXCLUDED.sizes,
              colors = EXCLUDED.colors,
              collections = EXCLUDED.collections,
              benefit_primary_text = EXCLUDED.benefit_primary_text,
              benefit_secondary_text = EXCLUDED.benefit_secondary_text,
              cover_image_url = EXCLUDED.cover_image_url,
              updated_at = NOW()
          `;

          if (item.imageUrl) {
            const existingPrimary = await trx`
              SELECT id
              FROM product_images
              WHERE product_id = ${item.id} AND is_primary = TRUE
              ORDER BY sort_order ASC, id ASC
              LIMIT 1
            `;

            if (existingPrimary.length) {
              await trx`
                UPDATE product_images
                SET image_url = ${item.imageUrl},
                    alt_text = ${item.name},
                    sort_order = 0,
                    is_primary = TRUE
                WHERE id = ${existingPrimary[0].id}
              `;
            } else {
              await trx`
                INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
                VALUES (${item.id}, ${item.imageUrl}, ${item.name}, 0, TRUE)
              `;
            }
          }
        }
      });
      await writeCachedJson(REDIS_CACHE_KEYS.inventory, normalized, REDIS_CACHE_TTL_SECONDS.inventory);
      return;
    } catch (error) {
      console.error("Failed to save inventory to Neon", error);
    }
  }

  await fsp.writeFile(inventoryPath, JSON.stringify(normalized, null, 2));
  await writeCachedJson(REDIS_CACHE_KEYS.inventory, normalized, REDIS_CACHE_TTL_SECONDS.inventory);
}

async function saveCartStates(nextCartStates = cartStates) {
  if (sql) {
    try {
      await sql.begin(async (trx) => {
        await trx`DELETE FROM cart_items`;
        for (const [cartId, items] of Object.entries(nextCartStates || {})) {
          for (const item of Array.isArray(items) ? items.map(normalizeCartItem) : []) {
            await trx`
              INSERT INTO cart_items (
                cart_id, product_id, product_name, image_url, price_cents, quantity, variant, source, created_at
              ) VALUES (
                ${String(cartId)}, ${item.id}, ${item.name}, ${item.image}, ${item.priceCents},
                ${item.quantity}, ${item.variant}, ${item.source}, NOW()
              )
            `;
          }
        }
      });
      return;
    } catch (error) {
      console.error("Failed to save cart state to Neon", error);
    }
  }

  await fsp.writeFile(cartStatePath, JSON.stringify(nextCartStates, null, 2));
}

async function saveOrders(nextOrders = orderHistory) {
  const normalizedOrders = nextOrders.map(normalizeOrder);

  if (sql) {
    try {
      await sql.begin(async (trx) => {
        await trx`DELETE FROM order_items`;
        await trx`DELETE FROM orders`;

        for (const order of normalizedOrders) {
          await trx`
            INSERT INTO orders (
              id, tx_ref, cart_id, customer_name, customer_email, customer_phone, currency,
              amount_cents, status, payment_status, transaction_id, paid_at, created_at, updated_at
            ) VALUES (
              ${order.id}, ${order.txRef}, ${order.cartId},
              ${String(order.customer?.name || "")},
              ${String(order.customer?.email || "")},
              ${String(order.customer?.phone || "")},
              ${String(order.currency || "NGN")},
              ${Number(order.amountCents || 0)},
              ${String(order.status || "pending")},
              ${String(order.paymentStatus || "")},
              ${String(order.transactionId || "")},
              ${order.paidAt || null},
              ${order.createdAt || new Date().toISOString()},
              ${order.updatedAt || new Date().toISOString()}
            )
          `;

          for (const item of Array.isArray(order.items) ? order.items.map(normalizeCartItem) : []) {
            await trx`
              INSERT INTO order_items (
                order_id, product_id, product_name, image_url, price_cents, quantity, variant
              ) VALUES (
                ${order.id}, ${item.id}, ${item.name}, ${item.image}, ${item.priceCents}, ${item.quantity}, ${item.variant}
              )
            `;
          }
        }
      });
      await writeCachedJson(REDIS_CACHE_KEYS.orders, normalizedOrders, REDIS_CACHE_TTL_SECONDS.orders);
      return;
    } catch (error) {
      console.error("Failed to save orders to Neon", error);
    }
  }

  await fsp.writeFile(ordersPath, JSON.stringify(normalizedOrders, null, 2));
  await writeCachedJson(REDIS_CACHE_KEYS.orders, normalizedOrders, REDIS_CACHE_TTL_SECONDS.orders);
}

async function readCachedJson(key) {
  const client = redisCache || createRedisCache();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function writeCachedJson(key, value, ttlSeconds) {
  const client = redisCache || createRedisCache();
  if (!client) return false;

  try {
    await client.set(key, JSON.stringify(value), ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

function createRedisCache() {
  if (!redisUrl) return null;
  if (!createRedisCache.instance) {
    createRedisCache.instance = new RedisCacheClient(redisUrl);
  }
  return createRedisCache.instance;
}

class RedisCacheClient {
  constructor(value) {
    this.value = value;
    this.socket = null;
    this.connecting = null;
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    this.disabled = false;
    this.url = null;
  }

  async get(key) {
    const reply = await this.send("GET", key);
    return typeof reply === "string" ? reply : null;
  }

  async set(key, value, ttlSeconds) {
    const ttl = Math.max(1, Math.trunc(Number(ttlSeconds || 0)));
    const args = ["SET", key, value];
    if (ttl > 0) {
      args.push("EX", String(ttl));
    }
    await this.send(...args);
    return true;
  }

  async del(key) {
    await this.send("DEL", key);
    return true;
  }

  async send(...args) {
    const socket = await this.connect();
    if (!socket) return null;

    return new Promise((resolve, reject) => {
      const pending = { resolve, reject, timer: null };
      pending.timer = setTimeout(() => {
        this.removePending(pending);
        resolve(null);
      }, REDIS_COMMAND_TIMEOUT_MS);
      this.pending.push(pending);
      socket.write(encodeRedisCommand(args));
    });
  }

  async connect() {
    if (this.disabled) return null;
    if (this.socket) return this.socket;
    if (this.connecting) return this.connecting;

    this.connecting = withTimeout(this.open(), REDIS_CONNECT_TIMEOUT_MS).finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  async open() {
    let url;
    try {
      url = new URL(this.value);
    } catch {
      this.disabled = true;
      return null;
    }

    if (!["redis:", "rediss:"].includes(url.protocol)) {
      this.disabled = true;
      return null;
    }

    if (url.protocol === "redis:" && !isLocalRedisHost(url.hostname)) {
      console.warn("Redis URL should use rediss:// outside local development.");
    }

    const useTls = url.protocol === "rediss:";
    const port = Number(url.port || (useTls ? 6380 : 6379));
    const hostname = url.hostname;
    const databaseIndex = Number(String(url.pathname || "/").replace(/^\//, "")) || 0;
    const username = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");

    const socket = useTls
      ? tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true })
      : net.createConnection({ host: hostname, port });

    socket.setNoDelay(true);
    socket.on("data", (chunk) => this.handleData(chunk));
    socket.on("error", () => this.dropSocket());
    socket.on("close", () => this.dropSocket());

    try {
      const connected = await waitForSocketReady(socket, REDIS_CONNECT_TIMEOUT_MS);
      if (!connected) {
        this.disabled = true;
        this.dropSocket();
        return null;
      }

      this.socket = socket;

      if (password) {
        if (username) {
          await this.send("AUTH", username, password);
        } else {
          await this.send("AUTH", password);
        }
      }

      if (databaseIndex > 0) {
        await this.send("SELECT", String(databaseIndex));
      }

      return socket;
    } catch (error) {
      this.disabled = true;
      this.dropSocket();
      return null;
    }
  }

  dropSocket() {
    this.socket = null;
    this.buffer = Buffer.alloc(0);

    while (this.pending.length) {
      const pending = this.pending.shift();
      if (pending?.timer) clearTimeout(pending.timer);
      pending?.resolve?.(null);
    }
  }

  removePending(pendingEntry) {
    const index = this.pending.indexOf(pendingEntry);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }
    if (pendingEntry?.timer) {
      clearTimeout(pendingEntry.timer);
    }
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const parsed = parseRedisReply(this.buffer);
      if (!parsed.complete) return;
      this.buffer = this.buffer.slice(parsed.consumed);
      const next = this.pending.shift();
      if (!next) continue;
      if (next.timer) clearTimeout(next.timer);

      if (parsed.value instanceof Error) {
        next.reject(parsed.value);
      } else {
        next.resolve(parsed.value);
      }
    }
  }
}

function encodeRedisCommand(args) {
  const parts = args.map((part) => Buffer.from(String(part)));
  const chunks = [Buffer.from(`*${parts.length}\r\n`)];
  for (const part of parts) {
    chunks.push(Buffer.from(`$${part.length}\r\n`));
    chunks.push(part);
    chunks.push(Buffer.from("\r\n"));
  }
  return Buffer.concat(chunks);
}

function parseRedisReply(buffer) {
  if (!buffer.length) return { complete: false, consumed: 0, value: null };

  const prefix = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return { complete: false, consumed: 0, value: null };

  const line = buffer.slice(1, lineEnd).toString("utf8");
  const consumedLine = lineEnd + 2;

  if (prefix === "+") {
    return { complete: true, consumed: consumedLine, value: line };
  }

  if (prefix === "-") {
    return { complete: true, consumed: consumedLine, value: new Error(line) };
  }

  if (prefix === ":") {
    return { complete: true, consumed: consumedLine, value: Number(line) };
  }

  if (prefix === "$") {
    const length = Number(line);
    if (Number.isNaN(length)) return { complete: true, consumed: consumedLine, value: null };
    if (length === -1) {
      return { complete: true, consumed: consumedLine, value: null };
    }

    const end = consumedLine + length;
    if (buffer.length < end + 2) return { complete: false, consumed: 0, value: null };
    return {
      complete: true,
      consumed: end + 2,
      value: buffer.slice(consumedLine, end).toString("utf8")
    };
  }

  if (prefix === "*") {
    const count = Number(line);
    if (Number.isNaN(count) || count === -1) {
      return { complete: true, consumed: consumedLine, value: null };
    }

    let cursor = consumedLine;
    const items = [];
    for (let index = 0; index < count; index += 1) {
      const parsed = parseRedisReply(buffer.slice(cursor));
      if (!parsed.complete) return { complete: false, consumed: 0, value: null };
      items.push(parsed.value);
      cursor += parsed.consumed;
    }

    return { complete: true, consumed: cursor, value: items };
  }

  return { complete: true, consumed: consumedLine, value: line };
}

function isLocalRedisHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());
}

function waitForSocketReady(socket, timeoutMs) {
  const timeout = Math.max(1, Math.trunc(Number(timeoutMs || 0)));
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onReady);
      socket.off("secureConnect", onReady);
      socket.off("error", onError);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => {
      try {
        socket.destroy();
      } catch {}
      finish(false);
    }, timeout);

    socket.once("connect", onReady);
    socket.once("secureConnect", onReady);
    socket.once("error", onError);
  });
}

async function saveUpload(body) {
  const name = sanitizeFilename(body.fileName || `upload-${Date.now()}.png`);
  const mimeType = body.mimeType || "image/png";
  const data = String(body.data || body.base64 || "");
  const payload = data.includes(",") ? data.split(",").pop() : data;
  if (cloudinaryUrl) {
    return uploadToCloudinary({ name, mimeType, payload });
  }

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

async function uploadToCloudinary({ name, mimeType, payload }) {
  const config = parseCloudinaryUrl(cloudinaryUrl);
  const buffer = Buffer.from(payload, "base64");
  const publicId = sanitizeFilename(name.replace(path.extname(name), "")) || `peacejewel-${Date.now()}`;
  const formData = new FormData();
  formData.append("file", new Blob([buffer], { type: mimeType }), name);
  formData.append("folder", "peacejewel/products");
  formData.append("public_id", publicId);
  formData.append("use_filename", "true");
  formData.append("unique_filename", "true");
  formData.append("overwrite", "true");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}`
    },
    body: formData
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.secure_url) {
    throw new Error(result?.error?.message || "Unable to upload image to Cloudinary");
  }

  return {
    url: result.secure_url,
    name: result.original_filename ? `${result.original_filename}.${result.format || mimeTypeToExtension(mimeType).replace(".", "")}` : path.basename(result.secure_url),
    mimeType,
    publicId: result.public_id,
    assetId: result.asset_id
  };
}

function parseCloudinaryUrl(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("cloudinary://")) {
    throw new Error("CLOUDINARY_URL is invalid");
  }

  const withoutScheme = raw.slice("cloudinary://".length);
  const atIndex = withoutScheme.lastIndexOf("@");
  const credentials = atIndex >= 0 ? withoutScheme.slice(0, atIndex) : "";
  const cloudName = atIndex >= 0 ? withoutScheme.slice(atIndex + 1) : "";
  const colonIndex = credentials.indexOf(":");
  if (!credentials || !cloudName || colonIndex === -1) {
    throw new Error("CLOUDINARY_URL is invalid");
  }

  return {
    apiKey: decodeURIComponent(credentials.slice(0, colonIndex)),
    apiSecret: decodeURIComponent(credentials.slice(colonIndex + 1)),
    cloudName: decodeURIComponent(cloudName)
  };
}

function mapProductRowToInventoryItem(row) {
  return normalizeInventoryItem({
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
    priceCents: row.price_cents,
    stock: row.stock,
    status: row.status,
    active: row.active,
    sizes: row.sizes,
    colors: row.colors,
    collections: row.collections,
    benefitPrimaryText: row.benefit_primary_text,
    benefitSecondaryText: row.benefit_secondary_text
  });
}

function optimizeImageUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("/assets/") || rawUrl.startsWith("/uploads/")) {
    return rawUrl;
  }

  if (!/^https?:\/\/res\.cloudinary\.com\//.test(rawUrl) || rawUrl.includes("/f_auto,q_84/")) {
    return rawUrl;
  }

  return rawUrl.replace(/\/upload\/(?!f_auto,q_84\/)/, "/upload/f_auto,q_84/");
}

function normalizeCartItem(item) {
  return {
    id: String(item.id || ""),
    name: String(item.name || "Product"),
    image: optimizeImageUrl(String(item.image || item.imageUrl || "/assets/Vector.png")),
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
    imageUrl: optimizeImageUrl(String(item.imageUrl || item.image || "/assets/Vector.png")),
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
    imageUrl: optimizeImageUrl(item.imageUrl),
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
