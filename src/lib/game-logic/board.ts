import { BoardNode, Pawn, Position, PlayerColor } from '../types';

const BORD_ROWS = 11;
const BORD_COLS = 23;
const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];

export function generateBoard(activeSlotIds: number[] = [0, 1, 2, 3]): { board: Record<string, BoardNode>, verbodenBarricades: Position[], startCols: number[] } {
    const knoppen: Record<string, BoardNode> = {};
    const verbodenBarricades: Position[] = [];
    const playerCount = activeSlotIds.length;

    // Compute start columns distributed evenly across board width (cols 2-20)
    const startCols: number[] = [];
    if (playerCount === 1) {
        startCols.push(11); // center
    } else if (playerCount === 2) {
        startCols.push(5, 17); // Perfectly symmetric (6 from center)
    } else if (playerCount === 3) {
        startCols.push(5, 11, 17); // Symmetric around center (0, 6, 6)
    } else {
        startCols.push(5, 9, 13, 17); // Compact & symmetric (6, 2, 2, 6)
    }

    const bridgesByRow: Record<number, number[]> = {};
    bridgesByRow[11] = [...startCols]; // Connect to entry node paths
    bridgesByRow[-1] = [11]; // Connect to finish node at center

    // 1. Generate symmetrical bridge columns for odd rows (9 down to 1)
    for (const r of [9, 7, 5, 3, 1]) {
        const cols = new Set<number>();
        if (r === 1) {
            cols.add(11);
        } else {
            let maxDist = 9;
            if (r === 3) maxDist = 3; 
            if (r === 5) maxDist = 6;
            
            const available: number[] = [];
            for (let d = 3; d <= maxDist; d += 3) available.push(d);
            
            // To ensure ONLY T-junctions, we must avoid shared columns with row R+2
            const takenByPreviousRow = new Set(bridgesByRow[r + 2] || []);
            
            const validAvailable = available.filter(d => !takenByPreviousRow.has(11 - d) && !takenByPreviousRow.has(11 + d));
            
            const count = Math.random() > 0.4 ? 2 : 1;
            
            for (let i = validAvailable.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [validAvailable[i], validAvailable[j]] = [validAvailable[j], validAvailable[i]];
            }
            
            for (let i = 0; i < count && i < validAvailable.length; i++) {
                cols.add(11 - validAvailable[i]);
                cols.add(11 + validAvailable[i]);
            }
            
            // For row 9, we must connect to startCols, BUT standard boards use T-junctions
            // where entry point is its own vertical path or doesn't X.
            if (r === 9) {
                // If we add startCols, we must be careful. For now, let's just use them
                // but ensure they don't have Up-AND-Down at the EXACT same node in Step 3.
                for (const sc of startCols) {
                    cols.add(sc);
                }
            } else if (Math.random() > 0.7 && !takenByPreviousRow.has(11)) {
                cols.add(11);
            }
            if (cols.size === 0) {
               // Fallback: pick one d not in takenByPreviousRow
               const fallbackDist = [3, 6, 9].find(d => !takenByPreviousRow.has(11 - d) && !takenByPreviousRow.has(11 + d));
               if (fallbackDist !== undefined) {
                   cols.add(11 - fallbackDist);
                   cols.add(11 + fallbackDist);
               } else {
                   cols.add(11); // Last resort
               }
            }
        }
        bridgesByRow[r] = Array.from(cols).sort((a,b) => a-b);
    }

    // 2. Instantiate bridge nodes
    for (const r of [9, 7, 5, 3, 1]) {
        for (const c of bridgesByRow[r]) {
            knoppen[`${r},${c}`] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
        }
    }

    // 3. Instantiate horizontal rows
    for (const r of [10, 8, 6, 4, 2]) {
        const upBridges = new Set(bridgesByRow[r - 1] || []);
        const downBridges = new Set(bridgesByRow[r + 1] || []);
        const allConnectors = [...upBridges, ...downBridges];
        
        const minC = Math.min(...allConnectors);
        const maxC = Math.max(...allConnectors);
        
        for (let c = minC; c <= maxC; c++) {
            const hasUp = upBridges.has(c);
            const hasDown = downBridges.has(c);
            
            // If it has BOTH, it's an X if it also connects horizontally.
            // We BREAK the horizontal connection at this point to keep it a T or Path.
            const isXCrossingPoint = hasUp && hasDown;
            
            if (isXCrossingPoint) {
                // Instantiate the node so vertical paths can pass, but it won't connect L/R
                // actually Step 6 handles neighbors Cardinal directions.
                // If we want ONLY T-junctions, this node MUST NOT have horizontal neighbors.
                // We'll mark it special or just ensure Step 6 knows.
                knoppen[`${r},${c}`] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1, is_t_junction_break: true } as any;
            } else {
                knoppen[`${r},${c}`] = { r, c, buren: [], is_finish: false, is_start: false, speler_start: -1 };
            }
        }
    }

    // 4. Finish node
    knoppen['0,11'] = { r: 0, c: 11, buren: [], is_finish: true, is_start: false, speler_start: -1 };
    if (knoppen['1,11']) {
        knoppen['1,11'].buren.push({ r: 0, c: 11 });
        knoppen['0,11'].buren.push({ r: 1, c: 11 });
    }

    // 5. Start positions — ONLY for active players
    const start_row = 10;
    for (let idx = 0; idx < playerCount; idx++) {
        const startC = startCols[idx];
        const entry_key = `${start_row},${startC}`;
        
        // Ensure entry node exists
        if (!knoppen[entry_key]) {
            knoppen[entry_key] = { r: start_row, c: startC, buren: [], is_finish: false, is_start: false, speler_start: -1 };
        }
        
        for (const [ro, co] of [[1, -1], [1, 1], [2, -1], [2, 1]]) {
            const pr = start_row + ro;
            const pc = startC + co;
            const key = `${pr},${pc}`;
            knoppen[key] = { r: pr, c: pc, buren: [{ r: start_row, c: startC }], is_finish: false, is_start: true, speler_start: activeSlotIds[idx] };
            knoppen[entry_key].buren.push({ r: pr, c: pc });
            verbodenBarricades.push({ r: pr, c: pc });
        }
    }

    // 6. Connect neighbors — SKIP start nodes (they only connect to their entry point)
    for (const posKey in knoppen) {
        const knoop = knoppen[posKey];
        if (knoop.is_start) continue; 
        const { r, c } = knoop;
        
        // Horizontal neighbors
        const horBuren = [{ r, c: c - 1 }, { r, c: c + 1 }];
        for (const buurPos of horBuren) {
            // Only connect horizontally if NEITHER node is a T-junction-break
            if ((knoop as any).is_t_junction_break) continue;
            
            const buurKey = `${buurPos.r},${buurPos.c}`;
            const buurNode = knoppen[buurKey];
            if (buurNode && !buurNode.is_start && !(buurNode as any).is_t_junction_break) {
                if (!knoop.buren.find((b: BoardNode) => b.r === buurPos.r && b.c === buurPos.c)) {
                    knoop.buren.push({ r: buurPos.r, c: buurPos.c });
                }
            }
        }
        
        // Vertical neighbors
        const verBuren = [{ r: r - 1, c }, { r: r + 1, c }];
        for (const buurPos of verBuren) {
            const buurKey = `${buurPos.r},${buurPos.c}`;
            const buurNode = knoppen[buurKey];
            if (buurNode && !buurNode.is_start) {
                if (!knoop.buren.find((b: BoardNode) => b.r === buurPos.r && b.c === buurPos.c)) {
                    knoop.buren.push({ r: buurPos.r, c: buurPos.c });
                }
            }
        }
    }

    return { board: knoppen, verbodenBarricades, startCols };
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
    const CENTER_COL = 11;
    const ENTRY_ROW = 10;
    
    // Count all playable nodes (non-start, non-finish)
    const playableNodes = Object.values(board).filter(k => !k.is_start && !k.is_finish);
    const budget = Math.floor(playableNodes.length / 8); // 1:8 ratio
    
    const isForbidden = (pos: Position) =>
        pos.r === ENTRY_ROW || pos.r === 0 ||
        verbodenBarricades.some(vb => vb.r === pos.r && vb.c === pos.c);
    
    const nodeExists = (r: number, c: number) => !!board[`${r},${c}`];
    
    // --- Step 1: Identify T-junctions in middle section (rows 3-9) ---
    const tJunctions: Position[] = [];
    for (const node of playableNodes) {
        if (node.r >= 3 && node.r <= 9 && node.r % 2 === 1 && node.buren.length >= 3 && !isForbidden(node)) {
            tJunctions.push({ r: node.r, c: node.c });
        }
    }
    // Sort by proximity to finish (smaller r = closer to top)
    tJunctions.sort((a, b) => a.r - b.r);
    
    // --- Step 2: Place T-junction barricades symmetrically ---
    const barricades: Position[] = [];
    const placed = new Set<string>();
    
    // Group T-junctions into symmetrical pairs around CENTER_COL
    const processedRows = new Set<string>(); // track "row,dist" to avoid dupes
    
    for (const tj of tJunctions) {
        if (barricades.length >= budget) break;
        
        const dist = tj.c - CENTER_COL; // distance from center
        const mirrorC = CENTER_COL - dist; // mirror column
        const pairKey = `${tj.r},${Math.min(tj.c, mirrorC)}`;
        
        if (processedRows.has(pairKey)) continue;
        processedRows.add(pairKey);
        
        const key1 = `${tj.r},${tj.c}`;
        
        if (dist === 0) {
            // Center column — just place one
            if (!placed.has(key1) && barricades.length < budget) {
                barricades.push({ r: tj.r, c: tj.c });
                placed.add(key1);
            }
        } else {
            // Place as symmetrical pair
            const key2 = `${tj.r},${mirrorC}`;
            if (!placed.has(key1) && !placed.has(key2) && 
                nodeExists(tj.r, mirrorC) && !isForbidden({ r: tj.r, c: mirrorC }) &&
                barricades.length + 2 <= budget) {
                barricades.push({ r: tj.r, c: tj.c });
                placed.add(key1);
                barricades.push({ r: tj.r, c: mirrorC });
                placed.add(key2);
            }
        }
    }
    
    // --- Step 3: Fill remaining budget symmetrically from middle section ---
    const middleCandidates = playableNodes
        .filter(k => k.r >= 3 && k.r <= 9 && !isForbidden(k) && !placed.has(`${k.r},${k.c}`))
        .map(k => ({ r: k.r, c: k.c }));
    
    // Shuffle
    for (let i = middleCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [middleCandidates[i], middleCandidates[j]] = [middleCandidates[j], middleCandidates[i]];
    }
    
    for (const mc of middleCandidates) {
        if (barricades.length >= budget) break;
        const dist = mc.c - CENTER_COL;
        const mirrorC = CENTER_COL - dist;
        const key1 = `${mc.r},${mc.c}`;
        const key2 = `${mc.r},${mirrorC}`;
        
        if (dist === 0) {
            if (!placed.has(key1)) {
                barricades.push(mc);
                placed.add(key1);
            }
        } else if (!placed.has(key1) && !placed.has(key2) && 
                   nodeExists(mc.r, mirrorC) && !isForbidden({ r: mc.r, c: mirrorC }) &&
                   barricades.length + 2 <= budget) {
            barricades.push(mc);
            placed.add(key1);
            barricades.push({ r: mc.r, c: mirrorC });
            placed.add(key2);
        }
    }
    
    // --- Step 4: Path congestion validation ---
    for (const evenRow of [10, 8, 6, 4, 2]) {
        const rowNodes = playableNodes.filter(k => k.r === evenRow);
        const hasClearUpward = rowNodes.some(node => {
            if (placed.has(`${node.r},${node.c}`)) return false;
            return node.buren.some((b: Position) => 
                b.r === node.r - 1 && !placed.has(`${b.r},${b.c}`)
            );
        });
        
        if (!hasClearUpward) {
            // Remove the last-placed barricade on this row
            for (let i = barricades.length - 1; i >= 0; i--) {
                if (barricades[i].r === evenRow || barricades[i].r === evenRow - 1) {
                    placed.delete(`${barricades[i].r},${barricades[i].c}`);
                    barricades.splice(i, 1);
                    break;
                }
            }
        }
    }
    
    return barricades;
}
