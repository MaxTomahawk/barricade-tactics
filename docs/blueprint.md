# **App Name**: Barricade Tactics

## Core Features:

- Dynamic Game Board & Responsive UI: Render the game board with all pawns, barricades, and finish nodes. Provide clear visual feedback for selected pieces, valid moves, and highlight dice rolls. Ensure the UI is fully responsive and optimized for both desktop (mouse) and mobile (touch) input.
- Core Game Logic Engine: Implement all Barricade game rules, including dice rolling, exact pawn movement along paths, barricade placement and removal upon landing, capturing opponent pawns, and determining win conditions (reaching finish node with an exact roll).
- Multiplayer Lobby & Host Settings: Enable users to create (host) new game rooms or join existing ones via a room code. Hosts can configure game settings: total players (2-4), number of bots, dice roll animation preference, capture bonus toggle, and win condition (number of pawns to finish).
- Real-time Game State Synchronization: Leverage Firestore for seamless, real-time synchronization of the entire game state, including player turns, pawn and barricade positions, dice rolls, and lobby updates, across all connected clients.
- Heuristic AI Opponent: Integrate non-player character (bot) behavior, using move-scoring heuristics based on the Pygame reference to make strategic decisions such as advancing own pawns and blocking opponents.
- AI Game Strategy Advisor: A generative AI tool that analyzes past game turns or current board state to offer personalized strategic tips and insights, helping players improve their gameplay.

## Style Guidelines:

- The application features a sleek dark-mode aesthetic. Primary interactions and highlights use a deep sapphire blue (#2676D9). The background consists of a muted dark charcoal (#21262B) to maintain focus on the game board. An elegant lavender accent (#BE99E0) is used for secondary interactive elements or specific notifications.
- The font 'Inter' (sans-serif) is recommended for all text, providing a modern, neutral, and highly readable appearance across various screen sizes.
- Utilize minimalist and clear icons for game actions, navigation, and settings, ensuring easy recognition and generous touch/click targets for optimal usability on all devices.
- Implement a responsive, adaptive layout that seamlessly adjusts the game board and UI elements for optimal viewing and interaction on both large desktop screens and smaller mobile devices. Key interactive elements feature generous sizing for effortless touch input.
- Pawns animate with a parabolic jump arc when moving between nodes. Barricades slide smoothly to their new positions. Valid target nodes are subtly highlighted, and dice rolls are accompanied by fluid, optional animations, providing clear visual feedback without disrupting gameplay.