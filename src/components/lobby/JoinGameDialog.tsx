'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { normalizeRoomId } from '@/lib/webrtc-room';

interface JoinGameDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  playerName: string;
  initialGameId?: string;
}

export default function JoinGameDialog({ isOpen, setIsOpen, playerName, initialGameId }: JoinGameDialogProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [gameId, setGameId] = useState(initialGameId || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialGameId) setGameId(initialGameId);
  }, [initialGameId]);

  const handleJoinGame = async () => {
    const roomId = normalizeRoomId(gameId);
    const trimmedPlayerName = playerName.trim();

    if (!roomId) {
      showError('Please enter a room code.');
      return;
    }

    if (!trimmedPlayerName) {
      showError('Please enter a player name first.');
      return;
    }

    setIsLoading(true);
    localStorage.setItem('playerName', trimmedPlayerName);
    localStorage.setItem(
      'barricadeSession',
      JSON.stringify({
        role: 'guest',
        roomId,
        playerName: trimmedPlayerName,
      })
    );

    setIsOpen(false);
    setIsLoading(false);
    router.push(`/game?roomId=${roomId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Game</DialogTitle>
          <DialogDescription>Enter the room code to join a game.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="game-id">Room Code</Label>
            <Input
              id="game-id"
              placeholder="Enter Room Code"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="text-lg"
              maxLength={10}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleJoinGame} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Join
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
