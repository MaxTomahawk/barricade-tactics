'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/app/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GameSettings } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HostGameDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  playerName: string;
}

export default function HostGameDialog({ isOpen, setIsOpen, playerName }: HostGameDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(2);
  const [botCount, setBotCount] = useState(1);
  const [settings, setSettings] = useState<GameSettings>({
    totalPlayers: 2,
    botCount: 1,
    diceAnimation: 'animated',
    captureBonus: false,
    winCondition: 1,
  });

  const handleTotalPlayersChange = (value: number) => {
    setTotalPlayers(value);
    setSettings(s => ({ ...s, totalPlayers: value }));
    if (botCount >= value) {
      const newBotCount = value - 1;
      setBotCount(newBotCount);
      setSettings(s => ({ ...s, botCount: newBotCount }));
    }
  };

  const handleBotCountChange = (value: number) => {
    setBotCount(value);
    setSettings(s => ({ ...s, botCount: value }));
  };

  const handleHostGame = async () => {
    setIsLoading(true);
    try {
      const { roomCode, error } = await createRoom(playerName, settings);
      if (roomCode) {
        router.push(`/game/${roomCode}`);
      } else {
        toast({
          title: "Error Creating Room",
          description: error || "An unknown error occurred.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      console.error("Error hosting game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Host New Game</DialogTitle>
          <DialogDescription>Configure the rules for your match.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label>Total Players: {settings.totalPlayers}</Label>
            <Slider
              value={[settings.totalPlayers]}
              onValueChange={(val) => handleTotalPlayersChange(val[0])}
              min={2}
              max={4}
              step={1}
            />
          </div>
          <div className="grid gap-2">
            <Label>Number of Bots: {settings.botCount}</Label>
            <Slider
              value={[settings.botCount]}
              onValueChange={(val) => handleBotCountChange(val[0])}
              min={0}
              max={totalPlayers - 1}
              step={1}
            />
          </div>
          <div className="grid gap-2">
            <Label>Pawns to Win: {settings.winCondition}</Label>
            <Slider
              value={[settings.winCondition]}
              onValueChange={(val) => setSettings(s => ({ ...s, winCondition: val[0] }))}
              min={1}
              max={4}
              step={1}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Capture Bonus (Extra Roll)</Label>
            <Switch
              checked={settings.captureBonus}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, captureBonus: checked }))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Dice Roll Animation</Label>
            <Select
              value={settings.diceAnimation}
              onValueChange={(value: GameSettings['diceAnimation']) => setSettings(s => ({ ...s, diceAnimation: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select animation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="animated">Animated for everyone</SelectItem>
                <SelectItem value="instant_bot">Instant for Bots only</SelectItem>
                <SelectItem value="instant_all">Instant for everyone</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleHostGame} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
