const socket = io();
let myAddress = null;
let myName = "Jugador";
let myCards = [];
let roomType = "free";
let myCurrentBalance = 0;
let isHost = false;
let socketId = null;
let currentRoomId = "---";
let lastGameState = null;



const BB_VALUE = 20;
function toBB(amount) { return (amount / BB_VALUE).toFixed(1) + " BB"; }

socket.on('connect', () => { socketId = socket.id; });

// --- LÓGICA DE PERFIL Y LOBBY ---

async function connectWallet() {
    const nameInput = document.getElementById('player-name').value.trim();
    if(!nameInput) return alert("Por favor, ingresa un nombre.");
    
    if (window.ethereum) {
        try {
            const accs = await ethereum.request({ method: 'eth_requestAccounts' });
            myAddress = accs[0];
        } catch (e) {
            myAddress = "0xTest" + Math.floor(Math.random()*1000);
        }
    } else {
        myAddress = "0xTest" + Math.floor(Math.random()*1000);
    }
    
    myName = nameInput;
    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('lobby-controls').style.display = 'block';
    
    // Solicitar lista de salas públicas al entrar al lobby
    socket.emit('requestPublicRooms');
}

function createRoom() {
    // 1. MUESTRAS LA PANTALLA
    mostrarPantallaCarga(); 
    const type = document.getElementById('room-type-select').value;
    const visibility = document.getElementById('room-visibility-select').value;
    socket.emit('createRoom', { 
        address: myAddress, 
        name: myName, 
        type: type, 
        visibility: visibility 
    });
}

function joinRoom() {
    
    const code = document.getElementById('room-input').value.toUpperCase();
    // 1. MUESTRAS LA PANTALLA
    mostrarPantallaCarga(); 
    if(code) socket.emit('joinRoom', { roomId: code, walletAddress: myAddress, name: myName });
}

function startMatchmaking() {
    socket.emit('requestMatchmaking');
}

function directJoin(id) {
     // 1. MUESTRAS LA PANTALLA
    mostrarPantallaCarga(); 
    socket.emit('joinRoom', { roomId: id, walletAddress: myAddress, name: myName });
}

// --- LISTENERS DEL LOBBY ---

socket.on('publicRoomsList', (rooms) => {
    const container = document.getElementById('public-rooms-list');
    if (!container) return;

    if (rooms.length === 0) {
        container.innerHTML = `<div style="color:#555; font-size:11px; text-align:center; padding:10px;">No hay salas públicas activas.</div>`;
        return;
    }

    container.innerHTML = rooms.map(room => `
        <div class="public-room-card">
            <div class="room-info-text">
                <span class="room-name-id">SALA ${room.id}</span>
                <span class="room-stats">${room.type.toUpperCase()} • ${room.playersCount}/6 Jugadores • ${room.gameState === 'WAITING' ? 'ESPERANDO' : 'EN JUEGO'}</span>
            </div>
            <button class="btn-join-small" onclick="directJoin('${room.id}')" ${room.playersCount >= 6 ? 'disabled' : ''}>
                ${room.playersCount >= 6 ? 'LLENA' : 'UNIRSE'}
            </button>
        </div>
    `).join('');
});

socket.on('matchmakingResult', (roomId) => {
    directJoin(roomId);
});

