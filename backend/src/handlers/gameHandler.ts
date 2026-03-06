import { Server, Socket } from 'socket.io';
import { PokerEngine } from '../engine/pokerEngine.js';

// Interfaz para la información básica del cliente (espectadores)
interface ClientInfo {
    id: string;
    address: string;
    name: string;
}

// Interfaz para un jugador sentado en la mesa
interface Seat {
    id: string;
    address: string;
    name: string;
    balance: number;
    holeCards: any[]; // Podemos tipar mejor con Card[] si importamos
    currentBet: number;
    active: boolean;      // Si está en la mano (no se ha retirado)
    acted: boolean;       // Si ya actuó en la ronda actual
    isAllIn: boolean;
    lastAction: string;
    actionId: number;     // Para animaciones de acción
    sittingOut: boolean;  // Si está ausente (para futura funcionalidad)
}

interface Room {
    id: string;
    host: string;
    seats: Array<Seat | null>;
    clients: Record<string, ClientInfo>; // Todos los sockets conectados (espectadores + jugadores)
    engine: PokerEngine;
    gameState: 'WAITING' | 'PLAYING' | 'HAND_OVER';
    handState: 'WAITING' | 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
    pot: number;
    currentBet: number;
    turnIndex: number;      // Índice del jugador que debe actuar ahora
    dealerIndex: number;
    sbIndex: number;
    bbIndex: number;
    type: string;           // 'free' o 'paid'
    isPublic: boolean;
    turnTimer: NodeJS.Timeout | null;
    leaderboard: Record<string, any>; // Podría ser para estadísticas
    smallBlind: number;
    bigBlind: number;
    minRaise: number;
    lastRaise: number;
    actionInProgress: boolean; // Para evitar acciones simultáneas
}

const rooms: Record<string, Room> = {};

// Constantes
const DEFAULT_BALANCE = 1000;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const TURN_TIMEOUT = 30000; // 30 segundos

// Función para obtener el ID de la sala a la que pertenece el socket (excluyendo su propio ID)
function getRoomId(socket: Socket): string | null {
    const roomsArray = Array.from(socket.rooms.values());
    return roomsArray.find(r => r !== socket.id) || null;
}

