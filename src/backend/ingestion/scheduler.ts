/**
 * Concurrent 1-minute Polling Scheduler
 */

export class PollingScheduler {
  private intervalSeconds: number;

  constructor(intervalSeconds: number = 60) {
    this.intervalSeconds = intervalSeconds;
  }

  public start(): void {
    console.log(`[Scheduler] Starting VCF 9 polling loop every ${this.intervalSeconds}s`);
  }
}
