import { firestore } from '@/lib/firebase/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { gameId, playerName } = await req.json();

    if (!gameId || !playerName) {
      return NextResponse.json({ error: 'Game ID and player name are required' }, { status: 400 });
    }

    const gameRef = doc(firestore, 'games', gameId);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    await updateDoc(gameRef, {
      players: arrayUnion(playerName),
    });

    return NextResponse.json({ message: 'Player joined successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error joining game:', error);
    return NextResponse.json({ error: 'Failed to join game' }, { status: 500 });
  }
}