// Transmite el estado actual del juego a todos los clientes en la sala
function broadcastState(io: Server, roomId: string): void {
    const room = rooms[roomId];
    if (!room) return;

    // Preparamos el objeto de estado que se enviará al cliente
    const gameState = {
        seats: room.seats.map(seat => {
            if (!seat) return null;
            return {
                id: seat.id,
                name: seat.name,
                balance: seat.balance,
                currentBet: seat.currentBet,
                active: seat.active,
                // Convertimos las cartas a string para evitar errores en el cliente
                holeCards: seat.holeCards ? seat.holeCards.map(c => {
                    // Si ya es string, lo usamos; si es objeto, intentamos convertirlo
                    if (typeof c === 'string') return c;
                    if (c.rank && c.suit) return c.rank + c.suit;
                    return c.toString(); // fallback
                }) : [],
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
        winningCards: [], // Aquí irían las cartas ganadoras cuando se implemente
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind
    };
    io.to(roomId).emit('gameState', gameState);
    console.log('Enviando gameState para sala', roomId, 'asientos:', room.seats);
}

// Actualiza la lista de salas públicas para el lobby global
function updateGlobalLobby(io: Server): void {
    const publicRooms = Object.values(rooms)
        .filter(r => r.isPublic)
        .map(r => ({ id: r.id, players: r.seats.filter(s => s !== null).length }));
    io.emit('publicRooms', publicRooms);
}

// Lógica para que un cliente se una a una sala (como espectador o para sentarse después)
function joinClientToRoom(io: Server, socket: Socket, roomId: string, address?: string, name?: string) {
    const room = rooms[roomId];
    if (!room) {
        socket.emit('error', 'Sala no encontrada');
        return false;
    }

    // Guardamos la información del cliente en la sala
    room.clients[socket.id] = { 
        id: socket.id, 
        address: address || '', 
        name: name || 'Jugador' 
    };

    // Unimos el socket a la sala de Socket.IO
    socket.join(roomId);

    // Enviamos confirmación al cliente
    socket.emit('roomJoined', {
        roomId,
        isHost: room.host === socket.id,
        type: room.type
    });

    // Log de entrada
    io.to(roomId).emit('serverLog', { 
        message: `👁️ ${name || 'Jugador'} entró como espectador.`, 
        type: 'log-info' 
    });

    // Enviamos el estado actual
    broadcastState(io, roomId);
    return true;
}

// Función para avanzar al siguiente turno (turno de poker)
function nextTurn(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING') return;

    // Buscar el siguiente jugador activo (no all-in, no folded)
    let nextIdx = (room.turnIndex + 1) % room.seats.length;
    let found = false;
    let count = 0;
    while (count < room.seats.length) {
        const seat = room.seats[nextIdx];
        if (seat && seat.active && !seat.isAllIn) {
            found = true;
            break;
        }
        nextIdx = (nextIdx + 1) % room.seats.length;
        count++;
    }

    if (!found) {
        // Si no hay más jugadores activos, pasar a la siguiente ronda o showdown
        advanceHandStage(io, roomId);
        return;
    }

    room.turnIndex = nextIdx;
    room.actionInProgress = false;

    // Reiniciamos el timer
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        // Si el jugador no actúa a tiempo, automáticamente se retira (fold)
        const currentPlayerId = room.seats[room.turnIndex]?.id;
        if (currentPlayerId) {
            handlePlayerAction(io, roomId, currentPlayerId, 'fold', 0);
        }
    }, TURN_TIMEOUT);

    broadcastState(io, roomId);
}

// Avanza la etapa de la mano (preflop -> flop -> turn -> river -> showdown)
function advanceHandStage(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING') return;

    // Verificar si queda más de un jugador activo
    const activePlayers = room.seats.filter(s => s && s.active);
    if (activePlayers.length === 1) {
        // Solo un jugador, gana la mano
        endHand(io, roomId, activePlayers[0]!.id);
        return;
    }

    // Determinar siguiente etapa
    let nextStage: typeof room.handState = 'SHOWDOWN';
    switch (room.handState) {
        case 'PREFLOP':
            // Repartir flop
            room.engine.dealFlop();
            nextStage = 'FLOP';
            break;
        case 'FLOP':
            room.engine.dealTurn();
            nextStage = 'TURN';
            break;
        case 'TURN':
            room.engine.dealRiver();
            nextStage = 'RIVER';
            break;
        case 'RIVER':
            // Showdown
            nextStage = 'SHOWDOWN';
            break;
        default:
            break;
    }

    if (nextStage === 'SHOWDOWN') {
        // Evaluar ganadores
        // Obtener los jugadores ganadores del motor (devuelve objetos Player)
        const winningPlayers = room.engine.determineWinners();
        // Convertirlos a IDs de asiento usando el orden de engine.players y asientos sentados
        const seatedIndices = room.seats.map((s, idx) => (s !== null ? idx : -1)).filter(idx => idx !== -1);
        const winnerIds: string[] = [];
        winningPlayers.forEach(p => {
            const playerIdx = room.engine.players.indexOf(p);
            if (playerIdx !== -1 && playerIdx < seatedIndices.length) {
                const seatIdx = seatedIndices[playerIdx];
                const seat = room.seats[seatIdx];
                if (seat) winnerIds.push(seat.id);
            }
        });
        endHand(io, roomId, winnerIds);
        return;
    }

    room.handState = nextStage;
    room.currentBet = 0;
    // Resetear acted para todos los jugadores activos
    room.seats.forEach(seat => {
        if (seat && seat.active) seat.acted = false;
    });

    // El primer turno después de flop/turn/river es el siguiente al dealer (o el primero a la izquierda del dealer)
    // Por simplicidad, empezamos desde el primer jugador activo después del dealer
    let startIdx = (room.dealerIndex + 1) % room.seats.length;
    while (room.seats[startIdx] === null || !room.seats[startIdx]!.active || room.seats[startIdx]!.isAllIn) {
        startIdx = (startIdx + 1) % room.seats.length;
    }
    room.turnIndex = startIdx;
    room.actionInProgress = false;

    broadcastState(io, roomId);
    // Iniciar timer para el primer jugador
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        const currentPlayerId = room.seats[room.turnIndex]?.id;
        if (currentPlayerId) {
            handlePlayerAction(io, roomId, currentPlayerId, 'fold', 0);
        }
    }, TURN_TIMEOUT);
}

