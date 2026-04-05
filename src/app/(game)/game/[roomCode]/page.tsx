'use client';

// This is a placeholder for the game room.
// The full implementation will be done in the next steps.

export default function GameRoomPage({ params }: { params: { roomCode: string } }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Joining Room...</h1>
        <p className="text-muted-foreground">Room Code: {params.roomCode}</p>
      </div>
    </div>
  );
}
