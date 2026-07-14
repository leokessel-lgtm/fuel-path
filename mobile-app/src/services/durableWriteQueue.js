class DurableWriteQueue {
  constructor(write, onStatus = () => {}, options = {}) {
    this.write = write;
    this.onStatus = onStatus;
    this.retryDelaysMs = options.retryDelaysMs || [150, 600];
    this.pending = undefined;
    this.failed = undefined;
    this.running = null;
    this.disposed = false;
  }

  enqueue(value) {
    if (this.disposed) return;
    this.pending = value;
    this.failed = undefined;
    this.#start();
  }

  retry() {
    if (this.disposed || this.failed === undefined) return;
    this.pending = this.pending === undefined ? this.failed : this.pending;
    this.failed = undefined;
    this.#start();
  }

  async whenIdle() {
    while (this.running) await this.running;
  }

  dispose() {
    this.disposed = true;
    this.pending = undefined;
    this.failed = undefined;
  }

  #start() {
    if (this.running || this.disposed) return;
    this.running = this.#drain().finally(() => {
      this.running = null;
      if (this.pending !== undefined && !this.disposed) this.#start();
    });
  }

  async #drain() {
    while (this.pending !== undefined && !this.disposed) {
      const value = this.pending;
      this.pending = undefined;
      this.onStatus({ status: "saving" });
      let superseded = false;
      for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
        try {
          await this.write(value);
          this.onStatus({ status: "saved", savedAt: new Date().toISOString() });
          superseded = false;
          break;
        } catch (error) {
          if (this.pending !== undefined) {
            superseded = true;
            break;
          }
          if (attempt < this.retryDelaysMs.length) {
            await delay(this.retryDelaysMs[attempt]);
            continue;
          }
          this.failed = value;
          this.onStatus({ status: "error", error: normaliseError(error) });
          return;
        }
      }
      if (superseded) continue;
    }
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normaliseError(error) {
  return error instanceof Error ? error : new Error("Local data write failed");
}

module.exports = { DurableWriteQueue };
