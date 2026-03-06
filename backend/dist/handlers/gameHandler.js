import { PokerEngine } from '../engine/pokerEngine.js';
const rooms = {};
function getRoomId(socket) {
    const rooms = Array.from(socket.rooms.values());
    return rooms.find(r => r !== socket.id) || null;
}
function broadcastState(io, roomId) {
    const room = rooms[roomId];
    if (!room)
        return;
    const gameState = {
        seats: room.seats.map(seat => {
            if (!seat)
                return null;
            return {
                id: seat.id,
                name: seat.name,
                balance: seat.balance,
                currentBet: seat.currentBet,
                active: seat.active,
                holeCards: seat.holeCards,
                lastAction: seat.lastAction,
                actionId: seat.actionId
            };
        }),
        gameState: room.gameState,
        handState: room.handState,
        pot: room.pot,
        currentBet: room.currentBet,
        currentTurnIndex: room.turnIndex,
        dealerIndex: room.dealerIndex,
        sbIndex: room.sbIndex,
        bbIndex: room.bbIndex,
        winningCards: []
    };
    io.to(roomId).emit('gameState', gameState);
}
function updateGlobalLobby(io) {
    const publicRooms = Object.values(rooms)
        .filter(r => r.isPublic)
        .map(r => ({ id: r.id, players: r.seats.filter(s => s).length }));
    io.emit('publicRooms', publicRooms);
}
function joinClientToRoom(io, socket, roomId, address, name) {
    const room = rooms[roomId];
    if (!room)
        return socket.emit('error', 'Sala no encontrada');
    room.clients[socket.id] = { id: socket.id, address: address || '', name: name || 'Jugador' };
    socket.join(roomId);
    socket.emit('roomJoined', {
        roomId,
        isHost: room.host === socket.id,
        type: room.type
    });
    io.to(roomId).emit('serverLog', { message: `👁️ ${name || 'Jugador'} entró como espectador.`, type: 'log-info' });
    broadcastState(io, roomId);
}
export function registerGameHandlers(io, socket) {
    socket.on('createRoom', ({ address, name, type, visibility }) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = {
            id: roomId,
            host: socket.id,
            seats: new Array(6).fill(null),
            clients: {},
            engine: new PokerEngine(),
            gameState: 'WAITING',
            handState: 'WAITING',
            pot: 0,
            currentBet: 0,
            turnIndex: -1,
            dealerIndex: -1,
            sbIndex: -1,
            bbIndex: -1,
            type: type || 'free',
            isPublic: visibility === 'public',
            turnTimer: null,
            leaderboard: {}
        };
        joinClientToRoom(io, socket, roomId, address, name);
        updateGlobalLobby(io);
    });
    socket.on('sitDown', (seatIndex) => {
        const roomId = getRoomId(socket);
        if (!roomId)
            return;
        const room = rooms[roomId];
        if (!room || room.gameState === 'PLAYING' || room.seats[seatIndex] !== null)
            return;
        if (room.seats.some(s => s && s.id === socket.id))
            return;
        const client = room.clients[socket.id];
        if (!client)
            return;
        room.seats[seatIndex] = {
            id: client.id,
            address: client.address,
            name: client.name,
            balance: room.type === 'free' ? 1000 : 0,
            holeCards: [],
            currentBet: 0,
            active: true,
            acted: false,
            isAllIn: false,
            lastAction: '',
            actionId: 0
        };
        io.to(roomId).emit('serverLog', { message: `🪙 ${client.name} se sentó en la mesa.`, type: 'log-info' });
        broadcastState(io, roomId);
        updateGlobalLobby(io);
    });
    socket.on('playerAction', (action) => {
        const roomId = getRoomId(socket);
        if (!roomId)
            return;
        // Por ahora solo reenviamos, pero deberías implementar la lógica real
        io.to(roomId).emit('playerAction', { player: socket.id, action });
    });
    socket.on('sendChat', (msg) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            const client = rooms[roomId]?.clients[socket.id];
            io.to(roomId).emit('receiveChat', {
                user: client?.name || 'Desconocido',
                message: msg
            });
        }
    });
    socket.on('requestMatchmaking', () => {
        const availableRooms = Object.values(rooms).filter(r => r.isPublic &&
            r.gameState === 'WAITING' &&
            r.seats.filter(s => s !== null).length < 6);
        if (availableRooms.length === 0) {
            return socket.emit('serverLog', { message: "❌ No hay salas públicas disponibles. ¡Crea una!", type: 'log-error' });
        }
        availableRooms.sort((a, b) => {
            const countA = a.seats.filter(s => s !== null).length;
            const countB = b.seats.filter(s => s !== null).length;
            return countB - countA;
        });
        const best = availableRooms[0];
        if (best)
            socket.emit('matchmakingResult', best.id);
    });
    socket.on('startGameRequest', () => {
        const roomId = getRoomId(socket);
        if (!roomId)
            return;
        const room = rooms[roomId];
        if (!room || room.host !== socket.id)
            return;
        const playersCount = room.seats.filter(s => s !== null).length;
        if (playersCount < 2) {
            io.to(roomId).emit('serverLog', { message: 'Se necesitan al menos 2 jugadores', type: 'log-error' });
            return;
        }
        room.gameState = 'PLAYING';
        room.handState = 'PREFLOP';
        room.engine = new PokerEngine();
        room.engine.startGame(playersCount);
        const seatedPlayers = room.seats.filter(s => s !== null);
        seatedPlayers.forEach((player, idx) => {
            if (player) {
                player.holeCards = room.engine.players[idx]?.holeCards || [];
                player.active = true;
            }
        });
        // Asignar ciegas (simplificado)
        room.dealerIndex = 0;
        room.sbIndex = 1;
        room.bbIndex = 2;
        room.turnIndex = room.bbIndex;
        broadcastState(io, roomId);
    });
}
//# sourceMappingURL=gameHandler.js.map