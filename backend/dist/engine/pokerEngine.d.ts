export declare const SUITS: string[];
export declare const RANKS: string[];
export declare const RANK_VALUES: Record<string, number>;
export declare const RANK_NAMES_PLURAL: Record<number, string>;
export declare const RANK_NAMES_SINGULAR: Record<number, string>;
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
export declare class PokerEngine {
    deck: Card[];
    board: Card[];
    players: Player[];
    createDeck(): void;
    shuffleDeck(): void;
    drawCard(): Card | undefined;
    startGame(numPlayers: number): void;
    dealFlop(): void;
    dealTurn(): void;
    dealRiver(): void;
    getCombinations<T>(array: T[], size: number): T[][];
    evaluate5Cards(cards: Card[]): EvalResult;
    evaluatePlayer(player: Player): void;
    determineWinners(): Player[];
}
//# sourceMappingURL=pokerEngine.d.ts.map