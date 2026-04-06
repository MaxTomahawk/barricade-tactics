'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Bot } from 'lucide-react';
import HostGameDialog from '@/components/lobby/HostGameDialog';
import JoinGameDialog from '@/components/lobby/JoinGameDialog';

export default function Home() {
  const [name, setName] = useState('');
  const [isHostDialogOpen, setIsHostDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    localStorage.setItem('playerName', e.target.value);
  };
  
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setName(savedName);
    }
  }, []);

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
        </CardContent>
      </Card>
      
      <p className="text-sm text-muted-foreground mt-8 flex items-center gap-2">
        <Bot size={16} /> AI opponents and strategy advisor powered by Google AI.
      </p>

      <HostGameDialog
        isOpen={isHostDialogOpen}
        setIsOpen={setIsHostDialogOpen}
        playerName={name}
      />
      <JoinGameDialog
        isOpen={isJoinDialogOpen}
        setIsOpen={setIsJoinDialogOpen}
        playerName={name}
      />
    </main>
  );
}
