import { BoardState, Position, GameStatus, Pawn } from '../types';
import { generateBoard, generateInitialBarricades } from './board';

export const { board: GAME_GRAPH, verbodenBarricades: VERBODEN_BARRICADES } = generateBoard();
export const FINISH_POS: Position = { r: 0, c: 11 };

export function posToStr(p: Position): string {
    return `${p.r},${p.c}`;
}

export function initializeBoardState(slots: { id: number, type: string }[]): BoardState {
    const activeSlots = slots.filter(s => s.type === 'host' || s.type === 'player' || s.type === 'bot');
    const pawns: Pawn[] = [];
    const start_row = 10;
    const start_cols = [2, 8, 14, 20];
    let pawnIdCounter = 0;

    for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
        const slot = slots[slotIdx];
        if (slot.type === 'host' || slot.type === 'player' || slot.type === 'bot') {
            const c = start_cols[slotIdx];
            const startOffsets = [[1, -1], [1, 1], [2, -1], [2, 1]];
            for (let j = 0; j < 4; j++) {
                const [r_offset, c_offset] = startOffsets[j];
                pawns.push({
                    id: pawnIdCounter++,
                    playerId: '',
                    playerIndex: slotIdx,
                    pos: { r: start_row + r_offset, c: c + c_offset },
                    isHome: true,
                    isFinished: false,
                    color: (['red', 'green', 'blue', 'yellow'] as const)[slotIdx],
                });
            }
        }
    }
    
    const barricades = generateInitialBarricades(GAME_GRAPH, VERBODEN_BARRICADES);
    const activeIndices = activeSlots.map(s => s.id);
    const startBeurt = activeIndices[Math.floor(Math.random() * activeIndices.length)];
    
    return {
        beurt: startBeurt,
        dobbelsteen: 0,
        status: "WACHT_OP_DOBBELSTEEN",
        pionnen: pawns,
        barricades,
        verbodenBarricades: VERBODEN_BARRICADES,
        laatsteWorpen: {},
        winnaar: null,
        opgepakteBarricadePos: null,
    };
}

export function vindZetten(start_pos: Position, state: BoardState): Position[] {
    const zetten = new Set<string>();
    
    // state tuple: pos, steps left, previous pos null
    const q: { pos: Position; stappen: number; vorig: Position | null }[] = [];
    const bezocht = new Set<string>();
    
    q.push({ pos: start_pos, stappen: state.dobbelsteen, vorig: null });
    
    while (q.length > 0) {
        const { pos: huidig, stappen, vorig } = q.shift()!;
        
        if (stappen === 0) {
            zetten.add(posToStr(huidig));
            continue;
        }
        
        const staat_barricade = state.barricades.some(b => b.r === huidig.r && b.c === huidig.c) && 
                              !(huidig.r === start_pos.r && huidig.c === start_pos.c);
        if (staat_barricade) continue;

        const knoop = GAME_GRAPH[posToStr(huidig)];
        if (!knoop) continue;

        for (const buur of knoop.buren) {
            const buurNode = GAME_GRAPH[posToStr(buur)];
            if (buurNode.is_start) continue;
            
            if (!vorig || (buur.r !== vorig.r || buur.c !== vorig.c)) {
                // To avoid redundant object creation, state check string
                const stateStr = `${buur.r},${buur.c}|${stappen - 1}|${huidig.r},${huidig.c}`;
                if (!bezocht.has(stateStr)) {
                    bezocht.add(stateStr);
                    q.push({ pos: buur, stappen: stappen - 1, vorig: huidig });
                }
            }
        }
    }
    
    const geldige_zetten: Position[] = [];
    for (const zStr of zetten) {
        const [r, c] = zStr.split(',').map(Number);
        
        const bezet_door_eigen = state.pionnen.some(p => p.playerIndex === state.beurt && p.pos.r === r && p.pos.c === c);
        if (!bezet_door_eigen) {
            geldige_zetten.push({ r, c });
        }
    }
    return geldige_zetten;
}

