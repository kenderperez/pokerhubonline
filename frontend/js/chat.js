import { socket } from "./socket-client.js";

// Exportamos la función para que otros módulos puedan importarla
export function sendChat() {
    const input = document.getElementById('chat-input');
    if (input && input.value) {
        socket.emit('sendChat', input.value);
        input.value = '';
    }
}

// También la hacemos global para el onclick del HTML
window.sendChat = sendChat;

// Escuchar mensajes
socket.on('receiveChat', (data) => {
    const box = document.getElementById('chat-messages');
    if (box) {
        box.innerHTML += `<div><b style="color:#6a5ce7">${data.user}:</b> ${data.message}</div>`;
        box.scrollTop = box.scrollHeight;
    }
});