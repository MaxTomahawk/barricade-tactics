'use client';

import type { DataConnection } from 'peerjs';
import Peer from 'peerjs';
import type { BoardState, Position } from './types';
import { initializeBoardState } from './game-logic/engine';

export type SlotType = 'host' | 'player' | 'open' | 'bot' | 'closed';

export type PlayerSlot = {
  id: number;
  type: SlotType;
  playerName?: string;
  connectionId?: string;
};

export type GameState = {
  id: string;
  gameName: string;
  slots: [PlayerSlot, PlayerSlot, PlayerSlot, PlayerSlot];
  boardState?: BoardState;
};

export type ClientMessage =
  | { type: 'joinRequest'; playerName: string }
  | { type: 'gameStateUpdated'; game: GameState }
  | { type: 'joinRejected'; reason: string }
  | { type: 'requestStartGame' }
  | { type: 'requestRollDice' }
  | { type: 'requestMovePawn'; pawnIdx: number; target: Position }
  | { type: 'requestPlaceBarricade'; target: Position };

export type HostSession = {
  peer: Peer;
  game: GameState;
  updateSlot: (index: number, type: SlotType, pName?: string) => void;
  broadcast: () => void;
  processAction: (action: any, connectionId?: string) => void;
  startGame: () => void;
  shutdown: () => void;
};

export type GuestSession = {
  peer: Peer;
  sendToHost: (msg: ClientMessage) => void;
  shutdown: () => void;
};

