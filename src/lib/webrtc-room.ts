'use client';

import type { DataConnection } from 'peerjs';
import Peer from 'peerjs';
import type { BoardState, Position, GameSettings } from './types';
import { initializeBoardState } from './game-logic/engine';

export type SlotType = 'host' | 'player' | 'open' | 'bot' | 'closed';

export type PlayerColorHex = string;

export type PlayerSlot = {
  id: number;
  type: SlotType;
  playerName?: string;
  connectionId?: string;
  color: PlayerColorHex;
};

export type GameState = {
  id: string;
  gameName: string;
  slots: [PlayerSlot, PlayerSlot, PlayerSlot, PlayerSlot];
  settings: GameSettings;
  boardState?: BoardState;
};

export type ClientMessage =
  | { type: 'joinRequest'; playerName: string }
  | { type: 'gameStateUpdated'; game: GameState }
  | { type: 'joinRejected'; reason: string }
  | { type: 'requestStartGame' }
  | { type: 'requestRollDice' }
  | { type: 'requestMovePawn'; pawnIdx: number; target: Position }
  | { type: 'requestPlaceBarricade'; target: Position }
  | { type: 'requestNoMoves' }
  | { type: 'requestChangeColor'; slotId: number; color: string };

export type HostSession = {
  peer: Peer;
  game: GameState;
  updateSlot: (index: number, type: SlotType, pName?: string, color?: string) => void;
  updateSettings: (newSettings: Partial<GameSettings>) => void;
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
  initialGame?: GameState;
  onGameStateUpdated: (game: GameState) => void;
  onError: (message: string) => void;
  onStatusUpdated?: (status: string) => void;
}): HostSession {
  const defaultSettings: GameSettings = {
    captureBonus: false,
    winCondition: 1,
    diceMode: 'animated',
    protectBottomRow: true,
    extraRollAfterBarricade: false,
  };

  const game: GameState = args.initialGame || {
    id: sanitizeRoomId(args.roomId),
    gameName: args.gameName,
    slots: [
      { id: 0, type: 'host', playerName: args.hostName, connectionId: '', color: '#ef4444' }, // Red
      { id: 1, type: 'open', color: '#22c55e' }, // Green
      { id: 2, type: 'open', color: '#3b82f6' }, // Blue
      { id: 3, type: 'open', color: '#eab308' }, // Yellow
    ],
    settings: defaultSettings,
    boardState: undefined,
  };

  args.onStatusUpdated?.('Contacting PeerJS Server...');
  const peer = new Peer(game.id);
  const connections = new Map<string, DataConnection>();

  let hostOpenTimeout = setTimeout(() => {
    if (!peer.open && !peer.disconnected) {
      args.onError('Failed to start as Host. PeerJS servers might be rate-limiting you.');
      peer.destroy();
    }
  }, 6000);

  const updateSettings = (newSettings: Partial<GameSettings>) => {
    game.settings = { ...game.settings, ...newSettings };
    broadcast();
  };

  const broadcast = () => {
    const publicGame: GameState = {
      id: game.id,
      gameName: game.gameName,
      slots: game.slots.map(s => ({ ...s })) as [PlayerSlot, PlayerSlot, PlayerSlot, PlayerSlot],
      settings: game.settings,
      boardState: game.boardState ? structuredClone(game.boardState) : undefined
    };
    args.onGameStateUpdated(publicGame);
    for (const conn of connections.values()) {
      if (conn.open) {
        conn.send({ type: 'gameStateUpdated', game: publicGame });
      }
    }
  };

  const removePlayerForConnection = (peerId: string) => {
    let changed = false;
    for (const slot of game.slots) {
      if (slot.connectionId === peerId) {
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
       // Called by Host locally
       const currBeurt = game.boardState?.beurt ?? -1;
       const currSlot = game.slots.find(s => s.id === currBeurt);
       
       // Server authority: if it's a mandatory transition or a bot turn, 
       // the host machine is acting on behalf of the current player.
       if (action.type === 'ROLL_END' || action.type === 'GEEN_ZETTEN_ACK' || (currSlot && currSlot.type === 'bot')) {
           initiatorIndex = currBeurt;
       } else {
           initiatorIndex = 0; // Host player (index 0) acting manually
       }
    } else {
       // Call from a guest connection
       const slot = game.slots.find(s => s.connectionId === connectionId); // connectionId here is actually the peerId passed from data handler
       if (slot) initiatorIndex = slot.id;
    }
    
    // Total players? The active valid ones:
    const activeValid = game.slots.filter(s => s.type === 'host' || s.type === 'player' || s.type === 'bot').map(s => s.id);
    const result = processGameAction(game.boardState, initiatorIndex, game.slots.length, action);
    if (result) broadcast();
  };

  const updateSlot = (index: number, type: SlotType, pName?: string, color?: string) => {
    if (index < 0 || index > 3) return; 
    const slot = game.slots[index];
    
    if (slot.type === 'player' && slot.connectionId && type !== 'player') {
      const conn = connections.get(slot.connectionId);
      if (conn) {
        conn.send({ type: 'joinRejected', reason: 'You were removed from the room.' });
        setTimeout(() => conn.close(), 500);
      }
    }

    slot.type = type;
    if (pName !== undefined) slot.playerName = pName;
    if (color !== undefined) slot.color = color;
    if (type === 'open' || type === 'bot' || type === 'closed') {
       slot.connectionId = undefined;
    }
    broadcast();
  };

  peer.on('open', () => {
    clearTimeout(hostOpenTimeout);
    args.onStatusUpdated?.('Peer Server Confirmed! Waiting for guests...');
    broadcast();
  });

  peer.on('connection', (conn) => {
    connections.set(conn.peer, conn);

    conn.on('data', (raw) => {
      const msg = raw as ClientMessage;
      if (msg?.type === 'joinRequest') {
        const playerName = msg.playerName.trim();
        if (!playerName) return;

        const openSlot = game.slots.find(s => s.type === 'open');
        if (openSlot) {
          openSlot.type = 'player';
          openSlot.playerName = playerName;
          openSlot.connectionId = conn.peer;
          broadcast();
        } else {
          conn.send({ type: 'joinRejected', reason: 'Room is full or no open slots available.' });
          setTimeout(() => conn.close(), 500);
        }
      } else {
        if (msg.type.startsWith('request')) {
          // parse request intent manually for security later, map to action
          let engineAction: any;
          if (msg.type === 'requestRollDice') engineAction = { type: 'ROLL_START' };
          if (msg.type === 'requestMovePawn') engineAction = { type: 'MOVE', pawnIdx: msg.pawnIdx, target: msg.target };
          if (msg.type === 'requestPlaceBarricade') engineAction = { type: 'BARRICADE', target: msg.target };
          if (msg.type === 'requestNoMoves') engineAction = { type: 'GEEN_ZETTEN_ACK' };
          
          if (msg.type === 'requestChangeColor') {
            const requesterSlot = game.slots.find(s => s.connectionId === conn.peer);
            if (requesterSlot && requesterSlot.id === msg.slotId) {
                updateSlot(msg.slotId, requesterSlot.type, requesterSlot.playerName, msg.color);
            }
          }

          if (engineAction) processAction(engineAction, conn.peer);
        }
      }
    });

    conn.on('close', () => {
      connections.delete(conn.peer);
      removePlayerForConnection(conn.peer);
    });

    conn.on('error', () => {
      connections.delete(conn.peer);
      removePlayerForConnection(conn.peer);
    });
  });

  peer.on('error', (err) => {
    args.onError(err.message || 'Host connection error');
  });

  const startGame = () => {
    if (game.boardState) return; // Already started
    const seed = initializeBoardState(game.slots, game.settings);
    game.boardState = seed;
    broadcast();
  };

  return {
    peer,
    game,
    updateSlot,
    updateSettings,
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
  }, 6000);

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
      args.onError("[peer-unavailable] Host room doesn't exist.");
    } else if (err.type === 'unavailable-id') {
      args.onError("[id-taken] PeerJS ID taken.");
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
