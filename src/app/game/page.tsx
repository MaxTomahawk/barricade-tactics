'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameState, HostSession, GuestSession, SlotType, startGuestSession, startHostSession, PlayerSlot } from '@/lib/webrtc-room';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, Trophy, ChevronRight, Info, Dice5, Maximize, Minimize, Link as LinkIcon, UserMinus } from 'lucide-react';
import { useDynamicFavicon } from '@/hooks/use-dynamic-favicon';

import { GAME_COLORS, TAILWIND_COLOR_MAP } from '@/lib/constants';


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
        <div className="grid grid-cols-4 gap-2">

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
import { DiceDots, RollingDice, StaticDice } from '@/components/ui/dice';
import { BotIcon } from '@/components/ui/bot-icon';
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

  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const shutdownRef = useRef<null | (() => void)>(null);
  const signaledRef = useRef(false);
  const passwordRef = useRef('');
  const [isLeftSidebarExpanded, setIsLeftSidebarExpanded] = useState(false);
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const isReconnecting = signalingStatus.includes('retrying') || signalingStatus.includes('busy');
  const reconnectingOverlay = isReconnecting ? (
    <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-slate-900/90 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full border-b-2 border-b-yellow-500/50 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>
        <div className="w-20 h-20 bg-yellow-500/20 rounded-3xl flex items-center justify-center animate-pulse">
          <div className="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
        </div>
        <div className="flex flex-col items-center text-center">
          <p className="text-yellow-500 font-black uppercase tracking-[0.2em] text-[12px] mb-2">Connection Unstable</p>
          <p className="text-white/80 text-sm font-medium leading-tight mb-6">{signalingStatus}</p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all shadow-[0_10px_30px_rgba(234,179,8,0.3)] active:scale-95 flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-3 h-3" />
              Refresh Page
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] transition-all border border-white/5"
            >
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Default to expanded on desktop, collapsed on mobile
      setIsLeftSidebarExpanded(!mobile);
      setIsRightSidebarExpanded(!mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lastProcessedRef = useRef<string>('');

  const [lastDicePositionInCorner, setLastDicePositionInCorner] = useState(false);

  const localPlayerIndex = useMemo(() => {
    if (!game) return -1;
    if (!!hostSession) return 0;
    if (typeof window === 'undefined') return -1;
    let raw = localStorage.getItem(`barricade_session_${roomId}`);
    if (!raw) raw = localStorage.getItem('barricadeSession');
    if (!raw) return -1;
    try {
      const session = JSON.parse(raw);
      const mySlot = game.slots.find(s => s.playerName === session.playerName);
      return mySlot ? mySlot.id : -1;
    } catch (e) { return -1; }
  }, [game, hostSession, roomId]);

  // Dynamic Favicon handling: Show viewer's color, or default to slot 0/red
  const activePlayerColorRaw = (localPlayerIndex !== -1 && game?.slots[localPlayerIndex]?.color)
    ? game.slots[localPlayerIndex].color
    : (game?.slots[0]?.color || '#ef4444');



  const activePlayerColor = TAILWIND_COLOR_MAP[activePlayerColorRaw] || activePlayerColorRaw;
  useDynamicFavicon(activePlayerColor);

  useEffect(() => {
    if (game?.boardState) {
      const bs = game.boardState;
      if (localPlayerIndex === bs.beurt) {
        setLastDicePositionInCorner(bs.status === 'PLAATS_BARRICADE' || bs.status === 'SPELEN');
      }
    }
  }, [game?.boardState?.status, game?.boardState?.beurt, localPlayerIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === ' ' || e.key === 'Enter') {
        const bs = game?.boardState;
        if (bs?.status === 'WACHT_OP_DOBBELSTEEN' && localPlayerIndex === bs.beurt) {
          e.preventDefault();
          if (hostSession) hostSession.processAction({ type: 'ROLL_START' });
          else if (guestSession) guestSession.sendToHost({ type: 'requestRollDice' });
        } else if (bs?.status === 'GEEN_ZETTEN' && localPlayerIndex === bs.beurt) {
          e.preventDefault();
          if (hostSession) hostSession.processAction({ type: 'GEEN_ZETTEN_ACK' });
          else if (guestSession) guestSession.sendToHost({ type: 'requestNoMoves' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game?.boardState, localPlayerIndex, hostSession, guestSession]);

  useEffect(() => {
    if (game?.boardState?.status === 'WACHT_OP_DOBBELSTEEN' && game.boardState.beurt === localPlayerIndex) {
      const playTurnSound = () => {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) { }
      };
      playTurnSound();
    }
  }, [game?.boardState?.beurt, localPlayerIndex]);

  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      setError('Missing roomId in URL.');
      return;
    }

    if (signaledRef.current) return;
    signaledRef.current = true;

    // Prioritize room-specific session data to avoid tab cross-pollution
    let raw = localStorage.getItem(`barricade_session_${roomId}`);
    if (!raw) {
      // Fallback to global key only if it matches current room
      raw = localStorage.getItem('barricadeSession');
    }

    if (!raw) {
      setIsLoading(false);
      setError('Session not found. Return to lobby and host or join again.');
      return;
    }

    const session = JSON.parse(raw) as SessionInfo;
    if (session.roomId !== roomId) {
      // If global key exists but doesn't match, we still can't use it
      setIsLoading(false);
      setError('Room ID mismatch. Return to lobby and try again.');
      return;
    }

    const onGameStateUpdated = (nextGame: GameState) => {
      // If we are in matchmaking, we might have started with BTU_MATCH_... 
      // but the actual room we joined is BT_MATCH_1. We should accept it.
      const isMatchmaking = session.role === 'matchmaking';
      if (nextGame.id.toUpperCase() === roomId || isMatchmaking) {
        setGame(nextGame);
        setError('');
        setIsLoading(false);
      }
    };

    const onPeerError = (message: string) => {
      setError(message);
      setIsLoading(false);

      // Detailed error logging or specific handling for PeerJS codes
      console.error('PeerJS Error Callback:', message);

      // If critical error, redirect home after a longer delay to allow manual retry or reading error
      const isCritical = message.includes('not found') || message.includes('session') || message.includes('ID') || message.includes('already taken');

      if (isCritical) {
        if (message.includes('taken') || message.includes('ID')) {
          setError("Host ID conflict: A previous session might still be active. Retrying... (If this persists, try another room code)");
        }
        // Longer delay (10s) gives user time to see the error or refresh manually
        setTimeout(() => router.push('/'), 10000);
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
          } catch (e) { }
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
      signaledRef.current = false;
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
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      setError('Could not copy invite link.');
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
      const isInstantMode = game.settings.diceMode === 'instant' || game.settings.diceMode === 'instant_bots';

      // Only skip the "thinking" pause for the roll itself if instant mode is on.
      // For moving pawns or placing barricades, we keep the 1s delay so the movement animation 
      // has time to play out and the user can actually see the bot's tactical choice.
      // We use 600ms here (instead of 50ms) to ensure the previous pawn's move animation (400ms) 
      // always finishes before the next roll start is triggered by the bot.
      if (isInstantMode && bs.status === 'WACHT_OP_DOBBELSTEEN') {
        delay = 600;
      }

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
      <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-950">
        <div className="animate-pulse flex flex-col items-center justify-center text-center max-w-md w-full">
          <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-8 rotate-3 shadow-2xl border border-primary/20">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>

          <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase italic text-white">{signalingStatus}</h2>
          <p className="text-white/40 text-sm font-medium leading-relaxed mb-10 max-w-xs mx-auto">
            If this takes longer than 6 seconds, try refreshing the page manually.
          </p>

          <div className="flex flex-col gap-4 w-full px-8">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-primary hover:bg-primary/90 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] active:scale-95 flex items-center justify-center gap-3 group"
            >
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              Refresh Page
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-white/40 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all hover:text-white border border-white/5 flex items-center justify-center"
            >
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show the fatal error screen if we haven't even loaded the game yet
  // If the game is already in progress, we'll show a non-blocking overlay instead
  if (error && !game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-950/90 backdrop-blur-xl z-[999] gap-4 fixed inset-0">
        <div className="p-10 bg-red-500/10 border border-red-500/20 text-red-100 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl backdrop-blur-md border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>

          <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-6 float-animation group-hover:rotate-0 transition-all duration-700">
            <Info className="text-red-500 w-10 h-10" />
          </div>

          <h2 className="text-4xl font-black mb-3 tracking-tighter uppercase italic leading-none">Connection Lost</h2>
          <p className="text-red-100/50 mb-10 text-sm leading-relaxed font-medium uppercase tracking-[0.1em]">{error}</p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-red-500 hover:bg-red-600 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-[0_10px_30px_rgba(239,68,68,0.4)] active:scale-95 flex items-center justify-center gap-3 group/btn"
            >
              <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1.5 transition-transform" />
              Try Reconnecting
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-5 bg-white/5 hover:bg-white/10 text-white/40 rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all hover:text-white border border-white/5"
            >
              Return to Menu
            </button>
          </div>
        </div>
        <p className="text-white/10 text-[9px] uppercase tracking-[0.4em] font-black mt-8 animate-pulse">Auto-redirecting in 10s</p>
      </div>
    );
  }

  if (!game) return <div className="p-8">Game not found.</div>;
  const isHostUser = !!hostSession;

  if (game.boardState) {
    const bs = game.boardState;

    const currentColor = game.slots[bs.beurt]?.color || '#ffffff';

    const rulesMenu = (
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
              <li>
                Landing on an opponent's pawn sends it back to its Home slot.
                {game.settings.playerCaptureBonus && (
                  <span className="text-yellow-500/80 block mt-1 ml-4 italic font-medium">Bonus: You get an immediate extra roll!</span>
                )}
              </li>
              <li>
                Landing on a Barricade (white/brown) allows you to move it to any valid board node.
                <div className="space-y-1 mt-1 ml-4">
                  {game.settings.barricadeCaptureBonus && (
                    <span className="text-yellow-500/80 block italic font-medium">Bonus: You get an immediate extra roll!</span>
                  )}
                  {game.settings.protectBottomRow && (
                    <span className="text-yellow-500/80 block italic font-medium">First row protection on: you cannot place barricades on the first row</span>
                  )}
                </div>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <ChevronRight size={14} className="text-primary" /> Finish
            </h3>
            <p className="text-slate-400">
              Reach the finish node with your pawns to win.
              <span className="text-yellow-500/80 block mt-1 italic font-medium">To win, you need to bring {game.settings.winCondition} pawn(s) to the Finish Node.</span>
            </p>
          </section>
        </div>
      </DialogContent>
    );

    return (
      <div className="true-fullscreen overflow-hidden bg-slate-950 relative">
        {reconnectingOverlay}
        <div className="forced-landscape w-full h-full flex overflow-hidden">
          <Sidebar
            state={bs}
            slots={game.slots}
            localPlayerIndex={localPlayerIndex}
            onAction={(action) => isHostUser ? hostSession?.processAction(action) : guestSession?.sendToHost(action)}
            isExpanded={isLeftSidebarExpanded}
            setIsExpanded={setIsLeftSidebarExpanded}
            isMobile={isMobile}
            side="left"
            showFullscreen={true}
          />

          <div
            className="flex-grow relative overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={() => {
              if (isMobile) {
                setIsLeftSidebarExpanded(false);
                setIsRightSidebarExpanded(false);
              }
            }}
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

            {/* Dynamic Dice Popup Overlay */}
            <div className="absolute inset-0 pointer-events-none z-40">
              {(bs.status === "WACHT_OP_DOBBELSTEEN" || bs.status === "DOBBELEN" || bs.status === "PLAATS_BARRICADE" || bs.status === "GEEN_ZETTEN" || bs.status === "SPELEN") && (
                <div
                  className={`absolute transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-top-right ${localPlayerIndex === bs.beurt
                    ? (bs.status === 'PLAATS_BARRICADE' || bs.status === 'SPELEN')
                      ? 'top-8 right-8 translate-x-0 translate-y-0 scale-[0.35] opacity-100'
                      : 'top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 scale-100 opacity-100'
                    : lastDicePositionInCorner
                      ? 'top-8 right-8 translate-x-0 translate-y-0 scale-[0.35] opacity-0 pointer-events-none'
                      : 'top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 scale-90 opacity-0 pointer-events-none'
                    }`}
                >
                  <div className={`bg-slate-900/60 backdrop-blur-3xl border border-white/10 ${(bs.status === 'PLAATS_BARRICADE' || bs.status === 'SPELEN') ? 'p-6 rounded-[2rem]' : 'p-12 rounded-[3.5rem]'} shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col items-center gap-8 pointer-events-auto animate-in zoom-in duration-300`}>
                    <div className="flex flex-col items-center">
                      {bs.status === "PLAATS_BARRICADE" ? (
                        <div
                          className="w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl border-4"
                          style={{ backgroundColor: '#854d0e', borderColor: '#451a03' }}
                        >
                          <span className="text-6xl font-black" style={{ color: '#451a03' }}>B</span>
                        </div>
                      ) : bs.status === "WACHT_OP_DOBBELSTEEN" && localPlayerIndex === bs.beurt ? (
                        <button
                          onClick={() => {
                            if (isHostUser) hostSession?.processAction({ type: 'ROLL_START' });
                            else guestSession?.sendToHost({ type: 'requestRollDice' });
                          }}
                          className="hover:scale-110 active:scale-95 transition-all cursor-pointer group relative"
                        >
                          <div className="absolute -inset-8 bg-primary/20 rounded-full blur-2xl animate-pulse group-hover:bg-primary/40 transition-all"></div>
                          <StaticDice color={currentColor} size={40} value={0} showQuestion={true} />
                        </button>
                      ) : bs.status === "DOBBELEN" ? (
                        game.settings.diceMode === 'instant' ? (
                          <StaticDice value={bs.dobbelsteen} color={currentColor} size={40} />
                        ) : (
                          <RollingDice color={currentColor} diceMode={game.settings.diceMode} size={40} />
                        )
                      ) : bs.status === "SPELEN" ? (
                        <StaticDice value={bs.dobbelsteen} color={currentColor} size={40} />
                      ) : null}

                      {!(bs.status === 'PLAATS_BARRICADE' || bs.status === 'SPELEN') && (
                        <div className="mt-8 flex flex-col items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                            Your Turn
                          </span>
                          <span className="text-lg font-bold text-white">
                            {bs.status === "WACHT_OP_DOBBELSTEEN" ? "Roll the die" : bs.status === "DOBBELEN" ? "Rolling..." : "Secure a path"}
                          </span>
                        </div>
                      )}
                    </div>

                    {bs.status === "GEEN_ZETTEN" && localPlayerIndex === bs.beurt && (
                      <button
                        onClick={() => {
                          if (isHostUser) hostSession?.processAction({ type: 'GEEN_ZETTEN_ACK' });
                          else guestSession?.sendToHost({ type: 'requestNoMoves' });
                        }}
                        className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-lg font-black uppercase tracking-widest animate-bounce shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all pointer-events-auto"
                      >
                        No Moves (Finish)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Sidebar
            state={bs}
            slots={game.slots}
            localPlayerIndex={localPlayerIndex}
            onAction={(action) => isHostUser ? hostSession?.processAction(action) : guestSession?.sendToHost(action)}
            rulesContent={rulesMenu}
            isExpanded={isRightSidebarExpanded}
            setIsExpanded={setIsRightSidebarExpanded}
            isMobile={isMobile}
            side="right"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="true-fullscreen overflow-hidden bg-slate-950 relative">
      {reconnectingOverlay}

      {showCopied && (
        <div className="copy-success-popup">Copied!</div>
      )}

      <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
        {/* Mobile Header - Now outside the scroll area for perfect alignment */}
        <div className="lobby-header-mobile flex-shrink-0">
          <div className="flex items-center justify-between w-full mt-1">
            {/* Links: De naam */}
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
              {game.gameName}
            </h1>

            {/* Rechts: De acties (button + status) */}
            <div className="flex items-center gap-2">
              <button
                onClick={copyInvite}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-primary text-[10px] font-mono font-bold active:scale-95 transition-all outline-none"
                title="Copy Invite Link"
              >
                {game.id}
                <LinkIcon size={10} />
              </button>

              <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                <div className={`w-1 h-1 rounded-full ${signalingStatus.includes('Confirmed') || signalingStatus.includes('Handshaking') || signalingStatus.includes('Connected') || signalingStatus.includes('Waiting') ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                <span className={`text-[8px] uppercase tracking-tighter font-black ${signalingStatus.includes('Confirmed') || signalingStatus.includes('Handshaking') || signalingStatus.includes('Connected') || signalingStatus.includes('Waiting') ? 'text-green-500' : 'text-yellow-500'}`}>
                  {signalingStatus.includes('Confirmed') || signalingStatus.includes('Handshaking') || signalingStatus.includes('Connected') || signalingStatus.includes('Waiting') ? 'Connected' : 'Connecting'}
                </span>
              </div>
            </div>
          </div>

          {isHostUser ? (
            <div className="mt-3">
              {(!game.slots.some(s => s.type === 'open') && game.slots.some(s => s.type === 'player' || s.type === 'bot')) ? (
                <button
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-2 rounded-xl shadow-lg transition-all text-[11px] tracking-[0.2em] uppercase"
                  onClick={() => hostSession?.startGame()}
                >
                  Start Game
                </button>
              ) : (
                <div className="w-full py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center flex items-center justify-center">
                  <p className="text-orange-500 text-[9px] font-black tracking-[0.2em] uppercase">
                    Awaiting Players
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 w-full py-2 rounded-xl bg-primary/5 border border-primary/20 text-center flex items-center justify-center">
              <p className="text-primary text-[9px] font-black tracking-[0.2em] uppercase">
                Awaiting Host
              </p>
            </div>
          )}
        </div>

        <div className="flex-grow overflow-y-auto lobby-scroll-area flex flex-col items-center">
          <div className="lobby-container px-2 lg:px-4 lg:pt-8 min-h-screen flex flex-col">
            {/* Desktop Header */}
            <div className="lobby-desktop-header mb-8">
              <h1 className="lobby-title text-xl md:text-3xl font-bold mb-1 tracking-tight">Room Setup: {game.gameName}</h1>
              <div className="flex items-center gap-3">
                <h2 className="text-xs md:text-lg font-semibold text-slate-400">
                  Code:
                  <button
                    onClick={copyInvite}
                    className="ml-2 text-white font-mono hover:text-primary transition-colors inline-flex items-center gap-2 group outline-none"
                    title="Copy Invite Link"
                  >
                    {game.id}
                    <LinkIcon size={16} className="text-primary group-hover:scale-110 transition-transform" />
                  </button>
                </h2>
              </div>
            </div>

            {/* Start Button (Lg screen only) */}
            {isHostUser && (
              <div className="hidden lg:flex mb-6 w-full max-w-md">
                {(!game.slots.some(s => s.type === 'open') && game.slots.some(s => s.type === 'player' || s.type === 'bot')) ? (
                  <button
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all text-sm tracking-[0.3em] uppercase active:scale-[0.98]"
                    onClick={() => hostSession?.startGame()}
                  >
                    Start Game
                  </button>
                ) : (
                  <div className="w-full p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center">
                    <p className="text-orange-500 text-xs font-black tracking-[0.4em] uppercase">
                      Awaiting Players
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Section */}
            {isHostUser && (
              <div className="lobby-section mb-6">
                <div className="lobby-section-title">
                  <Dice5 size={14} className="text-primary" />
                  Room Settings
                </div>
                <div className="lobby-grid-2col">
                  {/* Capture Barricade */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 min-h-[64px] lg:min-h-[72px] gap-2">
                    <div className="flex-grow leading-tight">
                      <span className="text-[9px] lg:text-[10px] text-white/30 font-black uppercase tracking-[0.2em] inline-block">
                        Capture (Barricade)
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="inline-flex items-center ml-1.5 text-white/20 hover:text-white transition-colors align-middle -mt-0.5">
                              <HelpCircle size={10} />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-white/10 text-slate-200">
                            <DialogHeader><DialogTitle>Capture (Barricade) Bonus</DialogTitle></DialogHeader>
                            <p className="text-sm">Landing on a Barricade allows you to roll again for an extra turn after placing it.</p>
                          </DialogContent>
                        </Dialog>
                      </span>
                    </div>
                    <button
                      onClick={() => hostSession?.updateSettings({ barricadeCaptureBonus: !game.settings.barricadeCaptureBonus })}
                      className={`w-8 lg:w-10 h-5 lg:h-6 rounded-full transition-all relative flex-shrink-0 ${game.settings.barricadeCaptureBonus ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 lg:top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all ${game.settings.barricadeCaptureBonus ? 'left-3.5 lg:left-5' : 'left-0.5 lg:left-1'}`} />
                    </button>
                  </div>

                  {/* Capture Player */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 min-h-[64px] lg:min-h-[72px] gap-2">
                    <div className="flex-grow leading-tight">
                      <span className="text-[9px] lg:text-[10px] text-white/30 font-black uppercase tracking-[0.2em] inline-block">
                        Capture (Player)
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="inline-flex items-center ml-1.5 text-white/20 hover:text-white transition-colors align-middle -mt-0.5">
                              <HelpCircle size={10} />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-white/10 text-slate-200">
                            <DialogHeader><DialogTitle>Capture (Player) Bonus</DialogTitle></DialogHeader>
                            <p className="text-sm">Landing on an opponent's pawn sends them home and gives you an extra roll.</p>
                          </DialogContent>
                        </Dialog>
                      </span>
                    </div>
                    <button
                      onClick={() => hostSession?.updateSettings({ playerCaptureBonus: !game.settings.playerCaptureBonus })}
                      className={`w-8 lg:w-10 h-5 lg:h-6 rounded-full transition-all relative flex-shrink-0 ${game.settings.playerCaptureBonus ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 lg:top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all ${game.settings.playerCaptureBonus ? 'left-3.5 lg:left-5' : 'left-0.5 lg:left-1'}`} />
                    </button>
                  </div>

                  {/* Row Protection */}
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 min-h-[64px] lg:min-h-[72px] gap-2">
                    <div className="flex-grow leading-tight">
                      <span className="text-[9px] lg:text-[10px] text-white/30 font-black uppercase tracking-[0.2em] inline-block">
                        Row Protect
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="inline-flex items-center ml-1.5 text-white/20 hover:text-white transition-colors align-middle -mt-0.5">
                              <HelpCircle size={10} />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-white/10 text-slate-200">
                            <DialogHeader><DialogTitle>First Row Protection</DialogTitle></DialogHeader>
                            <p className="text-sm">Prevents barricades from being placed on the starting row of any player.</p>
                          </DialogContent>
                        </Dialog>
                      </span>
                    </div>
                    <button
                      onClick={() => hostSession?.updateSettings({ protectBottomRow: !game.settings.protectBottomRow })}
                      className={`w-8 lg:w-10 h-5 lg:h-6 rounded-full transition-all relative flex-shrink-0 ${game.settings.protectBottomRow ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 lg:top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all ${game.settings.protectBottomRow ? 'left-3.5 lg:left-5' : 'left-0.5 lg:left-1'}`} />
                    </button>
                  </div>

                  {/* Win Condition */}
                  <div className="flex flex-col gap-1.5 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] lg:text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Win Condition</span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-white/20 hover:text-white transition-colors">
                            <HelpCircle size={12} />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/10 text-slate-200">
                          <DialogHeader><DialogTitle>Win Condition</DialogTitle></DialogHeader>
                          <p className="text-sm">The number of pawns you must bring to the top center finish node to win the game.</p>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Select
                      value={game.settings.winCondition.toString()}
                      onValueChange={(val) => hostSession?.updateSettings({ winCondition: parseInt(val) })}
                    >
                      <SelectTrigger className="h-8 lg:h-9 text-[10px] lg:text-xs bg-white/5 border-white/10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="1">1 Pawn</SelectItem>
                        <SelectItem value="2">2 Pawns</SelectItem>
                        <SelectItem value="3">3 Pawns</SelectItem>
                        <SelectItem value="4">4 Pawns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dice Mode */}
                  <div className="flex flex-col gap-1.5 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] lg:text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Dice Mode</span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-white/20 hover:text-white transition-colors">
                            <HelpCircle size={12} />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/10 text-slate-200">
                          <DialogHeader><DialogTitle>Dice Mode</DialogTitle></DialogHeader>
                          <ul className="text-sm space-y-2">
                            <li><strong>Animated:</strong> Full sequence for every roll.</li>
                            <li><strong>Instant Bots:</strong> Bots skip the rolling animation.</li>
                            <li><strong>Instant All:</strong> All dice rolls reveal results immediately.</li>
                          </ul>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Select
                      value={game.settings.diceMode}
                      onValueChange={(val) => hostSession?.updateSettings({ diceMode: val as any })}
                    >
                      <SelectTrigger className="h-8 lg:h-9 text-[10px] lg:text-xs bg-white/5 border-white/10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="animated">Animated</SelectItem>
                        <SelectItem value="instant_bots">Instant Bots</SelectItem>
                        <SelectItem value="instant">Instant All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Players Section */}
            <div className="lobby-section">
              <div className="lobby-section-title">
                <Trophy size={14} className="text-primary" />
                Player Slots
              </div>
              <div className="lobby-players-grid">
                {game.slots.map((slot) => {
                  const isHost = slot.type === 'host';
                  const label = `Slot ${slot.id}`;
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
                        <div className="flex-grow min-w-0">
                          <Select
                            value={slot.type}
                            onValueChange={(val) => {
                              let nextName = undefined;
                              if (val === 'bot') nextName = `Bot ${slot.id}`;
                              hostSession?.updateSlot(slot.id, val as SlotType, nextName);
                            }}
                          >
                            <SelectTrigger className="h-8 lg:h-9 text-[10px] lg:text-xs bg-white/5 border-white/10 rounded-lg pr-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="bot">Bot</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                              {slot.type === 'player' && (
                                <SelectItem value="player">
                                  {slot.playerName || 'Player'}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {slot.type === 'player' && (
                          <button
                            onClick={() => hostSession?.updateSlot(slot.id, 'open')}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 flex-shrink-0"
                            title="Kick Player"
                          >
                            <UserMinus size={12} />
                          </button>
                        )}
                      </div>
                    );
                  } else {
                    let display: string = slot.type;
                    if (slot.type === 'player' || slot.type === 'host' || slot.type === 'bot') {
                      display = slot.playerName || (slot.type === 'bot' ? `Bot ${slot.id}` : display);
                    } else if (slot.type === 'open') display = 'Waiting...';
                    else if (slot.type === 'closed') display = 'Closed';

                    content = (
                      <div className="flex gap-2 items-center overflow-hidden">
                        <ColorPicker
                          current={slot.color}
                          onChange={handleColorChange}
                          disabled={!canChangeColor || slot.type === 'closed' || slot.type === 'open'}
                          used={game.slots.filter(s => s.type !== 'open' && s.type !== 'closed').map(s => s.color)}
                        />
                        <div className={`text-[11px] lg:text-sm ${slot.type === 'open' || slot.type === 'closed' ? 'text-white/20 italic' : 'font-bold text-white'} flex items-center gap-1.5 truncate`}>
                          <span className="truncate">{display}</span>
                          {slot.type === 'bot' && <BotIcon color={slot.color} className="text-base flex-shrink-0" />}
                          {isHost && <span className="flex-shrink-0 text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black">HOST</span>}
                          {slot.type === 'player' && <span className="flex-shrink-0 text-[8px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full font-black">PLAYER</span>}
                        </div>
                      </div>
                    );
                  }

                  const isSlotActive = slot.type !== 'open' && slot.type !== 'closed';

                  return (
                    <div
                      key={slot.id}
                      className={`p-2 lg:p-4 rounded-xl lg:rounded-2xl border transition-all duration-300 ${isSlotActive ? 'bg-white/5 border-white/10' : 'bg-transparent border-dashed border-white/5 opacity-40'}`}
                    >
                      <span className="text-[8px] lg:text-[9px] text-white/30 uppercase font-black tracking-widest mb-1 lg:mb-2 block">{label}</span>
                      {content}
                    </div>
                  );
                })}
              </div>
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
