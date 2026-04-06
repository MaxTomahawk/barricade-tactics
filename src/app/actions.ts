'use server';

import { dbAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
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

export async function createRoom(playerName: string, settings: GameSettings): Promise<{ roomCode: string | null; error: string | null; }> {
    try {
        console.log("Attempting to create room...");
        const roomsCol = dbAdmin.collection('games');
        let roomCode = '';
        let roomExists = true;
        let attempts = 0;

        while (roomExists && attempts < 10) {
            attempts++;
            roomCode = generateRoomCode();
            console.log(`Generated room code ${roomCode}, attempt ${attempts}`);
            const roomDoc = roomsCol.doc(roomCode);
            console.log("Getting room document snapshot...");
            const roomSnapshot = await roomDoc.get();
            console.log("Snapshot received. Exists:", roomSnapshot.exists);
            roomExists = roomSnapshot.exists;
        }

        if (roomExists) {
            throw new Error("Failed to generate a unique room code after 10 attempts.");
        }

        console.log(`Unique room code found: ${roomCode}`);

        const hostPlayer: Player = {
            id: 'host-' + Date.now(),
            name: playerName,
            isBot: false,
            color: 'red',
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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        console.log("Setting initial game state...");
        await roomsCol.doc(roomCode).set(initialGameState);
        console.log("Room created successfully.");

        return { roomCode, error: null };
    } catch (error: any) {
        console.error("Error creating room:", error);
        return { roomCode: null, error: error.message };
    }
}


export async function joinRoom(playerName: string, roomCode: string): Promise<{ success: boolean; error?: string; roomCode?: string }> {
    const roomRef = dbAdmin.collection('games').doc(roomCode);

    try {
        const result = await dbAdmin.runTransaction(async (transaction) => {
            const roomSnapshot = await transaction.get(roomRef);

            if (!roomSnapshot.exists) {
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