export function kortstePad(start: Position, doel: Position, state: BoardState): Position[] {
    if (start.r === doel.r && start.c === doel.c) return [];
    
    const q: { pos: Position; pad: Position[] }[] = [];
    const bezocht = new Set<string>();
    const startStr = posToStr(start);
    
    q.push({ pos: start, pad: [] });
    bezocht.add(startStr);
    
    while (q.length > 0) {
        const { pos: huidig, pad } = q.shift()!;
        const knoop = GAME_GRAPH[posToStr(huidig)];
        
        if (!knoop) continue;
        
        for (const buur of knoop.buren) {
            const buurNode = GAME_GRAPH[posToStr(buur)];
            const b_pos_str = posToStr(buur);
            
            if (!bezocht.has(b_pos_str)) {
                const isBarricade = state.barricades.some(b => b.r === buur.r && b.c === buur.c);
                const isDoel = (buur.r === doel.r && buur.c === doel.c);
                
                if ((!isBarricade || isDoel) && !buurNode.is_start) {
                    const newPad = [...pad, buur];
                    if (isDoel) return newPad;
                    bezocht.add(b_pos_str);
                    q.push({ pos: buur, pad: newPad });
                }
            }
        }
    }
    return [];
}

export function calcScore(posToScore: Position, playerIndex: number, state: BoardState): number {
    let score = 0;
    score += (posToScore.r * 10) + Math.abs(posToScore.c - 11) * 2;
    
    if (posToScore.r === 0 && posToScore.c === 11) score -= 10000;
    
    const isBarricade = state.barricades.some(b => b.r === posToScore.r && b.c === posToScore.c);
    if (isBarricade) score -= 50; // Eating barricade is very good behavior
    
    for (const p of state.pionnen) {
        if (p.playerIndex !== playerIndex && p.pos.r === posToScore.r && p.pos.c === posToScore.c) {
            score -= 30; // Eating enemy is good
        }
    }
    return score;
}

export function calculateBotAction(state: BoardState): { type: "BARRICADE", target: Position } | { type: "MOVE", pawnIdx: number, target: Position } | null {
    if (state.status === "PLAATS_BARRICADE") {
        const vrije_plekken = Object.values(GAME_GRAPH)
            .filter(k => !k.is_finish && !k.is_start &&
                   !state.barricades.some(b => b.r === k.r && b.c === k.c) &&
                   !state.verbodenBarricades.some(vb => vb.r === k.r && vb.c === k.c) &&
                   !state.pionnen.some(p => p.pos.r === k.r && p.pos.c === k.c)
            )
            .map(k => ({ r: k.r, c: k.c }));
            
        if (vrije_plekken.length > 0) {
            const eigen_paden = state.pionnen
                .filter(p => p.playerIndex === state.beurt)
                .map(p => kortstePad(p.pos, FINISH_POS, state))
                .filter(pad => pad.length > 0);
                
            let beste_eigen_pad: Position[] = [];
            if (eigen_paden.length > 0) {
                beste_eigen_pad = eigen_paden.reduce((min, p) => p.length < min.length ? p : min, eigen_paden[0]);
            }
            
            const tegenstander_paden = state.pionnen
                .filter(p => p.playerIndex !== state.beurt)
                .map(p => ({ len: kortstePad(p.pos, FINISH_POS, state).length, pad: kortstePad(p.pos, FINISH_POS, state), pos: p.pos }))
                .filter(item => item.pad.length > 0);
                
            tegenstander_paden.sort((a, b) => a.len - b.len);
            
            let gevaarlijkste_pad: Position[] = [];
            let gevaarlijkste_pion_pos: Position | null = null;
            
            if (tegenstander_paden.length > 0) {
                gevaarlijkste_pad = tegenstander_paden[0].pad;
                gevaarlijkste_pion_pos = tegenstander_paden[0].pos;
            }
            
            let max_score = -Infinity;
            let beste_plek = vrije_plekken[Math.floor(Math.random() * vrije_plekken.length)];
            
            for (const plek of vrije_plekken) {
                let score = 0;
                
                const gIdx = gevaarlijkste_pad.findIndex(p => p.r === plek.r && p.c === plek.c);
                if (gIdx !== -1) {
                    score += 100 - gIdx;
                }
                
                const eIdx = beste_eigen_pad.findIndex(p => p.r === plek.r && p.c === plek.c);
                if (eIdx !== -1) {
                    score -= 200;
                }
                
                if (GAME_GRAPH[posToStr(plek)].buren.length > 2) {
                    score += 20;
                }
                
                if (gevaarlijkste_pion_pos) {
                    const dist = Math.abs(plek.r - gevaarlijkste_pion_pos.r) + Math.abs(plek.c - gevaarlijkste_pion_pos.c);
                    if (dist < 5) {
                        score += (5 - dist) * 2;
                    }
                }
                
                score += Math.floor(Math.random() * 6);
                if (score > max_score) {
                    max_score = score;
                    beste_plek = plek;
                }
            }
            return { type: "BARRICADE", target: beste_plek };
        }
        return null;
    }
    
    if (state.status === "SPELEN") {
        const alle_zetten: { pionIdx: number, target: Position, score: number }[] = [];
        
        for (let i = 0; i < state.pionnen.length; i++) {
            const p = state.pionnen[i];
            if (p.playerIndex === state.beurt && !p.isFinished) {
                const zetten = vindZetten(p.pos, state);
                for (const z of zetten) {
                    alle_zetten.push({ pionIdx: i, target: z, score: calcScore(z, state.beurt, state) });
                }
            }
        }
        
        if (alle_zetten.length > 0) {
            // Sort to find min score
            alle_zetten.sort((a, b) => a.score - b.score);
            const best = alle_zetten[0];
            return { type: "MOVE", pawnIdx: best.pionIdx, target: best.target };
        }
        return null;
    }
    
    return null;
}