// Finaliza la mano actual
function endHand(io: Server, roomId: string, winnerIds: string | string[]) {
    const room = rooms[roomId];
    if (!room) return;

    // Aquí deberías repartir el bote a los ganadores
    // Por simplicidad, asumimos un solo ganador
    if (typeof winnerIds === 'string') {
        const winnerSeat = room.seats.find(s => s && s.id === winnerIds);
        if (winnerSeat) {
            winnerSeat.balance += room.pot;
            io.to(roomId).emit('serverLog', { message: `🏆 ${winnerSeat.name} gana ${room.pot} fichas!`, type: 'log-success' });
        }
    } else {
        // Múltiples ganadores, repartir equitativamente (simplificado)
        const share = Math.floor(room.pot / winnerIds.length);
        winnerIds.forEach(id => {
            const seat = room.seats.find(s => s && s.id === id);
            if (seat) seat.balance += share;
        });
    }

    // Limpiar para la siguiente mano
    room.pot = 0;
    room.currentBet = 0;
    room.gameState = 'HAND_OVER';
    room.handState = 'WAITING';

    // Recoger cartas de los jugadores
    room.seats.forEach(seat => {
        if (seat) {
            seat.holeCards = [];
            seat.currentBet = 0;
            seat.active = true; // Se reseteará al empezar nueva mano
            seat.acted = false;
            seat.isAllIn = false;
        }
    });

    broadcastState(io, roomId);

    // Después de un breve tiempo, iniciar nueva mano automáticamente
    setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].gameState === 'HAND_OVER') {
            startNewHand(io, roomId);
        }
    }, 5000);
}

// Inicia una nueva mano
function startNewHand(io: Server, roomId: string) {
    const room = rooms[roomId];
    if (!room) return;

    // Verificar que haya al menos 2 jugadores sentados
    const seatedPlayers = room.seats.filter(s => s !== null);
    if (seatedPlayers.length < 2) {
        room.gameState = 'WAITING';
        broadcastState(io, roomId);
        return;
    }

    // Mover el dealer (rotar)
    room.dealerIndex = (room.dealerIndex + 1) % room.seats.length;
    while (room.seats[room.dealerIndex] === null) {
        room.dealerIndex = (room.dealerIndex + 1) % room.seats.length;
    }

    // Asignar SB y BB (los siguientes jugadores activos)
    let sbIdx = (room.dealerIndex + 1) % room.seats.length;
    while (room.seats[sbIdx] === null) {
        sbIdx = (sbIdx + 1) % room.seats.length;
    }
    room.sbIndex = sbIdx;

    let bbIdx = (sbIdx + 1) % room.seats.length;
    while (room.seats[bbIdx] === null) {
        bbIdx = (bbIdx + 1) % room.seats.length;
    }
    room.bbIndex = bbIdx;

    // Reiniciar engine
    room.engine = new PokerEngine();
    // Iniciar juego con el número de jugadores sentados
    room.engine.startGame(seatedPlayers.length); // Necesita adaptarse para asignar cartas a los jugadores

    // Asignar cartas a cada jugador sentado (según el orden de la mesa)
    // Nota: El engine debe tener una lista de jugadores en el mismo orden que los asientos ocupados.
    // Por simplicidad, asumimos que engine.players está en el mismo orden que los asientos no nulos.
    const seatedIndices = room.seats.map((s, idx) => s !== null ? idx : -1).filter(idx => idx !== -1);
    seatedIndices.forEach((seatIdx, engineIdx) => {
        const seat = room.seats[seatIdx]!;
        seat.holeCards = room.engine.players[engineIdx]?.holeCards || [];
        seat.active = true;
        seat.currentBet = 0;
        seat.acted = false;
        seat.isAllIn = false;
        seat.lastAction = '';
    });

    // Cobrar ciegas
    const sbSeat = room.seats[room.sbIndex];
    const bbSeat = room.seats[room.bbIndex];
    if (sbSeat) {
        const sbAmount = Math.min(room.smallBlind, sbSeat.balance);
        sbSeat.balance -= sbAmount;
        sbSeat.currentBet = sbAmount;
        room.pot += sbAmount;
        if (sbSeat.balance === 0) sbSeat.isAllIn = true;
    }
    if (bbSeat) {
        const bbAmount = Math.min(room.bigBlind, bbSeat.balance);
        bbSeat.balance -= bbAmount;
        bbSeat.currentBet = bbAmount;
        room.pot += bbAmount;
        if (bbSeat.balance === 0) bbSeat.isAllIn = true;
    }

    room.currentBet = room.bigBlind;
    room.gameState = 'PLAYING';
    room.handState = 'PREFLOP';

    // El primer turno es después del BB (el jugador a la izquierda del BB)
    let turnIdx = (room.bbIndex + 1) % room.seats.length;
    while (room.seats[turnIdx] === null || !room.seats[turnIdx]!.active || room.seats[turnIdx]!.isAllIn) {
        turnIdx = (turnIdx + 1) % room.seats.length;
    }
    room.turnIndex = turnIdx;
    room.actionInProgress = false;

    // Iniciar timer
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = setTimeout(() => {
        const currentPlayerId = room.seats[room.turnIndex]?.id;
        if (currentPlayerId) {
            handlePlayerAction(io, roomId, currentPlayerId, 'fold', 0);
        }
    }, TURN_TIMEOUT);

    broadcastState(io, roomId);
}

