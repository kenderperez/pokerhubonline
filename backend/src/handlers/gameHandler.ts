import { Server, Socket } from 'socket.io';
import { PokerEngine } from '../engine/pokerEngine.js';

interface ClientInfo {
    id: string;
    address: string;
    name: string;
}

interface Seat {
    id: string;
    address: string;
    name: string;
    balance: number;
    holeCards: any[];
    currentBet: number;
    active: boolean;
    acted: boolean;
    isAllIn: boolean;
    lastAction: string;
    actionId: number;
    sittingOut: boolean;
    raiseCount: number;   // ← subidas en la calle actual
}

interface Room {
    id: string;
    host: string;
    seats: Array<Seat | null>;
    clients: Record<string, ClientInfo>;
    engine: PokerEngine;
    gameState: 'WAITING' | 'PLAYING' | 'HAND_OVER';
    handState: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
    pot: number;
    currentBet: number;
    turnIndex: number;
    dealerIndex: number;
    sbIndex: number;
    bbIndex: number;
    type: string;
    isPublic: boolean;
    turnTimer: NodeJS.Timeout | null;
    leaderboard: Record<string, any>;
    smallBlind: number;
    bigBlind: number;
    minRaise: number;
    lastRaiseSize: number;  // ← tamaño del último raise para calcular mínimos
    actionInProgress: boolean;
}

const rooms: Record<string, Room> = {};

const DEFAULT_BALANCE = 1000;
const SMALL_BLIND     = 5;
const BIG_BLIND       = 10;
const TURN_TIMEOUT    = 30000;
const MAX_RAISES_PER_STREET = 3;  // tras 3 raises, solo all-in

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getRoomId(socket: Socket): string | null {
    const roomsArray = Array.from(socket.rooms.values());
    return roomsArray.find(r => r !== socket.id) || null;
}

function broadcastState(io: Server, roomId: string): void {
    const room = rooms[roomId];
    if (!room) return;

    const gameState = {
        seats: room.seats.map(seat => {
            if (!seat) return null;
            return {
                id: seat.id,
                name: seat.name,
                balance: seat.balance,
                currentBet: seat.currentBet,
                active: seat.active,
                holeCards: seat.holeCards ? seat.holeCards.map(c => {
                    if (typeof c === 'string') return c;
                    if (c.rank && c.suit) return c.rank + c.suit;
                    return c.toString();
                }) : [],
                lastAction: seat.lastAction,
                actionId: seat.actionId,
                bestHand: (seat as any).bestHand || null,
                isAllIn: seat.isAllIn,
            };
        }),
        gameState:         room.gameState,
        handState:         room.handState,
        pot:               room.pot,
        currentBet:        room.currentBet,
        currentTurnIndex:  room.turnIndex,
        dealerIndex:       room.dealerIndex,
        sbIndex:           room.sbIndex,
        bbIndex:           room.bbIndex,
        winningCards:      [],
        smallBlind:        room.smallBlind,
        bigBlind:          room.bigBlind,
        board: room.engine.board.map(c => (typeof c === 'string' ? c : c.rank + c.suit)),
    };

    io.to(roomId).emit('gameState', gameState);
}

function updateGlobalLobby(io: Server): void {
    const publicRooms = Object.values(rooms)
        .filter(r => r.isPublic)
        .map(r => ({ id: r.id, players: r.seats.filter(s => s !== null).length }));
    io.emit('publicRooms', publicRooms);
}

function joinClientToRoom(io: Server, socket: Socket, roomId: string, address?: string, name?: string) {
    const room = rooms[roomId];
    if (!room) { socket.emit('error', 'Sala no encontrada'); return false; }

    room.clients[socket.id] = { id: socket.id, address: address || '', name: name || 'Jugador' };
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, isHost: room.host === socket.id, type: room.type });
    io.to(roomId).emit('serverLog', { message: `👁️ ${name || 'Jugador'} entró como espectador.`, type: 'log-info' });
    broadcastState(io, roomId);
    return true;
}

