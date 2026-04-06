'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameState, startGuestSession, startHostSession } from '@/lib/webrtc-room';

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

    if (session.role === 'host') {
      const host = startHostSession({
        roomId,
        gameName: session.gameName || 'Untitled Room',
        hostName: session.playerName || 'Host',
        onGameStateUpdated,
        onError: onPeerError,
      });
      shutdownRef.current = host.shutdown;
      return () => {
        shutdownRef.current?.();
        shutdownRef.current = null;
      };
    }

    const guest = startGuestSession({
      roomId,
      playerName: session.playerName || 'Guest',
      onGameStateUpdated,
      onError: onPeerError,
    });
    shutdownRef.current = guest.shutdown;

    return () => {
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
    return <div className="p-8 text-red-500">{error}</div>;
  }

  if (!game) {
    return <div className="p-8">Game not found.</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <h1 className="text-4xl font-bold mb-4">Game: {game.gameName}</h1>
      <h2 className="text-2xl font-semibold mb-3">Room Code: {game.id}</h2>
      <button
        type="button"
        onClick={copyInvite}
        className="mb-8 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
      >
        Copy Invite Link
      </button>

      <div className="w-full max-w-2xl">
        <h3 className="text-xl font-semibold mb-4">Players:</h3>
        <ul className="space-y-2">
          {game.players.map((player) => (
            <li key={player} className="p-4 bg-muted rounded-lg text-lg">
              {player}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading game...</div>}>
      <GamePageContent />
    </Suspense>
  );
}
