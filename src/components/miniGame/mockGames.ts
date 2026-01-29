import { GameData } from '../../types';

// Mock games with intentionally invalid URLs to trigger fallback emojis
// Replace these with actual icon URLs when available from the API
export const mockGames: GameData[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Classic card game. Beat the dealer without going over 21!',
  },
  {
    id: 'word-puzzle',
    name: 'Word Hunt',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Find as many words as you can in the letter grid.',
  },
  {
    id: 'memory',
    name: 'Memory Match',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Match pairs of cards to clear the board.',
  },
  {
    id: 'trivia',
    name: 'Quick Trivia',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Test your knowledge with rapid-fire questions.',
  },
  {
    id: 'poker',
    name: 'Video Poker',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Draw poker with instant payouts.',
  },
  {
    id: 'solitaire',
    name: 'Solitaire',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'The classic card stacking game.',
  },
  {
    id: 'slots',
    name: 'Lucky Slots',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Spin to win with colorful slot reels.',
  },
  {
    id: 'chess',
    name: 'Quick Chess',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Play fast-paced chess puzzles.',
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    iconUrl: 'invalid-url-to-trigger-fallback',
    description: 'Classic number puzzle game.',
  },
];