function sanitizeRoomId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function randomId(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function createRoomId(): string {
  return randomId();
}

export function normalizeRoomId(value: string): string {
  return sanitizeRoomId(value);
}

import { processGameAction } from './game-logic/engine';

export function startHostSession(args: {
  roomId: string;
  gameName: string;
  hostName: string;
  onGameStateUpdated: (game: GameState) => void;
  onError: (message: string) => void;
  onStatusUpdated?: (status: string) => void;
}): HostSession {
  const game: GameState = {
    id: sanitizeRoomId(args.roomId),
    gameName: args.gameName.trim() || 'Untitled Room',
    slots: [
      { id: 0, type: 'host', playerName: args.hostName.trim() },
      { id: 1, type: 'open' },
      { id: 2, type: 'open' },
      { id: 3, type: 'open' },
    ],
  };

  args.onStatusUpdated?.('Contacting PeerJS Server...');
  const peer = new Peer(game.id);
  const connections = new Map<string, DataConnection>();

  let hostOpenTimeout = setTimeout(() => {
    if (!peer.open && !peer.disconnected) {
      args.onError('Failed to start as Host. PeerJS servers might be rate-limiting you.');
      peer.destroy();
    }
  }, 10000);

  const broadcast = () => {
    const publicGame: GameState = {
      id: game.id,
      gameName: game.gameName,
      slots: game.slots.map(s => ({ ...s })) as [PlayerSlot, PlayerSlot, PlayerSlot, PlayerSlot],
      boardState: game.boardState // Passes exact board state efficiently through channels
    };
    args.onGameStateUpdated(publicGame);
    for (const conn of connections.values()) {
      if (conn.open) {
        conn.send({ type: 'gameStateUpdated', game: publicGame });
      }
    }
  };

  const removePlayerForConnection = (connectionId: string) => {
    let changed = false;
    for (const slot of game.slots) {
      if (slot.connectionId === connectionId) {
        slot.type = 'open';
        slot.playerName = undefined;
        slot.connectionId = undefined;
        changed = true;
      }
    }
    if (changed) broadcast();
  };

  const processAction = (action: any, connectionId?: string) => {
    if (!game.boardState) return;
    
    let initiatorIndex = -1;
    if (!connectionId) {
       // Host local invocation
       initiatorIndex = 0;
    } else {
       // Find player
       const slot = game.slots.find(s => s.connectionId === connectionId);
       if (slot) initiatorIndex = slot.id;
    }
    
    // Total players? The active valid ones:
    const activeValid = game.slots.filter(s => s.type === 'host' || s.type === 'player' || s.type === 'bot').map(s => s.id);
    const result = processGameAction(game.boardState, initiatorIndex, game.slots.length, action);
    if (result) broadcast();
  };

  const updateSlot = (index: number, type: SlotType, pName?: string) => {
    if (index < 1 || index > 3) return; 
    const slot = game.slots[index];
    
    if (slot.type === 'player' && slot.connectionId && type !== 'player') {
      const conn = connections.get(slot.connectionId);
      if (conn) {
        conn.send({ type: 'joinRejected', reason: 'You were removed from the room.' });
        setTimeout(() => conn.close(), 500);
      }
    }

    slot.type = type;
    slot.playerName = pName;
    slot.connectionId = undefined;
    broadcast();
  };

  peer.on('open', () => {
    clearTimeout(hostOpenTimeout);
    args.onStatusUpdated?.('Peer Server Confirmed! Waiting for guests...');
    broadcast();
  });

  peer.on('connection', (conn) => {
    connections.set(conn.connectionId, conn);

    conn.on('data', (raw) => {
      const msg = raw as ClientMessage;
      if (msg?.type === 'joinRequest') {
        const playerName = msg.playerName.trim();
        if (!playerName) return;

        const openSlot = game.slots.find(s => s.type === 'open');
        if (openSlot) {
          openSlot.type = 'player';
          openSlot.playerName = playerName;
          openSlot.connectionId = conn.connectionId;
          broadcast();
        } else {
          conn.send({ type: 'joinRejected', reason: 'Room is full or no open slots available.' });
          setTimeout(() => conn.close(), 500);
        }
      } else {
        if (msg.type.startsWith('request')) {
          // parse request intent manually for security later, map to action
          let engineAction;
          if (msg.type === 'requestRollDice') engineAction = { type: 'ROLL_START' };
          if (msg.type === 'requestMovePawn') engineAction = { type: 'MOVE', pawnIdx: (msg as any).pawnIdx, target: (msg as any).target };
          if (msg.type === 'requestPlaceBarricade') engineAction = { type: 'BARRICADE', target: (msg as any).target };
          if (engineAction) processAction(engineAction, conn.connectionId);
        }
      }
    });

    conn.on('close', () => {
      connections.delete(conn.connectionId);
      removePlayerForConnection(conn.connectionId);
    });

    conn.on('error', () => {
      connections.delete(conn.connectionId);
      removePlayerForConnection(conn.connectionId);
    });
  });

  peer.on('error', (err) => {
    args.onError(err.message || 'Host connection error');
  });

  const startGame = () => {
    if (game.boardState) return; // Already started
    const seed = initializeBoardState(game.slots);
    game.boardState = seed;
    broadcast();
  };

  return {
    peer,
    game,
    updateSlot,
    broadcast,
    processAction,
    startGame,
    shutdown: () => {
      for (const conn of connections.values()) {
        conn.close();
      }
      peer.destroy();
    },
  };
}

export function startGuestSession(args: {
  roomId: string;
  playerName: string;
  onGameStateUpdated: (game: GameState) => void;
  onError: (message: string) => void;
  onStatusUpdated?: (status: string) => void;
}): GuestSession {
  args.onStatusUpdated?.('Contacting PeerJS Server...');
  const peer = new Peer();
  let peerOpenTimeout = setTimeout(() => {
    if (!peer.open && !peer.disconnected) {
      args.onError('Failed to connect to the Peer mapping server.');
      peer.destroy();
    }
  }, 10000);

  let connectionTimeout: ReturnType<typeof setTimeout>;
  let stateTimeout: ReturnType<typeof setTimeout>;
  let hostConnection: DataConnection | null = null;

  peer.on('open', () => {
    clearTimeout(peerOpenTimeout);
    args.onStatusUpdated?.('Handshaking with Host...');
    
    // Now that guest peer is open, we can safely connect to host
    hostConnection = peer.connect(sanitizeRoomId(args.roomId), {
      reliable: true,
    });

    connectionTimeout = setTimeout(() => {
      if (hostConnection && !hostConnection.open) {
        args.onError('Connection to host timed out. Room code might be wrong or host is offline.');
        peer.destroy();
      }
    }, 10000);

    hostConnection.on('open', () => {
      clearTimeout(connectionTimeout);
      args.onStatusUpdated?.('Waiting for game data...');
      
      stateTimeout = setTimeout(() => {
        args.onError('Host accepted connection but never sent game data. Host might be frozen.');
        if (hostConnection) hostConnection.close();
      }, 10000);

      setTimeout(() => {
        const joinMsg: ClientMessage = {
          type: 'joinRequest',
          playerName: args.playerName.trim(),
        };
        if (hostConnection) hostConnection.send(joinMsg);
      }, 200);
    });

    hostConnection.on('data', (raw) => {
      const msg = raw as ClientMessage;
      if (msg?.type === 'gameStateUpdated') {
        clearTimeout(stateTimeout); 
        args.onGameStateUpdated(msg.game);
      } else if (msg?.type === 'joinRejected') {
        args.onError(msg.reason || 'Failed to join room.');
        if (hostConnection) hostConnection.close();
      }
    });

    hostConnection.on('error', (err) => {
      clearTimeout(connectionTimeout);
      args.onError(err.message || 'Failed to connect to host');
    });

    hostConnection.on('close', () => {
      clearTimeout(connectionTimeout);
      args.onError('Host disconnected or removed you.');
    });
  });

  peer.on('error', (err: any) => {
    clearTimeout(peerOpenTimeout);
    clearTimeout(connectionTimeout);
    if (err.type === 'peer-unavailable') {
      args.onError("Host room doesn't exist. Please check the code.");
    } else if (err.type === 'unavailable-id') {
      args.onError("PeerJS ID taken. Avoid refreshing rapidly.");
    } else {
      args.onError(err.message || 'Peer connection error');
    }
  });

  return {
    peer,
    sendToHost: (msg: ClientMessage) => {
      if (hostConnection && hostConnection.open) hostConnection.send(msg);
    },
    shutdown: () => {
      clearTimeout(peerOpenTimeout);
      clearTimeout(connectionTimeout);
      clearTimeout(stateTimeout);
      if (hostConnection) hostConnection.close();
      peer.destroy();
    },
  };
}
