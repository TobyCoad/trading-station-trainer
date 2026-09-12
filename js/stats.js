/* Progress tab: trend, per-criterion weak spots, Fermi calibration over time. */
const Stats = (function () {
  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMES = {
    accuracy: 'Opening accuracy', capture: 'Captured the truth', spread: 'Spread discipline',
    spreadcap: 'Spread cap', consistency: 'Quote matched your own inputs', inputs: 'Component estimates',
    flow: 'Moved with the flow', size: 'Widened for size', news: 'Updated on news',
    position: 'Position tracking', pnl: 'P&L tracking', derived: 'Derived markets',
    digital: 'Option coherence', judgement: 'Judgement', timing: 'Inside the clock',
    crossed: 'Crossed your own market',
  };

  function spark(vals, w, h) {
    if (vals.length < 2) return '';
    const min = 0, max = 100;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / (max - min)) * (h - 4);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="0" y1="${(h - 2 - 0.8 * (h - 4)).toFixed(1)}" x2="${w}" y2="${(h - 2 - 0.8 * (h - 4)).toFixed(1)}" class="spark-ref"/>
      <polyline points="${pts}"/></svg>`;
  }

  function render() {
    const mm = Store.mmHistory(), fr = Store.fermiHistory();
    if (!mm.length && !fr.length) {
      el('stats-body').innerHTML = '<p class="empty">Nothing recorded yet. Make a market.</p>';
      return;
    }
    let html = '';

    if (mm.length) {
      const last10 = mm.slice(-10);
      const avg = Math.round(last10.reduce((a, r) => a + r.pct, 0) / last10.length);
      const best = Math.max(...mm.map(r => r.pct));
      const money = mm.reduce((a, r) => a + (r.settled > 0 ? 1 : 0), 0);
      html += `<div class="card">
        <h3>Market making</h3>
        <div class="kpis">
          <div><b>${mm.length}</b><span>markets</span></div>
          <div><b>${avg}%</b><span>last 10</span></div>
          <div><b>${best}%</b><span>best</span></div>
          <div><b>${Math.round(100 * money / mm.length)}%</b><span>settled up</span></div>
        </div>
        ${spark(mm.slice(-30).map(r => r.pct), 300, 54)}
        <p class="hint">The line is your score, session by session. The rule is 80%.</p>
      </div>`;

      const agg = {};
      for (const r of mm) for (const l of (r.lines || [])) {
        const a = agg[l.kind] = agg[l.kind] || { s: 0, n: 0 };
        a.s += l.frac; a.n++;
      }
      const rows = Object.keys(agg).map(k => ({ k, f: agg[k].s / agg[k].n, n: agg[k].n }))
        .sort((a, b) => a.f - b.f);
      html += `<div class="card"><h3>By criterion, all sessions</h3>` +
        rows.map(r => `<div class="bar-row">
            <span class="bar-label">${esc(NAMES[r.k] || r.k)}</span>
            <span class="bar"><i style="width:${Math.round(r.f * 100)}%" class="${r.f >= 0.85 ? 'ok' : r.f >= 0.6 ? 'near' : 'no'}"></i></span>
            <span class="bar-val">${Math.round(r.f * 100)}%</span></div>`).join('') +
        `<p class="hint">Worst first. Fix the top two before adding clocks.</p></div>`;
    }

    if (fr.length) {
      const last = fr.slice(-10);
      const avg = Math.round(last.reduce((a, r) => a + r.pct, 0) / last.length);
      const med = last.reduce((a, r) => a + r.medLogErr, 0) / last.length;
      const withHit = fr.filter(r => r.hit != null);
      const hit = withHit.length ? withHit.slice(-10).reduce((a, r) => a + r.hit, 0) / Math.min(10, withHit.length) : null;
      const bias = last.reduce((a, r) => a + (r.bias || 0), 0) / last.length;
      html += `<div class="card">
        <h3>Fermi</h3>
        <div class="kpis">
          <div><b>${fr.length}</b><span>runs</span></div>
          <div><b>${avg}%</b><span>last 10</span></div>
          <div><b>${(Math.pow(10, med)).toFixed(1)}x</b><span>median error</span></div>
          <div><b>${hit == null ? '—' : Math.round(hit * 100) + '%'}</b><span>interval hits</span></div>
        </div>
        ${spark(fr.slice(-30).map(r => r.pct), 300, 54)}
        <p class="hint">${hit == null ? 'Turn on the 90% interval to get a calibration number.'
          : hit < 0.8 ? 'Below 90%: your intervals are too narrow, which is the same mistake as quoting too tight.'
          : hit > 0.98 ? 'Above 90%: your intervals are wider than they need to be, which is the same mistake as quoting too wide.'
          : 'Calibrated. That is the hard part done.'}</p>
        <p class="hint">${Math.abs(bias) < 0.08 ? 'No systematic direction to your misses.'
          : bias > 0 ? 'You estimate high more often than low.' : 'You estimate low more often than high.'}</p>
      </div>`;
    }

    el('stats-body').innerHTML = html;
  }

  return { render };
})();
