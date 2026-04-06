'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface JoinGameDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  playerName: string;
}

export default function JoinGameDialog({ isOpen, setIsOpen, playerName }: JoinGameDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [gameId, setGameId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinGame = async () => {
    if (!gameId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a game ID.",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/join-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId, playerName }),
      });

      if (response.ok) {
        router.push(`/game/${gameId}`);
      } else {
        const { error } = await response.json();
        toast({
          title: "Failed to Join",
          description: error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error joining game:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Game</DialogTitle>
          <DialogDescription>Enter the game ID to join a friend's game.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="game-id">Game ID</Label>
            <Input
              id="game-id"
              placeholder="Enter Game ID"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="text-lg"
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
