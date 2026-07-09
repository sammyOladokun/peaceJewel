const http = require("node:http");
const { URL } = require("node:url");

const port = Number(process.env.PORT || 4000);

const products = [
  {
    id: "prod_001",
    slug: "aurora-solitaire-ring",
    name: "Aurora Solitaire Ring",
    category: "engagement",
    description:
      "A refined solitaire ring designed to highlight the brilliance of a single center stone.",
    imageUrl: "/assets/Vector.png"
  },
  {
    id: "prod_002",
    slug: "luna-pearl-necklace",
    name: "Luna Pearl Necklace",
    category: "necklaces",
    description:
      "An elegant pearl necklace for timeless styling, crafted for everyday luxury.",
    imageUrl: "/assets/Vector(1).png"
  }
];

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "peacejewel-api",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (pathname === "/catalog") {
    sendJson(response, 200, products);
    return;
  }

  const productMatch = pathname.match(/^\/catalog\/([^/]+)$/);
  if (productMatch) {
    const product = products.find((item) => item.slug === productMatch[1]);
    if (!product) {
      sendJson(response, 404, { message: "Product not found" });
      return;
    }
    sendJson(response, 200, product);
    return;
  }

  sendJson(response, 404, { message: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${port}`);
});

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
