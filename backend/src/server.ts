import express from "express";
import http from "http";
import { Server } from "socket.io";
import { registerGameHandlers } from "./handlers/gameHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const frontendPath = path.join(__dirname, "../../frontend");
console.log("📁 Ruta calculada para frontend:", frontendPath);

if (fs.existsSync(frontendPath)) {
  console.log("✅ La carpeta frontend existe.");
} else {
  console.error("❌ La carpeta frontend NO existe en esa ruta.");
}

const indexPath = path.join(frontendPath, "index.html");
if (fs.existsSync(indexPath)) {
  console.log("✅ index.html encontrado en:", indexPath);
} else {
  console.error("❌ No se encontró index.html en:", indexPath);
}

// ✅ CSP corregida para permitir recursos externos
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.setHeader(
  'Content-Security-Policy',
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.socket.io; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; " +
  "connect-src 'self' ws: wss: http://localhost:3000 https://cdn.socket.io;"
);
  next();
});

app.use(express.static(frontendPath));

// Middleware para SPA (rutas no encontradas)
app.use((req, res) => {
  res.sendFile(indexPath);
});

io.on("connection", (socket) => {
  registerGameHandlers(io, socket);
});

server.listen(3000, () => {
  console.log("🚀 Servidor corriendo en http://localhost:3000");
});