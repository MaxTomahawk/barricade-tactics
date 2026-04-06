'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BoardState, Position, PlayerColor, Pawn } from '@/lib/types';
import { vindZetten, posToStr } from '@/lib/game-logic/engine';

interface GameBoardProps {
  state: BoardState;
  slots?: { id: number, type: string, playerName?: string }[];
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

const BORD_ROWS = 11;
const BORD_COLS = 23;

function usePawnPositions(pawns: Pawn[]) {
  const [displayPos, setDisplayPos] = useState<Record<number, {cx: number, cy: number, arcOffset: number}>>({});
  const prevPawnsRef = useRef<Pawn[]>(pawns);

  useEffect(() => {
     let isActive = true;
     const prev = prevPawnsRef.current;
     prevPawnsRef.current = pawns;
     
     pawns.forEach((p: Pawn) => {
        const old = prev.find((x: Pawn) => x.id === p.id);
        const targetX = p.pos.c + 0.5;
        const targetY = p.pos.r + 0.5;

        // If it moved, trigger animation frame loop
        if (old && (old.pos.r !== p.pos.r || old.pos.c !== p.pos.c)) {
           const startX = old.pos.c + 0.5;
           const startY = old.pos.r + 0.5;
           let start = performance.now();
           const duration = 400; 
           
           const frame = (time: number) => {
              if (!isActive) return;
              const progress = Math.min((time - start) / duration, 1);
              const cx = startX + (targetX - startX) * progress;
              const cy = startY + (targetY - startY) * progress;
              // Sine wave for parabolic jump (negative is UP in SVG y-axis)
              const jump = Math.sin(progress * Math.PI) * 1.5; 
              
              setDisplayPos((curr: Record<number, {cx: number, cy: number, arcOffset: number}>) => ({...curr, [p.id]: { cx, cy, arcOffset: -jump }}));
              
              if (progress < 1) requestAnimationFrame(frame);
              else setDisplayPos((curr: Record<number, {cx: number, cy: number, arcOffset: number}>) => ({...curr, [p.id]: { cx: targetX, cy: targetY, arcOffset: 0 }}));
           };
           requestAnimationFrame(frame);
        } else {
           // Instant place (e.g. initial load or steady)
           setDisplayPos((curr: Record<number, {cx: number, cy: number, arcOffset: number}>) => ({...curr, [p.id]: { cx: targetX, cy: targetY, arcOffset: 0 }}));
        }
     });

     return () => { isActive = false; };
  }, [pawns]);

  return displayPos;
}

export function GameBoard({ state, slots, localPlayerIndex, onAction }: GameBoardProps) {
  const isMyTurn = localPlayerIndex === state.beurt;
  const animPos = usePawnPositions(state.pionnen);
  const [selectedPawnId, setSelectedPawnId] = useState<number | null>(null);

  // Derive allowed moves if it is my turn
  const allowedMoves = useMemo(() => {
    const valid = new Set<string>();
    if (!isMyTurn) return valid;
    
    if (state.status === 'SPELEN') {
         if (selectedPawnId !== null) {
            const pawn = state.pionnen.find(p => p.id === selectedPawnId);
            if (pawn && !pawn.isFinished) {
               const moves = vindZetten(pawn.pos, state);
               for (const m of moves) valid.add(posToStr(m));
            }
         }
    } else if (state.status === 'PLAATS_BARRICADE') {
        const vrije_plekken = Object.values(state.graph)
            .filter(k => !k.is_finish && !k.is_start &&
                   !state.barricades.some(b => b.r === k.r && b.c === k.c) &&
                   !state.verbodenBarricades.some(vb => vb.r === k.r && vb.c === k.c) &&
                   !state.pionnen.some(p => p.pos.r === k.r && p.pos.c === k.c)
            );
        for (const vp of vrije_plekken) valid.add(posToStr(vp));
    }
    return valid;
  }, [state, isMyTurn, localPlayerIndex, selectedPawnId]);

  const selectablePawns = useMemo(() => {
    const valid = new Set<string>();
    if (isMyTurn && state.status === 'SPELEN') {
       for (const p of state.pionnen) {
           if (p.playerIndex === localPlayerIndex && !p.isFinished) {
               const moves = vindZetten(p.pos, state);
               if (moves.length > 0) valid.add(posToStr(p.pos));
           }
       }
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
      const clickedPawn = state.pionnen.find(p => p.playerIndex === localPlayerIndex && p.pos.r === pos.r && p.pos.c === pos.c && !p.isFinished);
      if (clickedPawn && selectablePawns.has(posToStr(pos))) {
          setSelectedPawnId(clickedPawn.id);
          return;
      }
      
      if (selectedPawnId !== null) {
          const pawnIdx = state.pionnen.findIndex(p => p.id === selectedPawnId);
          if (pawnIdx !== -1 && allowedMoves.has(posToStr(pos))) {
              onAction({ type: 'MOVE', pawnIdx, target: pos });
              setSelectedPawnId(null);
          }
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
    for (const node of Object.values(state.graph)) {
        for (const b of node.buren) {
            const minR = Math.min(node.r, b.r);
            const minC = Math.min(node.c, b.c);
            const maxR = Math.max(node.r, b.r);
            const maxC = Math.max(node.c, b.c);
            const key = `${minR},${minC}-${maxR},${maxC}`;
            if (!seen.has(key)) {
                seen.add(key);
                lines.push({ 
                    x1: node.c + 0.5, 
                    y1: node.r + 0.5, 
                    x2: b.c + 0.5, 
                    y2: b.r + 0.5 
                });
            }
        }
    }
    return lines;
  }, []);

  return (
    <>
      <div className="portrait:flex landscape:hidden fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex-col items-center justify-center p-8 text-center overscroll-none">
          <div className="rotate-90 text-white mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Rotate Device</h2>
          <p className="text-slate-400 font-medium text-lg max-w-[280px]">Barricade is designed to be played in landscape mode. Please rotate your device to continue.</p>
      </div>

      <div className="portrait:hidden fixed inset-0 w-full h-[100dvh] max-w-none flex flex-col items-center justify-center select-none bg-slate-900 overflow-hidden shadow-2xl z-0">
        <div className="absolute top-2 left-4 right-4 flex justify-between items-center text-slate-200 uppercase tracking-widest text-xs font-bold z-10 pointer-events-none">
          <div>
            Status: <span className="text-white">{state.status.replace('_', ' ')}</span>
          </div>
          <div>
             Turn: Player {state.beurt + 1}
          </div>
        </div>
        
        <svg viewBox={`-1 -0.5 ${BORD_COLS + 2} ${BORD_ROWS + 4.5}`} className="w-full h-full max-h-[100dvh] drop-shadow-xl overflow-visible mx-auto shrink-0 z-0">
          {/* Draw Path Lines manually filtering out the fan base spread */}
          {edges.map((e, idx) => {
              if ((e.y1 === 10.5 && e.y2 > 10.5) || (e.y2 === 10.5 && e.y1 > 10.5)) return null;
              return (
              <line 
                  key={idx} 
                  x1={e.x1} y1={e.y1} 
                  x2={e.x2} y2={e.y2} 
                  stroke={COLOR_MAP.path} 
                  strokeWidth={0.15} 
                  strokeLinecap="round" 
              />
              );
          })}

          {/* Draw Custom Home Base Linkages */}
          {[2, 8, 14, 20].map(c => {
             const cx = c + 0.5;
             return (
                <g key={`home-links-${c}`} stroke={COLOR_MAP.path} strokeWidth={0.15} strokeLinecap="round">
                   {/* Entry to split */}
                   <line x1={cx} y1={10.5} x2={cx} y2={11.5} />
                   {/* Horizontal bridge */}
                   <line x1={cx - 1} y1={11.5} x2={cx + 1} y2={11.5} />
                   {/* Vertical pillars */}
                   <line x1={cx - 1} y1={11.5} x2={cx - 1} y2={12.5} />
                   <line x1={cx + 1} y1={11.5} x2={cx + 1} y2={12.5} />
                </g>
             );
          })}

          {/* Draw Nodes */}
          {Object.values(state.graph).map(k => {
            const cx = k.c + 0.5;
            const cy = k.r + 0.5;
            const isFinish = k.is_finish;
            const isStart = k.is_start;
             let fill = '#1e293b';
            let stroke = '#0f172a';
            let strokeWidth = 0.06;

            if (isFinish) fill = COLOR_MAP.finish;
            else if (isStart) {
               const colors: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
               const playerColorStr = COLOR_MAP[colors[k.speler_start]];
               fill = '#1e293b'; 
               stroke = playerColorStr; 
               strokeWidth = 0.1;
            }
            
            const strPos = posToStr(k);
            const isAllowedTarget = allowedMoves.has(strPos);
            const isClickablePawn = selectablePawns.has(strPos);

            return (
              <g key={`node-${strPos}`} onClick={() => handleNodeClick({r: k.r, c: k.c})} className={(isAllowedTarget || isClickablePawn) ? "cursor-pointer" : ""}>
                 <circle cx={cx} cy={cy} r={0.3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                 {isFinish && <circle cx={cx} cy={cy} r={0.35} fill="none" stroke="white" strokeWidth={0.05} />}
                 {(isAllowedTarget && state.status !== 'PLAATS_BARRICADE') && (
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
             const pos = animPos[p.id] || { cx: p.pos.c + 0.5, cy: p.pos.r + 0.5, arcOffset: 0 };
             return (
                 <g 
                    key={`pawn-${p.id}`} 
                    className="pointer-events-none" 
                    transform={`translate(${pos.cx}, ${pos.cy + pos.arcOffset})`}
                >
                   <circle cx={0} cy={0} r={0.25} fill={COLOR_MAP[p.color]} />
                   <circle cx={0} cy={0} r={0.25} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={0.05} />
                   {selectedPawnId === p.id && (
                       <circle cx={0} cy={0} r={0.35} fill="none" stroke="white" strokeWidth={0.08} className="animate-pulse" />
                   )}
                </g>
             );
          })}

          {/* Dice History Nodes */}
          {[0, 1, 2, 3].map(i => {
             const roll = state.laatsteWorpen[i];
             if (!roll) return null;
             // Match start cols exactly
             const cx = [2, 8, 14, 20][i] + 0.5;
             const nameStr = slots?.[i]?.playerName || (slots?.[i]?.type === 'bot' ? 'Bot' : `Player ${i+1}`);
             const isActive = state.pionnen.some(p => p.playerIndex === i);
             const colors: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
             
             return (
                <g key={`history-${i}`} transform={`translate(${cx}, ${BORD_ROWS + 3.5})`}>
                   {isActive && <text x={0} y={-1.0} fill="rgba(255,255,255,0.8)" fontSize={0.3} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle" style={{ textTransform: 'uppercase' }}>{nameStr}</text>}
                   
                   {roll ? (
                       <>
                           <rect x={-0.35} y={-0.35} width={0.7} height={0.7} fill="#1e293b" rx={0.15} stroke={COLOR_MAP[colors[i]]} strokeWidth={0.05} />
                           <text x={0} y={0.12} fill="white" fontSize={0.4} fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">{roll}</text>
                       </>
                   ) : null}
                </g>
             );
          })}
        </svg>
        
        {/* Dice & Interactions */}
        {(state.status === "WACHT_OP_DOBBELSTEEN" || state.status === "DOBBELEN" || state.status === "SPELEN" || state.status === "PLAATS_BARRICADE" || state.status === "GEEN_ZETTEN") && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 shrink-0">
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
    </>
  );
}
