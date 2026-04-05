'use server';
/**
 * @fileOverview A Genkit flow for an AI game strategy advisor for the game Barricade.
 * 
 * - aiGameStrategyAdvisor - A function that provides personalized strategic tips and insights.
 * - AiGameStrategyAdvisorInput - The input type for the aiGameStrategyAdvisor function.
 * - AiGameStrategyAdvisorOutput - The return type for the aiGameStrategyAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Represents the input for the AI game strategy advisor, containing the current board state,
 * a summary of past turns, and the ID of the player requesting advice.
 */
const AiGameStrategyAdvisorInputSchema = z.object({
  boardState: z.string().describe('A detailed JSON string representation of the current Barricade game board state, including node connections, pawn positions, barricade locations, current player, and dice roll.'),
  pastTurnsSummary: z.string().optional().describe('A summary string of recent game turns or key events leading to the current state.'),
  currentPlayerId: z.number().describe('The ID of the player requesting strategy advice (0, 1, 2, or 3).'),
});
export type AiGameStrategyAdvisorInput = z.infer<typeof AiGameStrategyAdvisorInputSchema>;

/**
 * Represents the output from the AI game strategy advisor, containing strategic tips
 * and an optional detailed analysis.
 */
const AiGameStrategyAdvisorOutputSchema = z.object({
  strategyAdvice: z.string().describe('Concise and actionable strategic tips and insights for the current player.'),
  analysis: z.string().optional().describe('A more detailed explanation and analysis supporting the given strategy advice.'),
});
export type AiGameStrategyAdvisorOutput = z.infer<typeof AiGameStrategyAdvisorOutputSchema>;

/**
 * Provides personalized strategic tips and insights for a Barricade player based on the current game state.
 * @param input The current game board state, past turns summary, and current player ID.
 * @returns An object containing strategic advice and an optional analysis.
 */
export async function aiGameStrategyAdvisor(input: AiGameStrategyAdvisorInput): Promise<AiGameStrategyAdvisorOutput> {
  return aiGameStrategyAdvisorFlow(input);
}

/**
 * Defines the Genkit prompt for the Barricade game strategy advisor.
 * This prompt instructs the AI to act as an expert strategist and provide optimal moves and tactics.
 */
const strategyAdvisorPrompt = ai.definePrompt({
  name: 'barricadeStrategyAdvisorPrompt',
  input: {schema: AiGameStrategyAdvisorInputSchema},
  output: {schema: AiGameStrategyAdvisorOutputSchema},
  prompt: `You are an expert Barricade (Malefiz) game strategist. Your goal is to provide personalized and optimal strategic advice to Player {{currentPlayerId}} based on the current board state and recent game history.

Analyze the following game information:

Current Board State (JSON):
{{{boardState}}}

Recent Game Summary:
{{{pastTurnsSummary}}}

Based on this, provide strategic tips for Player {{currentPlayerId}}. Consider:
1. Advancing Player {{currentPlayerId}}'s pawns towards the finish node (node 0,5).
2. Capturing opponent's pawns if advantageous.
3. Placing barricades strategically to block opponents, especially those close to the finish or with high threat.
4. Relocating existing barricades after landing on them to open up Player {{currentPlayerId}}'s path or hinder opponents.
5. Defensive positioning of Player {{currentPlayerId}}'s pawns.

Ensure your advice is clear, concise, and actionable in the "strategyAdvice" field. Optionally, provide a more detailed "analysis" in a separate field.`,
});

/**
 * Defines the Genkit flow for the AI game strategy advisor.
 * This flow uses the defined prompt to generate strategic advice for the player.
 */
const aiGameStrategyAdvisorFlow = ai.defineFlow(
  {
    name: 'aiGameStrategyAdvisorFlow',
    inputSchema: AiGameStrategyAdvisorInputSchema,
    outputSchema: AiGameStrategyAdvisorOutputSchema,
  },
  async (input) => {
    const {output} = await strategyAdvisorPrompt(input);
    return output!;
  }
);