// Maneja la acción de un jugador (fold, check, call, raise, all-in)
function handlePlayerAction(io: Server, roomId: string, playerId: string, action: string, amount?: number) {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'PLAYING' || room.actionInProgress) return;

    const seatIndex = room.seats.findIndex(s => s && s.id === playerId);
    if (seatIndex === -1 || seatIndex !== room.turnIndex) return; // No es su turno

    const player = room.seats[seatIndex];
    if (!player || !player.active || player.isAllIn) return;

    room.actionInProgress = true;
    if (room.turnTimer) clearTimeout(room.turnTimer);

    // Procesar acción
    let actionValid = true;
    let betAmount = 0;
    let actionText = '';

    switch (action) {
        case 'fold':
            player.active = false;
            player.lastAction = 'FOLD';
            actionText = 'se retiró';
            break;
        case 'check':
            if (room.currentBet > player.currentBet) {
                actionValid = false; // No puede check si hay apuesta pendiente
            } else {
                player.lastAction = 'CHECK';
                actionText = 'pasó';
            }
            break;
        case 'call':
            const callAmount = room.currentBet - player.currentBet;
            if (callAmount <= 0) {
                // Si no hay diferencia, es check
                player.lastAction = 'CHECK';
                actionText = 'pasó';
            } else {
                const actualCall = Math.min(callAmount, player.balance);
                player.balance -= actualCall;
                player.currentBet += actualCall;
                room.pot += actualCall;
                if (player.balance === 0) player.isAllIn = true;
                player.lastAction = 'CALL';
                actionText = 'igualó';
            }
            break;
        case 'raise':
            if (!amount || amount < room.currentBet + room.minRaise) {
                actionValid = false; // Raise mínimo no cumplido
                break;
            }
            betAmount = Math.min(amount, player.balance + player.currentBet); // No puede apostar más de lo que tiene
            const raiseTotal = betAmount - player.currentBet;
            player.balance -= raiseTotal;
            player.currentBet = betAmount;
            room.pot += raiseTotal;
            room.currentBet = betAmount;
            room.lastRaise = betAmount;
            room.minRaise = betAmount - room.currentBet; // Simplificado
            if (player.balance === 0) player.isAllIn = true;
            player.lastAction = 'RAISE';
            actionText = 'subió a ' + betAmount;
            break;
        case 'allin':
            const allInAmount = player.balance;
            player.balance = 0;
            player.currentBet += allInAmount;
            room.pot += allInAmount;
            if (player.currentBet > room.currentBet) {
                room.currentBet = player.currentBet;
                room.minRaise = player.currentBet - room.currentBet; // Simplificado
            }
            player.isAllIn = true;
            player.lastAction = 'ALL-IN';
            actionText = 'apostó todo';
            break;
        default:
            actionValid = false;
    }

    if (!actionValid) {
        room.actionInProgress = false;
        // Podríamos reenviar el timer
        room.turnTimer = setTimeout(() => {
            handlePlayerAction(io, roomId, playerId, 'fold', 0);
        }, TURN_TIMEOUT);
        return;
    }

    player.actionId = (player.actionId || 0) + 1;
    io.to(roomId).emit('serverLog', { message: `🎲 ${player.name} ${actionText}.`, type: 'log-action' });

    // Verificar si la mano terminó (todos los demás se retiraron o all-in)
    const activePlayers = room.seats.filter(s => s && s.active);
    if (activePlayers.length === 1) {
        endHand(io, roomId, activePlayers[0]!.id);
        return;
    }

    // Si todos los que no están all-in ya actuaron, pasar a la siguiente ronda
    const playersToAct = room.seats.filter(s => s && s.active && !s.isAllIn);
    const allActed = playersToAct.every(s => s!.acted);
    if (allActed || playersToAct.length === 0) {
        // Avanzar etapa
        advanceHandStage(io, roomId);
    } else {
        // Pasar al siguiente turno
        nextTurn(io, roomId);
    }
}