socket.on('roomJoined', (data) => {
    document.getElementById('lobby-overlay').style.display = 'none';
        // 3. AHORA OCULTAS TAMBIÉN LA PANTALLA DE CARGA 3D
    // (Puedes poner un setTimeout de 1 o 2 segundos para que el usuario 
    // aprecie la animación 3D un poquito antes de entrar de golpe)
    setTimeout(() => {
        ocultarPantallaCarga();
    }, 1500); // 1.5 segundos de retraso estético (opcional)
    currentRoomId = data.roomId;
    isHost = data.isHost;
    roomType = data.type;
    
    document.getElementById('room-info-display').innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color:white; font-size: 14px;">SALA:</span> 
        <span style="color: #fff; background: #222; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px; font-family: monospace;">${currentRoomId}</span> 
        
        <button onclick="copyRoomId('${currentRoomId}', this)" style="background: #4CAF50; color: black; border: none; cursor: pointer; font-size: 11px; font-weight: bold; padding: 5px 10px; border-radius: 4px; transition: 0.2s;">
            COPIAR
        </button>
        
        <span style="font-size:12px; color:#888;">${estadoMesa} - ${miEstado}</span>
    </div>
`;
    
    const potChip = document.querySelector('#pot-display .poker-chip');
    if (potChip) potChip.className = `poker-chip chip-${data.type === 'free' ? 'free' : 'paid'}`;
});

// También debes ocultarla si hay un ERROR, para que el usuario no se quede atrapado
socket.on('error', (mensaje) => {
    ocultarPantallaCarga();
    alert(mensaje);
});

// --- LÓGICA DE JUEGO ---

socket.on('updateGameState', (data) => {
    // Animación de fichas al bote
    let flyingChips = [];
    if (lastGameState && lastGameState.seats) {
        lastGameState.seats.forEach((oldSeat, i) => {
            if (oldSeat && oldSeat.currentBet > 0 && (!data.seats[i] || data.seats[i].currentBet === 0)) {
                const betEl = document.getElementById(`bet-spot-${i}`);
                if (betEl) {
                    const rect = betEl.getBoundingClientRect();
                    flyingChips.push({ x: rect.left, y: rect.top, amount: oldSeat.currentBet });
                }
            }
        });
    }
    if (flyingChips.length > 0) animateChipsToPot(flyingChips);

    // Actualizar Pot con Stack de Fichas (Estilo Minimalista TV)
    const potBadge = document.querySelector('.pot-badge');
    if (potBadge && data.pot > 0) {
        // Calculamos las fichas usando la función que creamos antes
        const chips = calculateChips(data.pot);
        
        // Generamos el HTML de las fichas apiladas
        const chipsHTML = chips.map((val, idx) => 
            `<div class="poker-chip chip-${val}" style="bottom: ${idx * 3}px; z-index: ${idx};"></div>`
        ).join('');
        
        const stackHeight = 28 + (chips.length * 3);

        // Insertamos las fichas arriba y SOLO el texto de los BB abajo
        potBadge.innerHTML = `
            <div class="chip-stack" style="height: ${stackHeight}px;">
                ${chipsHTML}
            </div>
            <span id="pot-text-content">${toBB(data.pot)}</span>
        `;
    } else if (potBadge) {
        // Si el pozo está vacío, mostramos 0 BB sin fichas
        potBadge.innerHTML = `<span id="pot-text-content">0.0 BB</span>`;
    }
    // Animación de cartas comunitarias
    const comm = document.getElementById('community-cards');
    const currentCardsInDom = comm.querySelectorAll('.card').length;
    if (data.board.length > currentCardsInDom) {
        for (let i = currentCardsInDom; i < data.board.length; i++) {
            const c = data.board[i];
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${getCardColorClass(c)} community-card-anim`;
            cardDiv.style.animationDelay = `${(i - currentCardsInDom) * 0.2}s`;
            // Separar el número del palo para la mesa
            const rank = c.slice(0, -1);
            const suit = c.slice(-1);
            
            cardDiv.innerHTML = `
                <div class="card-corner top-left">
                    <span class="rank">${rank}</span>
                    <span class="suit">${suit}</span>
                </div>
                <div class="card-center">${suit}</div>
                <div class="card-corner bottom-right">
                    <span class="rank">${rank}</span>
                    <span class="suit">${suit}</span>
                </div>`;
            comm.appendChild(cardDiv);
        }
    } else if (data.board.length === 0) {
        comm.innerHTML = '';
    }

    // Info de sala
    const me = data.seats.find(s => s && s.id === socketId);
    const estadoMesa = data.gameState === 'PLAYING' ? 'EN JUEGO' : 'ESPERANDO';
    const miEstado = me ? 'SENTADO' : 'ESPECTADOR';
    document.getElementById('room-info-display').innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color:white; font-size: 14px;">SALA:</span> 
        <span style="color: #fff; background: #222; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px; font-family: monospace;">${currentRoomId}</span> 
        
        <button onclick="copyRoomId('${currentRoomId}', this)" style="background: #4CAF50; color: black; border: none; cursor: pointer; font-size: 11px; font-weight: bold; padding: 5px 10px; border-radius: 4px; transition: 0.2s;">
            COPIAR
        </button>
        
        <span style="font-size:12px; color:#888;">${estadoMesa} - ${miEstado}</span>
    </div>
