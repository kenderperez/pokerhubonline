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

// ✅ CORS habilitado para Vite (dev) y producción
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",  // Vite dev server
      "http://localhost:4173",  // Vite preview
      "http://localhost:3000",  // Mismo origen en producción
    ],
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// ── Servir frontend en PRODUCCIÓN ─────────────────────────────────────────────
// En desarrollo Vite corre en su propio puerto, esto solo aplica para el build
const frontendPath = path.join(__dirname, "../../frontend-react-casino/dist");

if (fs.existsSync(frontendPath)) {
  console.log("✅ Frontend build encontrado:", frontendPath);
  app.use(express.static(frontendPath));
  app.use((req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  console.log("ℹ️  Sin build de frontend — modo desarrollo (usa Vite en puerto 5173)");
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅ Socket conectado: ${socket.id}`);
  registerGameHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log(`❌ Socket desconectado: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor corriendo en http://localhost:3000");
});