// Emite yourTurn al jugador que debe actuar
function emitYourTurn(io: Server, room: Room, seatIdx: number): void {
    const seat = room.seats[seatIdx];
    if (!seat) return;

    const callAmount = Math.max(0, room.currentBet - seat.currentBet);

    // Mínimo raise = 25% del pot, pero al menos un bigBlind
    const minRaiseIncrement = Math.max(room.bigBlind, Math.floor(room.pot * 0.25));
    const minRaiseTotal     = room.currentBet + minRaiseIncrement;
    const maxRaise          = seat.balance + seat.currentBet;

    // ¿Ya agotó sus raises? solo puede all-in
    const raiseCapped = seat.raiseCount >= MAX_RAISES_PER_STREET;

    io.to(seat.id).emit('yourTurn', {
        callAmount,
        minRaise:   minRaiseTotal,
        maxRaise,
        currentBet: room.currentBet,
        raiseCapped,            // el cliente puede desactivar el botón de raise
        pot:        room.pot,
    });
    io.to(seat.id).emit('timerStart', { seatIndex: seatIdx, duration: TURN_TIMEOUT });
}

// ─────────────────────────────────────────────────────────────
// NEXT TURN
// ─────────────────────────────────────────────────────────────

function nextTurn(io: Server, roomId: string): void {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING') return;

    // ¿Cuántos jugadores activos pueden actuar (no all-in)?
    const canAct = room.seats.filter(s => s && s.active && !s.isAllIn);

    // Si 0 o 1 puede actuar, correr el tablero automáticamente
    if (canAct.length <= 1) {
        advanceHandStage(io, roomId);
        return;
    }

    // Buscar el siguiente jugador activo que puede actuar
    let nextIdx = (room.turnIndex + 1) % room.seats.length;
    let found   = false;
    for (let count = 0; count < room.seats.length; count++) {
        const seat = room.seats[nextIdx];
        if (seat && seat.active && !seat.isAllIn) { found = true; break; }
        nextIdx = (nextIdx + 1) % room.seats.length;
    }

    if (!found) { advanceHandStage(io, roomId); return; }

    room.turnIndex       = nextIdx;
    room.actionInProgress = false;

    emitYourTurn(io, room, nextIdx);

    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        const pid = room.seats[room.turnIndex]?.id;
        if (pid) handlePlayerAction(io, roomId, pid, 'fold', 0);
    }, TURN_TIMEOUT);

    broadcastState(io, roomId);
}

// ─────────────────────────────────────────────────────────────
// ADVANCE HAND STAGE  (PREFLOP → FLOP → TURN → RIVER → SHOWDOWN)
// ─────────────────────────────────────────────────────────────

