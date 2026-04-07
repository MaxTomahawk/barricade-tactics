'use client';

import React from 'react';
import { Trophy, HelpCircle, Dice5, Maximize, Minimize, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import { BoardState } from '@/lib/types';
import { StaticDice, DiceDots, RollingDice } from './dice';
import { useFullscreen } from '@/hooks/use-fullscreen';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface SidebarProps {
  state: BoardState;
  slots: { id: number, connectionId?: string, type: string, playerName?: string, color: string }[];
  localPlayerIndex: number;
  onAction: (action: any) => void;
  rulesContent: React.ReactNode;
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
  rulesContent, 
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

  // miniDice removed, we will use diceContent directly in the collapsed sidebar

  if (!isExpanded && isMobile) {
    return (
      <div 
        className="sidebar-container fixed right-0 top-0 h-full w-[7rem] bg-slate-900/90 backdrop-blur-md border-l border-white/10 flex flex-col items-center py-2 gap-4 shadow-2xl z-50 transition-all"
      >
        <div className="flex flex-col items-center gap-1 mt-2 w-full">
          <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-[10px] font-bold text-primary animate-pulse mb-1">
            {statusLabels[state.status] || state.status}
          </div>
          <div className="scale-75 flex items-center justify-center -my-2">
             {diceContent}
          </div>
        </div>

        {/* Detailed Mini Leaderboard */}
        <div className="flex-grow flex flex-col items-center gap-3 overflow-y-auto w-full px-2 py-2">
          {slots?.filter(s => s.type !== 'open' && s.type !== 'closed').map(slot => {
            const finishedCount = state.pionnen.filter(p => p.playerIndex === slot.id && p.isFinished).length;
            const isTurn = state.beurt === slot.id;
            const lastThrow = state.laatsteWorpen[slot.id];
            
            return (
              <div 
                key={slot.id} 
                className={`flex items-center justify-between p-1.5 md:p-3 rounded-lg transition-all w-full ${isTurn ? 'bg-primary/10 border border-primary/20' : 'bg-white/5 border border-white/5'}`}
              >
                 <div className="flex items-center gap-2 min-w-0">
                    {lastThrow ? (
                      <div className="shrink-0 origin-left">
                        <StaticDice value={lastThrow} color={slot.color} size={7} />
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slot.color }} />
                    )}
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

        <div className="flex items-center justify-around w-full mt-auto pt-2 border-t border-white/5 px-1">
          {isMobile && (
            <>
              <button 
                onClick={() => setIsExpanded(true)}
                className="p-1 text-white/30 hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="p-1 text-white/30 hover:text-white transition-colors"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </>
          )}
          <Dialog>
             <DialogTrigger asChild>
                <button className="p-1 text-white/40 hover:text-white transition-colors">
                   <HelpCircle size={18} />
                </button>
             </DialogTrigger>
             {rulesContent}
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className={`sidebar-container ${isMobile ? 'fixed right-0 top-0 w-52 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'relative w-80'} h-full bg-slate-900 border-l border-white/10 flex flex-col p-2 md:p-6 gap-2 md:gap-8 z-50 overflow-y-auto transition-all`}>


      {/* Game Status Card */}
      <div className={`sidebar-status-card bg-white/5 rounded-2xl p-2 md:p-5 border border-white/5 flex flex-row items-center justify-between gap-4 w-full ${isMobile ? 'mt-6' : ''}`}>
        <div className="px-3 py-1.5 rounded-full bg-slate-800 border border-white/5 whitespace-nowrap">
          <span className="text-xs font-bold text-primary animate-pulse">
            {statusLabels[state.status] || state.status}
          </span>
        </div>

        <div className="flex items-center justify-center flex-grow">
           <div className={isMobile ? "scale-[0.8]" : ""}>
             {diceContent}
           </div>
        </div>
      </div>

      {/* Score Tracker */}
      <div className="space-y-1 md:space-y-4 flex-grow overflow-y-auto custom-scrollbar pr-1">
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
                       <div className="shrink-0 origin-left">
                         <StaticDice value={lastThrow} color={slot.color} size={isMobile ? 7 : 10} />
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

      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center justify-around w-full px-2">
          {isMobile && (
            <>
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-1 text-white/40 hover:text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
              <button 
                onClick={toggleFullscreen}
                className="p-1 text-white/40 hover:text-white transition-colors"
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </>
          )}
          <Dialog>
             <DialogTrigger asChild>
                <button className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-900/40 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all text-xs font-semibold">
                   <HelpCircle size={14} />
                   <span>Rules</span>
                </button>
             </DialogTrigger>
             {rulesContent}
          </Dialog>
        </div>
      </div>
    </div>
  );
}
