import { analyzePosition, EngineOutput, PvLine } from './stockfishWorker.js';

export interface AnalyzeRequest {
  fen: string;
  depth?: number;
  multiPv?: number;
  moveTime?: number; // ms, alternative to depth
}

export interface AnalyzeResponse extends EngineOutput {
  fen: string;
  timeMs: number;
}

/** Simple engine pool — queues analysis requests */
class EnginePool {
  private queue: Array<{
    request: AnalyzeRequest;
    resolve: (r: AnalyzeResponse) => void;
    reject: (e: Error) => void;
  }> = [];
  private running = 0;
  private maxConcurrent = 2;

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.flush();
    });
  }

  private flush() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      const start = Date.now();
      analyzePosition(job.request.fen, job.request.depth ?? 18, job.request.multiPv ?? 3)
        .then(result => {
          this.running--;
          job.resolve({ ...result, fen: job.request.fen, timeMs: Date.now() - start });
          this.flush();
        })
        .catch(err => {
          this.running--;
          job.reject(err);
          this.flush();
        });
    }
  }
}

export const enginePool = new EnginePool();
