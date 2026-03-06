import { renderSeats } from "./poker-render.js";
import { setSocket, setSocketId } from "./shared.js";

const socket = io();
setSocket(socket);

socket.on('connect', () => {
    setSocketId(socket.id);
});

socket.on("gameState", (data) => {
    renderSeats(data);
});

socket.on("yourTurn", (data) => {
    // manejar turno
});

socket.on("timerStart", (data) => {
    // manejar timer
});

// Nuevos listeners
socket.on('publicRooms', (rooms) => {
    const container = document.getElementById('public-rooms-list');
    if (!container) return;
    if (rooms.length === 0) {
        container.innerHTML = '<div style="color:#555; font-size:11px; text-align:center; padding:20px;">No hay salas públicas activas.</div>';
        return;
    }
    container.innerHTML = rooms.map(room => `
        <div class="public-room-card">
            <div class="room-info-text">
                <span class="room-name-id">Sala ${room.id}</span>
                <span class="room-stats">${room.players}/6 jugadores</span>
            </div>
            <button class="btn-join-small" onclick="socket.emit('joinRoom', '${room.id}')">UNIRSE</button>
        </div>
    `).join('');
});

socket.on('serverLog', (data) => {
    const logs = document.getElementById('game-logs');
    if (logs) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = data.message;
        logs.appendChild(entry);
        logs.scrollTop = logs.scrollHeight;
    }
});

export { socket };