export function nextTurn(state: BoardState, totalPlayers: number) {
    state.beurt = (state.beurt + 1) % totalPlayers;
    state.dobbelsteen = 0;
    state.status = "WACHT_OP_DOBBELSTEEN";
}

export function processGameAction(state: BoardState, playerIndex: number, totalPlayers: number, action: any): boolean {
    if (state.status === "GAME_OVER") return false;
    
    if (action.type === "ROLL_START" && state.status === "WACHT_OP_DOBBELSTEEN") {
        if (playerIndex !== state.beurt) return false;
        state.status = "DOBBELEN";
        return true;
    }
    
    if (action.type === "ROLL_END" && state.status === "DOBBELEN") {
        if (playerIndex !== state.beurt) return false;
        state.dobbelsteen = action.value;
        state.laatsteWorpen[state.beurt] = state.dobbelsteen;
        state.status = "SPELEN";
        
        // Check if player has valid moves
        let heeft_zet = false;
        for (const p of state.pionnen) {
            if (p.playerIndex === state.beurt && !p.isFinished) {
                if (vindZetten(p.pos, state).length > 0) {
                    heeft_zet = true;
                    break;
                }
            }
        }
        
        if (!heeft_zet) {
            state.status = "GEEN_ZETTEN";
        }
        return true;
    }
    
    if (action.type === "MOVE" && state.status === "SPELEN") {
        if (playerIndex !== state.beurt) return false;
        
        const p = state.pionnen[action.pawnIdx];
        if (!p || p.playerIndex !== state.beurt) return false;
        
        p.pos = action.target;
        
        // Remove barricade if landed on
        const bIdx = state.barricades.findIndex(b => b.r === action.target.r && b.c === action.target.c);
        if (bIdx !== -1) {
            state.barricades.splice(bIdx, 1);
            state.opgepakteBarricadePos = action.target;
            state.status = "PLAATS_BARRICADE";
            return true;
        }

        // Eat opponent pawn
        for (const other of state.pionnen) {
            if (other.id !== p.id && other.pos.r === action.target.r && other.pos.c === action.target.c) {
                const startNodes = Object.values(GAME_GRAPH).filter(n => n.is_start && n.speler_start === other.playerIndex);
                for (const sn of startNodes) {
                    if (!state.pionnen.some(op => op.pos.r === sn.r && op.pos.c === sn.c)) {
                        other.pos = { r: sn.r, c: sn.c };
                        break;
                    }
                }
            }
        }
        
        // Check finish
        if (action.target.r === FINISH_POS.r && action.target.c === FINISH_POS.c) {
            p.isFinished = true;
            state.status = "GAME_OVER";
            state.winnaar = state.beurt;
            return true;
        }
        
        nextTurn(state, totalPlayers);
        return true;
    }
    
    if (action.type === "BARRICADE" && state.status === "PLAATS_BARRICADE") {
        if (playerIndex !== state.beurt) return false;
        
        state.barricades.push(action.target);
        state.opgepakteBarricadePos = null;
        nextTurn(state, totalPlayers);
        return true;
    }
    
    if (action.type === "GEEN_ZETTEN_ACK" && state.status === "GEEN_ZETTEN") {
        if (playerIndex !== state.beurt) return false;
        nextTurn(state, totalPlayers);
        return true;
    }
    
    return false;
}