function advanceHandStage(io: Server, roomId: string): void {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING') return;

    const activePlayers = room.seats.filter(s => s && s.active);

    // Solo queda un jugador activo → gana inmediatamente
    if (activePlayers.length === 1) {
        endHand(io, roomId, activePlayers[0]!.id);
        return;
    }

    // ¿Todos los activos están all-in? Correr tablero completo de golpe
    const allAllIn = activePlayers.every(s => s!.isAllIn);

    // Revelar cartas al entrar en SHOWDOWN o all-in
    const goingToShowdown = room.handState === 'RIVER' || allAllIn;

    if (goingToShowdown) {
        // Si hay cartas pendientes por repartir (all-in prematuro), repartirlas
        if (room.handState === 'PREFLOP') { room.engine.dealFlop(); room.engine.dealTurn(); room.engine.dealRiver(); }
        else if (room.handState === 'FLOP') { room.engine.dealTurn(); room.engine.dealRiver(); }
        else if (room.handState === 'TURN') { room.engine.dealRiver(); }
        // RIVER ya está repartida

        room.handState = 'SHOWDOWN';
        broadcastState(io, roomId); // mostrar todas las cartas comunitarias

        // Evaluar y resolver
        const seatedActiveIndices = room.seats
            .map((s, idx) => s !== null ? idx : -1)
            .filter(idx => idx !== -1);

        seatedActiveIndices.forEach((seatIdx, engineIdx) => {
            const seat         = room.seats[seatIdx];
            const enginePlayer = room.engine.players[engineIdx];
            if (seat && seat.active && enginePlayer) {
                room.engine.evaluatePlayer(enginePlayer);
                (seat as any).bestHand = enginePlayer.bestHand;
            }
        });

        const winningPlayers = room.engine.determineWinners();
        const seatedIndices  = room.seats.map((s, idx) => (s !== null ? idx : -1)).filter(idx => idx !== -1);
        const winnerIds: string[] = [];
        winningPlayers.forEach(p => {
            const playerIdx = room.engine.players.indexOf(p);
            if (playerIdx !== -1 && playerIdx < seatedIndices.length) {
                const seatIdx = seatedIndices[playerIdx];
                const seat    = room.seats[seatIdx];
                if (seat) winnerIds.push(seat.id);
            }
        });
        endHand(io, roomId, winnerIds);
        return;
    }

    // Repartir siguiente carta comunitaria
    switch (room.handState) {
        case 'PREFLOP': room.engine.dealFlop();  room.handState = 'FLOP';  break;
        case 'FLOP':    room.engine.dealTurn();  room.handState = 'TURN';  break;
        case 'TURN':    room.engine.dealRiver(); room.handState = 'RIVER'; break;
        default: break;
    }

    // Resetear bets y raiseCount para la nueva calle
    room.currentBet   = 0;
    room.minRaise     = room.bigBlind;
    room.lastRaiseSize = room.bigBlind;

    room.seats.forEach(seat => {
        if (seat && seat.active) {
            seat.acted      = false;
            seat.currentBet = 0;
            seat.raiseCount = 0;
        }
    });

    // Primer turno: primer activo a la izquierda del dealer
    let startIdx = (room.dealerIndex + 1) % room.seats.length;
    for (let i = 0; i < room.seats.length; i++) {
        const s = room.seats[startIdx];
        if (s && s.active && !s.isAllIn) break;
        startIdx = (startIdx + 1) % room.seats.length;
    }

    room.turnIndex        = startIdx;
    room.actionInProgress = false;

    broadcastState(io, roomId);

    // ── FIX CLAVE: emitir yourTurn al primer jugador de la nueva calle ──
    emitYourTurn(io, room, startIdx);

    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        const pid = room.seats[room.turnIndex]?.id;
        if (pid) handlePlayerAction(io, roomId, pid, 'fold', 0);
    }, TURN_TIMEOUT);
}

// ─────────────────────────────────────────────────────────────
// END HAND
// ─────────────────────────────────────────────────────────────

function endHand(io: Server, roomId: string, winnerIds: string | string[]): void {
    const room = rooms[roomId];
    if (!room) return;

    if (typeof winnerIds === 'string') {
        const seat = room.seats.find(s => s && s.id === winnerIds);
        if (seat) {
            seat.balance += room.pot;
            io.to(roomId).emit('serverLog', { message: `🏆 ${seat.name} gana $${room.pot}!`, type: 'log-success' });
        }
    } else {
        const share = Math.floor(room.pot / winnerIds.length);
        winnerIds.forEach(id => {
            const seat = room.seats.find(s => s && s.id === id);
            if (seat) {
                seat.balance += share;
                io.to(roomId).emit('serverLog', { message: `🏆 ${seat.name} gana $${share}!`, type: 'log-success' });
            }
        });
    }

    room.pot          = 0;
    room.currentBet   = 0;
    room.gameState    = 'HAND_OVER';
    room.handState    = 'WAITING';

    room.seats.forEach(seat => {
        if (seat) {
            seat.holeCards  = [];
            seat.currentBet = 0;
            seat.active     = true;
            seat.acted      = false;
            seat.isAllIn    = false;
            seat.raiseCount = 0;
            (seat as any).bestHand = null;
        }
    });

    broadcastState(io, roomId);

    setTimeout(() => {
        if (rooms[roomId]?.gameState === 'HAND_OVER') startNewHand(io, roomId);
    }, 5000);
}

// ─────────────────────────────────────────────────────────────
// START NEW HAND
// ─────────────────────────────────────────────────────────────