// Registro de los handlers de Socket.IO
export function registerGameHandlers(io: Server, socket: Socket) {
    // Crear una nueva sala
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
            lastRaise: 0,
            actionInProgress: false
        };

        joinClientToRoom(io, socket, roomId, address, name);
        updateGlobalLobby(io);
    });

    // Unirse a una sala existente (por código)
    socket.on('joinRoom', ({ roomId, address, name }: { roomId: string; address?: string; name?: string }) => {
        joinClientToRoom(io, socket, roomId, address, name);
    });

    // Sentarse en un asiento
    socket.on('sitDown', (seatIndex: number) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.gameState !== 'WAITING' || room.seats[seatIndex] !== null) return;
        
        // Verificar que el jugador no esté ya sentado
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
            sittingOut: false
        };

        io.to(roomId).emit('serverLog', { message: `🪙 ${client.name} se sentó en la mesa.`, type: 'log-info' });
        broadcastState(io, roomId);
        updateGlobalLobby(io);
    });

    // Acción del jugador (fold, check, call, raise, allin)
    socket.on('playerAction', (actionData: { action: string; amount?: number }) => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room) return;

        // Verificar que el socket corresponde al jugador cuyo turno es
        const playerSeat = room.seats.find(s => s && s.id === socket.id);
        if (!playerSeat) return;

        handlePlayerAction(io, roomId, socket.id, actionData.action, actionData.amount);
    });

    // Chat
    socket.on('sendChat', (msg: string) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            const client = rooms[roomId]?.clients[socket.id];
            io.to(roomId).emit('receiveChat', { 
                user: client?.name || 'Desconocido', 
                message: msg 
            });
        }
    });

    // Matchmaking: buscar una sala pública con espacio
    socket.on('requestMatchmaking', () => {
        const availableRooms = Object.values(rooms).filter(r =>
            r.isPublic &&
            r.gameState === 'WAITING' &&
            r.seats.filter(s => s !== null).length < 6
        );

        if (availableRooms.length === 0) {
            return socket.emit('serverLog', { message: "❌ No hay salas públicas disponibles. ¡Crea una!", type: 'log-error' });
        }

        // Ordenar por las que tienen más jugadores (para llenar rápido)
        availableRooms.sort((a, b) => {
            const countA = a.seats.filter(s => s !== null).length;
            const countB = b.seats.filter(s => s !== null).length;
            return countB - countA;
        });

        const best = availableRooms[0];
        if (best) socket.emit('matchmakingResult', best.id);
    });

    // Iniciar juego (solo el host)
    socket.on('startGameRequest', () => {
        const roomId = getRoomId(socket);
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || room.host !== socket.id) return;

        const playersCount = room.seats.filter(s => s !== null).length;
        if (playersCount < 2) {
            io.to(roomId).emit('serverLog', { message: 'Se necesitan al menos 2 jugadores', type: 'log-error' });
            return;
        }

        startNewHand(io, roomId);
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        // Buscar en qué sala estaba este socket
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room.clients[socket.id]) {
                // Era un cliente (espectador o jugador)
                delete room.clients[socket.id];

                // Si estaba sentado, lo sacamos del asiento
                const seatIndex = room.seats.findIndex(s => s && s.id === socket.id);
                if (seatIndex !== -1) {
                    const playerName = room.seats[seatIndex]!.name;
                    room.seats[seatIndex] = null;
                    io.to(roomId).emit('serverLog', { message: `🚪 ${playerName} abandonó la mesa.`, type: 'log-info' });

                    // Si era el host, asignar nuevo host (el primer jugador sentado o el primer espectador)
                    if (room.host === socket.id) {
                        const firstSeat = room.seats.find(s => s !== null);
                        if (firstSeat) {
                            room.host = firstSeat.id;
                        } else {
                            // Si no hay jugadores, el primer espectador
                            const firstClient = Object.keys(room.clients)[0];
                            if (firstClient) room.host = firstClient;
                        }
                    }

                    // Si el juego estaba en curso y este jugador estaba activo, hay que manejarlo
                    if (room.gameState === 'PLAYING') {
                        // Lo consideramos como fold
                        handlePlayerAction(io, roomId, socket.id, 'fold', 0);
                    }

                    broadcastState(io, roomId);
                    updateGlobalLobby(io);
                }

                // Si la sala se queda sin clientes, la eliminamos (opcional)
                if (Object.keys(room.clients).length === 0) {
                    if (room.turnTimer) clearTimeout(room.turnTimer);
                    delete rooms[roomId];
                    updateGlobalLobby(io);
                }
                break;
            }
        }
    });
}