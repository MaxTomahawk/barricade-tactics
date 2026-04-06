export type Position = { r: number; c: number };
export type PlayerColor = string;

export interface BoardNode {
    r: number;
    c: number;
    buren: Position[];
    is_finish: boolean;
    is_start: boolean;
    speler_start: number;
}

export interface Pawn {
    id: number;
    playerId: string; // Internal logic might use it
    playerIndex: number; // 0, 1, 2, 3 corresponding to color/turn
    pos: Position;
    isHome: boolean;
    isFinished: boolean;
    color: PlayerColor;
    animating?: boolean;
}

export type GameStatus = "MENU_TOTAAL" | "WACHT_OP_DOBBELSTEEN" | "DOBBELEN" | "SPELEN" | "PLAATS_BARRICADE" | "GEEN_ZETTEN" | "GAME_OVER" | "PAUZE_MENU";

export interface GameSettings {
    captureBonus: boolean;
    winCondition: number;
    diceMode: 'animated' | 'instant_bots' | 'instant';
    protectBottomRow: boolean;
}

export interface BoardState {
    beurt: number;
    dobbelsteen: number;
    status: GameStatus;
    pionnen: Pawn[];
    barricades: Position[];
    verbodenBarricades: Position[];
    graph: Record<string, BoardNode>;
    laatsteWorpen: Record<number, number>;
    winnaar: number | null;
    opgepakteBarricadePos: Position | null;
    settings: GameSettings;
    activePlayerIndices: number[];
    startCols: number[];
    lastMoveHadCapture?: boolean;
}
