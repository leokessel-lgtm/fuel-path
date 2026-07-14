export type DurableWriteStatus =
  | { status: "saving" }
  | { status: "saved"; savedAt: string }
  | { status: "error"; error: Error };

export class DurableWriteQueue<T> {
  constructor(
    write: (value: T) => Promise<void>,
    onStatus?: (status: DurableWriteStatus) => void,
    options?: { retryDelaysMs?: number[] },
  );
  enqueue(value: T): void;
  retry(): void;
  whenIdle(): Promise<void>;
  dispose(): void;
}