function startNewHand(io: Server, roomId: string): void {
    const room = rooms[roomId];
    if (!room) return;

    const seatedPlayers = room.seats.filter(s => s !== null);
    if (seatedPlayers.length < 2) { room.gameState = 'WAITING'; broadcastState(io, roomId); return; }

    // Rotar dealer
    room.dealerIndex = (room.dealerIndex + 1) % room.seats.length;
    while (room.seats[room.dealerIndex] === null)
        room.dealerIndex = (room.dealerIndex + 1) % room.seats.length;

    // SB y BB
    let sbIdx = (room.dealerIndex + 1) % room.seats.length;
    while (room.seats[sbIdx] === null) sbIdx = (sbIdx + 1) % room.seats.length;
    room.sbIndex = sbIdx;

    let bbIdx = (sbIdx + 1) % room.seats.length;
    while (room.seats[bbIdx] === null) bbIdx = (bbIdx + 1) % room.seats.length;
    room.bbIndex = bbIdx;

    // Nuevo motor
    room.engine = new PokerEngine();
    room.engine.startGame(seatedPlayers.length);

    // Asignar cartas
    const seatedIndices = room.seats.map((s, idx) => s !== null ? idx : -1).filter(idx => idx !== -1);
    seatedIndices.forEach((seatIdx, engineIdx) => {
        const seat = room.seats[seatIdx]!;
        seat.holeCards  = room.engine.players[engineIdx]?.holeCards || [];
        seat.active     = true;
        seat.currentBet = 0;
        seat.acted      = false;
        seat.isAllIn    = false;
        seat.lastAction = '';
        seat.raiseCount = 0;
        (seat as any).bestHand = null;
    });

    // Cobrar ciegas
    const sbSeat = room.seats[room.sbIndex];
    const bbSeat = room.seats[room.bbIndex];
    if (sbSeat) {
        const sbAmt = Math.min(room.smallBlind, sbSeat.balance);
        sbSeat.balance  -= sbAmt;
        sbSeat.currentBet = sbAmt;
        room.pot += sbAmt;
        if (sbSeat.balance === 0) sbSeat.isAllIn = true;
    }
    if (bbSeat) {
        const bbAmt = Math.min(room.bigBlind, bbSeat.balance);
        bbSeat.balance  -= bbAmt;
        bbSeat.currentBet = bbAmt;
        room.pot += bbAmt;
        if (bbSeat.balance === 0) bbSeat.isAllIn = true;
    }

    room.currentBet    = room.bigBlind;
    room.minRaise      = room.bigBlind;
    room.lastRaiseSize = room.bigBlind;
    room.gameState     = 'PLAYING';
    room.handState     = 'PREFLOP';

    // Primer turno: jugador a la izquierda del BB
    let turnIdx = (room.bbIndex + 1) % room.seats.length;
    while (room.seats[turnIdx] === null || !room.seats[turnIdx]!.active || room.seats[turnIdx]!.isAllIn)
        turnIdx = (turnIdx + 1) % room.seats.length;

    room.turnIndex        = turnIdx;
    room.actionInProgress = false;

    broadcastState(io, roomId);
    emitYourTurn(io, room, turnIdx);

    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        const pid = room.seats[room.turnIndex]?.id;
        if (pid) handlePlayerAction(io, roomId, pid, 'fold', 0);
    }, TURN_TIMEOUT);
}

// ─────────────────────────────────────────────────────────────
// HANDLE PLAYER ACTION
// ─────────────────────────────────────────────────────────────