`;

    if(me) {
        myCurrentBalance = me.balance;
        document.getElementById('my-balance').innerText = `$${me.balance} (${toBB(me.balance)})`;
    }

    renderSeats(data);
    if (data.leaderboard) renderLeaderboard(data.leaderboard);
    lastGameState = data;

    // Botón iniciar (Solo Host)
    if (isHost && data.gameState === 'WAITING') {
        const seatedCount = data.seats.filter(s => s !== null).length;
        document.getElementById('start-btn').style.display = seatedCount >= 2 ? 'block' : 'none';
    } else {
        document.getElementById('start-btn').style.display = 'none';
    }
});

function getCardColorClass(card) {
    if (card.includes('♥')) return 'red';
    if (card.includes('♦')) return 'blue';
    if (card.includes('♣')) return 'green';
    return 'black';
}

function renderSeats(data) {
    document.querySelectorAll('.seat').forEach(s => s.remove());
    
    data.seats.forEach((p, i) => {
        const seat = document.createElement('div');
        seat.className = `seat pos-${i}`;
        
        if (p === null) {
            if(data.gameState === 'PLAYING') {
                seat.innerHTML = `<div class="empty-seat-btn locked">OCUPADO</div>`;
            } else {
                seat.innerHTML = `<div class="empty-seat-btn" onclick="socket.emit('sitDown', ${i})">SENTARSE</div>`;
            }
        } else {
            const isTurn = i === data.currentTurnIndex;
            const isMe = p.id === socketId;
            if(isTurn) seat.classList.add('active-turn');

            let cardsHTML = '';
            if(p.active && data.handState && data.handState !== 'WAITING') {
                let cardsToRender = (isMe) ? myCards : (p.holeCards ? p.holeCards.map(c => c.str) : ['?', '?']);
                cardsHTML = cardsToRender.map(c => {
                    if (c === '?') return `<div class="card hidden"></div>`;
                    const isWinner = data.winningCards && data.winningCards.includes(c);
                    
                    // Separar el número del palo
                    const rank = c.slice(0, -1);
                    const suit = c.slice(-1);
                    
                    return `
                        <div class="card ${getCardColorClass(c)} ${isWinner ? 'winner-highlight' : ''}">
                            <div class="card-corner top-left">
                                <span class="rank">${rank}</span>
                                <span class="suit">${suit}</span>
                            </div>
                            <div class="card-center">${suit}</div>
                            <div class="card-corner bottom-right">
                                <span class="rank">${rank}</span>
                                <span class="suit">${suit}</span>
                            </div>
                        </div>`;
                }).join('');
            }

            let blindHTML = i === data.dealerIndex ? '<div class="blind-btn btn-dealer">D</div>' : 
                           (i === data.sbIndex ? '<div class="blind-btn btn-sb">SB</div>' : 
                           (i === data.bbIndex ? '<div class="blind-btn btn-bb">BB</div>' : ''));

            // 3. Apuestas en la mesa (STACK DE FICHAS)
            let betHTML = '';
            if (p.currentBet > 0) {
                const oldBet = lastGameState?.seats[i]?.currentBet || 0;
                
                // Calcular las fichas necesarias
                const chips = calculateChips(p.currentBet);
                
                // Generar el HTML de cada ficha apilada (separadas por 3px de altura)
                const chipsHTML = chips.map((val, idx) => 
                    `<div class="poker-chip chip-${val}" style="bottom: ${idx * 3}px; z-index: ${idx};"></div>`
                ).join('');

                // La altura del contenedor depende de la cantidad de fichas
                const stackHeight = 28 + (chips.length * 3);

                betHTML = `
                    <div class="player-bet visible ${p.currentBet > oldBet ? 'anim-throw' : ''}" id="bet-spot-${i}">
                        <div class="chip-stack" style="height: ${stackHeight}px;">
                            ${chipsHTML}
                        </div>
                        <span style="margin-bottom: 4px;">$${p.currentBet}</span>
                    </div>`;
            }
            let actionLabelHTML = '';
            if (p.lastAction && p.actionId !== (window[`lastActionId_${i}`] || 0)) {
                actionLabelHTML = `<div class="action-label">${p.lastAction}</div>`;
                window[`lastActionId_${i}`] = p.actionId;
            }

            let handEvalHTML = (p.active && p.bestHandName && (isMe || data.handState === 'SHOWDOWN')) 
                ? `<div class="hand-eval-display" style="font-size:10px; line-height:1.2; margin-top:3px;">${p.bestHandName}</div>` 
                : '';

            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`;
            
            seat.innerHTML = `
                ${betHTML}
                ${actionLabelHTML}
                <div class="player-cards">${cardsHTML}</div>
                <div class="avatar-wrapper">
                    <img src="${avatarUrl}" class="avatar-img" style="${p.active ? '' : 'opacity:0.3; filter:grayscale(1);'}">
                    ${blindHTML}
                </div>
                <div class="player-info-panel">
                    <b>${p.name}</b>
                    <span>${toBB(p.balance)}</span>
                    <div class="timer-container">
                        <div class="timer-bar" id="timer-bar-${i}"></div>
                    </div>
                    ${handEvalHTML}
                </div>
            `;
        }
        document.getElementById('poker-table').appendChild(seat);
    });
}

