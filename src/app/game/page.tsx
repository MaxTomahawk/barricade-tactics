'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameState, HostSession, GuestSession, SlotType, startGuestSession, startHostSession } from '@/lib/webrtc-room';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, Trophy, ChevronRight, Info } from 'lucide-react';

const GAME_COLORS = [
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#6366f1'  // Indigo
];

function ColorPicker({ 
  current, 
  onChange, 
  disabled,
  used = []
}: { 
  current: string; 
  onChange: (color: string) => void; 
  disabled?: boolean;
  used?: string[];
}) {
  return (
    <Popover>
      <PopoverTrigger disabled={disabled}>
        <div 
          className={`w-8 h-8 rounded-full border-2 border-white/20 shadow-inner cursor-pointer hover:scale-110 transition-transform ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
          style={{ backgroundColor: current }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-48 bg-slate-900 border-white/10 p-2">
        <div className="grid grid-cols-5 gap-2">
          {GAME_COLORS.map(c => {
            const isUsed = used.includes(c) && c !== current;
            return (
              <button
                key={c}
                disabled={isUsed}
                onClick={() => onChange(c)}
                className={`w-6 h-6 rounded-full border border-white/10 transition-transform ${current === c ? 'ring-2 ring-white scale-110' : 'hover:scale-125'} ${isUsed ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { GameBoard } from '@/components/ui/GameBoard';
import { initializeBoardState, calculateBotAction } from '@/lib/game-logic/engine';

type SessionInfo = {
  role: 'host' | 'guest';
  roomId: string;
  gameName?: string;
  playerName: string;
};

function GamePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = useMemo(() => (searchParams.get('roomId') || '').trim().toUpperCase(), [searchParams]);

  const [game, setGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signalingStatus, setSignalingStatus] = useState('Initializing connections...');
  const [error, setError] = useState('');
  
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const shutdownRef = useRef<null | (() => void)>(null);
  const signaledRef = useRef(false);
  const lastProcessedRef = useRef<string>('');

  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      setError('Missing roomId in URL.');
      return;
    }

    if (signaledRef.current) return;
    signaledRef.current = true;

    const raw = localStorage.getItem('barricadeSession');
    if (!raw) {
      setIsLoading(false);
      setError('Session not found. Return to lobby and host or join again.');
      return;
    }

    const session = JSON.parse(raw) as SessionInfo;
    if (session.roomId !== roomId) {
      setIsLoading(false);
      setError('Room ID mismatch. Return to lobby and try again.');
      return;
    }

    const onGameStateUpdated = (nextGame: GameState) => {
      if (nextGame.id.toUpperCase() === roomId) {
        setGame(nextGame);
        setError('');
        setIsLoading(false);
      }
    };

    const onPeerError = (message: string) => {
      setError(message);
      setIsLoading(false);
      
      // If critical error, redirect home after a short delay
      if (message.includes('not found') || message.includes('session') || message.includes('ID') || message.includes('already taken')) {
         // Specific helpful error for collisions
         if (message.includes('taken') || message.includes('ID')) {
             setError("A game with this code is already active. Please try a different code or return to the main menu.");
         }
         setTimeout(() => router.push('/'), 5000);
      }
    };

    let active = true;
    let fallbackTimeout: ReturnType<typeof setTimeout>;

    if (session.role === 'host') {
      fallbackTimeout = setTimeout(() => {
        if (!active) return;

        let initialGame: GameState | undefined = undefined;
        const cacheRaw = localStorage.getItem(`barricade_host_cache_${roomId}`);
        if (cacheRaw) {
          try {
            const cached = JSON.parse(cacheRaw);
            if (cached.id === roomId) {
              initialGame = cached;
              console.log("Resuming from cache for room", roomId);
            }
          } catch(e) {
            console.error("Failed to parse game cache", e);
          }
        }

        const host = startHostSession({
          roomId,
          gameName: session.gameName || 'Untitled Room',
          hostName: session.playerName || 'Host',
          initialGame,
          onGameStateUpdated,
          onError: onPeerError,
          onStatusUpdated: setSignalingStatus,
        });
        setHostSession(host);
        shutdownRef.current = host.shutdown;
        if (roomId) localStorage.setItem('lastRoomCode', roomId);
      }, 50);
    } else {
      fallbackTimeout = setTimeout(() => {
        if (!active) return;
        const guest = startGuestSession({
          roomId,
          playerName: session.playerName || 'Guest',
          onGameStateUpdated,
          onError: onPeerError,
          onStatusUpdated: setSignalingStatus,
        });
        setGuestSession(guest);
        shutdownRef.current = guest.shutdown;
        if (roomId) localStorage.setItem('lastRoomCode', roomId);
      }, 50);
    }

    return () => {
      active = false;
      clearTimeout(fallbackTimeout);
      shutdownRef.current?.();
      shutdownRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    if (game && hostSession) {
        localStorage.setItem(`barricade_host_cache_${game.id}`, JSON.stringify(game));
    }
  }, [game, hostSession]);

  const inviteUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    const url = new URL(window.location.origin + window.location.pathname.replace(/\/game\/?$/, '/'));
    url.searchParams.set('joinRoom', roomId);
    return url.toString();
  }, [roomId]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      setError('Could not copy invite link. You can copy it manually from the browser bar.');
    }
  };

  // --- HOST ORCHESTRATION ENGINE LOOP ---
  useEffect(() => {
    const isHostUser = !!hostSession;
    if (!isHostUser || !game?.boardState || !hostSession) return;
    const bs = game.boardState;
    
    const statusKey = `${bs.beurt}-${bs.status}`;
    if (lastProcessedRef.current === statusKey) return;
    lastProcessedRef.current = statusKey;

    const activeSlot = game.slots[bs.beurt];

    // Automatically throw dice server-side
    if (bs.status === 'DOBBELEN') {
       let delay = 500;
       if (game.settings.diceMode === 'instant' || (game.settings.diceMode === 'instant_bots' && activeSlot?.type === 'bot')) delay = 50;

       const timer = setTimeout(() => {
           const dice = Math.floor(Math.random() * 6) + 1;
           hostSession.processAction({ type: 'ROLL_END', value: dice });
       }, delay);
       return () => clearTimeout(timer);
    }

    // Bot AI
    if (activeSlot && activeSlot.type === 'bot') {
       let delay = 1000;
       if (game.settings.diceMode === 'instant' || game.settings.diceMode === 'instant_bots') delay = 50;
       const timer = setTimeout(() => {
           if (bs.status === 'WACHT_OP_DOBBELSTEEN') {
              hostSession.processAction({ type: 'ROLL_START' });
            } else if (bs.status === 'GEEN_ZETTEN') {
               hostSession.processAction({ type: 'GEEN_ZETTEN_ACK' });
            } else if (bs.status === 'SPELEN' || bs.status === 'PLAATS_BARRICADE') {
               const botAction = calculateBotAction(bs);
               if (botAction) hostSession.processAction(botAction);
               else if (bs.status === 'SPELEN') hostSession.processAction({ type: 'GEEN_ZETTEN_ACK' }); // fallback
            }
       }, delay);
       return () => clearTimeout(timer);
    }
  }, [game?.boardState, hostSession, game?.slots]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-medium text-foreground">{signalingStatus}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background gap-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg max-w-md text-center">
          <p className="font-bold text-lg mb-2">Error</p>
          <p>{error}</p>
        </div>
        <p className="text-muted-foreground animate-pulse">Redirecting to menu...</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors">Return Now</button>
      </div>
    );
  }

  if (!game) {
    return <div className="p-8">Game not found.</div>;
  }

  const isHostUser = !!hostSession;



  if (game.boardState) {
     const bs = game.boardState;
     let localPlayerIndex = -1;
     if (isHostUser) localPlayerIndex = 0;
     else {
         const raw = sessionStorage.getItem('barricadeSession');
         if (raw) {
            const sessionName = JSON.parse(raw).playerName;
            const mySlot = game.slots.find(s => s.playerName === sessionName);
            if (mySlot) localPlayerIndex = mySlot.id;
         }
     }

     const finishedCount = bs.pionnen.filter(p => p.playerIndex === localPlayerIndex && p.isFinished).length;
     const targetCount = game.settings.winCondition || 1;
     const myColor = game.slots[localPlayerIndex]?.color || '#ffffff';

     return (
       <div className="relative w-full h-screen overflow-hidden">
         {/* Top UI Overlay */}
         <div className="absolute top-2 right-4 flex items-center gap-4 z-20">
            {/* Finish Progress Indicator */}
            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg group hover:border-yellow-500/50 transition-all cursor-help" title={`Goal: Get ${targetCount} pawns to the finish`}>
               <Trophy size={16} className={finishedCount >= targetCount ? "text-yellow-400" : "text-white/40"} />
               <div className="flex items-baseline gap-1">
                  <span className="text-white font-bold text-sm">{finishedCount}</span>
                  <span className="text-white/40 text-[10px]">/</span>
                  <span className="text-white/60 text-xs font-medium">{targetCount}</span>
               </div>
            </div>

            {/* Rules Menu */}
            <Dialog>
               <DialogTrigger asChild>
                  <button className="flex items-center justify-center w-9 h-9 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all shadow-lg active:scale-95">
                     <HelpCircle size={20} />
                  </button>
               </DialogTrigger>
               <DialogContent className="bg-slate-900 border-white/10 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                     <DialogTitle className="text-2xl font-bold flex items-center gap-2 mb-4">
                        <Info className="text-primary" /> Rules of Barricade
                     </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-6 text-sm leading-relaxed">
                     <section className="space-y-2">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                           <ChevronRight size={14} className="text-primary" /> Objective
                        </h3>
                        <p>Be the first to reach the <strong className="text-yellow-500">Finish Node</strong> at the top center with the required number of pawns.</p>
                     </section>

                     <section className="space-y-2">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                           <ChevronRight size={14} className="text-primary" /> Movement & Capturing
                        </h3>
                        <p>Roll the dice and move exactly that many spaces. You can move in any direction but cannot backtrack in the same turn.</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                           <li>Jump over other pawns (your own or opponents).</li>
                           <li>Landing on an opponent's pawn sends it back to its <strong>Home slot</strong>.</li>
                           <li>Landing on a <strong>Barricade</strong> allows you to move it to any valid board node.</li>
                        </ul>
                     </section>

                     <section className="space-y-2 p-4 bg-white/5 rounded-xl border border-white/5">
                        <h3 className="text-white font-semibold mb-3">Active Session Rules</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500 uppercase tracking-wider">Win Condition</span>
                              <span className="font-medium" style={{ color: myColor }}>{targetCount} pawn{targetCount > 1 ? 's' : ''} to finish</span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500 uppercase tracking-wider">Capture Bonus</span>
                              <span className="font-medium" style={{ color: myColor }}>
                                 {game.settings.captureBonus ? "Extra roll after capture" : "Standard rules"}
                              </span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500 uppercase tracking-wider">Entry Protection</span>
                              <span className="font-medium" style={{ color: myColor }}>
                                 {game.settings.protectBottomRow ? "Row 1 is safe from barricades" : "No protection"}
                              </span>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-500 uppercase tracking-wider">Dice Mode</span>
                              <span className="font-medium" style={{ color: myColor }}>{game.settings.diceMode.replace('_', ' ')}</span>
                           </div>
                        </div>
                     </section>
                  </div>
               </DialogContent>
            </Dialog>
         </div>

         <GameBoard 
            state={bs} 
            slots={game.slots} 
            localPlayerIndex={localPlayerIndex} 
            onAction={(action) => {
               if (isHostUser) {
                  hostSession?.processAction(action);
               } else if (guestSession) {
                  let reqMsg: any = null;
                  if (action.type === 'ROLL_START') reqMsg = { type: 'requestRollDice' };
                  if (action.type === 'MOVE') reqMsg = { type: 'requestMovePawn', pawnIdx: action.pawnIdx, target: action.target };
                  if (action.type === 'BARRICADE') reqMsg = { type: 'requestPlaceBarricade', target: action.target };
                  if (action.type === 'GEEN_ZETTEN_ACK') reqMsg = { type: 'requestNoMoves' };
                  
                  if (reqMsg) guestSession.sendToHost(reqMsg);
               }
            }}
         />
       </div>
     );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <h1 className="text-4xl font-bold mb-4">Game: {game.gameName}</h1>
      <h2 className="text-2xl font-semibold mb-3">Room Code: {game.id}</h2>
      <button
        type="button"
        onClick={copyInvite}
        className="mb-8 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Copy Invite Link
      </button>

      {isHostUser && (
        <div className="mb-4 w-full max-w-md mx-auto flex flex-col gap-4 animate-in fade-in duration-300 bg-black/20 p-4 rounded-xl border border-white/5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300 font-medium">Capture Bonus (Extra Roll)</span>
            <button
              onClick={() => hostSession?.updateSettings({ captureBonus: !game.settings.captureBonus })}
              className={`w-12 h-6 rounded-full transition-colors relative ${game.settings.captureBonus ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${game.settings.captureBonus ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300 font-medium">Protect Bottom Row</span>
            <button
              onClick={() => hostSession?.updateSettings({ protectBottomRow: !game.settings.protectBottomRow })}
              className={`w-12 h-6 rounded-full transition-colors relative ${game.settings.protectBottomRow ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${game.settings.protectBottomRow ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-300 font-medium">Win Condition (Pawns to Finish)</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => hostSession?.updateSettings({ winCondition: n })}
                  className={`flex-1 py-1 rounded transition-colors text-sm font-bold ${game.settings.winCondition === n ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-300 font-medium">Dice Mode</span>
            <select 
              value={game.settings.diceMode}
              onChange={(e) => hostSession?.updateSettings({ diceMode: e.target.value as any })}
              className="bg-gray-800 border-none text-white text-sm rounded outline-none p-2 focus:ring-2 focus:ring-primary"
            >
              <option value="animated">Fully Animated</option>
              <option value="instant_bots">Instant Bots</option>
              <option value="instant">Instant Everything</option>
            </select>
          </div>
        </div>
      )}

      {isHostUser && (
        <div className="mb-10 w-full max-w-md mx-auto flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          {(!game.slots.some(s => s.type === 'open') && game.slots.some(s => s.type === 'player' || s.type === 'bot')) ? (
            <button
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-12 rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 text-2xl tracking-wide uppercase"
              onClick={() => hostSession?.startGame()}
            >
              Start Game
            </button>
          ) : (
            <div className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center shadow-inner">
              <p className="text-orange-600 dark:text-orange-400 text-sm font-bold tracking-widest uppercase mb-1">
                Awaiting Players
              </p>
              <p className="text-muted-foreground text-xs font-medium">
                Ensure no slots are left "Open", and that you have at least 1 Opponent.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-2xl">
        <h3 className="text-xl font-semibold mb-6">Players & Slots</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {game.slots.map((slot) => {
            const isHost = slot.type === 'host';
            const label = isHost ? 'Host' : `Slot ${slot.id}`;
            
            const isGuestSelf = !isHostUser && guestSession && game.slots.find(s => s.connectionId === guestSession.peer.id)?.id === slot.id;
            const canChangeColor = isHostUser ? (isHost || slot.type === 'bot') : isGuestSelf;

            const handleColorChange = (color: string) => {
              if (isHostUser) {
                hostSession?.updateSlot(slot.id, slot.type, slot.playerName, color);
              } else if (isGuestSelf) {
                guestSession?.sendToHost({ type: 'requestChangeColor', slotId: slot.id, color });
              }
            };

            let content;
            if (isHostUser && !isHost) {
              content = (
                <div className="flex gap-3 items-center">
                  <ColorPicker 
                    current={slot.color} 
                    onChange={handleColorChange} 
                    disabled={slot.type === 'closed' || slot.type === 'open'} 
                    used={game.slots.filter(s => s.type !== 'open' && s.type !== 'closed').map(s => s.color)}
                  />
                  <Select
                    value={slot.type}
                    onValueChange={(val) => {
                      let nextName = undefined;
                      if (val === 'bot') nextName = `bot ${slot.id} 🤖`;
                      hostSession?.updateSlot(slot.id, val as SlotType, nextName);
                    }}
                  >
                    <SelectTrigger className="w-full bg-background border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open (Waiting)</SelectItem>
                      <SelectItem value="bot">Bot</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      {slot.type === 'player' && (
                        <SelectItem value="player">{slot.playerName} (Player)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              );
            } else {
              let display: string = slot.type;
              if (slot.type === 'player' || slot.type === 'host' || slot.type === 'bot') {
                display = slot.playerName || (slot.type === 'bot' ? `bot ${slot.id} 🤖` : display);
              } else if (slot.type === 'open') {
                display = 'Waiting for player...';
              } else if (slot.type === 'closed') {
                display = 'Closed';
              }

              let extraStyle = '';
              if (slot.type === 'open') extraStyle = 'text-muted-foreground italic';
              if (slot.type === 'closed') extraStyle = 'text-muted-foreground line-through';

              content = (
                <div className="flex gap-3 items-center">
                   <ColorPicker 
                      current={slot.color} 
                      onChange={handleColorChange} 
                      disabled={!canChangeColor || slot.type === 'closed' || slot.type === 'open'} 
                      used={game.slots.filter(s => s.type !== 'open' && s.type !== 'closed').map(s => s.color)}
                    />
                   <div className={`text-lg py-2 ${extraStyle}`}>{display}</div>
                </div>
              );
            }

            return (
              <div
                key={slot.id}
                className="p-4 bg-muted border border-border rounded-lg flex flex-col gap-2"
              >
                <span className="text-sm text-foreground/60 uppercase font-semibold tracking-wider">
                  {label}
                </span>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading game location...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
