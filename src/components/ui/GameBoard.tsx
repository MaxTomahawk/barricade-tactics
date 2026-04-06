'use client';

import React, { useMemo } from 'react';
import { BoardState, Position, PlayerColor } from '@/lib/types';
import { GAME_GRAPH, vindZetten, posToStr } from '@/lib/game-logic/engine';

interface GameBoardProps {
  state: BoardState;
  localPlayerIndex?: number;
  onAction: (action: any) => void;
}

const COLOR_MAP: Record<PlayerColor | 'barricade' | 'finish' | 'path', string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  barricade: '#854d0e',
  finish: '#eab308',
  path: '#334155'
};

const BORD_ROWS = 15;
const BORD_COLS = 11;

export function GameBoard({ state, localPlayerIndex, onAction }: GameBoardProps) {
  const isMyTurn = localPlayerIndex === state.beurt;

  // Derive allowed moves if it is my turn
  const allowedMoves = useMemo(() => {
    const valid = new Set<string>();
    if (!isMyTurn) return valid;
    
    if (state.status === 'SPELEN') {
        for (const p of state.pionnen) {
            if (p.playerIndex === localPlayerIndex && !p.isFinished) {
               const moves = vindZetten(p.pos, state);
               for (const m of moves) {
                   valid.add(posToStr(m));
               }
            }
        }
    } else if (state.status === 'PLAATS_BARRICADE') {
        const vrije_plekken = Object.values(GAME_GRAPH)
            .filter(k => !k.is_finish && !k.is_start &&
                   !state.barricades.some(b => b.r === k.r && b.c === k.c) &&
                   !state.verbodenBarricades.some(vb => vb.r === k.r && vb.c === k.c) &&
                   !state.pionnen.some(p => p.pos.r === k.r && p.pos.c === k.c)
            );
        for (const vp of vrije_plekken) valid.add(posToStr(vp));
    }
    return valid;
  }, [state, isMyTurn, localPlayerIndex]);

  const handleNodeClick = (pos: Position) => {
    if (!isMyTurn) return;
    
    if (state.status === 'PLAATS_BARRICADE') {
      if (allowedMoves.has(posToStr(pos))) {
        onAction({ type: 'BARRICADE', target: pos });
      }
      return;
    }
    
    if (state.status === 'SPELEN') {
      // Find which pawn can move to this target
      // If multiple, just pick the first. (In a perfect UX you click the pawn then the target, but auto-resolving the target is faster).
      // Or if the user clicked their own pawn, we highlight it? Python allowed clicking target.
      const pionIdx = state.pionnen.findIndex(p => p.playerIndex === localPlayerIndex && !p.isFinished && vindZetten(p.pos, state).some(z => z.r === pos.r && z.c === pos.c));
      
      if (pionIdx !== -1) {
        onAction({ type: 'MOVE', pawnIdx: pionIdx, target: pos });
      }
    }
  };

  const handleRollClick = () => {
    if (!isMyTurn || state.status !== 'WACHT_OP_DOBBELSTEEN') return;
    // Technically Guest sends this to Host, and Host resolves it and responds with ROLL_END.
    // For pure UI speed, we emit ROLL_START, wait a random time, then Host emits ROLL_END
    onAction({ type: 'ROLL_START' });
  };

  // Pre-calculate line connections to avoid duplications
  const edges = useMemo(() => {
    const lines = [];
    const seen = new Set<string>();
    for (const node of Object.values(GAME_GRAPH)) {
        for (const b of node.buren) {
            const minR = Math.min(node.r, b.r);
            const minC = Math.min(node.c, b.c);
            const maxR = Math.max(node.r, b.r);
            const maxC = Math.max(node.c, b.c);
            const key = `${minR},${minC}-${maxR},${maxC}`;
            if (!seen.has(key)) {
                seen.add(key);
                lines.push({ x1: node.c + 0.5, y1: node.r + 0.5, x2: b.c + 0.5, y2: b.r + 0.5 });
            }
        }
    }
    return lines;
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center select-none bg-slate-900 p-4 rounded-xl shadow-2xl relative">
      <div className="w-full flex justify-between items-center mb-4 text-slate-200 uppercase tracking-widest text-xs font-bold px-2">
        <div>
          Status: <span className="text-white">{state.status.replace('_', ' ')}</span>
        </div>
        <div>
           Turn: Player {state.beurt + 1}
        </div>
      </div>
      
      <svg viewBox={`0 0 ${BORD_COLS} ${BORD_ROWS + 1}`} className="w-full h-auto overflow-visible mb-6 drop-shadow-xl">
        {/* Draw Path Lines */}
        {edges.map((e, idx) => (
            <line 
                key={idx} 
                x1={e.x1} y1={e.y1} 
                x2={e.x2} y2={e.y2} 
                stroke={COLOR_MAP.path} 
                strokeWidth={0.15} 
                strokeLinecap="round" 
            />
        ))}

        {/* Draw Nodes */}
        {Object.values(GAME_GRAPH).map(k => {
          const cx = k.c + 0.5;
          const cy = k.r + 0.5;
          const isFinish = k.is_finish;
          const isStart = k.is_start;
          let fill = '#1e293b'; 
          if (isFinish) fill = COLOR_MAP.finish;
          else if (isStart) {
             const colors: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
             fill = COLOR_MAP[colors[k.speler_start]];
          }
          
          const strPos = posToStr(k);
          const isAllowed = allowedMoves.has(strPos);

          return (
            <g key={`node-${strPos}`} onClick={() => handleNodeClick({r: k.r, c: k.c})} className={isAllowed ? "cursor-pointer" : ""}>
               <circle cx={cx} cy={cy} r={0.3} fill={fill} stroke="#0f172a" strokeWidth={0.06} />
               {isFinish && <circle cx={cx} cy={cy} r={0.35} fill="none" stroke="white" strokeWidth={0.05} />}
               {isAllowed && (
                   <circle cx={cx} cy={cy} r={0.45} fill="none" stroke="white" strokeWidth={0.08} className="animate-pulse" />
               )}
            </g>
          );
        })}

        {/* Draw Barricades */}
        {state.barricades.map((b, idx) => {
           const cx = b.c + 0.5;
           const cy = b.r + 0.5;
           return (
             <rect 
                key={`barricade-${idx}`} 
                x={cx - 0.3} y={cy - 0.3} 
                width={0.6} height={0.6} 
                fill={COLOR_MAP.barricade} 
                stroke="#451a03" 
                strokeWidth={0.05} 
                rx={0.1}
                className="transform transition-transform duration-300 pointer-events-none"
             />
           );
        })}

        {/* Draw Pawns */}
        {state.pionnen.map((p) => {
           if (p.isFinished) return null;
           const cx = p.pos.c + 0.5;
           const cy = p.pos.r + 0.5;
           return (
              <g key={`pawn-${p.id}`} className="transition-all duration-300 pointer-events-none" style={{ transform: `translate(${cx}, ${cy})` }}>
                 <circle cx={0} cy={0} r={0.25} fill={COLOR_MAP[p.color]} />
                 <circle cx={0} cy={0} r={0.25} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={0.05} />
                 {/* Internal shadow matching pygame style */}
                 <circle cx={0.05} cy={-0.05} r={0.15} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.04} />
              </g>
           );
        })}
      </svg>
      
      {/* Dice & Interactions */}
      {(state.status === "WACHT_OP_DOBBELSTEEN" || state.status === "DOBBELEN" || state.status === "SPELEN" || state.status === "PLAATS_BARRICADE" || state.status === "GEEN_ZETTEN") && (
          <div className="flex flex-col items-center">
            {state.status === "WACHT_OP_DOBBELSTEEN" && isMyTurn ? (
                <button onClick={handleRollClick} className="w-24 h-24 bg-primary text-primary-foreground rounded-2xl shadow-xl flex items-center justify-center font-bold text-2xl hover:scale-105 active:scale-95 transition-all">
                   ROLL
                </button>
            ) : (
                <div className="w-24 h-24 bg-white/10 border-4 border-slate-600 rounded-2xl flex items-center justify-center shadow-inner relative">
                    {state.dobbelsteen > 0 ? (
                        <span className="text-4xl font-black text-white">{state.status === 'DOBBELEN' ? '?' : state.dobbelsteen}</span>
                    ) : null}
                    
                    {state.status === 'DOBBELEN' && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse rounded-xl" />
                    )}
                </div>
            )}
            
            {state.status === "GEEN_ZETTEN" && isMyTurn && (
                <button onClick={() => onAction({ type: 'GEEN_ZETTEN_ACK' })} className="mt-4 px-6 py-2 bg-red-600 text-white rounded-full font-bold animate-bounce shadow-xl">
                   No Moves Possible (Finish Turn)
                </button>
            )}
          </div>
      )}
      
      {state.status === "GAME_OVER" && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in zoom-in">
              <h2 className="text-4xl font-black uppercase tracking-widest bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-2xl mb-8">
                  Player {state.winnaar! + 1} Wins!
              </h2>
          </div>
      )}
    </div>
  );
}
