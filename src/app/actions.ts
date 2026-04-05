'use server';

import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp, runTransaction } from 'firebase/firestore';
import { GameSettings, Player, GameState, PlayerColor, Pawn, BoardNode, Position } from '@/lib/types';
import { generateBoard } from '@/lib/game-logic/board';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const PLAYER_COLORS_LIST: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];

function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function createRoom(playerName: string, settings: GameSettings): Promise<string> {
    const roomsCol = collection(db, 'games');
    let roomCode = '';
    let roomExists = true;

    while (roomExists) {
        roomCode = generateRoomCode();
        const roomDoc = doc(db, 'games', roomCode);
        const roomSnapshot = await getDoc(roomDoc);
        roomExists = roomSnapshot.exists();
    }
    
    const hostPlayer: Player = {
        id: 'host-' + Date.now(), // Simplified ID for now
        name: playerName,
        isBot: false,
        color: 'red', // Will be assigned on game start
        playerIndex: 0
    };

    const { board, verbodenBarricades } = generateBoard();

    const initialGameState: GameState = {
        id: roomCode,
        players: [hostPlayer],
        pawns: [],
        barricades: [],
        board,
        verbodenBarricades,
        settings,
        status: 'lobby',
        hostId: hostPlayer.id,
        currentPlayerIndex: 0,
        diceRoll: 0,
        lastRolls: {},
        opgepakteBarricadePos: null,
        history: [],
        createdAt: serverTimestamp(),
    };

    await setDoc(doc(roomsCol, roomCode), initialGameState);
    return roomCode;
}


export async function joinRoom(playerName: string, roomCode: string): Promise<{ success: boolean; error?: string; roomCode?: string }> {
    const roomRef = doc(db, 'games', roomCode);

    try {
        const result = await runTransaction(db, async (transaction) => {
            const roomSnapshot = await transaction.get(roomRef);

            if (!roomSnapshot.exists()) {
                return { success: false, error: 'Room not found.' };
            }

            const game = roomSnapshot.data() as GameState;

            if (game.status !== 'lobby') {
                return { success: false, error: 'Game has already started.' };
            }

            if (game.players.length >= game.settings.totalPlayers) {
                return { success: false, error: 'Room is full.' };
            }
            
            const newPlayer: Player = {
                id: 'player-' + Date.now(),
                name: playerName,
                isBot: false,
                color: 'red', // Assigned on start
                playerIndex: game.players.length
            };

            const newPlayers = [...game.players, newPlayer];

            transaction.update(roomRef, { players: newPlayers });

            return { success: true, roomCode };
        });
        revalidatePath(`/game/${roomCode}`);
        return result;

    } catch (e) {
        console.error("Transaction failed: ", e);
        return { success: false, error: 'An error occurred while joining the room.' };
    }
}
