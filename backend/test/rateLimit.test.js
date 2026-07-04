import assert from 'node:assert/strict';
import test from 'node:test';
import { genericSseStream, RateLimitBucket } from '../src/index.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarmAt = null;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async setAlarm(value) {
    this.alarmAt = value;
  }

  async deleteAll() {
    this.values.clear();
    this.alarmAt = null;
  }
}

function consume(bucket, settings) {
  return bucket.fetch(new Request('https://rate-limit/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })).then((response) => response.json());
}

test('enforces a daily limit and reports remaining quota', async () => {
  const storage = new MemoryStorage();
  const bucket = new RateLimitBucket({ storage });
  const settings = { dailyLimit: 2, minuteLimit: 10, cooldownMs: 1_000 };

  const first = await consume(bucket, settings);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = await consume(bucket, settings);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const third = await consume(bucket, settings);
  assert.equal(third.allowed, false);
  assert.equal(third.reason, 'DAILY_LIMIT');
  assert.equal(third.remaining, 0);
  assert.ok(storage.alarmAt > Date.now());
});

test('starts a cooldown after a per-minute burst', async () => {
  const storage = new MemoryStorage();
  const bucket = new RateLimitBucket({ storage });
  const settings = { dailyLimit: 50, minuteLimit: 1, cooldownMs: 60_000 };

  assert.equal((await consume(bucket, settings)).allowed, true);
  const limited = await consume(bucket, settings);
  assert.equal(limited.allowed, false);
  assert.equal(limited.reason, 'MINUTE_LIMIT');
  assert.equal(limited.retryAfter, 60);

  const coolingDown = await consume(bucket, settings);
  assert.equal(coolingDown.allowed, false);
  assert.equal(coolingDown.reason, 'COOLDOWN');
});

test('deletes anonymous rate-limit state when retention alarm fires', async () => {
  const storage = new MemoryStorage();
  const bucket = new RateLimitBucket({ storage });
  await consume(bucket, { dailyLimit: 50, minuteLimit: 8, cooldownMs: 120_000 });

  assert.equal(storage.values.size, 1);
  await bucket.alarm();
  assert.equal(storage.values.size, 0);
});

test('splits large upstream deltas into incremental SSE events', async () => {
  const encoder = new TextEncoder();
  const upstream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(
        'data: {"choices":[{"delta":{"content":"abcdefghijklmnop"}}]}\n\n'
        + 'data: [DONE]\n\n',
      ));
      controller.close();
    },
  });

  const output = await new Response(genericSseStream(upstream)).text();
  const events = output.match(/^data: .+$/gm);

  assert.deepEqual(events, [
    'data: {"delta":"abcd"}',
    'data: {"delta":"efgh"}',
    'data: {"delta":"ijkl"}',
    'data: {"delta":"mnop"}',
    'data: [DONE]',
  ]);
});
