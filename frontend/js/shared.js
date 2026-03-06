// shared.js
export let socket = null;
export let socketId = null;
export let myCurrentBalance = 0;
export let BB_VALUE = 20;
export let lastGameState = null;
export let myCards = [];
export let roomType = 'free';
export const CHIP_VALUES = [100, 50, 25, 10, 5, 1]; // ejemplo

export function setSocket(newSocket) {
    socket = newSocket;
}
export function setSocketId(id) {
    socketId = id;
}
export function setMyCurrentBalance(bal) {
    myCurrentBalance = bal;
}
export function setBBValue(val) {
    BB_VALUE = val;
}
export function setLastGameState(state) {
    lastGameState = state;
}
export function setMyCards(cards) {
    myCards = cards;
}
export function setRoomType(type) {
    roomType = type;
}

export function toBB(val) {
    return (val / BB_VALUE).toFixed(1) + ' BB';
}

export function getCardColorClass(cardStr) {
    const suit = cardStr.slice(-1);
    return suit === '♥' || suit === '♦' ? 'red' : 'black';
}