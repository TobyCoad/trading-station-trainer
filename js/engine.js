/* Scenario construction, the market-making state machine, the book, and grading. */
const Engine = (function () {

  /* ---------------- numbers ---------------- */
  /* Only the units a trader would actually say. Below a million you quote the
   * raw number: nobody says "one point three thousand". */
  const SCALES = [
    { m: 1e15, name: 'quadrillion' }, { m: 1e12, name: 'trillion' },
    { m: 1e9, name: 'billion' }, { m: 1e6, name: 'million' }, { m: 1, name: '' },
  ];
  function pickScale(v) {
    for (const s of SCALES) if (s.m === 1 || v / s.m >= 1) return s;
    return SCALES[SCALES.length - 1];
  }
  function sig(v, n) {
    if (!isFinite(v) || v === 0) return '0';
    const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(v))));
    return (+v.toFixed(Math.min(12, d))).toLocaleString(undefined, { maximumFractionDigits: Math.min(12, d) });
  }
  /* "4.5bn", "1.2e9", "61k", "3 500" all parse. */
  function parseNum(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim().toLowerCase().replace(/[, _]/g, '').replace(/[$£€]/g, '');
    if (!s) return NaN;
    let mult = 1;
    const suf = [['quadrillion', 1e15], ['trillion', 1e12], ['billion', 1e9], ['million', 1e6],
                 ['thousand', 1e3], ['tn', 1e12], ['bn', 1e9], ['mm', 1e6], ['m', 1e6], ['k', 1e3], ['b', 1e9], ['t', 1e12]];
    for (const [t, f] of suf) {
      if (s.endsWith(t) && !/e[+-]?\d+$/.test(s)) { s = s.slice(0, -t.length); mult = f; break; }
    }
    const v = parseFloat(s);
    return isFinite(v) ? v * mult : NaN;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function pickTwo(a) {
    const i = Math.floor(Math.random() * a.length);
    let j = Math.floor(Math.random() * (a.length - 1));
    if (j >= i) j++;
    return [a[i], a[j]];
  }

  /* ---------------- scenarios ---------------- */

  /* Quantities you can sensibly quote a two-way price on. 52-factorial is a fine
   * Fermi question and a silly market. */
  const MM_FERMI = Data.FERMI.filter(f => f.v >= 100 && f.v <= 1e13);

  function fermiScenario() {
    const f = pick(MM_FERMI);
    const sc = pickScale(f.v);
    return {
      kind: 'fermi',
      title: f.q,
      prompt: 'Make a market on: ' + f.q.charAt(0).toLowerCase() + f.q.slice(1) + '.',
      unitName: f.unit,
      scale: sc.m,
      scaleName: sc.name,
      trueValue: f.v,
      hint: f.hint,
      components: null,
    };
  }

  /* The reported IMC exercise: distance x population(A) x density(B). */
  function compoundScenario() {
    const [A, B] = pickTwo(Data.CITIES);
    const dist = Data.greatCircle(A, B);
    const dens = Data.density(B);
    const v = dist * A.pop * dens;
    const sc = pickScale(v);
    return {
      kind: 'compound',
      title: A.name + ' x ' + B.name,
      prompt: 'Make a market on: the great-circle distance between ' + A.name + ' and ' + B.name +
              ' in kilometres, multiplied by the population of ' + A.name +
              ', multiplied by the population density of ' + B.name + ' in people per square kilometre.',
      unitName: 'km x people x people/km2',
      scale: sc.m,
      scaleName: sc.name,
      trueValue: v,
      hint: 'Distance ' + sig(dist, 3) + ' km, ' + A.name + ' ' + sig(A.pop / 1e6, 3) + 'M (' + A.basis +
            '), ' + B.name + ' ' + sig(B.pop / 1e6, 3) + 'M over ' + sig(B.area, 3) + ' km2 = ' +
            sig(dens, 3) + ' per km2 (' + B.basis + ').',
      cityA: A, cityB: B,
      components: [
        { key: 'dist', label: 'Distance ' + A.name + ' to ' + B.name, unit: 'km', v: dist, entryScale: 1 },
        { key: 'popA', label: 'Population of ' + A.name, unit: 'millions', v: A.pop, entryScale: 1e6 },
        { key: 'densB', label: 'Density of ' + B.name, unit: 'per km2', v: dens, entryScale: 1 },
      ],
    };
  }

  /* ---------------- event script ---------------- */

  const PRESETS = {
    warmup:    { openSec: 120, stepSec: 30, spreadCap: 0,    script: 'warmup',    label: 'Warm-up' },
    standard:  { openSec: 90,  stepSec: 20, spreadCap: 0,    script: 'standard',  label: 'Standard' },
    interview: { openSec: 60,  stepSec: 10, spreadCap: 0.10, script: 'interview', label: 'Interview' },
  };

  function buildEvents(sc, preset) {
    const lots = () => 1 + Math.floor(Math.random() * 3);
    const flip = () => (Math.random() < 0.5 ? 'buy' : 'sell');
    const first = flip(), other = first === 'buy' ? 'sell' : 'buy';
    const T = side => ({ type: 'trade', side, lots: lots() });
    const J = () => ({ type: 'judgement', item: pick(Data.JUDGEMENT) });
    /* A derived market only exists on the city product; elsewhere spend the slot
     * on a judgement call so every preset keeps its length. */
    const D = () => (sc.kind === 'compound' ? { type: 'derived' } : J());

    if (preset.script === 'warmup') {
      return [T(first), T(first), { type: 'position' }, { type: 'news' }, { type: 'pnl' }];
    }
    if (preset.script === 'standard') {
      return [T(first), T(first), { type: 'position' }, T(other), { type: 'pnl' },
              { type: 'size', mult: 10 }, { type: 'news' }, J(), D(), { type: 'pnl' }];
    }
    return [T(first), T(first), { type: 'position' }, T(first), { type: 'size', mult: 10 },
            { type: 'pnl' }, { type: 'news' }, J(), T(other), D(),
            { type: 'digital' }, { type: 'pnl' }];
  }

  /* ---------------- session ---------------- */

  function newSession(mode, presetName) {
    const preset = PRESETS[presetName] || PRESETS.standard;
    const sc = mode === 'compound' ? compoundScenario()
             : mode === 'fermi' ? fermiScenario()
             : (Math.random() < 0.5 ? compoundScenario() : fermiScenario());
    return {
      scenario: sc,
      preset, presetName,
      events: buildEvents(sc, preset),
      idx: -1,               // -1 = components/opening quote phase
      quotes: [],            // {bid, ask, ms, late}
      trades: [],            // {side, price, lots}
      marks: [],             // {kind, ok, detail}
      componentEntry: null,  // compound: what they said each input was
      newsShown: null,
      startedAt: Date.now(),
      seq: 0,                // one clock for quotes and trades, so the ledger reads in order
      done: false,
    };
  }

  /* Quoted units: everything the player types is in scaled units. */
  const toScaled = (s, v) => v / s.scale;
  const fromScaled = (s, v) => v * s.scale;

  function book(trades) {
    let pos = 0, cash = 0;
    for (const t of trades) {
      if (t.side === 'buy') { pos -= t.lots; cash += t.price * t.lots; }   // they bought from us
      else { pos += t.lots; cash -= t.price * t.lots; }
    }
    return { pos, cash };
  }
  /* Mark-to-market at a value expressed in SCALED units. */
  function pnlAt(trades, scaledValue) {
    const { pos, cash } = book(trades);
    return cash + pos * scaledValue;
  }
  const lastQuote = s => s.quotes[s.quotes.length - 1] || null;
  const lastMid = s => { const q = lastQuote(s); return q ? (q.bid + q.ask) / 2 : null; };

  function addMark(s, kind, ok, detail, weight) {
    s.marks.push({ kind, ok: ok ? 1 : 0, detail, weight: weight == null ? 1 : weight });
  }

  /* Record a quote. Returns the marks generated, for the debrief. */
  function submitQuote(s, bid, ask, ms) {
    const sc = s.scenario;
    const limit = (s.quotes.length === 0 ? s.preset.openSec : s.preset.stepSec) * 1000;
    const late = ms > limit;
    const prev = lastQuote(s);
    const q = { bid, ask, ms, late, atEvent: s.idx, seq: s.seq++ };
    s.quotes.push(q);

    addMark(s, 'timing', !late, late ? 'Over the clock on a quote' : 'Quote inside the clock');

    if (!prev) {
      const trueScaled = toScaled(sc, sc.trueValue);
      const mid = (bid + ask) / 2;
      const logErr = Math.abs(Math.log10(mid / trueScaled));
      q.logErr = logErr;
      addMark(s, 'accuracy', logErr <= 0.301, 'Opening mid was ' + accuracyWord(logErr) + ' the true value', 1);
      addMark(s, 'capture', trueScaled >= bid && trueScaled <= ask, 'True value ' + (trueScaled >= bid && trueScaled <= ask ? 'was' : 'was not') + ' inside the opening market');
      const rel = (ask - bid) / mid;
      const sane = rel >= 0.03 && rel <= 0.6;
      addMark(s, 'spread', sane, 'Opening spread was ' + Math.round(rel * 100) + '% of the mid');
      if (s.preset.spreadCap) {
        const ok = (ask - bid) <= s.preset.spreadCap * bid + 1e-9;
        addMark(s, 'spreadcap', ok, ok ? 'Respected the ' + Math.round(s.preset.spreadCap * 100) + '% spread cap'
                                       : 'Broke the ' + Math.round(s.preset.spreadCap * 100) + '% spread cap');
      }
      if (sc.kind === 'compound' && s.componentEntry) {
        const implied = toScaled(sc, s.componentEntry.dist * s.componentEntry.popA * s.componentEntry.densB);
        const d = Math.abs(Math.log10(mid / implied));
        addMark(s, 'consistency', d <= 0.05,
          'Your quoted mid ' + (d <= 0.05 ? 'matched' : 'did not match') + ' the product of your own three inputs (' + sig(implied, 3) + ')');
      }
    } else {
      /* Direction: the market must move with the flow of the trade just done. */
      const ev = s.events[s.idx];
      if (ev && ev.type === 'trade') {
        const moved = (bid + ask) / 2 - (prev.bid + prev.ask) / 2;
        const want = ev.side === 'buy' ? 1 : -1;
        const ok = moved * want > 0;
        addMark(s, 'flow', ok, ok ? 'Moved the market with the flow' : 'Failed to move the market with the flow');
      }
      if (ev && ev.type === 'size') {
        const wider = (ask - bid) > (prev.ask - prev.bid) * 1.15;
        addMark(s, 'size', wider, wider ? 'Widened for ten times the size' : 'Did not widen for ten times the size');
      }
      if (ev && ev.type === 'news') {
        /* News should pull you toward the answer. Credit either capturing it or
         * landing within a factor of two of it, since one revealed component of
         * a triple product does not pin the whole thing. */
        const trueScaled = toScaled(sc, sc.trueValue);
        const mid = (bid + ask) / 2;
        const inside = trueScaled >= bid && trueScaled <= ask;
        const close = Math.abs(Math.log10(mid / trueScaled)) <= 0.301;
        addMark(s, 'news', inside || close,
          'After the news your mid was ' + accuracyWord(Math.abs(Math.log10(mid / trueScaled))) + ' the truth');
      }
    }
    if (bid >= ask) addMark(s, 'crossed', false, 'Bid at or above your own ask');
    return q;
  }

  function accuracyWord(logErr) {
    if (logErr <= 0.1) return 'within 25% of';
    if (logErr <= 0.301) return 'within a factor of 2 of';
    if (logErr <= 0.48) return 'within a factor of 3 of';
    if (logErr <= 0.7) return 'within a factor of 5 of';
    if (logErr <= 1) return 'within a factor of 10 of';
    return 'more than a factor of 10 from';
  }

  /* Execute the trade sitting at the current event, at the live quote. */
  function fillTrade(s, ev) {
    const q = lastQuote(s);
    const price = ev.side === 'buy' ? q.ask : q.bid;
    s.trades.push({ side: ev.side, price, lots: ev.lots, seq: s.seq++ });
    return price;
  }

  /* News: either reveal one true component (compound) or bracket the truth. */
  function makeNews(s) {
    const sc = s.scenario;
    if (sc.kind === 'compound' && Math.random() < 0.75) {
      const c = pick(sc.components);
      const shown = c.key === 'popA' ? sig(c.v / 1e6, 3) + ' million' : sig(c.v, 3) + ' ' + c.unit;
      return {
        style: 'component',
        text: 'Fact: the ' + c.label.charAt(0).toLowerCase() + c.label.slice(1) + ' is ' + shown + '.',
        follow: 'Recompute. It is a product, so this leg moves your fair proportionally.',
      };
    }
    const t = sc.trueValue;
    const lo = t / rnd(1.2, 1.5), hi = t * rnd(1.2, 1.5);
    const scl = sc.scale, nm = sc.scaleName ? ' ' + sc.scaleName : '';
    return {
      style: 'bracket',
      text: 'Fact: it is more than ' + sig(lo / scl, 3) + nm + ' and less than ' + sig(hi / scl, 3) + nm + '.',
      follow: 'That is a hard bracket. Recentre inside it and tighten.',
    };
  }

  /* Derived market (compound only): area, ratio, or a single component. */
  function makeDerived(s) {
    const sc = s.scenario, A = sc.cityA, B = sc.cityB;
    const opts = [
      { label: 'the area of ' + B.name + ' in square kilometres', v: B.area, unit: 'km2',
        check: 'Area is population divided by density, exactly. It is not an independent estimate.' },
      { label: 'the ratio of ' + A.name + '’s population to ' + B.name + '’s', v: A.pop / B.pop, unit: 'x',
        check: 'This must agree with whatever you would quote on the two populations separately.' },
      { label: 'the population density of ' + A.name + ' in people per square kilometre', v: Data.density(A), unit: 'per km2',
        check: 'Same identity again: population over area.' },
    ];
    const d = pick(opts);
    const dsc = pickScale(d.v);
    return { label: d.label, v: d.v, unit: d.unit, scale: dsc.m, scaleName: dsc.name, check: d.check };
  }

  /* Digital: 100 if the quantity ends above a strike set off the player's own mid. */
  function makeDigital(s) {
    const mid = lastMid(s);
    const rel = pick([0.85, 0.9, 1.1, 1.25, 1.5]);
    const strike = mid * rel;
    const q = lastQuote(s);
    /* Their own market width is the only uncertainty they have declared: read the
     * full spread as roughly one standard deviation, lognormal about their mid. */
    const sigma = Math.max(0.05, (q.ask - q.bid) / mid);
    const z = Math.log(strike / mid) / sigma;
    const coherent = 100 * (1 - normCdf(z));
    const trueScaled = toScaled(s.scenario, s.scenario.trueValue);
    return { strike, coherent, settles: trueScaled > strike ? 100 : 0, sigma };
  }
  function normCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  /* ---------------- scoring ---------------- */

  const WEIGHTS = {
    accuracy: 22, capture: 10, spread: 8, spreadcap: 4, consistency: 10,
    flow: 14, size: 5, news: 6, position: 10, pnl: 10, judgement: 8,
    digital: 6, timing: 8, crossed: 6,
  };

  function score(s) {
    const groups = {};
    for (const m of s.marks) {
      (groups[m.kind] = groups[m.kind] || []).push(m);
    }
    let got = 0, max = 0;
    const lines = [];
    for (const k of Object.keys(groups)) {
      const w = WEIGHTS[k] || 4;
      const arr = groups[k];
      const frac = arr.reduce((a, m) => a + m.ok, 0) / arr.length;
      got += w * frac; max += w;
      lines.push({ kind: k, frac, weight: w, detail: arr.map(m => m.detail) });
    }
    const pct = max ? Math.round(100 * got / max) : 0;
    const trueScaled = toScaled(s.scenario, s.scenario.trueValue);
    return {
      pct, lines,
      settled: pnlAt(s.trades, trueScaled),
      position: book(s.trades).pos,
      trueScaled,
      grade: pct >= 80 ? 'strong' : pct >= 62 ? 'passable' : 'needs another rep',
    };
  }

  return {
    PRESETS, newSession, submitQuote, fillTrade, makeNews, makeDerived, makeDigital,
    book, pnlAt, lastQuote, lastMid, score, addMark, toScaled, fromScaled,
    parseNum, sig, pickScale, accuracyWord, normCdf,
  };
})();