function animateChipsToPot(chipsInfo) {
    const potEl = document.getElementById('pot-display');
    const potRect = potEl.getBoundingClientRect();
    chipsInfo.forEach(chip => {
        const flying = document.createElement('div');
        flying.className = 'poker-chip chip-' + (roomType === 'free' ? 'free' : 'paid');
        flying.style.cssText = `position:fixed; left:${chip.x}px; top:${chip.y}px; z-index:9999; transition:all 0.5s ease-in;`;
        document.body.appendChild(flying);
        requestAnimationFrame(() => {
            flying.style.left = (potRect.left + potRect.width/2) + 'px';
            flying.style.top = (potRect.top + potRect.height/2) + 'px';
            flying.style.opacity = '0';
        });
        setTimeout(() => flying.remove(), 500);
    });
    setTimeout(() => {
        potEl.classList.add('anim-pot-collect');
        setTimeout(() => potEl.classList.remove('anim-pot-collect'), 600);
    }, 500);
}

// --- ACCIONES DE APUESTA ---

function updateRaiseLabels() {
    const val = document.getElementById('raise-slider').value;
    document.getElementById('raise-val-cash').innerText = `$${val}`;
    document.getElementById('raise-val-bb').innerText = toBB(val);
}

function setRaisePercent(percent) {
    if (!lastGameState) return;
    const pot = lastGameState.pot;
    const myBet = lastGameState.seats.find(s => s && s.id === socketId)?.currentBet || 0;
    const callAmt = lastGameState.currentBet - myBet;
    let amount = callAmt + Math.floor(percent * (pot + callAmt));
    const slider = document.getElementById('raise-slider');
    slider.value = Math.min(Math.max(amount, slider.min), myCurrentBalance);
    updateRaiseLabels();
}

function setRaiseBB(multiplier) {
    let amount = multiplier * BB_VALUE;
    const slider = document.getElementById('raise-slider');
    slider.value = Math.min(Math.max(amount, slider.min), myCurrentBalance);
    updateRaiseLabels();
}

socket.on('yourTurn', (data) => {
    document.getElementById('action-panel').classList.add('active');
    const slider = document.getElementById('raise-slider');
    const minRaise = data.betToCall ? lastGameState.currentBet + BB_VALUE : BB_VALUE * 2;
    
    slider.min = Math.min(minRaise, myCurrentBalance);
    slider.max = myCurrentBalance;
    slider.value = slider.min;
    updateRaiseLabels();

    const callBtn = document.getElementById('call-btn');
    if(data.betToCall > 0) {
        const callAmt = Math.min(data.betToCall, myCurrentBalance);
        callBtn.innerText = `CALL $${callAmt}`;
        callBtn.style.background = "var(--accent-yellow)";
    } else {
        callBtn.innerText = "CHECK";
        callBtn.style.background = "#fff";
    }
});

function sendAction(type) {
    let amt = type === 'raise' ? parseInt(document.getElementById('raise-slider').value) : (type === 'allin' ? myCurrentBalance : 0);
    socket.emit('playerAction', { action: type, amount: amt });
    document.getElementById('action-panel').classList.remove('active');
}

// --- LEADERBOARD ---

function renderLeaderboard(lb) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;
    const sorted = Object.entries(lb).map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins).slice(0, 5);
    if (sorted.length === 0) {
        container.innerHTML = `<div style="font-size:10px; color:#555; text-align:center;">No hay victorias registradas</div>`;
        return;
    }
    container.innerHTML = sorted.map((player, index) => `
        <div class="leaderboard-row">
            <span class="rank">#${index + 1}</span>
            <span class="name">${player.name}</span>
            <span class="wins">${player.wins} ${player.wins === 1 ? 'Win' : 'Wins'}</span>
        </div>`).join('');
}

// --- OTROS EVENTOS ---

