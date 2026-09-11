import fs from 'node:fs';
import path from 'node:path';
import { shouldSkipOutboundProviderRetry } from '../src/modules/messages/send-lease';
import { MetaWhatsAppService } from '../src/modules/whatsapp/meta.service';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const evidencePath = path.join(repoRoot, '.run/packet-f-evidence.json');
const DEFAULT_N = 1000;

type Recip = {
  id: string;
  phone: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'AMBIGUOUS';
  claimToken: string | null;
  providerCallStartedAt: Date | null;
};

type GraphCall = { to: string; url: string };

function eligiblePhone(i: number): string {
  return `9198${String(1_000_000 + i).slice(-7)}`;
}

function seedRecipients(n: number): Recip[] {
  const rows: Recip[] = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      id: `r${i}`,
      phone: eligiblePhone(i),
      status: 'PENDING',
      claimToken: null,
      providerCallStartedAt: null,
    });
  }
  return rows;
}

/** Same claim predicate the campaign worker uses: PENDING + no provider call yet. */
function canClaimRecipient(row: Recip): boolean {
  return row.status === 'PENDING' && row.providerCallStartedAt == null;
}

function writeEvidence(payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  let previous: Record<string, unknown> = {};
  if (fs.existsSync(evidencePath)) {
    previous = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as Record<string, unknown>;
  }
  fs.writeFileSync(evidencePath, `${JSON.stringify({ ...previous, ...payload }, null, 2)}\n`);
}

function uniqueTos(calls: GraphCall[]): string[] {
  return [...new Set(calls.map((call) => call.to))];
}

function installSimulator(mode: 'ok' | '429' | '5xx' | 'timeout'): GraphCall[] {
  const calls: GraphCall[] = [];
  const perTo = new Map<string, number>();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const to = JSON.parse(String(init?.body || '{}')).to as string;
    calls.push({ to, url });
    const seen = (perTo.get(to) || 0) + 1;
    perTo.set(to, seen);
    if (mode === 'timeout') {
      const err = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
      throw err;
    }
    if (mode === '5xx') {
      return {
        ok: false,
        status: 500,
        text: async () => 'upstream',
      } as Response;
    }
    if (mode === '429' && seen === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'rate', code: 130429 } }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ messages: [{ id: `wamid.${to}` }] }),
    } as Response;
  }) as typeof fetch;
  (installSimulator as { restore?: () => void }).restore = () => {
    globalThis.fetch = previousFetch;
  };
  return calls;
}

function restoreFetch(): void {
  (installSimulator as { restore?: () => void }).restore?.();
}

async function sendOne(phone: string): Promise<void> {
  await MetaWhatsAppService.sendMessage(
    'pn_packet_f',
    'token',
    { to: phone, type: 'text', text: { body: 'packet-f' } },
    { maxAttempts: 4 }
  );
}

