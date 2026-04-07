'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameState, HostSession, GuestSession, SlotType, startGuestSession, startHostSession, PlayerSlot } from '@/lib/webrtc-room';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, Trophy, ChevronRight, Info, Dice5, Maximize, Minimize } from 'lucide-react';
import { useFullscreen } from '@/hooks/use-fullscreen';

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

import { Sidebar } from '@/components/ui/sidebar';
import { GameBoard } from '@/components/ui/GameBoard';
import { DiceDots, RollingDice } from '@/components/ui/dice';
import { initializeBoardState, calculateBotAction } from '@/lib/game-logic/engine';

type SessionInfo = {
  role: 'host' | 'guest' | 'matchmaking';
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
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const shutdownRef = useRef<null | (() => void)>(null);
  const signaledRef = useRef(false);
  const passwordRef = useRef('');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Default to expanded on desktop, collapsed on mobile
      setIsSidebarExpanded(!mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
         if (message.includes('taken') || message.includes('ID')) {
             setError("A game with this code is already active. Please try a different code or return to the main menu.");
         }
         setTimeout(() => router.push('/'), 5000);
      }
    };

    let active = true;
    let matchIdx = 1;

    const tryNextMatch = () => {
        if (!active) return;
        if (matchIdx > 5) {
            setError("No matchmaking rooms available. Please try hosting a private room.");
            setIsLoading(false);
            return;
        }

        const currentRoomId = `BT_MATCH_${matchIdx}`;
        setSignalingStatus(`Searching for game (${matchIdx}/5)...`);
        
        let guest: GuestSession | null = null;
        let host: HostSession | null = null;

        const onMatchError = (msg: string) => {
            if (!active) return;
            if (msg.includes('[peer-unavailable]')) {
                setSignalingStatus(`Creating new room ${currentRoomId}...`);
                host = startHostSession({
                    roomId: currentRoomId,
                    gameName: 'Matchmaking Lobby',
                    hostName: session.playerName,
                    onGameStateUpdated,
                    onError: (hMsg) => {
                       if (hMsg.includes('[id-taken]')) {
                          matchIdx++;
                          tryNextMatch();
                       } else {
                          onPeerError(hMsg);
                       }
                    },
                    onStatusUpdated: setSignalingStatus,
                });
                setHostSession(host);
                shutdownRef.current = host.shutdown;
            } else if (msg.includes('full') || msg.includes('Rejected')) {
                shutdownRef.current?.();
                matchIdx++;
                tryNextMatch();
            } else {
                onPeerError(msg);
            }
        };

        guest = startGuestSession({
            roomId: currentRoomId,
            playerName: session.playerName,
            onGameStateUpdated,
            onError: onMatchError,
            onStatusUpdated: (s) => setSignalingStatus(`Joining room ${currentRoomId}: ${s}`),
        });
        setGuestSession(guest);
        shutdownRef.current = guest.shutdown;
    };

    if (session.role === 'matchmaking') {
        tryNextMatch();
    } else {
        let initialGame: GameState | undefined = undefined;
        if (session.role === 'host') {
          const cacheRaw = localStorage.getItem(`barricade_host_cache_${roomId}`);
          if (cacheRaw) {
            try {
              const cached = JSON.parse(cacheRaw);
              if (cached.id === roomId) initialGame = cached;
            } catch(e) {}
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
        } else {
          const guest = startGuestSession({
            roomId,
            playerName: session.playerName || 'Guest',
            onGameStateUpdated,
            onError: onPeerError,
            onStatusUpdated: setSignalingStatus,
          });
          setGuestSession(guest);
          shutdownRef.current = guest.shutdown;
        }
    }

    return () => {
      active = false;
      shutdownRef.current?.();
      shutdownRef.current = null;
    };
  }, [roomId, router]);

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

  useEffect(() => {
    const isHostUser = !!hostSession;
    if (!isHostUser || !game?.boardState || !hostSession) return;
    const bs = game.boardState;
    
    const statusKey = `${bs.beurt}-${bs.status}`;
    if (lastProcessedRef.current === statusKey) return;
    lastProcessedRef.current = statusKey;

    const activeSlot = game.slots[bs.beurt];

    if (bs.status === 'DOBBELEN') {
       let delay = 500;
       if (game.settings.diceMode === 'instant' || (game.settings.diceMode === 'instant_bots' && activeSlot?.type === 'bot')) delay = 50;
       const timer = setTimeout(() => {
           const dice = Math.floor(Math.random() * 6) + 1;
           hostSession.processAction({ type: 'ROLL_END', value: dice });
       }, delay);
       return () => clearTimeout(timer);
    }

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
               else if (bs.status === 'SPELEN') hostSession.processAction({ type: 'GEEN_ZETTEN_ACK' });
            }
       }, delay);
       return () => clearTimeout(timer);
    }
  }, [game?.boardState, hostSession, game?.slots, game?.settings.diceMode]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
        <div className="animate-pulse space-y-6 text-center">
          <div className="h-10 w-10 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xl font-medium text-foreground">{signalingStatus}</p>
          <div className="pt-8 space-y-4">
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              If this takes longer than 6 seconds, try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-slate-800 text-white rounded-full text-sm font-bold hover:bg-slate-700 transition-colors shadow-lg active:scale-95"
            >
              Refresh Page
            </button>
          </div>
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

  if (!game) return <div className="p-8">Game not found.</div>;
  const isHostUser = !!hostSession;

  if (game.boardState) {
     const bs = game.boardState;
     let localPlayerIndex = -1;
     if (isHostUser) localPlayerIndex = 0;
     else {
         const raw = localStorage.getItem('barricadeSession');
         if (raw) {
            const sessionName = JSON.parse(raw).playerName;
            const mySlot = game.slots.find(s => s.playerName === sessionName);
            if (mySlot) localPlayerIndex = mySlot.id;
         }
     }

     const currentColor = game.slots[bs.beurt]?.color || '#ffffff';

     const diceContent = (
       <div className="flex flex-col items-center">
         {bs.status === "PLAATS_BARRICADE" ? (
           <div className="w-16 h-16 bg-slate-800/80 border-4 border-amber-700 rounded-2xl flex items-center justify-center shadow-xl">
             <svg viewBox="0 0 24 24" className="w-8 h-8">
               <rect x="4" y="4" width="16" height="16" rx="3" fill="#854d0e" stroke="#451a03" strokeWidth="1.5" />
               <text x="12" y="16" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">B</text>
             </svg>
           </div>
         ) : bs.status === "WACHT_OP_DOBBELSTEEN" && localPlayerIndex === bs.beurt ? (
           <button 
             onClick={() => {
                if (isHostUser) hostSession?.processAction({ type: 'ROLL_START' });
                else guestSession?.sendToHost({ type: 'requestRollDice' });
             }} 
             className="w-16 h-16 bg-slate-800 border-4 rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer" 
             style={{ borderColor: currentColor }}
           >
             <svg viewBox="-0.4 -0.4 0.8 0.8" className="w-10 h-10">
               <DiceDots value={6} color={currentColor} size={0.8} />
             </svg>
           </button>
         ) : (
           <div className="w-16 h-16 bg-slate-800/80 border-4 rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden" style={{ borderColor: currentColor }}>
             {bs.status === 'DOBBELEN' ? (
               <RollingDice color={currentColor} diceMode={game.settings.diceMode} size={10} />
             ) : bs.dobbelsteen > 0 ? (
               <svg viewBox="-0.4 -0.4 0.8 0.8" className="w-10 h-10">
                 <DiceDots value={bs.dobbelsteen} color={currentColor} size={0.8} />
               </svg>
             ) : <Dice5 className="w-8 h-8 text-slate-700" />}
           </div>
         )}
         
         {bs.status === "GEEN_ZETTEN" && localPlayerIndex === bs.beurt && (
           <button 
             onClick={() => {
                if (isHostUser) hostSession?.processAction({ type: 'GEEN_ZETTEN_ACK' });
                else guestSession?.sendToHost({ type: 'requestNoMoves' });
             }} 
             className="mt-4 px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold animate-bounce shadow-xl"
           >
             No Moves (Finish)
           </button>
         )}
       </div>
     );

     const rulesMenu = (
        <Dialog>
           <DialogTrigger asChild>
              <button className="flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all shadow-lg active:scale-95">
                 <HelpCircle size={18} />
                 <span className="text-sm font-semibold">Rules</span>
              </button>
           </DialogTrigger>
           <DialogContent className="bg-slate-900 border-white/10 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                 <DialogTitle className="text-2xl font-bold flex items-center gap-2 mb-4">
                    <Info className="text-primary" /> Rules of Barricade Tactics
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
                       <li>Jump over other pawns.</li>
                       <li>Landing on an opponent's pawn sends it back to its Home slot.</li>
                       <li>Landing on a Barricade allows you to move it to any valid board node.</li>
                    </ul>
                 </section>
              </div>
           </DialogContent>
        </Dialog>
     );

     return (
       <div className="true-fullscreen overflow-hidden bg-slate-950">
          <div className="forced-landscape w-full h-full flex overflow-hidden">
             <div 
               className="flex-grow relative overflow-hidden flex items-center justify-center cursor-pointer"
               onClick={() => isMobile && isSidebarExpanded && setIsSidebarExpanded(false)}
             >
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

             <Sidebar 
                state={bs}
                slots={game.slots}
                localPlayerIndex={localPlayerIndex}
                onAction={(action) => isHostUser ? hostSession?.processAction(action) : guestSession?.sendToHost(action)} 
                rulesDialog={rulesMenu}
                diceContent={diceContent}
                isExpanded={isSidebarExpanded}
                setIsExpanded={setIsSidebarExpanded}
                isMobile={isMobile}
             />
          </div>
       </div>
     );
  }

    return (
      <div className="true-fullscreen overflow-hidden bg-slate-950">
        <div className="forced-landscape w-full h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
          <div className="absolute top-4 right-4 z-20">
            <button 
              onClick={toggleFullscreen}
              className="p-3 bg-slate-900 border border-white/10 rounded-xl text-white/50 hover:text-white transition-all shadow-xl active:scale-95"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>

          <div className="lobby-card flex flex-col items-center w-full max-w-xl px-2 py-1">
            <h1 className="lobby-title text-xl md:text-3xl font-bold mb-0.5">Room Setup: {game.gameName}</h1>
            <h2 className="text-xs md:text-lg font-semibold mb-1 text-slate-400">Code: <span className="text-white font-mono">{game.id}</span></h2>
        <button
          type="button"
          onClick={copyInvite}
          className="mb-2 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Copy Invite Link
        </button>

        {isHostUser && (
          <div className="mb-2 w-full max-w-md mx-auto grid grid-cols-2 gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
            <div className="flex justify-between items-center p-1 bg-white/5 rounded">
              <span className="text-[10px] text-gray-300 font-medium">Capture Bonus</span>
              <button
                onClick={() => hostSession?.updateSettings({ captureBonus: !game.settings.captureBonus })}
                className={`w-8 h-4 rounded-full transition-colors relative ${game.settings.captureBonus ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${game.settings.captureBonus ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center p-1 bg-white/5 rounded">
              <span className="text-[10px] text-gray-300 font-medium">Protect Bottom</span>
              <button
                onClick={() => hostSession?.updateSettings({ protectBottomRow: !game.settings.protectBottomRow })}
                className={`w-8 h-4 rounded-full transition-colors relative ${game.settings.protectBottomRow ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${game.settings.protectBottomRow ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
            
            <div className="flex flex-col gap-1 p-1 bg-white/5 rounded">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Win Condition</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => hostSession?.updateSettings({ winCondition: n })}
                    className={`flex-1 py-0.5 rounded transition-colors text-[10px] font-bold ${game.settings.winCondition === n ? 'bg-primary text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 p-1 bg-white/5 rounded">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Dice Mode</span>
              <select 
                value={game.settings.diceMode}
                onChange={(e) => hostSession?.updateSettings({ diceMode: e.target.value as any })}
                className="bg-gray-800 border-none text-white text-[10px] rounded outline-none p-0.5"
              >
                <option value="animated">Animated</option>
                <option value="instant_bots">Instant Bots</option>
                <option value="instant">Instant All</option>
              </select>
            </div>
          </div>
        )}

        {isHostUser && (
          <div className="mb-2 w-full max-w-md mx-auto flex flex-col items-center justify-center">
            {(!game.slots.some(s => s.type === 'open') && game.slots.some(s => s.type === 'player' || s.type === 'bot')) ? (
              <button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-6 rounded-lg shadow-lg transition-all text-sm tracking-wide uppercase"
                onClick={() => hostSession?.startGame()}
              >
                Start Game
              </button>
            ) : (
              <div className="w-full p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                <p className="text-orange-500 text-[10px] font-bold tracking-widest uppercase">
                  Awaiting Players
                </p>
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-2xl px-2">
          <div className="grid grid-cols-2 gap-2">
            {game.slots.map((slot) => {
              const isHost = slot.type === 'host';
              const label = isHost ? 'Host' : `Slot ${slot.id}`;
              const isGuestSelf = !isHostUser && guestSession && game.slots.find(s => s.connectionId === guestSession.peer.id)?.id === slot.id;
              const canChangeColor = isHostUser ? (isHost || slot.type === 'bot') : isGuestSelf;

              const handleColorChange = (color: string) => {
                if (isHostUser) hostSession?.updateSlot(slot.id, slot.type, slot.playerName, color);
                else if (isGuestSelf) guestSession?.sendToHost({ type: 'requestChangeColor', slotId: slot.id, color });
              };

              let content;
              if (isHostUser && !isHost) {
                content = (
                  <div className="flex gap-2 items-center">
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
                      <SelectTrigger className="h-7 text-[10px] bg-background border-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="bot">Bot</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        {slot.type === 'player' && <SelectItem value="player">Player</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                );
              } else {
                let display: string = slot.type;
                if (slot.type === 'player' || slot.type === 'host' || slot.type === 'bot') {
                  display = slot.playerName || (slot.type === 'bot' ? `bot ${slot.id} 🤖` : display);
                } else if (slot.type === 'open') display = 'Waiting...';
                else if (slot.type === 'closed') display = 'Closed';

                content = (
                  <div className="flex gap-2 items-center">
                     <ColorPicker 
                        current={slot.color} 
                        onChange={handleColorChange} 
                        disabled={!canChangeColor || slot.type === 'closed' || slot.type === 'open'} 
                        used={game.slots.filter(s => s.type !== 'open' && s.type !== 'closed').map(s => s.color)}
                      />
                     <div className={`text-xs ${slot.type === 'open' || slot.type === 'closed' ? 'text-muted-foreground italic' : 'font-bold'}`}>{display}</div>
                  </div>
                );
              }

              return (
                <div key={slot.id} className="p-1.5 md:p-3 bg-white/5 border border-white/10 rounded-lg flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
                  {content}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading game location...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
