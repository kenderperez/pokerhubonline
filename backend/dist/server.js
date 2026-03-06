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
// Calculamos la ruta a la carpeta frontend (asumiendo que está al mismo nivel que backend)
// __dirname apunta a: .../CASINO-TECHNICAL/backend/src
// Subimos dos niveles para llegar a la raíz y luego entramos a frontend
const frontendPath = path.join(__dirname, "../../frontend");
console.log("📁 Ruta calculada para frontend:", frontendPath);
// Verificamos si la carpeta existe
if (fs.existsSync(frontendPath)) {
    console.log("✅ La carpeta frontend existe.");
}
else {
    console.error("❌ La carpeta frontend NO existe en esa ruta.");
}
// Verificamos si index.html existe dentro de frontend
const indexPath = path.join(frontendPath, "index.html");
if (fs.existsSync(indexPath)) {
    console.log("✅ index.html encontrado en:", indexPath);
}
else {
    console.error("❌ No se encontró index.html en:", indexPath);
}
// Servir archivos estáticos
app.use(express.static(frontendPath));
// Ruta catch-all para enviar index.html (por si se accede directamente a una ruta como /sala/abc)
app.get('*', (req, res) => {
    res.sendFile(indexPath);
});
// Middleware CSP permisiva (opcional, para evitar bloqueos)
app.use((req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' ws: wss: http://localhost:3000;");
    next();
});
io.on("connection", (socket) => {
    registerGameHandlers(io, socket);
});
server.listen(3000, () => {
    console.log("🚀 Servidor corriendo en http://localhost:3000");
});
//# sourceMappingURL=server.js.map