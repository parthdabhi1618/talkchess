import { EventEmitter } from 'events';
import * as path from 'path';
import { Worker } from 'worker_threads';

export interface EngineOutput {
  evals: number[];      // best eval per depth (in pawns, from side-to-move perspective)
  bestMove: string;     // UCI move string e.g. "e2e4"
  pvLines: PvLine[];    // multipv lines
  mateScore?: number;   // positive = mating, negative = being mated
  depth: number;
}

export interface PvLine {
  rank: number;
  eval: number;
  moves: string[]; // UCI move strings
  mateIn?: number;
}

/**
 * Analyzes a FEN position using Stockfish via child process.
 */
export async function analyzePosition(
  fen: string,
  depth: number = 18,
  multiPv: number = 3,
): Promise<EngineOutput> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    
    // Try to find stockfish binary
    const stockfishBin = findStockfishBinary();
    
    if (!stockfishBin) {
      // Fall back to JS implementation via worker
      return analyzeWithJs(fen, depth, multiPv).then(resolve).catch(reject);
    }
    
    const sf = spawn(stockfishBin, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    const pvLines: Map<number, PvLine> = new Map();
    let bestMove = '';
    const evals: number[] = [];
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        sf.kill();
        // Return what we have
        resolve({
          evals,
          bestMove,
          pvLines: Array.from(pvLines.values()).sort((a, b) => a.rank - b.rank),
          depth: evals.length,
        });
      }
    }, 10000);
    
    sf.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        parseInfoLine(line, pvLines, evals);
        if (line.startsWith('bestmove')) {
          bestMove = line.split(' ')[1] || '';
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            sf.kill();
            const result = buildResult(pvLines, evals, bestMove, depth);
            resolve(result);
          }
        }
      }
    });
    
    sf.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        analyzeWithJs(fen, depth, multiPv).then(resolve).catch(reject);
      }
    });
    
    sf.stdin.write('uci\n');
    sf.stdin.write(`setoption name MultiPV value ${multiPv}\n`);
    sf.stdin.write(`position fen ${fen}\n`);
    sf.stdin.write(`go depth ${depth}\n`);
  });
}

function findStockfishBinary(): string | null {
  const { execSync } = require('child_process');
  const candidates = ['stockfish', '/usr/local/bin/stockfish', '/opt/homebrew/bin/stockfish'];
  for (const bin of candidates) {
    try {
      execSync(`${bin} --version 2>/dev/null`, { timeout: 1000 });
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

/** Parse UCI info lines */
function parseInfoLine(line: string, pvLines: Map<number, PvLine>, evals: number[]) {
  if (!line.startsWith('info')) return;
  
  const multipvMatch = line.match(/multipv (\d+)/);
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/ pv (.+)/);
  const depthMatch = line.match(/depth (\d+)/);
  
  if (!scoreMatch) return;
  
  const rank = multipvMatch ? parseInt(multipvMatch[1]) : 1;
  const scoreType = scoreMatch[1];
  const scoreValue = parseInt(scoreMatch[2]);
  const moves = pvMatch ? pvMatch[1].trim().split(' ') : [];
  const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
  
  let evalPawns: number;
  let mateIn: number | undefined;
  
  if (scoreType === 'cp') {
    evalPawns = scoreValue / 100;
  } else {
    mateIn = scoreValue;
    evalPawns = scoreValue > 0 ? 100 : -100; // large value for mate
  }
  
  pvLines.set(rank, { rank, eval: evalPawns, moves, mateIn });
  
  // Track evals for depth tracking (rank 1 only)
  if (rank === 1) {
    evals.push(evalPawns);
  }
}

function buildResult(pvLines: Map<number, PvLine>, evals: number[], bestMove: string, depth: number): EngineOutput {
  const sortedLines = Array.from(pvLines.values()).sort((a, b) => a.rank - b.rank);
  const topLine = pvLines.get(1);
  const mateScore = topLine?.mateIn;
  
  return {
    evals,
    bestMove,
    pvLines: sortedLines,
    mateScore,
    depth,
  };
}

/** Fallback: analyze using stockfish.js (WASM-based npm package) */
async function analyzeWithJs(fen: string, depth: number, multiPv: number): Promise<EngineOutput> {
  return new Promise((resolve, reject) => {
    try {
      const Stockfish = require('stockfish');
      const sf = Stockfish();
      
      const pvLines: Map<number, PvLine> = new Map();
      let bestMove = '';
      const evals: number[] = [];
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(buildResult(pvLines, evals, bestMove, depth));
        }
      }, 15000);
      
      sf.onmessage = (event: string | { data: string }) => {
        const msg = typeof event === 'string' ? event : event.data;
        const lines = msg.split('\n');
        for (const line of lines) {
          parseInfoLine(line, pvLines, evals);
          if (line.startsWith('bestmove')) {
            bestMove = line.split(' ')[1] || '';
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(buildResult(pvLines, evals, bestMove, depth));
            }
          }
        }
      };
      
      sf.postMessage('uci');
      sf.postMessage(`setoption name MultiPV value ${multiPv}`);
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage(`go depth ${depth}`);
    } catch (err) {
      reject(new Error(`Stockfish analysis failed: ${err}`));
    }
  });
}