socket.on('timerStart', (data) => {
    const bar = document.getElementById(`timer-bar-${data.seatIndex}`);
    if(bar) {
        bar.style.transition = 'none';
        bar.style.width = '100%';
        bar.style.backgroundColor = 'var(--accent-green)';
        void bar.offsetWidth;
        bar.style.transition = `width ${data.time / 1000}s linear, background-color ${data.time / 1000}s linear`;
        bar.style.width = '0%';
        bar.style.backgroundColor = 'var(--accent-red)';
    }
});

socket.on('receiveHoleCards', (cards) => { myCards = cards.map(c => c.str); });

function sendChat() {
    const input = document.getElementById('chat-input');
    if(input.value) { socket.emit('sendChat', input.value); input.value = ''; }
}

socket.on('receiveChat', (data) => {
    const box = document.getElementById('chat-messages');
    box.innerHTML += `<div><b style="color:var(--accent-purple)">${data.user}:</b> ${data.message}</div>`;
    box.scrollTop = box.scrollHeight;
});

socket.on('serverLog', (data) => {
    const logs = document.getElementById('game-logs');
    const div = document.createElement('div');
    div.className = `log-entry ${data.type || ''}`;
    div.innerHTML = `<span>${data.type==='log-win'?'🏆':(data.type==='log-bet'?'💰':'📢')}</span> ${data.message}`;
    logs.prepend(div);
});


// --- CALCULADORA DE FICHAS (DENOMINACIONES) ---
const CHIP_VALUES = [1000, 500, 100, 25, 5, 1];

function calculateChips(amount) {
    let remaining = amount;
    let chips = [];
    
    for (let val of CHIP_VALUES) {
        let count = Math.floor(remaining / val);
        for (let i = 0; i < count; i++) {
            chips.push(val);
            // Límite visual: no apilar más de 12 fichas en total para no saturar la pantalla
            if (chips.length >= 12) return chips.reverse(); 
        }
        remaining %= val;
    }
    // Invertimos el array para que las fichas más grandes queden en la base del stack (primero en el DOM)
    return chips.reverse(); 
}

 // =========================================
        // MOTOR JS: Creación de Volumen 3D y Lluvia
        // =========================================
              // Reducimos un poco la cantidad máxima para asegurar que fluya a 60 FPS
        // ya que ahora la ficha tiene EL DOBLE de densidad (calidad alta).
        const cantidadFichas = 25; 
        let fichasActivas = 0;

        function crearFicha() {
            if (fichasActivas >= cantidadFichas) return;

            const contenedorCaida = document.createElement('div');
            contenedorCaida.classList.add('contenedor-caida');

            const contenedorRotacion = document.createElement('div');
            contenedorRotacion.classList.add('contenedor-rotacion');

            // -------------------------------------------------------------
            // MEJORA DE CALIDAD: Generamos 36 capas separadas por 0.5px
            // Esto duplica la resolución del cilindro eliminando la "escalera"
            // -------------------------------------------------------------
            for (let i = -18; i <= 18; i++) {
                const z = i * 0.5; // Pasos de 0.5 píxeles en lugar de 1 entero
                const capaGrosor = document.createElement('div');
                capaGrosor.classList.add('capa-grosor');
                capaGrosor.style.transform = `translateZ(${z}px)`;
                contenedorRotacion.appendChild(capaGrosor);
            }

            // Diseño de las caras
            const diseñoCara = `
                <div class="corte-blanco">
                    <div class="centro-rojo">
                        <div class="pica">♠</div>
                    </div>
                </div>
            `;
            
            const caraFrente = document.createElement('div');
            caraFrente.classList.add('cara', 'cara-frente');
            caraFrente.innerHTML = diseñoCara;

            const caraDorso = document.createElement('div');
            caraDorso.classList.add('cara', 'cara-dorso');
            caraDorso.innerHTML = diseñoCara;

            contenedorRotacion.appendChild(caraFrente);
            contenedorRotacion.appendChild(caraDorso);
            contenedorCaida.appendChild(contenedorRotacion);

            // --- FÍSICAS DE GRAVEDAD LENTA ---
            
            const posX = (Math.random() * 90 + 5) + 'vw';
            const posZ = (Math.random() * 800 - 400) + 'px'; 
            const escala = Math.random() * 0.6 + 0.4;
            
            // Gravedad ajustada: de 8 a 15 segundos (mucho más lento y majestuoso)
            const tiempoCaida = Math.random() * 7 + 8; 

            // Rotación más suave acorde a la velocidad lenta
            const giroX = (Math.random() * 720 + 360) * (Math.random() > 0.5 ? 1 : -1) + 'deg';
            const giroY = (Math.random() * 720 + 360) * (Math.random() > 0.5 ? 1 : -1) + 'deg';
            const giroZ = (Math.random() * 360) + 'deg';

            // --- APLICAR ESTILOS ---
            contenedorCaida.style.setProperty('--posX', posX);
            contenedorCaida.style.setProperty('--posZ', posZ);
            contenedorCaida.style.setProperty('--escala', escala);
            // Aplicamos el tiempo de caída largo
            contenedorCaida.style.animationDuration = `${tiempoCaida}s`;

            contenedorRotacion.style.setProperty('--giroX', giroX);
            contenedorRotacion.style.setProperty('--giroY', giroY);
            contenedorRotacion.style.setProperty('--giroZ', giroZ);
            contenedorRotacion.style.animationDuration = `${tiempoCaida}s`;

            document.body.appendChild(contenedorCaida);
            fichasActivas++;

            // Eliminar elemento para ahorrar RAM
            setTimeout(() => {
                contenedorCaida.remove();
                fichasActivas--;
            }, tiempoCaida * 1000);
        }

        // Aparece una ficha nueva cada 350 milisegundos para no saturar la pantalla
        // dado que ahora tardan más en caer.
        setInterval(crearFicha, 5500);




        // ==========================================
