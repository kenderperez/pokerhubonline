// pokerEngine.js - Motor Lógico Profesional de Texas Hold'em
const crypto = require('crypto');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']; 

const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const RANK_NAMES_PLURAL = {
    14: 'Ases', 13: 'Reyes', 12: 'Reinas', 11: 'Jotas', 10: 'Dieces',
    9: 'Nueves', 8: 'Ochos', 7: 'Sietes', 6: 'Seises', 5: 'Cincos',
    4: 'Cuatros', 3: 'Treses', 2: 'Doses'
};

const RANK_NAMES_SINGULAR = {
    14: 'As', 13: 'Rey', 12: 'Reina', 11: 'Jota', 10: 'Diez',
    9: 'Nueve', 8: 'Ocho', 7: 'Siete', 6: 'Seis', 5: 'Cinco',
    4: 'Cuatro', 3: 'Tres', 2: 'Dos'
};

class PokerEngine {
    constructor() {
        this.deck = [];
        this.board = [];
        this.players = [];
    }

    // --- MANEJO DE LA BARAJA (CRITOGRÁFICAMENTE SEGURO) ---
    createDeck() {
        this.deck = [];
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                this.deck.push({ rank, suit, value: RANK_VALUES[rank], str: rank + suit });
            }
        }
    }

    shuffleDeck() {
        // Shuffle Fisher-Yates usando crypto para seguridad nivel casino
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    drawCard() {
        return this.deck.pop();
    }

    // --- FLUJO DEL JUEGO ---
    startGame(numPlayers) {
        this.createDeck();
        this.shuffleDeck();
        this.board = [];
        this.players = [];

        for (let i = 0; i < numPlayers; i++) {
            this.players.push({ holeCards: [], bestHand: null, score: -1, winningCards: [] });
        }

        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < numPlayers; i++) {
                this.players[i].holeCards.push(this.drawCard());
            }
        }
    }

    dealFlop() { this.drawCard(); this.board.push(this.drawCard(), this.drawCard(), this.drawCard()); }
    dealTurn() { this.drawCard(); this.board.push(this.drawCard()); }
    dealRiver() { this.drawCard(); this.board.push(this.drawCard()); }

    // --- EVALUADOR MATEMÁTICO PERFECTO ---
    getCombinations(array, size) {
        const result = [];
        const f = (prefix, array) => {
            for (let i = 0; i < array.length; i++) {
                const newPrefix = [...prefix, array[i]];
                if (newPrefix.length === size) result.push(newPrefix);
                else f(newPrefix, array.slice(i + 1));
            }
        }
        f([], array);
        return result;
    }

    evaluate5Cards(cards) {
        cards.sort((a, b) => b.value - a.value);

        let isFlush = cards.every(c => c.suit === cards[0].suit);
        let isStraight = false;
        let straightHigh = 0;

        const uniqueValues = [...new Set(cards.map(c => c.value))];
        
        // Escalera Normal
        if (uniqueValues.length === 5 && uniqueValues[0] - uniqueValues[4] === 4) {
            isStraight = true;
            straightHigh = uniqueValues[0];
        } 
        // Escalera Baja (The Wheel): A-2-3-4-5
        else if (uniqueValues.length === 5 && uniqueValues[0] === 14 && uniqueValues[1] === 5 && uniqueValues[2] === 4 && uniqueValues[3] === 3 && uniqueValues[4] === 2) {
            isStraight = true;
            straightHigh = 5; 
        }

        const counts = {};
        cards.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });

        // Ordenar por frecuencia (Ej: Quads > Pair > Kicker) y luego por valor
        const sortedUnique = Object.keys(counts).map(Number).sort((a, b) => {
            if (counts[b] !== counts[a]) return counts[b] - counts[a];
            return b - a;
        });

        // Reconstruir array de valores en orden de importancia para el desempate matemático
        let tieBreakerValues = [];
        if (isStraight) {
            tieBreakerValues = [straightHigh, 0, 0, 0, 0];
        } else {
            for (const val of sortedUnique) {
                for (let i = 0; i < counts[val]; i++) tieBreakerValues.push(val);
            }
        }

        let rank = 1;
        let handName = "";
        const c1 = counts[sortedUnique[0]];
        const c2 = sortedUnique.length > 1 ? counts[sortedUnique[1]] : 0;

        if (isFlush && isStraight) {
            rank = 9;
            handName = straightHigh === 14 ? "Escalera Real" : `Escalera de Color al ${RANK_NAMES_SINGULAR[straightHigh]}`;
        } else if (c1 === 4) {
            rank = 8;
            handName = `Póker de ${RANK_NAMES_PLURAL[sortedUnique[0]]}`;
        } else if (c1 === 3 && c2 === 2) {
            rank = 7;
            handName = `Full House de ${RANK_NAMES_PLURAL[sortedUnique[0]]} y ${RANK_NAMES_PLURAL[sortedUnique[1]]}`;
        } else if (isFlush) {
            rank = 6;
            handName = `Color (Carta Alta ${RANK_NAMES_SINGULAR[sortedUnique[0]]})`;
        } else if (isStraight) {
            rank = 5;
            handName = `Escalera al ${RANK_NAMES_SINGULAR[straightHigh]}`;
        } else if (c1 === 3) {
            rank = 4;
            handName = `Trío de ${RANK_NAMES_PLURAL[sortedUnique[0]]}`;
        } else if (c1 === 2 && c2 === 2) {
            rank = 3;
            handName = `Doble Pareja de ${RANK_NAMES_PLURAL[sortedUnique[0]]} y ${RANK_NAMES_PLURAL[sortedUnique[1]]}`;
        } else if (c1 === 2) {
            rank = 2;
            handName = `Pareja de ${RANK_NAMES_PLURAL[sortedUnique[0]]}`;
        } else {
            rank = 1;
            handName = `Carta Alta ${RANK_NAMES_SINGULAR[sortedUnique[0]]}`;
        }

        // Score perfecto en base-16 para garantizar que ningún desempate falle
        let score = rank * Math.pow(16, 5);
        for (let i = 0; i < 5; i++) {
            score += tieBreakerValues[i] * Math.pow(16, 4 - i);
        }

        return { rank, score, name: handName, cards: cards };
    }

    evaluatePlayer(player) {
        const allCards = [...player.holeCards, ...this.board];
        const combos = this.getCombinations(allCards, 5);
        
        let best = { score: -1 };
        for (let combo of combos) {
            const res = this.evaluate5Cards(combo);
            if (res.score > best.score) best = res;
        }

        player.score = best.score;
        player.bestHand = best.name;
        player.winningCards = best.cards.map(c => c.str);
    }

    // Retorna SIEMPRE un ARRAY. Si hay empate matemático exacto, devuelve a todos los ganadores
    determineWinners() {
        if (this.players.length === 0) return [];
        let maxScore = -1;
        
        this.players.forEach(p => {
            if (p.score > maxScore) maxScore = p.score;
        });

        return this.players.filter(p => p.score === maxScore);
    }
}

module.exports = PokerEngine;