async function runWave(rows: Recip[], opts?: { crashAfterStartId?: string }): Promise<void> {
  for (const row of rows) {
    if (shouldSkipOutboundProviderRetry(row) || !canClaimRecipient(row)) continue;
    row.claimToken = `job:${row.id}`;
    row.providerCallStartedAt = new Date();
    if (opts?.crashAfterStartId === row.id) {
      // Kill API after providerCallStartedAt, before Meta returns.
      continue;
    }
    try {
      await sendOne(row.phone);
      row.status = 'SENT';
    } catch {
      row.status = 'AMBIGUOUS';
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runCount(): Promise<void> {
  const n = Number(process.env.PACKET_F_N || DEFAULT_N);
  assert(Number.isInteger(n) && n > 0, 'PACKET_F_N must be a positive integer');
  const rows = seedRecipients(n);
  const calls = installSimulator('ok');
  try {
    await runWave(rows);
    const tos = uniqueTos(calls);
    const dups = calls.length - tos.length;
    writeEvidence({
      count: {
        eligible: n,
        graphCalls: calls.length,
        uniqueTos: tos.length,
        duplicateTos: dups,
        sent: rows.filter((row) => row.status === 'SENT').length,
      },
    });
    assert(calls.length === n, `graphCalls ${calls.length} !== eligible ${n}`);
    assert(tos.length === n, `uniqueTos ${tos.length} !== eligible ${n}`);
    assert(dups === 0, `duplicate tos ${dups}`);
    assert(
      rows.every((row) => row.status === 'SENT'),
      'not every eligible recipient reached SENT'
    );
    console.log(`eligible=${n} graphCalls=${calls.length} uniqueTos=${tos.length} dups=${dups}`);
    console.log('packet-f-count-ok');
  } finally {
    restoreFetch();
  }
}

async function runRestart(): Promise<void> {
  const n = 8;
  const rows = seedRecipients(n);
  const crashId = rows[3].id;
  const calls = installSimulator('ok');
  try {
    await runWave(rows, { crashAfterStartId: crashId });
    const afterCrash = calls.length;
    const crashed = rows.find((row) => row.id === crashId)!;
    assert(crashed.providerCallStartedAt, 'crash row missing providerCallStartedAt');
    assert(crashed.status === 'PENDING', 'crash row must stay PENDING');
    assert(
      shouldSkipOutboundProviderRetry(crashed),
      'restart must skip the in-flight providerCallStartedAt row'
    );
    assert(!canClaimRecipient(crashed), 'campaign claim must refuse providerCallStartedAt');

    await runWave(rows);
    const afterRestart = calls.length;
    const crashedCalls = calls.filter((call) => call.to === crashed.phone).length;
    writeEvidence({
      restart: {
        eligible: n,
        graphCallsAfterCrash: afterCrash,
        graphCallsAfterRestart: afterRestart,
        crashedPhoneCalls: crashedCalls,
      },
    });
    assert(afterRestart === afterCrash, `restart added Graph calls ${afterCrash} -> ${afterRestart}`);
    assert(crashedCalls === 0, `crashed recipient was sent ${crashedCalls} times`);
    assert(afterRestart === n - 1, `completed sends ${afterRestart} !== ${n - 1}`);
    console.log(
      `afterCrash=${afterCrash} afterRestart=${afterRestart} crashedPhoneCalls=${crashedCalls}`
    );
    console.log('packet-f-restart-ok');
  } finally {
    restoreFetch();
  }
}

async function runMeta(): Promise<void> {
  const phone429 = '919800000001';
  const phoneTimeout = '919800000002';
  const phone5xx = '919800000003';

  const calls429 = installSimulator('429');
  try {
    await sendOne(phone429);
    assert(calls429.length === 2, `429 must retry once then succeed, got ${calls429.length}`);
  } finally {
    restoreFetch();
  }

  const callsTimeout = installSimulator('timeout');
  try {
    await sendOne(phoneTimeout).then(
      () => {
        throw new Error('timeout-after-accept must not succeed');
      },
      () => undefined
    );
    assert(callsTimeout.length === 1, `timeout must not retry, got ${callsTimeout.length}`);
  } finally {
    restoreFetch();
  }

  const calls5xx = installSimulator('5xx');
  try {
    await sendOne(phone5xx).then(
      () => {
        throw new Error('5xx must not succeed');
      },
      () => undefined
    );
    assert(calls5xx.length === 1, `5xx must not retry, got ${calls5xx.length}`);
  } finally {
    restoreFetch();
  }

  writeEvidence({
    meta: {
      retry429Calls: calls429.length,
      timeoutCalls: callsTimeout.length,
      http5xxCalls: calls5xx.length,
    },
  });
  console.log(
    `retry429=${calls429.length} timeout=${callsTimeout.length} http5xx=${calls5xx.length}`
  );
  console.log('packet-f-meta-ok');
}

const mode = process.argv[2];
const run =
  mode === '--count'
    ? runCount
    : mode === '--restart'
      ? runRestart
      : mode === '--meta'
        ? runMeta
        : null;

if (!run) {
  throw new Error('usage: --count | --restart | --meta');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