function handlePlayerAction(io: Server, roomId: string, playerId: string, action: string, amount?: number): void {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING' || room.actionInProgress) return;

    const seatIndex = room.seats.findIndex(s => s && s.id === playerId);
    if (seatIndex === -1 || seatIndex !== room.turnIndex) return;

    const player = room.seats[seatIndex];
    if (!player || !player.active || player.isAllIn) return;

    room.actionInProgress = true;
    if (room.turnTimer) clearTimeout(room.turnTimer);

    let actionValid = true;
    let actionText  = '';

    switch (action) {

        case 'fold':
            player.active     = false;
            player.lastAction = 'FOLD';
            actionText        = 'se retiró';
            break;

        case 'check':
            if (room.currentBet > player.currentBet) {
                actionValid = false;
            } else {
                player.lastAction = 'CHECK';
                actionText        = 'pasó';
            }
            break;

        case 'call': {
            const diff = room.currentBet - player.currentBet;
            if (diff <= 0) {
                player.lastAction = 'CHECK';
                actionText        = 'pasó';
            } else {
                const actual = Math.min(diff, player.balance);
                player.balance    -= actual;
                player.currentBet += actual;
                room.pot          += actual;
                if (player.balance === 0) player.isAllIn = true;
                player.lastAction = 'CALL';
                actionText        = `igualó $${player.currentBet}`;
            }
            break;
        }

        case 'raise': {
            // Cap: si ya subió MAX_RAISES_PER_STREET veces, no puede subir más
            if (player.raiseCount >= MAX_RAISES_PER_STREET) {
                actionValid = false;
                io.to(player.id).emit('serverLog', {
                    message: '⚠️ Ya subiste 3 veces. Solo puedes hacer All-In.',
                    type: 'log-error'
                });
                break;
            }

            // Mínimo: 25% del pot sobre el currentBet, o al menos un bigBlind
            const minIncrement = Math.max(room.bigBlind, Math.floor(room.pot * 0.25));
            const minTotal     = room.currentBet + minIncrement;

            if (!amount || amount < minTotal) {
                actionValid = false;
                io.to(player.id).emit('serverLog', {
                    message: `⚠️ Raise mínimo: $${minTotal}`,
                    type: 'log-error'
                });
                break;
            }

            const raiseTotal      = Math.min(amount, player.balance + player.currentBet);
            const chipsToPut      = raiseTotal - player.currentBet;
            player.balance       -= chipsToPut;
            player.currentBet     = raiseTotal;
            room.pot             += chipsToPut;
            room.lastRaiseSize    = raiseTotal - room.currentBet;
            room.currentBet       = raiseTotal;
            room.minRaise         = Math.max(room.bigBlind, Math.floor(room.pot * 0.25));
            player.raiseCount    += 1;

            if (player.balance === 0) player.isAllIn = true;
            player.lastAction = 'RAISE';
            actionText        = `subió a $${raiseTotal}`;

            // Los demás deben volver a actuar
            room.seats.forEach(s => {
                if (s && s.active && !s.isAllIn && s.id !== player.id) s.acted = false;
            });
            break;
        }

        case 'allin': {
            const allInChips   = player.balance;
            player.balance     = 0;
            player.currentBet += allInChips;
            room.pot          += allInChips;

            // Si este all-in constituye un raise
            if (player.currentBet > room.currentBet) {
                const raiseSize    = player.currentBet - room.currentBet;
                room.lastRaiseSize = raiseSize;
                room.currentBet    = player.currentBet;
                room.minRaise      = Math.max(room.bigBlind, Math.floor(room.pot * 0.25));
                // Los demás deben volver a actuar
                room.seats.forEach(s => {
                    if (s && s.active && !s.isAllIn && s.id !== player.id) s.acted = false;
                });
            }

            player.isAllIn    = true;
            player.lastAction = 'ALL-IN';
            actionText        = `fue ALL-IN por $${player.currentBet}`;
            break;
        }

        default:
            actionValid = false;
    }

    if (!actionValid) {
        room.actionInProgress = false;
        // Reenviar el turno
        if (room.turnTimer) clearTimeout(room.turnTimer);
        room.turnTimer = setTimeout(() => {
            handlePlayerAction(io, roomId, playerId, 'fold', 0);
        }, TURN_TIMEOUT);
        return;
    }

    player.actionId = (player.actionId || 0) + 1;
    player.acted    = true;
    io.to(roomId).emit('serverLog', { message: `🎲 ${player.name} ${actionText}.`, type: 'log-action' });

    // ¿Solo queda un jugador activo?
    const activePlayers = room.seats.filter(s => s && s.active);
    if (activePlayers.length === 1) {
        endHand(io, roomId, activePlayers[0]!.id);
        return;
    }

    // ¿Todos los activos están all-in? → ir directo al showdown
    const allAllIn = activePlayers.every(s => s!.isAllIn);
    if (allAllIn) {
        advanceHandStage(io, roomId);
        return;
    }

    // ¿Todos los que pueden actuar ya actuaron?
    const playersToAct = room.seats.filter(s => s && s.active && !s.isAllIn);
    const allActed     = playersToAct.every(s => s!.acted);

    if (allActed || playersToAct.length === 0) {
        advanceHandStage(io, roomId);
    } else {
        nextTurn(io, roomId);
    }
}

