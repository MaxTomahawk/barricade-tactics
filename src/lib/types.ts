export type PlayerColor = 'red' | 'green' | 'blue' | 'yellow';

export const PLAYER_COLORS: Record<PlayerColor, string> = {
  red: '#EF4444',    // bg-red-500
  green: '#22C55E', // bg-green-500
  blue: '#3B82F6',   // bg-blue-500
  yellow: '#EAB308' // bg-yellow-500
};

export interface Position {
  r: number;
  c: number;
}

export interface BoardNode extends Position {
  buren: Position[];
  is_finish: boolean;
  is_start: boolean;
  speler_start: number; // Player index
}

export interface Pawn {
  id: number;
  playerId: string;
  playerIndex: number;
  pos: Position;
  isHome: boolean;
  isFinished: boolean;
  color: PlayerColor;
}

export interface Player {
  id: string; // Unique ID (e.g., from Firebase Auth or session)
  name: string;
  isBot: boolean;
  color: PlayerColor;
  playerIndex: number;
}

export interface GameSettings {
  totalPlayers: number;
  botCount: number;
  diceAnimation: 'animated' | 'instant_bot' | 'instant_all';
  captureBonus: boolean;
  winCondition: number;
}

export type GameStatus = 'lobby' | 'playing' | 'placing_barricade' | 'game_over';

export interface AnimationState {
  type: 'pawn' | 'barricade';
  pawnId?: number;
  startPos: Position | 'hand';
  endPos: Position;
}
export interface GameState {
  id: string; // Room Code
  players: Player[];
  pawns: Pawn[];
  barricades: Position[];
  board: Record<string, BoardNode>;
  verbodenBarricades: Position[];
  settings: GameSettings;
  status: GameStatus;
  hostId: string;
  currentPlayerIndex: number;
  diceRoll: number;
  lastRolls: Record<number, number>;
  winner?: number; // playerIndex
  opgepakteBarricadePos?: Position | null;
  animation?: AnimationState | null;
  history: string[]; // Summary of last few turns
  createdAt: any; // Firestore Timestamp
}
