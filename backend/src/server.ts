import express from "express";
import http from "http";
import { Server } from "socket.io";
import { registerGameHandlers } from "./handlers/gameHandler.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app    = express();
const server = http.createServer(app);

// ✅ CORS — permite conexiones desde Vite dev server y build preview
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",  // vite dev
      "http://localhost:4173",  // vite preview
      "http://localhost:3000",  // mismo origen (producción)
    ],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

const frontendPath = path.join(__dirname, "../../frontend");

console.log("📁 Ruta calculada para frontend:", frontendPath);

if (fs.existsSync(frontendPath)) {
  console.log("✅ La carpeta frontend existe.");
} else {
  console.warn("⚠️  La carpeta frontend no existe en esa ruta (normal en dev).");
}

// CSP
app.use((req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.socket.io; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "connect-src 'self' ws: wss: http://localhost:3000 http://localhost:5173 https://cdn.socket.io;"
  );
  next();
});

// Servir frontend estático (solo en producción)
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res) => {
    const indexPath = path.join(frontendPath, "index.html");
    res.sendFile(indexPath);
  });
}

// Registrar handlers de Socket.IO
io.on("connection", (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  registerGameHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor corriendo en http://localhost:3000");
});