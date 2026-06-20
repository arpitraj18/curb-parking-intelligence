/* CURB local dev server — no dependencies, Node 18+.
   Serves the site AND runs the /api/assistant function so you can test live Gemini.
   Usage:  node dev-server.js   →   http://localhost:3000
   (Put your key in a .env file first: GEMINI_API_KEY=...)                       */
const http = require("http"), fs = require("fs"), path = require("path"), url = require("url");

// load .env (simple parser)
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach(function (line) {
    var m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) { /* no .env — assistant will use offline fallback */ }

var assistant = require("./api/assistant.js");
var MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

http.createServer(function (req, res) {
  var u = url.parse(req.url, true);

  if (u.pathname === "/api/assistant") {
    req.query = u.query;
    res.status = function (c) { this.statusCode = c; return this; };
    res.json = function (o) { this.setHeader("Content-Type", "application/json"); this.end(JSON.stringify(o)); return this; };
    return assistant(req, res);
  }

  var p = decodeURIComponent(u.pathname);
  if (p === "/") p = "/index.html";
  var file = path.normalize(path.join(__dirname, p));
  if (file.indexOf(__dirname) !== 0) { res.statusCode = 403; return res.end("Forbidden"); }
  fs.readFile(file, function (e, data) {
    if (e) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(3000, function () {
  console.log("\n  CURB running →  http://localhost:3000");
  console.log("  AI mode: " + (process.env.GEMINI_API_KEY ? "LIVE (Gemini)" : "offline fallback (no GEMINI_API_KEY found)") + "\n");
});
