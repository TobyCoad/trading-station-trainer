/* Fermi sprint: point estimate under a clock, optionally with a 90% interval.
 * Graded on order-of-magnitude accuracy and, if intervals are on, calibration —
 * the fraction of your 90% intervals that actually contain the answer. */
const Fermi = (function () {

  function newRun(n, withInterval, secs) {
    const pool = Data.FERMI.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return {
      items: pool.slice(0, n),
      withInterval, secs,
      idx: 0,
      answers: [],       // {est, lo, hi, ms, late, logErr, inside}
      startedAt: Date.now(),
    };
  }

  function submit(run, est, lo, hi, ms) {
    const it = run.items[run.idx];
    const late = run.secs > 0 && ms > run.secs * 1000;
    const valid = isFinite(est) && est > 0;
    const logErr = valid ? Math.abs(Math.log10(est / it.v)) : 99;
    const inside = (run.withInterval && isFinite(lo) && isFinite(hi) && lo > 0)
      ? (it.v >= Math.min(lo, hi) && it.v <= Math.max(lo, hi)) : null;
    const width = (run.withInterval && isFinite(lo) && isFinite(hi) && lo > 0)
      ? Math.abs(Math.log10(Math.max(lo, hi) / Math.min(lo, hi))) : null;
    run.answers.push({ est, lo, hi, ms, late, logErr, inside, width, item: it });
    run.idx++;
    return run.answers[run.answers.length - 1];
  }

  /* Band points: within 25% is what a good estimator hits on a familiar quantity. */
  function points(logErr) {
    if (logErr <= 0.1) return 10;
    if (logErr <= 0.2) return 8;
    if (logErr <= 0.301) return 6;     // factor of 2
    if (logErr <= 0.48) return 4;      // factor of 3
    if (logErr <= 0.7) return 2;       // factor of 5
    if (logErr <= 1) return 1;         // factor of 10
    return 0;
  }

  function summary(run) {
    const a = run.answers.filter(x => isFinite(x.logErr) && x.logErr < 90);
    const n = run.answers.length || 1;
    const pts = run.answers.reduce((s, x) => s + points(x.logErr), 0);
    const med = a.length ? a.map(x => x.logErr).sort((p, q) => p - q)[Math.floor(a.length / 2)] : 99;
    const within2 = run.answers.filter(x => x.logErr <= 0.301).length / n;
    const within10 = run.answers.filter(x => x.logErr <= 1).length / n;
    const withInt = run.answers.filter(x => x.inside !== null);
    const hit = withInt.length ? withInt.filter(x => x.inside).length / withInt.length : null;
    const avgWidth = withInt.length ? withInt.reduce((s, x) => s + (x.width || 0), 0) / withInt.length : null;
    const avgMs = run.answers.reduce((s, x) => s + x.ms, 0) / n;
    /* Signed bias: are you systematically high or low? */
    const bias = a.length ? a.reduce((s, x) => s + Math.log10(x.est / x.item.v), 0) / a.length : 0;
    return {
      pts, max: n * 10, pct: Math.round(100 * pts / (n * 10)),
      medLogErr: med, within2, within10, hit, avgWidth, avgMs, bias, n,
      calibration: hit === null ? null : (hit >= 0.8 && hit <= 0.98 ? 'well calibrated'
                   : hit < 0.8 ? 'overconfident — your intervals are too narrow'
                   : 'underconfident — your intervals are wider than they need to be'),
    };
  }

  return { newRun, submit, summary, points };
})();