// ─────────────────────────────────────────────────────────────
// SOCKET HANDLERS
// ─────────────────────────────────────────────────────────────

export function registerGameHandlers(io: Server, socket: Socket) {

    socket.on('createRoom', ({ address, name, type, visibility }: { address: string; name?: string; type?: string; visibility?: string }) => {
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
            leaderboard: {},
            smallBlind: SMALL_BLIND,
            bigBlind: BIG_BLIND,
            minRaise: BIG_BLIND,
            lastRaiseSize: BIG_BLIND,
            actionInProgress: false,
        };
        joinClientToRoom(io, socket, roomId, address, name);
        updateGlobalLobby(io);
    });

    socket.on('joinRoom', ({ roomId, address, name }: { roomId: string; address?: string; name?: string }) => {
        joinClientToRoom(io, socket, roomId, address, name);
    });

    socket.on('sitDown', (seatIndex: number) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.gameState !== 'WAITING' || room.seats[seatIndex] !== null) return;
        if (room.seats.some(s => s && s.id === socket.id)) return;

        const client = room.clients[socket.id];
        if (!client) return;

        room.seats[seatIndex] = {
            id: client.id,
            address: client.address,
            name: client.name,
            balance: room.type === 'free' ? DEFAULT_BALANCE : 0,
            holeCards: [],
            currentBet: 0,
            active: true,
            acted: false,
            isAllIn: false,
            lastAction: '',
            actionId: 0,
            sittingOut: false,
            raiseCount: 0,
        };

        io.to(roomId).emit('serverLog', { message: `🪙 ${client.name} se sentó en la mesa.`, type: 'log-info' });
        broadcastState(io, roomId);
        updateGlobalLobby(io);
    });

    socket.on('playerAction', (actionData: { action: string; amount?: number }) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;
        const playerSeat = room.seats.find(s => s && s.id === socket.id);
        if (!playerSeat) return;
        handlePlayerAction(io, roomId, socket.id, actionData.action, actionData.amount);
    });

    socket.on('sendChat', (msg: string) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            const client = rooms[roomId]?.clients[socket.id];
            io.to(roomId).emit('receiveChat', { user: client?.name || 'Desconocido', message: msg });
        }
    });

    socket.on('requestMatchmaking', () => {
        const availableRooms = Object.values(rooms).filter(r =>
            r.isPublic && r.gameState === 'WAITING' && r.seats.filter(s => s !== null).length < 6
        );
        if (availableRooms.length === 0) {
            return socket.emit('serverLog', { message: "❌ No hay salas públicas disponibles.", type: 'log-error' });
        }
        availableRooms.sort((a, b) =>
            b.seats.filter(s => s !== null).length - a.seats.filter(s => s !== null).length
        );
        socket.emit('matchmakingResult', availableRooms[0].id);
    });

    socket.on('startGameRequest', () => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.host !== socket.id) return;
        if (room.seats.filter(s => s !== null).length < 2) {
            io.to(roomId).emit('serverLog', { message: 'Se necesitan al menos 2 jugadores', type: 'log-error' });
            return;
        }
        startNewHand(io, roomId);
    });

    socket.on('disconnect', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (!room.clients[socket.id]) continue;

            delete room.clients[socket.id];
            const seatIndex = room.seats.findIndex(s => s && s.id === socket.id);

            if (seatIndex !== -1) {
                const playerName = room.seats[seatIndex]!.name;
                room.seats[seatIndex] = null;
                io.to(roomId).emit('serverLog', { message: `🚪 ${playerName} abandonó la mesa.`, type: 'log-info' });

                if (room.host === socket.id) {
                    const first = room.seats.find(s => s !== null);
                    if (first) room.host = first.id;
                    else {
                        const firstClient = Object.keys(room.clients)[0];
                        if (firstClient) room.host = firstClient;
                    }
                }

                if (room.gameState === 'PLAYING') {
                    handlePlayerAction(io, roomId, socket.id, 'fold', 0);
                }

                broadcastState(io, roomId);
                updateGlobalLobby(io);
            }

            if (Object.keys(room.clients).length === 0) {
                if (room.turnTimer) clearTimeout(room.turnTimer);
                delete rooms[roomId];
                updateGlobalLobby(io);
            }
            break;
        }
    });
}