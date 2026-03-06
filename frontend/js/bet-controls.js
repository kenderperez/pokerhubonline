import { socket } from "./socket-client.js";
import { socketId, myCurrentBalance, BB_VALUE, lastGameState, toBB } from "./shared.js";

export function updateRaiseLabels() {
    const val = document.getElementById('raise-slider').value;
    document.getElementById('raise-val-cash').innerText = `$${val}`;
    document.getElementById('raise-val-bb').innerText = toBB(val);
}

export function setRaisePercent(percent) {
    if (!lastGameState) return;
    const pot = lastGameState.pot;
    const myBet = lastGameState.seats.find(s => s && s.id === socketId)?.currentBet || 0;
    const callAmt = lastGameState.currentBet - myBet;
    let amount = callAmt + Math.floor(percent * (pot + callAmt));
    const slider = document.getElementById('raise-slider');
    slider.value = Math.min(Math.max(amount, slider.min), myCurrentBalance);
    updateRaiseLabels();
}

export function setRaiseBB(multiplier) {
    let amount = multiplier * BB_VALUE;
    const slider = document.getElementById('raise-slider');
    slider.value = Math.min(Math.max(amount, slider.min), myCurrentBalance);
    updateRaiseLabels();
}

export function sendAction(type) {
    let amt = type === 'raise' ? parseInt(document.getElementById('raise-slider').value) : (type === 'allin' ? myCurrentBalance : 0);
    socket.emit('playerAction', { action: type, amount: amt });
    document.getElementById('action-panel').classList.remove('active');
}