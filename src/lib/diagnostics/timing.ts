export class PerfTimer {
  private label: string;
  private start: number;
  private lastCheckpoint: number;
  private checkpoints: Map<string, number> = new Map();

  constructor(label: string) {
    this.label = label;
    this.start = performance.now();
    this.lastCheckpoint = this.start;
  }

  checkpoint(name: string): void {
    const now = performance.now();
    const duration = Math.round((now - this.lastCheckpoint) * 10) / 10;
    this.checkpoints.set(name, duration);
    this.lastCheckpoint = now;
  }

  end(): { totalMs: number; metrics: Record<string, number> } {
    const end = performance.now();
    const totalMs = Math.round((end - this.start) * 10) / 10;
    const metrics: Record<string, number> = {};

    for (const [name, dur] of this.checkpoints.entries()) {
      metrics[name] = dur;
    }

    const checkpointStr = Object.entries(metrics)
      .map(([k, v]) => `${k}: ${v}ms`)
      .join(' ');

    console.log(`[PERF] ${this.label} ${checkpointStr ? checkpointStr + ' ' : ''}total: ${totalMs}ms`);

    return { totalMs, metrics };
  }
}
