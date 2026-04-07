'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BoardState, Position, PlayerColor, Pawn, GameStatus } from '@/lib/types';
import { vindZetten, posToStr } from '@/lib/game-logic/engine';
import { DiceDots, RollingDice } from './dice';
import { BotIcon } from './bot-icon';

interface GameBoardProps {
  state: BoardState;
  slots?: { id: number, type: string, playerName?: string, color: string }[];
  localPlayerIndex?: number;
  onAction: (action: any) => void;
}

const STATUS_MAP: Record<GameStatus, string> = {
  MENU_TOTAAL: "Menu",
  WACHT_OP_DOBBELSTEEN: "Waiting for dice",
  DOBBELEN: "Rolling...",
  SPELEN: "Your turn",
  PLAATS_BARRICADE: "Move barricade",
  GEEN_ZETTEN: "No moves possible",
  GAME_OVER: "Game over",
  PAUZE_MENU: "Paused"
};

const STATIC_COLORS = {
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
    <div className="w-full h-full flex flex-col items-center justify-center select-none bg-slate-900 shadow-2xl overflow-hidden relative z-0">
        
        <svg viewBox={`-1 -0.5 ${BORD_COLS + 2} ${BORD_ROWS + 4.5}`} className="w-full h-full max-h-[100dvh] drop-shadow-xl overflow-visible mx-auto shrink-0 z-0">
          {/* Draw Path Lines manually filtering out the fan base spread */}
          {edges.map((e, idx) => {
              if ((e.y1 === 10.5 && e.y2 > 10.5) || (e.y2 === 10.5 && e.y1 > 10.5)) return null;
              return (
              <line 
                  key={idx} 
                  x1={e.x1} y1={e.y1} 
                  x2={e.x2} y2={e.y2} 
                  stroke={STATIC_COLORS.path} 
                  strokeWidth={0.15} 
                  strokeLinecap="round" 
              />
              );
          })}

          {/* Draw Custom Home Base Linkages */}
          {(state.startCols || []).map(c => {
             const cx = c + 0.5;
             return (
                <g key={`home-links-${c}`} stroke={STATIC_COLORS.path} strokeWidth={0.15} strokeLinecap="round">
                   {/* Entry to split */}
                   <line x1={cx} y1={10.5} x2={cx} y2={11.5} />
                   {/* Horizontal bridge (top) */}
                   <line x1={cx - 0.5} y1={11.5} x2={cx + 0.5} y2={11.5} />
                   {/* Vertical pillars */}
                   <line x1={cx - 0.5} y1={11.5} x2={cx - 0.5} y2={12.5} />
                   <line x1={cx + 0.5} y1={11.5} x2={cx + 0.5} y2={12.5} />
                   {/* Horizontal bridge (bottom) */}
                   <line x1={cx - 0.5} y1={12.5} x2={cx + 0.5} y2={12.5} />
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

            if (isFinish) fill = STATIC_COLORS.finish;
            else if (isStart) {
               const playerSlot = slots?.find(s => s.id === k.speler_start);
               fill = '#1e293b'; 
               stroke = playerSlot?.color || '#ffffff'; 
               strokeWidth = 0.1;

               // Marking finish progress if more than 1 pin needed
               const finishedForThisPlayer = state.pionnen.filter(p => p.playerIndex === k.speler_start && p.isFinished).length;
               
               const playerStartNodes = Object.values(state.graph)
                  .filter(n => n.is_start && n.speler_start === k.speler_start)
                  .sort((a,b) => a.c !== b.c ? a.c - b.c : a.r - b.r);
               
               const nodeIdx = playerStartNodes.findIndex(sn => sn.r === k.r && sn.c === k.c);
               const isMarkedFinished = nodeIdx !== -1 && nodeIdx < finishedForThisPlayer;

               const strPos = posToStr(k);
               const isAllowedTarget = allowedMoves.has(strPos);
               const isClickablePawn = selectablePawns.has(strPos);

               return (
                 <g key={`node-${posToStr(k)}`}>
                    <circle cx={cx} cy={cy} r={0.3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                    {isMarkedFinished && (
                        <g transform={`translate(${cx}, ${cy}) scale(0.02)`} className="pointer-events-none opacity-60">
                           <path 
                              d="M12 15l-3-3m0 0l3-3m-3 3h8M5 12a7 7 0 1114 0 7 7 0 01-14 0z" 
                              fill="none" 
                              stroke={stroke} 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              transform="translate(-12,-12)"
                           />
                           <circle r="8" fill={stroke} opacity="0.4" />
                        </g>
                    )}
                     {(isAllowedTarget || isClickablePawn) && (
                        <circle 
                           cx={cx} cy={cy} r={0.45} 
                           fill="transparent" 
                           className="animate-pulse cursor-pointer pointer-events-auto" 
                           onClick={() => handleNodeClick({r: k.r, c: k.c})}
                        />
                     )}
                 </g>
               );
            }
            
            const strPos = posToStr(k);
            const isAllowedTarget = allowedMoves.has(strPos);
            const isClickablePawn = selectablePawns.has(strPos);

            return (
              <g key={`node-${strPos}`} onClick={() => handleNodeClick({r: k.r, c: k.c})} className={(isAllowedTarget || isClickablePawn) ? "cursor-pointer" : ""}>
                 <circle cx={cx} cy={cy} r={0.3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                 {isFinish && <circle cx={cx} cy={cy} r={0.35} fill="none" stroke="white" strokeWidth={0.05} />}
                 {/* Hitbox overlay for easier clicking */}
                 <circle cx={cx} cy={cy} r={0.45} fill="transparent" className={(isAllowedTarget || isClickablePawn) ? "cursor-pointer pointer-events-auto" : "pointer-events-none"} />
                 {(isAllowedTarget && state.status !== 'PLAATS_BARRICADE') && (
                     <circle cx={cx} cy={cy} r={0.45} fill="none" stroke="white" strokeWidth={0.08} className="animate-pulse pointer-events-none" />
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
                  fill={STATIC_COLORS.barricade} 
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
                   <circle cx={0} cy={0} r={0.25} fill={p.color} />
                   <circle cx={0} cy={0} r={0.25} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={0.05} />
                   {selectedPawnId === p.id && (
                       <circle cx={0} cy={0} r={0.35} fill="none" stroke="white" strokeWidth={0.08} className="animate-pulse" />
                   )}
                </g>
             );
          })}
        </svg>
        
        {state.status === "GAME_OVER" && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in zoom-in z-50">
                <h2 
                    className="text-4xl font-black uppercase tracking-widest bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-2xl mb-8 flex items-center gap-4"
                >
                    {slots?.find(s => s.id === state.winnaar)?.playerName || `Player ${state.winnaar! + 1}`} Wins!
                    {slots?.find(s => s.id === state.winnaar)?.type === 'bot' && (
                        <BotIcon color={slots.find(s => s.id === state.winnaar)?.color || '#fff'} className="text-[1.5em]" />
                    )}
                </h2>
            </div>
        )}
      </div>
  );
}
