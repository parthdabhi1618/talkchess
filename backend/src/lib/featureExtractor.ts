import { Chess } from 'chess.js';
import { classifyMove, MoveClassification } from './evalColor.js';
import { PvLine } from '../engine/stockfishWorker.js';

export interface ExplainableFeature {
  move: string;             // SAN notation
  moveUci: string;          // UCI notation
  fen: string;              // Position before move
  fenAfter: string;         // Position after move
  evalBefore: number;       // Eval before move (pawns, from white's perspective)
  evalAfter: number;        // Eval after move (pawns, from white's perspective)
  evalDelta: number;        // evalAfter - evalBefore
  classification: MoveClassification;
  reasonTags: string[];     // Heuristic tags explaining why
  bestAlternative: { move: string; eval: number } | null;
  pvLines: PvLine[];        // Top engine lines from this position
  sideToMove: 'white' | 'black';
}

export interface FeatureInput {
  fen: string;
  moveSan: string;
  moveUci: string;
  evalBefore: number;  // from white perspective
  evalAfter: number;   // from white perspective
  pvLines: PvLine[];
}

export function extractFeatures(input: FeatureInput): ExplainableFeature {
  const chess = new Chess(input.fen);
  const sideToMove = chess.turn() === 'w' ? 'white' : 'black';
  
  // Convert eval to mover's perspective
  const sign = sideToMove === 'white' ? 1 : -1;
  const evalBeforeMover = input.evalBefore * sign;
  const evalAfterMover = input.evalAfter * sign;
  const evalDelta = evalAfterMover - evalBeforeMover; // positive = good for mover
  
  // Apply the move
  let fenAfter = input.fen;
  try {
    chess.move(input.moveSan);
    fenAfter = chess.fen();
  } catch {
    // Use move UCI if SAN fails
  }
  
  const classification = classifyMove(evalDelta);
  const reasonTags = generateReasonTags(input, chess, sideToMove, evalDelta);
  
  // Best alternative from PV lines
  const bestLine = input.pvLines.find(l => l.rank === 1);
  const bestMoveUci = bestLine?.moves[0] ?? null;
  let bestAlternative: { move: string; eval: number } | null = null;
  
  if (bestMoveUci && bestMoveUci !== input.moveUci) {
    const bestEval = bestLine ? bestLine.eval * sign : 0;
    bestAlternative = { move: uciToSan(input.fen, bestMoveUci), eval: bestLine?.eval ?? 0 };
  }
  
  return {
    move: input.moveSan,
    moveUci: input.moveUci,
    fen: input.fen,
    fenAfter,
    evalBefore: input.evalBefore,
    evalAfter: input.evalAfter,
    evalDelta,
    classification,
    reasonTags,
    bestAlternative,
    pvLines: input.pvLines,
    sideToMove,
  };
}

function generateReasonTags(
  input: FeatureInput,
  chessAfter: Chess,
  sideToMove: 'white' | 'black',
  evalDelta: number,
): string[] {
  const tags: string[] = [];
  const chessBefore = new Chess(input.fen);
  
  // Check if move gives check
  if (chessAfter.isCheck()) tags.push('gives_check');
  
  // Check if move captures a piece
  try {
    const moveObj = chessBefore.move(input.moveSan, { strict: false });
    if (moveObj) {
      if (moveObj.captured) tags.push('captures_' + moveObj.captured);
      if (moveObj.flags.includes('p')) tags.push('pawn_promotion');
      if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) tags.push('castling');
    }
  } catch { /* ignore */ }
  
  // Check for game-end conditions
  if (chessAfter.isCheckmate()) tags.push('checkmate');
  if (chessAfter.isStalemate()) tags.push('stalemate');
  if (chessAfter.isDraw()) tags.push('draws_game');
  
  // Eval-based tags
  if (evalDelta < -2.0) tags.push('major_material_loss');
  else if (evalDelta < -1.0) tags.push('loses_material');
  else if (evalDelta < -0.5) tags.push('weakens_position');
  else if (evalDelta < -0.3) tags.push('loses_tempo');
  else if (evalDelta > 1.0) tags.push('wins_material');
  else if (evalDelta > 0.3) tags.push('improves_position');
  
  // Check if the best alternative is very different (missed tactic)
  const bestLine = input.pvLines.find(l => l.rank === 1);
  const sign = sideToMove === 'white' ? 1 : -1;
  if (bestLine && Math.abs(bestLine.eval * sign - (input.evalBefore * sign + evalDelta)) > 0.5) {
    tags.push('missed_opportunity');
  }
  
  return tags;
}

function uciToSan(fen: string, uciMove: string): string {
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
    const move = chess.move({ from, to, promotion } as any);
    return move?.san ?? uciMove;
  } catch {
    return uciMove;
  }
}
