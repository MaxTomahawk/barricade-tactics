'use client';

import React from 'react';
import { Trophy, HelpCircle, Dice5, Maximize, Minimize, ChevronRight } from 'lucide-react';
import { BoardState } from '@/lib/types';
import { StaticDice, DiceDots, RollingDice } from './dice';
import { useFullscreen } from '@/hooks/use-fullscreen';

interface SidebarProps {
  state: BoardState;
  slots: { id: number, connectionId?: string, type: string, playerName?: string, color: string }[];
  localPlayerIndex: number;
  onAction: (action: any) => void;
  rulesDialog: React.ReactNode;
  diceContent: React.ReactNode;
}

interface SidebarProps {
  state: BoardState;
  slots: { id: number, connectionId?: string, type: string, playerName?: string, color: string }[];
  localPlayerIndex: number;
  onAction: (action: any) => void;
  rulesDialog: React.ReactNode;
  diceContent: React.ReactNode;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  isMobile: boolean;
}

export function Sidebar({ 
  state, 
  slots, 
  localPlayerIndex, 
  onAction, 
  rulesDialog, 
  diceContent,
  isExpanded,
  setIsExpanded,
  isMobile
}: SidebarProps) {
  const activeSlot = slots[state.beurt];
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const isMyTurn = state.beurt === localPlayerIndex;
  
  const statusLabels: Record<string, string> = {
    WACHT_OP_DOBBELSTEEN: 'Roll',
    DOBBELEN: 'Rolling',
    SPELEN: 'Move',
    PLAATS_BARRICADE: 'Barricade',
    GEEN_ZETTEN: 'Locked',
    GAME_OVER: 'Over'
  };

  // Mini Actionable Die for Collapsed Sidebar
  const miniDice = (
    <div className="flex flex-col items-center gap-1 mt-2">
      {state.status === "PLAATS_BARRICADE" ? (
        <div className="w-8 h-8 bg-amber-800 border-2 border-amber-600 rounded-lg flex items-center justify-center shadow-lg">
          <span className="text-[10px] font-bold text-white">B</span>
        </div>
      ) : state.status === "WACHT_OP_DOBBELSTEEN" && isMyTurn ? (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onAction({ type: 'ROLL_START' });
          }} 
          className="w-10 h-10 bg-slate-800 border-2 rounded-xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-pulse" 
          style={{ borderColor: activeSlot?.color }}
        >
          <div className="scale-75"><DiceDots value={6} color={activeSlot?.color || '#fff'} size={0.8} /></div>
        </button>
      ) : (
        <div className="w-10 h-10 bg-slate-800/80 border-2 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden" style={{ borderColor: activeSlot?.color }}>
          {state.status === 'DOBBELEN' ? (
            <div className="scale-50"><RollingDice color={activeSlot?.color || '#fff'} diceMode={state.settings.diceMode} size={10} /></div>
          ) : (
            <div className={`scale-75 transition-all ${state.dobbelsteen === 0 ? 'opacity-20' : 'opacity-100'}`}>
              <DiceDots value={state.dobbelsteen || 5} color={activeSlot?.color || '#fff'} size={0.8} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!isExpanded && isMobile) {
    return (
      <div 
        className="sidebar-container fixed right-0 top-0 h-full w-[3.5rem] bg-slate-900/90 backdrop-blur-md border-l border-white/10 flex flex-col items-center py-2 gap-4 shadow-2xl z-50 transition-all cursor-pointer"
        onClick={() => setIsExpanded(true)}
      >
        <button className="flex items-center justify-center p-1 text-white/30 hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>

        {/* Status Indicator */}
        <div className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg relative flex items-center justify-center" style={{ backgroundColor: activeSlot?.color }}>
          {state.status === 'WACHT_OP_DOBBELSTEEN' && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          )}
        </div>

        {miniDice}

        {/* Detailed Mini Leaderboard */}
        <div className="flex-grow flex flex-col items-center gap-3 overflow-y-auto w-full px-1 py-2">
          {slots?.filter(s => s.type !== 'open' && s.type !== 'closed').map(slot => {
            const finishedCount = state.pionnen.filter(p => p.playerIndex === slot.id && p.isFinished).length;
            const isTurn = state.beurt === slot.id;
            const lastThrow = state.laatsteWorpen[slot.id];
            
            return (
              <div 
                key={slot.id} 
                className={`flex flex-col items-center gap-1 p-1 rounded-md transition-all ${isTurn ? 'bg-white/5 border border-white/10' : ''}`}
              >
                <div 
                  className={`w-6 h-6 rounded-full border flex flex-col items-center justify-center transition-all ${isTurn ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-white/10'}`}
                  style={{ backgroundColor: slot.color }}
                >
                   <span className="text-[9px] font-black text-white mix-blend-difference">{finishedCount}</span>
                </div>
                {lastThrow && (
                  <div className="scale-[0.4] -mt-1 opacity-80">
                    <StaticDice value={lastThrow} color={slot.color} size={6} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          className="p-1.5 text-white/30 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`sidebar-container ${isMobile ? 'fixed right-0 top-0 w-52 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'relative w-80'} h-full bg-slate-900 border-l border-white/10 flex flex-col p-2 md:p-6 gap-2 md:gap-8 z-50 overflow-y-auto transition-all`}>
      {/* Header with Collapse Button (Mobile Only) */}
      {isMobile && (
        <button 
          onClick={() => setIsExpanded(false)}
          className="absolute left-1 top-2 p-1 text-white/30 hover:text-white transition-colors z-20"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Game Status Card */}
      <div className={`sidebar-status-card bg-white/5 rounded-2xl p-2 md:p-5 border border-white/5 flex flex-col items-center gap-1 md:gap-4 text-center ${isMobile ? 'mt-6' : ''}`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Active Player</span>
          <span className={`${isMobile ? 'text-sm' : 'text-xl'} font-black text-white flex items-center gap-1.5`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeSlot?.color }} />
            {activeSlot?.playerName || `Player ${state.beurt + 1}`}
          </span>
        </div>

        <div className="w-full h-px bg-white/5" />

        <div className="flex flex-col items-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Action</span>
          <div className="px-3 py-1 rounded-full bg-slate-800 border border-white/5">
            <span className="text-xs font-bold text-primary animate-pulse">
              {statusLabels[state.status] || state.status}
            </span>
          </div>
        </div>

        <div className={isMobile ? "scale-75 -my-2" : "mt-2"}>
           {diceContent}
        </div>
      </div>

      {/* Score Tracker */}
      <div className="space-y-1 md:space-y-4 flex-grow overflow-hidden">
        <div className="text-[8px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">
          Leaderboard
        </div>
        <div className="space-y-1.5">
           {slots?.filter(s => s.type !== 'open' && s.type !== 'closed').map(slot => {
              const finishedCount = state.pionnen.filter(p => p.playerIndex === slot.id && p.isFinished).length;
              const isTurn = state.beurt === slot.id;
              const lastThrow = state.laatsteWorpen[slot.id];
              
              return (
                <div 
                  key={slot.id} 
                  className={`flex items-center justify-between p-1.5 md:p-3 rounded-lg transition-all ${isTurn ? 'bg-primary/10 border border-primary/20' : 'bg-white/5 border border-white/5'}`}
                >
                   <div className="flex items-center gap-2 min-w-0">
                      {lastThrow ? (
                        <div className="shrink-0 scale-[0.6] origin-left">
                          <StaticDice value={lastThrow} color={slot.color} size={6} />
                        </div>
                      ) : (
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slot.color }} />
                      )}
                      <span className={`text-[10px] md:text-sm font-medium truncate ${isTurn ? 'text-white' : 'text-slate-400'}`}>
                        {slot.playerName || `Player ${slot.id + 1}`}
                      </span>
                   </div>
                   <div className="flex items-center gap-1 shrink-0">
                      <Trophy size={10} className={finishedCount > 0 ? "text-yellow-500" : "text-slate-700"} />
                      <span className="text-[10px] font-bold text-white">
                        {finishedCount}/{state.settings.winCondition || 1}
                      </span>
                   </div>
                </div>
              );
           })}
        </div>
      </div>

      {/* Rules / Footer */}
      <div className="pt-2 border-t border-white/5">
        <div className="flex gap-2">
          {isMobile ? (
             <button 
              onClick={() => setIsExpanded(false)}
              className="flex items-center justify-center p-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 text-white/50 w-full"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : rulesDialog}
          <button 
            onClick={toggleFullscreen}
            className="flex items-center justify-center p-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 text-white/70 hover:text-white"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
