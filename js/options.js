/* Price a contract: you are shown a two-way market on a quantity and must make a
 * market on a contract written on it.
 *
 * The convention, stated on screen every time: the MID of the market is the fair
 * value and the WIDTH is one standard deviation, with the quantity treated as
 * roughly normal. Every strike sits a whole number of half standard deviations
 * from the fair, so one small table prices everything:
 *
 *   distance from fair     0    1/2 sd   1 sd   1 1/2 sd   2 sd
 *   out of the money      50%    31%     16%      7%        2%
 *   in the money          50%    69%     84%     93%       98%
 *
 *   digital        the chance it pays, x 100
 *   call or put    out of the money: chance x about 2/3 sd (at the fair: 0.4 sd)
 *                  in the money: intrinsic + the out-of-the-money price at the same distance
 *   put from call  call - (fair - K), parity against your own fair
 *   after a move   shift the fair, recount the distance, read the table again
 *
 * The model value is still the exact normal one; the table lands inside the "close" band.
 */
const Opt = (function () {
  const Phi = z => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  };
  const phi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const callValue = (fair, sd, K) => { const d = (fair - K) / sd; return sd * (phi(d) + d * Phi(d)); };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sig = (v, n) => Engine.sig(v, n);
  const r3 = v => (v === 0 ? 0 : +v.toPrecision(3));           /* three significant figures */
  const fmt = v => r3(v).toLocaleString(undefined, { maximumFractionDigits: 6 });
  const fix = v => +v.toPrecision(6);

  /* The table. Chance of paying, out of the money, by distance in standard deviations. */
  const OTM = { 0: 50, 0.5: 31, 1: 16, 1.5: 7, 2: 2, 2.5: 1 };
  const DIST = { 0: 'at the fair', 0.5: 'half an sd', 1: 'one sd', 1.5: 'one and a half sd', 2: 'two sd', 2.5: 'two and a half sd' };
  const steps = (K, fair, sd) => Math.min(2.5, Math.round(2 * Math.abs(K - fair) / sd) / 2);

  /* Underlyings come from the same banks as the rest of the app, in spoken units.
   * The mid sits on a tick and the width is an even number of ticks, so the fair, half
   * a standard deviation and every strike are all numbers a person would say. */
  function underlying() {
    const pool = Data.FERMI.filter(f => f.v >= 100 && f.v <= 1e13)
      .concat(Data.REPORTED.filter(r => r.type === 'fermi' && !r.variants && !r.sprintOnly && r.v >= 100));
    const f = pick(pool);
    const sc = Engine.pickScale(f.v);
    /* The market shown is somebody's quote, not the truth: centre it near, not on, the true value. */
    const raw = (f.v / sc.m) * Math.exp((Math.random() - 0.5) * 0.5);
    const tick = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
    const rel = pick([0.10, 0.12, 0.16, 0.20, 0.25]);
    let n = Math.max(2, Math.round(raw * rel / tick)); if (n % 2) n += 1;
    const m = Math.round(raw / tick);
    return { name: f.q, unit: (sc.name ? sc.name + ' ' : '') + f.unit, bid: fix((m - n / 2) * tick), ask: fix((m + n / 2) * tick), tick };
  }

  /* The table method for a call or a put, in words, with the estimate it gives. */
  function byTable(isCall, fair, sd, K) {
    const s = steps(K, fair, sd), c = OTM[s];
    const itm = isCall ? K < fair : K > fair, name = isCall ? 'call' : 'put';
    if (s === 0) return { est: 0.4 * sd, text: `The strike is at your fair. Half the time the ${name} pays nothing, half the time about 0.8 sd: 0.4 x ${fmt(sd)} = ${fmt(0.4 * sd)}.` };
    const tv = (c / 100) * (2 / 3) * sd;
    if (!itm) return { est: tv, text: `${sig(K, 4)} is ${DIST[s]} from your fair of ${sig(fair, 4)}, and at the fair the ${name} pays nothing, so it is out of the money: ${c}% chance x about two thirds of an sd (${fmt(2 * sd / 3)}) = ${fmt(tv)}.` };
    const intr = Math.abs(fair - K);
    return { est: intr + tv, text: `${sig(K, 4)} is ${DIST[s]} from your fair of ${sig(fair, 4)}, and at the fair the ${name} pays ${fmt(intr)}, so it is in the money: intrinsic ${fmt(intr)} + the out-of-the-money price at the same distance (${c}% x ${fmt(2 * sd / 3)} = ${fmt(tv)}) = ${fmt(intr + tv)}.` };
  }

  function digitalByTable(above, fair, sd, K) {
    const s = steps(K, fair, sd), c = OTM[s];
    if (s === 0) return 'The strike is at your fair: a coin flip, 50.';
    const pays = above ? fair > K : fair < K;
    return `${sig(K, 4)} is ${DIST[s]} ${K > fair ? 'above' : 'below'} your fair of ${sig(fair, 4)}. If it settled at your fair this ${pays ? 'pays' : 'does not pay'}, so it is ${pays ? 'in' : 'out of'} the money: ${pays ? '100 - ' + c + ' = ' + (100 - c) : c}.`;
  }

  const KINDS = ['digital-above', 'digital-below', 'call', 'put', 'parity', 'reprice'];

  function question(kinds) {
    const u = underlying();
    const fair = fix((u.bid + u.ask) / 2), sd = fix(u.ask - u.bid);
    const kind = pick(kinds && kinds.length ? kinds : KINDS);
    /* Strikes are chosen so the contract is worth something you can reason about:
     * no calls three deviations out of the money, no reprice that lands on nothing. */
    const Z = {
      'digital-above': [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2], 'digital-below': [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5],
      call: [-1, -0.5, 0, 0.5, 1, 1.5], put: [-1.5, -1, -0.5, 0, 0.5, 1],
      parity: [-1, -0.5, 0.5, 1], reprice: [-0.5, 0, 0.5, 1],
    };
    const z = pick(Z[kind]);
    const K = fix(fair + z * sd);                    /* exactly on a half-sd step, and on a tick */
    const q = { u, fair, sd, kind, K, z };
    const exact = v => ` Exact: ${fmt(r3(v))}.`;

    if (kind === 'digital-above') {
      q.ask = `A contract pays 100 if the quantity turns out ABOVE ${sig(K, 4)}, and nothing otherwise. Make a market on it.`;
      q.model = 100 * (1 - Phi(z)); q.scale = 'points'; q.tol = 6;
      q.how = digitalByTable(true, fair, sd, K);
    } else if (kind === 'digital-below') {
      q.ask = `A contract pays 100 if the quantity turns out BELOW ${sig(K, 4)}, and nothing otherwise. Make a market on it.`;
      q.model = 100 * Phi(z); q.scale = 'points'; q.tol = 6;
      q.how = digitalByTable(false, fair, sd, K);
    } else if (kind === 'call') {
      q.ask = `A call pays the amount by which the quantity exceeds ${sig(K, 4)}, in the same units, and nothing if it is below. Make a market on it.`;
      q.model = callValue(fair, sd, K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = byTable(true, fair, sd, K).text + exact(q.model);
    } else if (kind === 'put') {
      q.ask = `A put pays the amount by which the quantity falls short of ${sig(K, 4)}, in the same units, and nothing if it is above. Make a market on it.`;
      q.model = callValue(fair, sd, K) - (fair - K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = byTable(false, fair, sd, K).text + exact(q.model);
    } else if (kind === 'parity') {
      /* The call market shown is rounded to three figures, and the answer is built from
       * what is shown, so the put really can be priced from the screen alone. */
      const c = callValue(fair, sd, K), half = Math.max(c * 0.07, sd * 0.02);
      const cb = r3(c - half), ca = r3(c + half), cm = (cb + ca) / 2;
      q.given = `The ${sig(K, 4)} call is quoted ${fmt(cb)} at ${fmt(ca)}.`;
      q.ask = `Using that call market and nothing else, make a market on the ${sig(K, 4)} put.`;
      q.model = cm - (fair - K); q.scale = 'units'; q.tol = Math.max(0.05 * sd, 0.15 * Math.abs(q.model));
      q.how = `Parity against the fair: put = call - (fair - K) = ${fmt(cm)} - (${fmt(fair - K)}) = ${fmt(q.model)}. No table needed.`;
    } else {
      const c0 = r3(callValue(fair, sd, K));
      const move = fix(sd * pick([-0.5, 0.5, 0.5, 1]));
      q.given = `With the market where it is, the ${sig(K, 4)} call is worth ${fmt(c0)}.`;
      q.ask = `The whole market now moves ${move > 0 ? 'UP' : 'DOWN'} by ${fmt(Math.abs(move))}, width unchanged. Make a new market on the call.`;
      q.model = callValue(fair + move, sd, K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = `Your fair is now ${sig(fix(fair + move), 4)}. Recount the distance and read the table again. ` + byTable(true, fix(fair + move), sd, K).text + exact(q.model);
    }
    return q;
  }

  function newRun(n, secs, kinds) {
    const items = [];
    for (let i = 0; i < n; i++) items.push(question(kinds));
    return { items, secs, idx: 0, answers: [], startedAt: Date.now() };
  }

  /* Four things are graded: the mid against the model, whether your market contains the
   * model value, whether the quote is legal and sensible, and the clock. */
  function grade(run, bid, ask, ms) {
    const q = run.items[run.idx];
    const mid = (bid + ask) / 2;
    const err = Math.abs(mid - q.model);
    const close = err <= q.tol;
    const contains = q.model >= bid && q.model <= ask;
    const isDigital = q.scale === 'points';
    let legal = bid >= 0 && ask > bid && (!isDigital || ask <= 100), why = '';
    if (!legal) why = isDigital ? 'A digital lives between 0 and 100 with the bid below the ask.' : 'A price cannot be negative, and the bid must be below the ask.';
    const wing = q.model < (isDigital ? 8 : 0.08 * q.sd);
    if (legal && wing && ask < q.model) { legal = false; why = 'You offered a tail contract below its worth. Never sell the wings cheap.'; }
    const width = ask - bid;
    const tooWide = isDigital ? width > 25 : width > Math.max(0.5 * q.sd, 1.2 * q.model);
    const late = run.secs > 0 && ms > run.secs * 1000;
    /* The price is the point: six for a close mid, three for the right area. The tidy-quote
     * and on-the-clock marks only count once the price is at least in the right area. */
    const near = err <= 2 * q.tol;
    const pts = (close ? 6 : near ? 3 : 0) + (contains && near ? 2 : 0) + (near && legal && !tooWide ? 1 : 0) + (near && !late ? 1 : 0);
    const a = { q, bid, ask, mid, err, close, contains, legal, why, tooWide, late, ms, pts };
    run.answers.push(a); run.idx++;
    return a;
  }

  function summary(run) {
    const n = run.answers.length || 1;
    const pts = run.answers.reduce((s, a) => s + a.pts, 0);
    const byKind = {};
    for (const a of run.answers) {
      const k = byKind[a.q.kind] = byKind[a.q.kind] || { n: 0, close: 0 };
      k.n++; k.close += a.close ? 1 : 0;
    }
    return {
      pct: Math.round(100 * pts / (n * 10)), n,
      close: run.answers.filter(a => a.close).length / n,
      contains: run.answers.filter(a => a.contains).length / n,
      late: run.answers.filter(a => a.late).length / n,
      avgMs: run.answers.reduce((s, a) => s + a.ms, 0) / n,
      byKind,
    };
  }

  const KIND_NAMES = {
    'digital-above': 'Digital, above', 'digital-below': 'Digital, below', call: 'Call', put: 'Put',
    parity: 'Put from a call, by parity', reprice: 'Reprice after a move, by the table',
  };

  return { newRun, grade, summary, question, byTable, Phi, phi, callValue, KINDS, KIND_NAMES, fmt };
})();
