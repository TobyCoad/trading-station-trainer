/* Price a contract: you are shown a two-way market on a quantity and must make a
 * market on a contract written on it.
 *
 * The convention, stated on screen every time: the MID of the market is the fair
 * value and the WIDTH is one standard deviation, with the quantity treated as
 * roughly normal. That is the rule of thumb the quoting ritual uses ("about one
 * standard deviation wide"), and it makes every price here a mental calculation:
 *
 *   digital above K   100 x P(Z > z)             z = (K - fair) / sd
 *   call              sd x [ phi(d) + d Phi(d) ]  d = (fair - K) / sd   (0.4 sd at the money)
 *   put               call - (fair - K)           put-call parity against your own fair
 *   after a move      old price + delta x move    delta = Phi(d)
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

  /* A number a trader would actually say: two or three significant figures. */
  function nice(v) {
    if (v === 0) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 1);
    return Math.round(v / mag) * mag;
  }

  /* Underlyings come from the same banks as the rest of the app, in spoken units.
   * Bid, ask and strikes all sit on one tick, two significant figures at the size of
   * the mid, so every market reads like something a person would say: 19 at 21. */
  function underlying() {
    const pool = Data.FERMI.filter(f => f.v >= 100 && f.v <= 1e13)
      .concat(Data.REPORTED.filter(r => r.type === 'fermi' && !r.variants && !r.sprintOnly && r.v >= 100));
    const f = pick(pool);
    const sc = Engine.pickScale(f.v);
    /* The market shown is somebody's quote, not the truth: centre it near, not on, the true value. */
    const raw = (f.v / sc.m) * Math.exp((Math.random() - 0.5) * 0.5);
    const tick = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
    const snap = v => Math.round(v / tick) * tick;
    const rel = pick([0.10, 0.12, 0.16, 0.20, 0.25]);
    let bid = snap(raw * (1 - rel / 2)), ask = snap(raw * (1 + rel / 2));
    if (ask - bid < 2 * tick) { bid = snap(raw) - tick; ask = snap(raw) + tick; }
    const fix = v => +v.toPrecision(6);
    return { name: f.q, unit: (sc.name ? sc.name + ' ' : '') + f.unit, bid: fix(bid), ask: fix(ask), tick, snap: v => fix(snap(v)) };
  }

  const KINDS = ['digital-above', 'digital-below', 'call', 'put', 'parity', 'reprice'];

  function question(kinds) {
    const u = underlying();
    const fair = (u.bid + u.ask) / 2, sd = u.ask - u.bid;
    const kind = pick(kinds && kinds.length ? kinds : KINDS);
    /* Strikes are chosen so the contract is worth something you can reason about:
     * no calls three deviations out of the money, no reprice that lands on nothing. */
    const Z = {
      'digital-above': [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2], 'digital-below': [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5],
      call: [-1, -0.5, 0, 0.5, 1, 1.5], put: [-1.5, -1, -0.5, 0, 0.5, 1],
      parity: [-1, -0.5, 0.5, 1], reprice: [-0.5, 0, 0.5, 1],
    };
    const z0 = pick(Z[kind]);
    let K = u.snap(fair + z0 * sd);
    if (K <= 0) K = u.snap(fair);
    const z = (K - fair) / sd;                       /* recomputed from the rounded strike */
    const q = { u, fair, sd, kind, K, z };

    if (kind === 'digital-above') {
      q.ask = `A contract pays 100 if the quantity turns out ABOVE ${sig(K, 4)}, and nothing otherwise. Make a market on it.`;
      q.model = 100 * (1 - Phi(z)); q.scale = 'points'; q.tol = 6;
      q.how = `z = (${sig(K, 4)} - ${sig(fair, 4)}) / ${sig(sd, 3)} = ${z.toFixed(2)}, so the chance of finishing above is ${Math.round(q.model)}%.`;
    } else if (kind === 'digital-below') {
      q.ask = `A contract pays 100 if the quantity turns out BELOW ${sig(K, 4)}, and nothing otherwise. Make a market on it.`;
      q.model = 100 * Phi(z); q.scale = 'points'; q.tol = 6;
      q.how = `z = (${sig(K, 4)} - ${sig(fair, 4)}) / ${sig(sd, 3)} = ${z.toFixed(2)}, so the chance of finishing below is ${Math.round(q.model)}%. It is 100 minus the "above" contract.`;
    } else if (kind === 'call') {
      q.ask = `A call pays the amount by which the quantity exceeds ${sig(K, 4)}, in the same units, and nothing if it is below. Make a market on it.`;
      q.model = callValue(fair, sd, K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = `d = (fair - K) / sd = ${(-z).toFixed(2)}. Call = sd x [phi(d) + d Phi(d)] = ${sig(sd, 3)} x ${(q.model / sd).toFixed(2)}. At the money it would be 0.40 sd.`;
    } else if (kind === 'put') {
      q.ask = `A put pays the amount by which the quantity falls short of ${sig(K, 4)}, in the same units, and nothing if it is above. Make a market on it.`;
      q.model = callValue(fair, sd, K) - (fair - K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = `Price the call, ${sig(callValue(fair, sd, K), 3)}, then parity: put = call - (fair - K) = ${sig(callValue(fair, sd, K), 3)} - (${sig(fair - K, 3)}).`;
    } else if (kind === 'parity') {
      /* The call market shown is rounded to three figures, and the answer is built from
       * what is shown, so the put really can be priced from the screen alone. */
      const c = callValue(fair, sd, K), half = Math.max(c * 0.07, sd * 0.02);
      const cb = r3(c - half), ca = r3(c + half), cm = (cb + ca) / 2;
      q.given = `The ${sig(K, 4)} call is quoted ${fmt(cb)} at ${fmt(ca)}.`;
      q.ask = `Using that call market and nothing else, make a market on the ${sig(K, 4)} put.`;
      q.model = cm - (fair - K); q.scale = 'units'; q.tol = Math.max(0.05 * sd, 0.15 * Math.abs(q.model));
      q.how = `Parity against the fair: put = call - (fair - K) = ${fmt(cm)} - (${fmt(fair - K)}) = ${fmt(q.model)}. No distribution needed.`;
    } else {
      const c0 = r3(callValue(fair, sd, K)), delta = Phi(-z);
      const move = u.snap(sd * pick([-0.5, 0.5, 0.5, 1])) || u.tick;
      q.given = `With the market where it is, the ${sig(K, 4)} call is worth ${fmt(c0)}.`;
      q.ask = `The whole market now moves ${move > 0 ? 'UP' : 'DOWN'} by ${fmt(Math.abs(move))}, width unchanged. Make a new market on the call.`;
      q.model = callValue(fair + move, sd, K); q.scale = 'units'; q.tol = Math.max(0.04 * sd, 0.25 * q.model);
      q.how = `Delta is Phi(d) = ${delta.toFixed(2)}, so a first estimate is ${fmt(c0)} ${move > 0 ? '+' : '-'} ${delta.toFixed(2)} x ${fmt(Math.abs(move))} = ${fmt(r3(c0 + delta * move))}. Exact repricing gives ${fmt(r3(q.model))}; the gap is gamma.`;
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
    parity: 'Put from a call, by parity', reprice: 'Reprice after a move, by delta',
  };

  return { newRun, grade, summary, question, Phi, phi, callValue, KINDS, KIND_NAMES, fmt };
})();
