// pokerEngine.ts - Motor lógico de Texas Hold'em en TypeScript
import * as crypto from 'crypto';

export const SUITS: string[] = ['♠', '♥', '♦', '♣'];
export const RANKS: string[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const RANK_NAMES_PLURAL: Record<number, string> = {
    14: 'Ases', 13: 'Reyes', 12: 'Reinas', 11: 'Jotas', 10: 'Dieces',
    9: 'Nueves', 8: 'Ochos', 7: 'Sietes', 6: 'Seises', 5: 'Cincos',
    4: 'Cuatros', 3: 'Treses', 2: 'Doses'
};

export const RANK_NAMES_SINGULAR: Record<number, string> = {
    14: 'As', 13: 'Rey', 12: 'Reina', 11: 'Jota', 10: 'Diez',
    9: 'Nueve', 8: 'Ocho', 7: 'Siete', 6: 'Seis', 5: 'Cinco',
    4: 'Cuatro', 3: 'Tres', 2: 'Dos'
};

export interface Card {
    rank: string;
    suit: string;
    value: number;
    str: string;
}

export interface Player {
    holeCards: Card[];
    bestHand: string | null;
    score: number;
    winningCards: string[];
}

export interface EvalResult {
    rank: number;
    score: number;
    name: string;
    cards: Card[];
}

export class PokerEngine {
    deck: Card[] = [];
    board: Card[] = [];
    players: Player[] = [];

    // --- MANEJO DE LA BARAJA (CRITOGRÁFICAMENTE SEGURO) ---
    createDeck(): void {
        this.deck = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.deck.push({ rank, suit, value: RANK_VALUES[rank]!, str: rank + suit });
            }
        }
    }

    shuffleDeck(): void {
        // Fisher-Yates con crypto.randomInt para seguridad
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            // swap with non-null assertion (deck always filled when shuffling)
            [this.deck[i]!, this.deck[j]!] = [this.deck[j]!, this.deck[i]!];
        }
    }

    drawCard(): Card | undefined {
        return this.deck.pop();
    }

    // --- FLUJO DEL JUEGO ---
    startGame(numPlayers: number): void {
        this.createDeck();
        this.shuffleDeck();
        this.board = [];
        this.players = [];

        for (let i = 0; i < numPlayers; i++) {
            this.players.push({ holeCards: [], bestHand: null, score: -1, winningCards: [] });
        }

        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < numPlayers; i++) {
                        const card = this.drawCard();
                if (card !== undefined) this.players[i]!.holeCards.push(card);
            }
        }
    }

    dealFlop(): void {
        this.drawCard();
        this.board.push(this.drawCard()!, this.drawCard()!, this.drawCard()!);
    }
    dealTurn(): void {
        this.drawCard();
        this.board.push(this.drawCard()!);
    }
    dealRiver(): void {
        this.drawCard();
        this.board.push(this.drawCard()!);
    }

    // --- EVALUADOR MATEMÁTICO PERFECTO ---
    getCombinations<T>(array: T[], size: number): T[][] {
        const result: T[][] = [];
        const f = (prefix: T[], arr: T[]): void => {
            for (let i = 0; i < arr.length; i++) {
                const newPrefix: T[] = [...prefix, arr[i]!];
                if (newPrefix.length === size) result.push(newPrefix);
                else f(newPrefix, arr.slice(i + 1));
            }
        };
        f([], array);
        return result;
    }

    evaluate5Cards(cards: Card[]): EvalResult {
        cards.sort((a, b) => b.value - a.value);

        let isFlush = cards.length > 0 && cards.every(c => c.suit === cards[0]!.suit);
        let isStraight = false;
        let straightHigh = 0;

        const uniqueValues = [...new Set(cards.map(c => c.value))];

        if (uniqueValues.length === 5 && uniqueValues[0]! - uniqueValues[4]! === 4) {
            isStraight = true;
            straightHigh = uniqueValues[0]!;
        } else if (
            uniqueValues.length === 5 &&
            uniqueValues[0] === 14 &&
            uniqueValues[1] === 5 &&
            uniqueValues[2] === 4 &&
            uniqueValues[3] === 3 &&
            uniqueValues[4] === 2
        ) {
            isStraight = true;
            straightHigh = 5;
        }

        const counts: Record<number, number> = {};
        cards.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });

        const sortedUnique = Object.keys(counts)
            .map(Number)
            .sort((a, b) => {
                const cb = counts[b] ?? 0;
                const ca = counts[a] ?? 0;
                if (cb !== ca) return cb - ca;
                return b - a;
            });

        let tieBreakerValues: number[] = [];
        if (isStraight) {
            tieBreakerValues = [straightHigh, 0, 0, 0, 0];
        } else {
            for (const val of sortedUnique) {
                for (let i = 0; i < (counts[val] ?? 0); i++) tieBreakerValues.push(val);
            }
        }

        let rank = 1;
        let handName = '';
        const u0 = sortedUnique[0] ?? 0;
        const u1 = sortedUnique[1] ?? 0;
        const c1 = counts[u0] ?? 0;
        const c2 = sortedUnique.length > 1 ? counts[u1] ?? 0 : 0;

        if (isFlush && isStraight) {
            rank = 9;
            handName =
                straightHigh === 14
                    ? 'Escalera Real'
                    : `Escalera de Color al ${RANK_NAMES_SINGULAR[straightHigh]}`;
        } else if (c1 === 4) {
            rank = 8;
            handName = `Póker de ${RANK_NAMES_PLURAL[u0]}`;
        } else if (c1 === 3 && c2 === 2) {
            rank = 7;
            handName = `Full House de ${RANK_NAMES_PLURAL[u0]} y ${RANK_NAMES_PLURAL[u1]}`;
        } else if (isFlush) {
            rank = 6;
            handName = `Color (Carta Alta ${RANK_NAMES_SINGULAR[u0]})`;
        } else if (isStraight) {
            rank = 5;
            handName = `Escalera al ${RANK_NAMES_SINGULAR[straightHigh]}`;
        } else if (c1 === 3) {
            rank = 4;
            handName = `Trío de ${RANK_NAMES_PLURAL[u0]}`;
        } else if (c1 === 2 && c2 === 2) {
            rank = 3;
            handName = `Doble Pareja de ${RANK_NAMES_PLURAL[u0]} y ${RANK_NAMES_PLURAL[u1]}`;
        } else if (c1 === 2) {
            rank = 2;
            handName = `Pareja de ${RANK_NAMES_PLURAL[u0]}`;
        } else {
            rank = 1;
            handName = `Carta Alta ${RANK_NAMES_SINGULAR[u0]}`;
        }

        let score = rank * Math.pow(16, 5);
        for (let i = 0; i < 5; i++) {
            score += (tieBreakerValues[i] ?? 0) * Math.pow(16, 4 - i);
        }

        return { rank, score, name: handName, cards };
    }

    evaluatePlayer(player: Player): void {
        const allCards = [...player.holeCards, ...this.board];
        const combos = this.getCombinations(allCards, 5);

        let best: EvalResult = { rank: 0, score: -1, name: '', cards: [] };
        for (const combo of combos) {
            const res = this.evaluate5Cards(combo);
            if (res.score > best.score) best = res;
        }

        player.score = best.score;
        player.bestHand = best.name;
        player.winningCards = best.cards.map(c => c.str);
    }

    determineWinners(): Player[] {
        if (this.players.length === 0) return [];
        let maxScore = -1;
        for (const p of this.players) {
            if (p.score > maxScore) maxScore = p.score;
        }
        return this.players.filter(p => p.score === maxScore);
    }
}
