import { BoardNode, Pawn, Position, PlayerColor } from '../types';

const BORD_ROWS = 11;
const BORD_COLS = 23;
const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];

export function generateBoard(): { board: Record<string, BoardNode>, verbodenBarricades: Position[] } {
    const knoppen: Record<string, BoardNode> = {};
    const verbodenBarricades: Position[] = [];

    const bridgesByRow: Record<number, number[]> = {};
    bridgesByRow[11] = [2, 8, 14, 20]; // Connect to 4 entry node paths
    bridgesByRow[-1] = [11]; // Connect to finish node at center

    // 1. Generate symmetrical bridge columns for odd rows (9 down to 1)
    for (const r of [9, 7, 5, 3, 1]) {
        const cols = new Set<number>();
        if (r === 1) {
            cols.add(11);
        } else {
            // Determine logical funneling bounds based on height (minDist maxDist from center 11)
            let maxDist = 9; // Col 2 and 20 are max limits
            if (r === 3) maxDist = 3; 
            if (r === 5) maxDist = 6;
            
            // Available intervals (divisible by 3 for aesthetics: 3, 6, 9)
            const available: number[] = [];
            for (let d = 3; d <= maxDist; d += 3) available.push(d);
            
            // Generate pool of symmetrical picks
            const count = Math.random() > 0.4 ? 2 : 1;
            
            for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]];
            }
            
            for (let i = 0; i < count && i < available.length; i++) {
                cols.add(11 - available[i]);
                cols.add(11 + available[i]); // Mirror
            }
            
            // 30% chance to put bridge exactly at center if we expand wide enough
            if (Math.random() > 0.7) cols.add(11);
            if (cols.size === 0) cols.add(11); // Fallback
        }
        bridgesByRow[r] = Array.from(cols).sort((a,b) => a-b);
    }

    // 2. Instantiate bridge nodes
    for (const r of [9, 7, 5, 3, 1]) {
        for (const c of bridgesByRow[r]) {
            knoppen[`${r},${c}`] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
        }
    }

    // 3. Instantiate horizontal rows ensuring NO dead ends
    // Row 10 spans exactly between the entry bridges
    for (const r of [10, 8, 6, 4, 2]) {
        const U = [...bridgesByRow[r+1], ...bridgesByRow[r-1]];
        const minC = Math.min(...U);
        const maxC = Math.max(...U);
        for (let c = minC; c <= maxC; c++) {
            knoppen[`${r},${c}`] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
        }
    }

    // 4. Finish node
    knoppen['0,11'] = { r: 0, c: 11, buren: [], is_finish: true, is_start: false, speler_start: -1 };
    if (knoppen['1,11']) {
        knoppen['1,11'].buren.push(knoppen['0,11']);
        knoppen['0,11'].buren.push(knoppen['1,11']);
    }

    // 5. Start positions
    const start_row = 10;
    const start_cols = [2, 8, 14, 20];
    for (let idx = 0; idx < 4; idx++) {
        const startC = start_cols[idx];
        const entry_key = `${start_row},${startC}`;
        
        for (const [ro, co] of [[1, -1], [1, 1], [2, -1], [2, 1]]) {
            const pr = start_row + ro;
            const pc = startC + co;
            const key = `${pr},${pc}`;
            knoppen[key] = { r: pr, c: pc, buren: [knoppen[entry_key]], is_finish: false, is_start: true, speler_start: idx };
            knoppen[entry_key].buren.push(knoppen[key]);
            verbodenBarricades.push({ r: pr, c: pc });
        }
    }

    // 6. Connect neighbors functionally
    for (const posKey in knoppen) {
        const knoop = knoppen[posKey];
        const { r, c } = knoop;
        const mogelijkeBuren = [{ r: r - 1, c }, { r: r + 1, c }, { r: r, c: c - 1 }, { r: r, c: c + 1 }];
        for (const buurPos of mogelijkeBuren) {
            const buurKey = `${buurPos.r},${buurPos.c}`;
            if (knoppen[buurKey] && !knoop.buren.find((b: BoardNode) => b.r === buurPos.r && b.c === buurPos.c)) {
                knoop.buren.push({ r: buurPos.r, c: buurPos.c });
            }
        }
    }

    return { board: knoppen, verbodenBarricades };
}

export function generateInitialPawns(playerCount: number): Pawn[] {
    const pawns: Pawn[] = [];
    const start_row = 10;
    const start_cols = [2, 8, 14, 20];
    let pawnIdCounter = 0;

    for (let i = 0; i < playerCount; i++) {
        const c = start_cols[i];
        const startOffsets = [[1, -1], [1, 1], [2, -1], [2, 1]];
        for (let j = 0; j < 4; j++) {
            const [r_offset, c_offset] = startOffsets[j];
            const start_pos = { r: start_row + r_offset, c: c + c_offset };
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
