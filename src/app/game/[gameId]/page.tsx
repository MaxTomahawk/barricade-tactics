'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/firebase';

export default function GamePage() {
  const { gameId } = useParams();
  const [game, setGame] = useState<any>(null);

  useEffect(() => {
    if (gameId) {
      const gameRef = doc(firestore, 'games', gameId as string);
      const unsubscribe = onSnapshot(gameRef, (doc) => {
        if (doc.exists()) {
          setGame({ id: doc.id, ...doc.data() });
        } else {
          // Handle game not found
          console.error('Game not found');
        }
      });

      return () => unsubscribe();
    }
  }, [gameId]);

  if (!game) {
    return <div>Loading...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <h1 className="text-4xl font-bold mb-4">Game: {game.gameName}</h1>
      <h2 className="text-2xl font-semibold mb-8">Room Code: {game.id}</h2>
      <div className="w-full max-w-2xl">
        <h3 className="text-xl font-semibold mb-4">Players:</h3>
        <ul className="space-y-2">
          {game.players.map((player: string) => (
            <li key={player} className="p-4 bg-muted rounded-lg text-lg">{player}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
