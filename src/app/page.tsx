'use client';

import { useState, useEffect, Suspense } from 'react';
import { ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import HostGameDialog from '@/components/lobby/HostGameDialog';
import JoinGameDialog from '@/components/lobby/JoinGameDialog';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinRoomId = searchParams.get('joinRoom');
  const [name, setName] = useState('');
  const [isHostDialogOpen, setIsHostDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    localStorage.setItem('playerName', e.target.value);
  };
  
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setName(savedName);
    }
    
    const lastCode = localStorage.getItem('lastRoomCode');
    if (lastCode) {
      setLastRoomCode(lastCode);
    }

    if (joinRoomId) {
      setIsJoinDialogOpen(true);
      // Clean up URL to prevent stuck dialogs on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('joinRoom');
      window.history.replaceState({}, '', url.toString());
    }
  }, [joinRoomId]);

  const isNameValid = name.trim().length > 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-primary tracking-tighter">Barricade Tactics</h1>
        <p className="text-muted-foreground mt-2 text-lg">The classic board game, reimagined for the web.</p>
      </div>

      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome, Player</CardTitle>
          <CardDescription>Enter your name to begin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              placeholder="e.g., PlayerOne"
              value={name}
              onChange={handleNameChange}
              className="text-lg"
              maxLength={20}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setIsHostDialogOpen(true)}
              disabled={!isNameValid}
            >
              Host Game
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => setIsJoinDialogOpen(true)}
              disabled={!isNameValid}
            >
              Join Game
            </Button>
          </div>
        
        <div className="pt-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 group"
            disabled={!isNameValid}
            onClick={() => {
              const sessionData = {
                role: 'matchmaking',
                playerName: name.trim(),
                roomId: 'MATCHMAKING'
              };
              localStorage.setItem('barricadeSession', JSON.stringify(sessionData));
              localStorage.setItem('barricade_session_MATCHMAKING', JSON.stringify(sessionData));
              router.push('/game?roomId=MATCHMAKING');
            }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Matchmaking (Quick Play)
              <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </span>
          </Button>
        </div>
          
          {lastRoomCode && isNameValid && (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Button 
                variant="outline" 
                className="w-full border-dashed border-primary/40 hover:border-primary/80 hover:bg-primary/5 group"
                onClick={() => {
                   // Redirect to game with the last room code (relative for base path support)
                   window.location.href = `game?roomId=${lastRoomCode}`;
                }}
              >
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Rejoin Last Game</span>
                  <span className="text-sm font-mono font-bold">{lastRoomCode}</span>
                </div>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <HostGameDialog
        isOpen={isHostDialogOpen}
        setIsOpen={setIsHostDialogOpen}
        playerName={name}
      />
      <JoinGameDialog
        isOpen={isJoinDialogOpen}
        setIsOpen={setIsJoinDialogOpen}
        playerName={name}
        initialGameId={joinRoomId || undefined}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