// SISTEMA DE PANTALLA DE CARGA 3D (Three.js)
// ==========================================
let isAnimating3D = false;
let animationFrameId;

// Inicialización de Three.js
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Texturas de la ficha
function createChipFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const center = 512;

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(center, center, 500, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.translate(center, center); ctx.rotate(i * (Math.PI / 3)); ctx.fillRect(-120, -512, 240, 300); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(center, center, 360, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D30000'; ctx.beginPath(); ctx.arc(center, center, 290, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 400px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♠', center, center + 30); 
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
}

function createChipEdgeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1024, 64);
    ctx.fillStyle = '#FFFFFF';
    for(let i=0; i<6; i++) { ctx.fillRect(i * (1024/6) + 30, 0, 100, 64); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Creación de la malla (Mesh)
const geometry = new THREE.CylinderGeometry(4, 4, 0.5, 64); 
const topBottomMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2, map: createChipFaceTexture() });
const edgeMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2, map: createChipEdgeTexture() });
const chip = new THREE.Mesh(geometry, [edgeMaterial, topBottomMaterial, topBottomMaterial]);

chip.rotation.x = Math.PI / 2.5; 
chip.rotation.z = Math.PI / 8;
chip.castShadow = true; chip.receiveShadow = true;
scene.add(chip);

// Iluminación
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const spotLight = new THREE.SpotLight(0xffffff, 1.5);
spotLight.position.set(10, 20, 10);
scene.add(spotLight);
const pointLight = new THREE.PointLight(0x88ccff, 1, 50);
pointLight.position.set(-10, -10, 10);
scene.add(pointLight);

const clock = new THREE.Clock();

// Bucle de animación (Optimizado para pausarse cuando no se ve)
function animate3D() {
    if (!isAnimating3D) return;
    animationFrameId = requestAnimationFrame(animate3D);
    const elapsedTime = clock.getElapsedTime();
    chip.rotation.y -= 0.05; // Velocidad de giro
    chip.position.y = Math.sin(elapsedTime * 3) * 0.3; // Levitación
    renderer.render(scene, camera);
}

// Responsividad del Canvas
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- FUNCIONES PARA USAR EN TU LÓGICA DE JUEGO ---

function mostrarPantallaCarga() {
    document.getElementById('loading-screen').style.display = 'block';
    isAnimating3D = true;
    clock.start();
    animate3D();
}

function ocultarPantallaCarga() {
    document.getElementById('loading-screen').style.display = 'none';
    isAnimating3D = false;
    cancelAnimationFrame(animationFrameId);
}
// ==========================================


// --- FUNCIONES PARA COPIAR EL ID DE LA SALA ---

window.copyRoomId = function(id, btnElement) {
    navigator.clipboard.writeText(id).then(() => {
        const originalText = btnElement.innerText;
        const originalBg = btnElement.style.background;
        
        // Cambiamos el texto y color temporalmente
        btnElement.innerText = '¡COPIADO!';
        btnElement.style.background = '#fff'; // Se pone blanco
        
        // Regresa a la normalidad después de 2 segundos
        setTimeout(() => {
            btnElement.innerText = originalText;
            btnElement.style.background = originalBg;
        }, 2000);
        
    }).catch(err => {
        console.error('Error: ', err);
        alert('Cópialo manualmente: ' + id);
    });
};