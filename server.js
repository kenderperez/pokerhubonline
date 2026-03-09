const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const PokerEngine = require('./pokerEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log(`Jugador conectado: ${socket.id}`);

    // --- 1. LÓGICA DE LOBBY ---
    
    // Enviar lista de salas públicas al cliente que lo pida
    socket.on('requestPublicRooms', () => {
        sendPublicRooms(socket);
    });

    // Matchmaking: Buscar la mejor sala disponible
    socket.on('requestMatchmaking', () => {
        const availableRooms = Object.values(rooms).filter(r => 
            r.isPublic && 
            r.gameState === 'WAITING' && 
            r.seats.filter(s => s !== null).length < 6
        );

        if (availableRooms.length === 0) {
            return socket.emit('serverLog', { message: "\u{274C} No hay salas públicas disponibles. ¡Crea una!", type: "log-error" });
        }

        // Prioridad: Salas con MÁS jugadores (para que empiecen rápido)
        availableRooms.sort((a, b) => {
            const countA = a.seats.filter(s => s !== null).length;
            const countB = b.seats.filter(s => s !== null).length;
            return countB - countA;
        });

        socket.emit('matchmakingResult', availableRooms[0].id);
    });

    // --- 2. GESTIÓN DE SALAS ---

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
        joinClientToRoom(socket, roomId, address, name);
        updateGlobalLobby();
    });

    socket.on('joinRoom', ({ roomId, walletAddress, name }) => {
        joinClientToRoom(socket, roomId, walletAddress, name);
    });

    function joinClientToRoom(socket, roomId, walletAddress, name) {
        const room = rooms[roomId];
        if (!room) return socket.emit('error', 'Sala no encontrada');

        room.clients[socket.id] = { id: socket.id, address: walletAddress, name: name || "Jugador" };
        socket.join(roomId);
        
        socket.emit('roomJoined', { 
            roomId, 
            isHost: room.host === socket.id, 
            type: room.type 
        });
        
        io.to(roomId).emit('serverLog', { message: `\u{1F441}\u{FE0F} ${name || "Jugador"} entró como espectador.`, type: "log-info" });
        broadcastState(roomId);
    }

    socket.on('sitDown', (seatIndex) => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (!room || room.gameState === 'PLAYING' || room.seats[seatIndex] !== null) return;
        if (room.seats.some(s => s && s.id === socket.id)) return;

        const client = room.clients[socket.id];
        room.seats[seatIndex] = {
            id: client.id,
            address: client.address,
            name: client.name,
            balance: room.type === 'free' ? 1000 : 0, 
            holeCards: [],
            currentBet: 0,
            active: false,
            acted: false,
            isAllIn: false,
            lastAction: "",
            actionId: 0
        };
        
        io.to(roomId).emit('serverLog', { message: `\u{1FA91} ${client.name} se sentó en la mesa.`, type: "log-info" });
        broadcastState(roomId);
        updateGlobalLobby(); // Actualizar conteo en el lobby
    });

    // --- 3. INICIO Y FLUJO ---

    socket.on('startGameRequest', () => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        
        if (room && room.host === socket.id && room.gameState === 'WAITING') {
            const seatedCount = room.seats.filter(s => s !== null).length;
            if (seatedCount < 2) return socket.emit('serverLog', { message: "Se necesitan al menos 2 jugadores", type: "log-error" });
            
            // Reiniciar balances al inicio del torneo
            room.seats.forEach(s => { if(s) s.balance = 1000; });
            
            room.gameState = 'PLAYING';
            io.to(roomId).emit('serverLog', { message: "\u{1F525} ¡EL TORNEO HA COMENZADO! \u{1F525}", type: "log-win" });
            room.dealerIndex = getNextOccupiedSeat(room.seats, -1);
            startNewHand(room);
            updateGlobalLobby(); // Sala ya no disponible para matchmaking
        }
    });

    socket.on('playerAction', ({ action, amount }) => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (!room) return;

        const player = room.seats[room.turnIndex];
        if (!player || player.id !== socket.id) return;

        clearTimeout(room.turnTimer); 
        processAction(room, player, action, amount);
    });

    function processAction(room, player, action, amount) {
        player.acted = true;
        player.lastAction = (action === 'call' && room.currentBet === player.currentBet) ? "CHECK" : action.toUpperCase();
        player.actionId = Date.now();

        if (action === 'fold') {
            player.active = false;
        } else if (action === 'call') {
            let diff = room.currentBet - player.currentBet;
            if (diff >= player.balance) { diff = player.balance; player.isAllIn = true; }
            player.balance -= diff;
            player.currentBet += diff;
            room.pot += diff;
        } else if (action === 'raise' || action === 'allin') {
            let diff = action === 'allin' ? player.balance : (amount - player.currentBet);
            if (diff >= player.balance) { diff = player.balance; player.isAllIn = true; }
            const totalBet = player.currentBet + diff;
            player.balance -= diff;
            player.currentBet = totalBet;
            room.pot += diff;
            if (totalBet > room.currentBet) room.currentBet = totalBet;
        }

        io.to(room.id).emit('serverLog', { message: `${player.name}: ${player.lastAction}`, type: "log-bet" });
        checkRoundEnd(room);
    }

    function checkRoundEnd(room) {
        const activePlayers = room.seats.filter(p => p && p.active);
        if (activePlayers.length === 1) { showdown(room, activePlayers[0]); return; }

        const bettingComplete = activePlayers.every(p => p.isAllIn || (p.currentBet === room.currentBet && p.acted));

        if (bettingComplete) {
            const playersWithChips = activePlayers.filter(p => !p.isAllIn);
            if (playersWithChips.length <= 1) fastForwardToShowdown(room);
            else advancePhase(room);
        } else {
            moveToNextPlayer(room);
        }
    }

    function advancePhase(room) {
        // RIVER FIX: Si ya terminó la ronda del River, ir a Showdown
        if (room.handState === 'RIVER') {
            showdown(room);
            return;
        }

        room.seats.forEach(p => { if(p) { p.currentBet = 0; p.acted = false; }});
        room.currentBet = 0;

        if (room.handState === 'PREFLOP') { room.engine.dealFlop(); room.handState = 'FLOP'; }
        else if (room.handState === 'FLOP') { room.engine.dealTurn(); room.handState = 'TURN'; }
        else if (room.handState === 'TURN') { room.engine.dealRiver(); room.handState = 'RIVER'; }

        room.turnIndex = room.dealerIndex; 
        moveToNextPlayer(room);
        broadcastState(room.id);
    }

    function fastForwardToShowdown(room) {
        room.seats.forEach(p => { if(p) p.currentBet = 0; });
        room.currentBet = 0;
        while (room.handState !== 'RIVER') {
            if (room.handState === 'PREFLOP') { room.engine.dealFlop(); room.handState = 'FLOP'; }
            else if (room.handState === 'FLOP') { room.engine.dealTurn(); room.handState = 'TURN'; }
            else if (room.handState === 'TURN') { room.engine.dealRiver(); room.handState = 'RIVER'; }
        }
        broadcastState(room.id);
        setTimeout(() => showdown(room), 2000);
    }

    function startNewHand(room) {
        room.seats.forEach((p, i) => {
            if (p && p.balance <= 0) {
                io.to(room.id).emit('serverLog', { message: `\u{274C} ${p.name} eliminado.`, type: "log-error" });
                room.seats[i] = null;
            }
            if (p) { p.lastAction = ""; p.actionId = 0; p.bestHandName = ""; }
        });

        const seatedPlayers = room.seats.filter(p => p !== null);
        if (seatedPlayers.length === 1) {
            const champion = seatedPlayers[0];
            room.leaderboard[champion.name] = (room.leaderboard[champion.name] || 0) + 1;
            io.to(room.id).emit('serverLog', { message: `\u{1F3C6} ¡${champion.name} ES EL CAMPEÓN!`, type: "log-win" });
            room.gameState = 'WAITING';
            broadcastState(room.id);
            updateGlobalLobby();
            return;
        }

        room.handState = 'PREFLOP';
        room.pot = 0;
        room.currentBet = 20; 
        
        room.dealerIndex = getNextOccupiedSeat(room.seats, room.dealerIndex);
        room.sbIndex = getNextOccupiedSeat(room.seats, room.dealerIndex);
        room.bbIndex = getNextOccupiedSeat(room.seats, room.sbIndex);
        room.turnIndex = getNextOccupiedSeat(room.seats, room.bbIndex);

        room.engine.startGame(seatedPlayers.length);
        
        let engineIdx = 0;
        room.seats.forEach((p, i) => {
            if (p) {
                p.holeCards = room.engine.players[engineIdx].holeCards;
                p.engineId = engineIdx;
                p.active = true;
                p.acted = false;
                p.currentBet = 0;
                p.isAllIn = false;
                
                if (i === room.sbIndex) { p.balance -= 10; p.currentBet = 10; room.pot += 10; }
                if (i === room.bbIndex) { p.balance -= 20; p.currentBet = 20; room.pot += 20; }
                
                io.to(p.id).emit('receiveHoleCards', p.holeCards);
                engineIdx++;
            }
        });

        broadcastState(room.id);
        startTurnTimer(room);
    }

    function showdown(room, loneWinner = null) {
        clearTimeout(room.turnTimer);
        
        if (loneWinner) {
            loneWinner.balance += room.pot;
            io.to(room.id).emit('serverLog', { message: `\u{1F4B0} ${loneWinner.name} gana $${room.pot}`, type: "log-win" });
        } else {
            room.seats.forEach((p) => {
                if (p && p.active) room.engine.evaluatePlayer(room.engine.players[p.engineId]);
            });

            const engineWinners = room.engine.determineWinners();
            const winners = room.seats.filter(p => 
                p && engineWinners.some(ew => room.engine.players.indexOf(ew) === p.engineId)
            );

            const splitAmount = Math.floor(room.pot / winners.length);
            winners.forEach(w => {
                w.balance += splitAmount;
                const handName = engineWinners[0].bestHand;
                io.to(room.id).emit('serverLog', { message: `\u{1F4B0} ¡${w.name} gana $${splitAmount} con ${handName}!`, type: "log-win" });
            });
        }

        room.handState = 'SHOWDOWN';
        broadcastState(room.id);
        setTimeout(() => startNewHand(room), 7000);
    }

    // --- 4. UTILIDADES Y BROADCAST ---

    function startTurnTimer(room) {
        clearTimeout(room.turnTimer);
        const currentPlayer = room.seats[room.turnIndex];
        
        if (currentPlayer && currentPlayer.active && !currentPlayer.isAllIn) {
            const timeLimit = 20000; 
            io.to(room.id).emit('timerStart', { seatIndex: room.turnIndex, time: timeLimit });
            sendTurnNotification(room);

            room.turnTimer = setTimeout(() => {
                const action = (room.currentBet - currentPlayer.currentBet === 0) ? 'call' : 'fold';
                processAction(room, currentPlayer, action, 0);
            }, timeLimit);
        } else if (room.gameState === 'PLAYING') {
            moveToNextPlayer(room);
        }
    }

    function moveToNextPlayer(room) {
        let loops = 0;
        do {
            room.turnIndex = (room.turnIndex + 1) % 6;
            loops++;
            if (loops > 6) return advancePhase(room); 
        } while (!room.seats[room.turnIndex] || !room.seats[room.turnIndex].active || room.seats[room.turnIndex].isAllIn); 

        broadcastState(room.id);
        startTurnTimer(room);
    }

    function getNextOccupiedSeat(seats, currentIndex) {
        for(let i=1; i<=6; i++) {
            let idx = (currentIndex + i) % 6;
            if (seats[idx]) return idx;
        }
        return currentIndex;
    }

    function broadcastState(roomId) {
        const room = rooms[roomId];
        if (!room) return;

        room.seats.forEach(p => {
            if (p && p.active && room.engine.board.length >= 3) {
                const ep = room.engine.players[p.engineId];
                if (ep) { room.engine.evaluatePlayer(ep); p.bestHandName = ep.bestHand; }
            }
        });

        io.to(roomId).emit('updateGameState', {
            pot: room.pot,
            board: room.engine ? room.engine.board.map(c => c.str) : [],
            gameState: room.gameState,
            handState: room.handState,
            dealerIndex: room.dealerIndex,
            sbIndex: room.sbIndex,
            bbIndex: room.bbIndex,
            type: room.type,
            leaderboard: room.leaderboard,
            seats: room.seats.map(p => p ? {
                id: p.id, name: p.name, balance: p.balance, 
                currentBet: p.currentBet, active: p.active, isAllIn: p.isAllIn,
                lastAction: p.lastAction, actionId: p.actionId, bestHandName: p.bestHandName,
                holeCards: (room.handState === 'SHOWDOWN' && p.active) ? p.holeCards : null
            } : null),
            currentTurnIndex: room.turnIndex
        });
    }

    function sendTurnNotification(room) {
        const currentPlayer = room.seats[room.turnIndex];
        if (currentPlayer) {
            io.to(currentPlayer.id).emit('yourTurn', { betToCall: room.currentBet - currentPlayer.currentBet });
        }
    }

    function sendPublicRooms(target) {
        const publicRooms = Object.values(rooms)
            .filter(r => r.isPublic)
            .map(r => ({
                id: r.id,
                type: r.type,
                playersCount: r.seats.filter(s => s !== null).length,
                gameState: r.gameState
            }));
        target.emit('publicRoomsList', publicRooms);
    }

    function updateGlobalLobby() {
        const publicRooms = Object.values(rooms)
            .filter(r => r.isPublic)
            .map(r => ({
                id: r.id,
                type: r.type,
                playersCount: r.seats.filter(s => s !== null).length,
                gameState: r.gameState
            }));
        io.emit('publicRoomsList', publicRooms);
    }

    function getRoomId(socket) { return Array.from(socket.rooms).find(r => r !== socket.id); }

    socket.on('sendChat', (message) => {
        const roomId = getRoomId(socket);
        const room = rooms[roomId];
        if (room && room.clients[socket.id]) {
            io.to(roomId).emit('receiveChat', { user: room.clients[socket.id].name, message });
        }
    });

    socket.on('disconnect', () => {
        // Limpieza de salas vacías
        Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            if (room.host === socket.id) {
                // Si el host se va, podrías asignar uno nuevo o cerrar la sala
            }
            delete room.clients[socket.id];
            // Si no hay nadie en la sala, borrarla
            if (Object.keys(room.clients).length === 0) {
                delete rooms[roomId];
            }
        });
        updateGlobalLobby();
    });
});

server.listen(3000, () => console.log('Servidor Poker PRO en puerto 3000'));