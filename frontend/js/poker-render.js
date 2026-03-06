import { socketId, lastGameState, myCards, toBB, roomType, CHIP_VALUES, getCardColorClass } from './shared.js';

export function renderSeats(data) {
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

            let betHTML = '';
            if (p.currentBet > 0) {
                const oldBet = lastGameState?.seats[i]?.currentBet || 0;
                const chips = calculateChips(p.currentBet);
                const chipsHTML = chips.map((val, idx) => 
                    `<div class="poker-chip chip-${val}" style="bottom: ${idx * 3}px; z-index: ${idx};"></div>`
                ).join('');
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

export function calculateChips(amount) {
    let remaining = amount;
    let chips = [];
    
    for (let val of CHIP_VALUES) {
        let count = Math.floor(remaining / val);
        for (let i = 0; i < count; i++) {
            chips.push(val);
            if (chips.length >= 12) return chips.reverse(); 
        }
        remaining %= val;
    }
    return chips.reverse(); 
}

export function animateChipsToPot(chipsInfo) {
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