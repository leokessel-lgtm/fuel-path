const assert = require("node:assert/strict");
const test = require("node:test");

const { DurableWriteQueue } = require("../../mobile-app/src/services/durableWriteQueue.js");

test("durable write queue serialises writes and skips superseded pending state", async () => {
  const writes = [];
  let active = 0;
  let maximumActive = 0;
  let releaseFirst;
  const firstMayFinish = new Promise((resolve) => { releaseFirst = resolve; });
  const queue = new DurableWriteQueue(async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    writes.push(value);
    if (value === "first") await firstMayFinish;
    active -= 1;
  });

  queue.enqueue("first");
  await Promise.resolve();
  queue.enqueue("second");
  queue.enqueue("latest");
  releaseFirst();
  await queue.whenIdle();

  assert.deepEqual(writes, ["first", "latest"]);
  assert.equal(maximumActive, 1);
});

test("durable write queue retries transient failures before reporting success", async () => {
  let attempts = 0;
  const statuses = [];
  const queue = new DurableWriteQueue(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("transient storage outage");
  }, (status) => statuses.push(status.status), { retryDelaysMs: [0, 0] });

  queue.enqueue({ revision: 1 });
  await queue.whenIdle();

  assert.equal(attempts, 3);
  assert.equal(statuses.at(-1), "saved");
  assert.equal(statuses.includes("error"), false);
});

test("durable write queue retains failed state for explicit retry", async () => {
  let available = false;
  const statuses = [];
  const queue = new DurableWriteQueue(async () => {
    if (!available) throw new Error("storage unavailable");
  }, (status) => statuses.push(status.status), { retryDelaysMs: [] });

  queue.enqueue("held-latest-state");
  await queue.whenIdle();
  assert.equal(statuses.at(-1), "error");

  available = true;
  queue.retry();
  await queue.whenIdle();
  assert.equal(statuses.at(-1), "saved");
});
