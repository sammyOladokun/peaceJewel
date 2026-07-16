const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const assetsDir = path.join(rootDir, "..", "..", "assets");

const html = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const catalogHtml = fs.readFileSync(path.join(rootDir, "catalog.html"), "utf8");
const productHtml = fs.readFileSync(path.join(rootDir, "product.html"), "utf8");
const css = fs.readFileSync(path.join(rootDir, "styles.css"), "utf8");
const menuJs = fs.readFileSync(path.join(rootDir, "menu.js"), "utf8");

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

  if (requestPath === "/product") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(productHtml);
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
