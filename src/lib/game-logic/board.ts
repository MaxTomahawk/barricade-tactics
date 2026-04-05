import { BoardNode, Pawn, Position, PlayerColor } from '../types';

const BORD_ROWS = 15;
const BORD_COLS = 11;
const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];

export function generateBoard(): { board: Record<string, BoardNode>, verbodenBarricades: Position[] } {
    const knoppen: Record<string, BoardNode> = {};
    const verbodenBarricades: Position[] = [];

    // Create all nodes based on the Python logic
    for (let r = 0; r < BORD_ROWS; r++) {
        if (r % 2 !== 0) {
            for (let c = 0; c < BORD_COLS; c++) {
                const posKey = `${r},${c}`;
                knoppen[posKey] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
            }
        } else {
            let bruggen: number[] = [];
            if (r === 14) bruggen = [2, 4, 6, 8];
            else if (r === 12) bruggen = [1, 5, 9];
            else if (r === 10) bruggen = [3, 7];
            else if (r === 8) bruggen = [1, 5, 9];
            else if (r === 6) bruggen = [3, 7];
            else if (r === 4) bruggen = [1, 5, 9];
            else if (r === 2) bruggen = [5];
            else if (r === 0) bruggen = [5];

            for (const c of bruggen) {
                const posKey = `${r},${c}`;
                knoppen[posKey] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
            }
        }
    }

    // Connect neighbors
    for (const posKey in knoppen) {
        const knoop = knoppen[posKey];
        const { r, c } = knoop;
        const mogelijkeBuren = [{ r: r - 1, c }, { r: r + 1, c }, { r: r, c: c - 1 }, { r: r, c: c + 1 }];
        for (const buurPos of mogelijkeBuren) {
            const buurKey = `${buurPos.r},${buurPos.c}`;
            if (knoppen[buurKey]) {
                knoop.buren.push({ r: buurPos.r, c: buurPos.c });
            }
        }
    }

    // Finish node
    knoppen['0,5'].is_finish = true;

    // Start positions are handled dynamically on game start to create pawns
    const start_cols = [2, 4, 6, 8];
    for (let i = 0; i < 4; i++) { // Always create all 4 start areas for board structure
        const c = start_cols[i];
        const entry_knoop_key = `${BORD_ROWS - 1},${c}`;
        if (knoppen[entry_knoop_key]) {
            verbodenBarricades.push({ r: BORD_ROWS - 1, c });
            verbodenBarricades.push({ r: BORD_ROWS - 2, c });

            for (const [r_offset, c_offset] of [[1, 0], [2, 0], [1, -1], [2, -1]]) {
                const start_pos = { r: BORD_ROWS - 1 + r_offset, c: c + c_offset };
                const start_pos_key = `${start_pos.r},${start_pos.c}`;
                const k: BoardNode = { ...start_pos, buren: [{ r: BORD_ROWS - 1, c }], is_start: true, is_finish: false, speler_start: i };
                knoppen[start_pos_key] = k;
                knoppen[entry_knoop_key].buren.push(start_pos);
            }
        }
    }

    return { board: knoppen, verbodenBarricades };
}

export function generateInitialPawns(playerCount: number): Pawn[] {
    const pawns: Pawn[] = [];
    const start_cols = [2, 4, 6, 8];
    let pawnIdCounter = 0;

    for (let i = 0; i < playerCount; i++) {
        const c = start_cols[i];
        const startOffsets = [[1, 0], [2, 0], [1, -1], [2, -1]];
        for (let j = 0; j < 4; j++) {
            const [r_offset, c_offset] = startOffsets[j];
            const start_pos = { r: BORD_ROWS - 1 + r_offset, c: c + c_offset };
            pawns.push({
                id: pawnIdCounter++,
                playerId: '', // Will be assigned
                playerIndex: i,
                pos: start_pos,
                isHome: true,
                isFinished: false,
                color: PLAYER_COLORS[i],
            });
        }
    }
    return pawns;
}


export function generateInitialBarricades(board: Record<string, BoardNode>, verbodenBarricades: Position[]): Position[] {
    const vrijePlekken = Object.values(board)
        .filter(k => 
            !k.is_start && 
            !k.is_finish && 
            k.r > 2 && // From python code
            !verbodenBarricades.some(vb => vb.r === k.r && vb.c === k.c)
        )
        .map(k => ({ r: k.r, c: k.c }));

    // Shuffle
    for (let i = vrijePlekken.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vrijePlekken[i], vrijePlekken[j]] = [vrijePlekken[j], vrijePlekken[i]];
    }

    return vrijePlekken.slice(0, 8);
}
