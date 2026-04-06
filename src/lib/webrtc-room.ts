'use client';

import type { DataConnection } from 'peerjs';
import Peer from 'peerjs';

export type GameState = {
  id: string;
  gameName: string;
  players: string[];
};

type ClientMessage =
  | { type: 'joinRequest'; playerName: string }
  | { type: 'gameStateUpdated'; game: GameState };

export type HostSession = {
  peer: Peer;
  game: GameState;
  shutdown: () => void;
};

export type GuestSession = {
  peer: Peer;
  hostConnection: DataConnection;
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

export function startHostSession(args: {
  roomId: string;
  gameName: string;
  hostName: string;
  onGameStateUpdated: (game: GameState) => void;
  onError: (message: string) => void;
}): HostSession {
  const game: GameState = {
    id: sanitizeRoomId(args.roomId),
    gameName: args.gameName.trim() || 'Untitled Room',
    players: [args.hostName.trim()],
  };

  const peer = new Peer(game.id);
  const joinedByConnection = new Map<string, string>();
  const connections = new Map<string, DataConnection>();

  const broadcast = () => {
    args.onGameStateUpdated({ ...game, players: [...game.players] });
    for (const conn of connections.values()) {
      if (conn.open) {
        const msg: ClientMessage = { type: 'gameStateUpdated', game };
        conn.send(msg);
      }
    }
  };

  const removePlayerForConnection = (connectionId: string) => {
    const playerName = joinedByConnection.get(connectionId);
    if (!playerName) return;
    joinedByConnection.delete(connectionId);
    game.players = game.players.filter((p) => p !== playerName);
    broadcast();
  };

  peer.on('open', () => {
    broadcast();
  });

  peer.on('connection', (conn) => {
    connections.set(conn.connectionId, conn);

    conn.on('data', (raw) => {
      const msg = raw as ClientMessage;
      if (msg?.type !== 'joinRequest') return;
      const playerName = msg.playerName.trim();
      if (!playerName) return;
      joinedByConnection.set(conn.connectionId, playerName);
      if (!game.players.includes(playerName)) {
        game.players.push(playerName);
      }
      broadcast();
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

  return {
    peer,
    game,
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
}): GuestSession {
  const peer = new Peer();
  const hostConnection = peer.connect(sanitizeRoomId(args.roomId), {
    reliable: true,
  });

  hostConnection.on('open', () => {
    const joinMsg: ClientMessage = {
      type: 'joinRequest',
      playerName: args.playerName.trim(),
    };
    hostConnection.send(joinMsg);
  });

  hostConnection.on('data', (raw) => {
    const msg = raw as ClientMessage;
    if (msg?.type === 'gameStateUpdated') {
      args.onGameStateUpdated(msg.game);
    }
  });

  hostConnection.on('error', (err) => {
    args.onError(err.message || 'Failed to connect to host');
  });

  hostConnection.on('close', () => {
    args.onError('Host disconnected.');
  });

  peer.on('error', (err) => {
    args.onError(err.message || 'Peer connection error');
  });

  return {
    peer,
    hostConnection,
    shutdown: () => {
      hostConnection.close();
      peer.destroy();
    },
  };
}
