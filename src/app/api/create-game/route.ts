import { firestore } from '@/lib/firebase/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { playerName, gameName } = await req.json();

    if (!playerName || !gameName) {
      return NextResponse.json({ error: 'Player name and game name are required' }, { status: 400 });
    }

    const gameRef = await addDoc(collection(firestore, 'games'), {
      gameName,
      host: playerName,
      players: [playerName],
      createdAt: new Date(),
    });

    return NextResponse.json({ gameId: gameRef.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
