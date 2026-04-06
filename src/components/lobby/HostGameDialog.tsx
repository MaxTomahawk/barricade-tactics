'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createRoomId } from '@/lib/webrtc-room';

interface HostGameDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  playerName: string;
}

export default function HostGameDialog({ isOpen, setIsOpen, playerName }: HostGameDialogProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [gameName, setGameName] = useState('');

  const handleHostGame = async () => {
    const trimmedGameName = gameName.trim();
    const trimmedPlayerName = playerName.trim();

    if (!trimmedGameName || !trimmedPlayerName) {
      showError('Please provide both game name and player name.');
      return;
    }

    setIsLoading(true);
    const roomId = createRoomId();

    localStorage.setItem('playerName', trimmedPlayerName);
    localStorage.setItem(
      'barricadeSession',
      JSON.stringify({
        role: 'host',
        roomId,
        gameName: trimmedGameName,
        playerName: trimmedPlayerName,
      })
    );

    setIsOpen(false);
    setIsLoading(false);
    router.push(`/game?roomId=${roomId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Host New Game</DialogTitle>
          <DialogDescription>Enter a name for your game room.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="game-name">Game Name</Label>
              <Input
                id="game-name"
                placeholder="e.g., My Awesome Game"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="text-lg"
                maxLength={30}
              />
            </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleHostGame} disabled={isLoading || !gameName.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
