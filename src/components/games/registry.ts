import type { ComponentType } from 'react';
import type { GameProps } from './GameProps';
import { RobotMaze } from './RobotMaze';
import { MemoryMatch } from './MemoryMatch';
import { BinaryChallenge } from './BinaryChallenge';
import { AlgorithmRace } from './AlgorithmRace';
import { FixTheBug } from './FixTheBug';
import { CodeAdventure } from './CodeAdventure';
import { LogicPuzzle } from './LogicPuzzle';
import { TreasureHunt } from './TreasureHunt';
import { PatternPop } from './PatternPop';
import { LoopOutput } from './LoopOutput';
import { QuickMath } from './QuickMath';

/** Maps a game slug to its playable component. */
export const GAME_REGISTRY: Record<string, ComponentType<GameProps>> = {
  'robot-maze': RobotMaze,
  'memory-match': MemoryMatch,
  'binary-challenge': BinaryChallenge,
  'algorithm-race': AlgorithmRace,
  'fix-the-bug': FixTheBug,
  'code-adventure': CodeAdventure,
  'logic-puzzle': LogicPuzzle,
  'treasure-hunt': TreasureHunt,
  'pattern-pop': PatternPop,
  'loop-output': LoopOutput,
  'quick-math': QuickMath,
};
