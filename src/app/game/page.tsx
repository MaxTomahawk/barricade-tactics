'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameState, HostSession, SlotType, startGuestSession, startHostSession } from '@/lib/webrtc-room';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SessionInfo = {
  role: 'host' | 'guest';
  roomId: string;
  gameName?: string;
  playerName: string;
};

function GamePageContent() {
  const searchParams = useSearchParams();
  const roomId = useMemo(() => (searchParams.get('roomId') || '').trim().toUpperCase(), [searchParams]);

  const [game, setGame] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const shutdownRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      setError('Missing roomId in URL.');
      return;
    }

    const raw = sessionStorage.getItem('barricadeSession');
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
    };

    let active = true;
    let fallbackTimeout: ReturnType<typeof setTimeout>;

    if (session.role === 'host') {
      fallbackTimeout = setTimeout(() => {
        if (!active) return;
        const host = startHostSession({
          roomId,
          gameName: session.gameName || 'Untitled Room',
          hostName: session.playerName || 'Host',
          onGameStateUpdated,
          onError: onPeerError,
        });
        setHostSession(host);
        shutdownRef.current = host.shutdown;
      }, 50);
    } else {
      fallbackTimeout = setTimeout(() => {
        if (!active) return;
        const guest = startGuestSession({
          roomId,
          playerName: session.playerName || 'Guest',
          onGameStateUpdated,
          onError: onPeerError,
        });
        shutdownRef.current = guest.shutdown;
      }, 50);
    }

    return () => {
      active = false;
      clearTimeout(fallbackTimeout);
      shutdownRef.current?.();
      shutdownRef.current = null;
    };
  }, [roomId]);

  const inviteUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('roomId', roomId);
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

  if (isLoading) {
    return <div className="p-8">Connecting to peer host...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500 font-medium">{error}</div>;
  }

  if (!game) {
    return <div className="p-8">Game not found.</div>;
  }

  const isHostUser = !!hostSession;

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

      <div className="w-full max-w-2xl">
        <h3 className="text-xl font-semibold mb-6">Players & Slots</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {game.slots.map((slot) => {
            const isHost = slot.type === 'host';
            const label = isHost ? 'Host' : `Slot ${slot.id}`;

            let content;
            if (isHostUser && !isHost) {
              content = (
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

              content = <div className={`text-lg py-2 ${extraStyle}`}>{display}</div>;
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
