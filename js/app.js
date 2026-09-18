/* App shell: screens, settings, and the three drills. */
(function () {
  const APP_VERSION = 5;
  window.APP_VERSION = APP_VERSION;
  const el = id => document.getElementById(id);
  const SCREENS = ['home', 'mm', 'mmres', 'fermi', 'fres', 'judge', 'stats', 'brief'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sig = Engine.sig;
  const num = Engine.parseNum;
  const clock = ms => {
    const neg = ms < 0; const t = Math.abs(Math.round(ms / 1000));
    return (neg ? '-' : '') + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };

  let settings = Store.loadSettings();

  /* ---------------- screens ---------------- */
  function show(name) {
    SCREENS.forEach(s => el('screen-' + s).classList.toggle('active', s === name));
    const inGame = ['mm', 'fermi', 'judge'].includes(name);
    el('tabbar').classList.toggle('hidden', inGame);
    const tab = ['stats', 'brief'].includes(name) ? name : 'home';
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (name === 'stats') Stats.render();
    if (name === 'home') refreshHome();
    window.scrollTo(0, 0);
  }

  /* ---------------- settings ---------------- */
  function syncSettings() {
    document.querySelectorAll('.seg[data-key]').forEach(seg => {
      const cur = String(settings[seg.dataset.key]);
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === cur));
    });
    document.querySelectorAll('input[type=checkbox][data-key]').forEach(c => { c.checked = !!settings[c.dataset.key]; });
  }
  function wireSettings() {
    document.querySelectorAll('.seg[data-key]').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = seg.dataset.key, v = b.dataset.val;
      settings[k] = /^-?\d*\.?\d+$/.test(v) ? +v : v;
      Store.saveSettings(settings); syncSettings(); refreshHome();
    }));
    document.querySelectorAll('input[type=checkbox][data-key]').forEach(c =>
      c.addEventListener('change', () => { settings[c.dataset.key] = c.checked; Store.saveSettings(settings); }));
    el('btn-interview').addEventListener('click', () => {
      Object.assign(settings, { preset: 'interview', feedback: 'end', mode: 'reported', pnlTolerance: 0.10, ledger: 'hide' });
      Store.saveSettings(settings); syncSettings(); refreshHome(); startMM();
    });
    el('btn-reset').addEventListener('click', () => {
      if (confirm('Erase every recorded session? This cannot be undone.')) { Store.reset(); refreshHome(); }
    });
  }
  function refreshHome() {
    const p = Engine.PRESETS[settings.preset];
    const rp = Store.loadReported();
    const left = Data.REPORTED.filter(r => !r.sprintOnly && !rp.seen.includes(r.id)).length;
    const modeName = settings.mode === 'compound' ? 'city product'
                   : settings.mode === 'fermi' ? 'Fermi quantity'
                   : settings.mode === 'reported' ? (left ? `reported questions first, ${left} unseen` : 'reported questions, all seen once, now mixed')
                   : 'mixed scenarios';
    el('mm-desc').textContent = `${modeName} · ${p.label} clocks · ${p.openSec}s to open, ${p.stepSec}s to requote`;
    const h = Store.mmHistory();
    const f = Store.fermiHistory();
    const badge = el('ready-badge');
    if (!h.length && !f.length) { badge.textContent = 'no sessions yet'; badge.className = 'badge'; }
    else {
      const recent = h.slice(-5);
      const avg = recent.length ? Math.round(recent.reduce((a, r) => a + r.pct, 0) / recent.length) : null;
      badge.textContent = avg == null ? `${f.length} Fermi runs` : `last 5 markets: ${avg}%`;
      badge.className = 'badge ' + (avg == null ? '' : avg >= 80 ? 'ok' : avg >= 62 ? 'near' : 'no');
    }
    const parts = [];
    if (h.length) parts.push(`${h.length} market${h.length === 1 ? '' : 's'} made`);
    if (f.length) parts.push(`${f.length} Fermi run${f.length === 1 ? '' : 's'}`);
    el('best-line').textContent = parts.join(' · ');
  }

  /* ---------------- clock ---------------- */
  let tickHandle = null, stepStart = 0, stepLimit = 0;
  function startClock(sec, label) {
    stopClock();
    stepStart = Date.now(); stepLimit = sec * 1000;
    const paint = () => {
      const used = Date.now() - stepStart;
      const left = stepLimit - used;
      const node = el(label);
      /* With no limit the clock counts up, so you can still see how long you took. */
      node.textContent = clock(stepLimit ? left : used);
      node.classList.toggle('warn', !!stepLimit && left <= 0);
      node.classList.toggle('near', !!stepLimit && left > 0 && left < 5000);
    };
    paint();
    tickHandle = setInterval(paint, 200);
  }
  function stopClock() { if (tickHandle) clearInterval(tickHandle); tickHandle = null; }
  const elapsed = () => Date.now() - stepStart;

  /* ================================================================
   *                        MARKET MAKING
   * ================================================================ */
  let S = null, phase = null, ctx = null;

  /* Per-question transcript for the debrief: what was asked, what you said,
   * what was right, and why. Filled in as each step is answered. */
  const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
  function logStep(prompt, answer, ok, truth, note) {
    if (!S) return;
    const limit = (S.steps && S.steps.length ? S.preset.stepSec : S.preset.openSec) * 1000;
    const ms = elapsed();
    (S.steps = S.steps || []).push({ prompt, answer, ok: ok === 'near' ? 'near' : ok ? 'ok' : 'no', truth, note: note || '', secs: Math.round(ms / 1000), late: ms > limit });
  }

  function startMM() {
    S = Engine.newSession(settings.mode, settings.preset, Store.loadReported());
    phase = S.scenario.components ? 'components' : 'open';
    ctx = {};
    el('mm-title').textContent = S.scenario.kind === 'compound' ? 'City product · ' + S.scenario.title
      : S.scenario.kind === 'product' ? 'Town product · reported shape'
      : S.scenario.src ? 'Reported question' : 'Fermi market';
    el('mm-prompt').textContent = S.scenario.prompt;
    show('mm');
    renderPhase();
  }

  const unitLine = sc => sc.scaleName
    ? `Quote in <b>${sc.scaleName}s</b>, so a quote of 5 means five ${sc.scaleName}.`
    : `Quote the number itself, in ${esc(sc.unitName)}.`;

  function quoteInputs(preBid, preAsk) {
    const sc = S.scenario;
    const cap = S.preset.spreadCap
      ? `<p class="note">Spread cap in force: your ask may not exceed your bid by more than ${Math.round(S.preset.spreadCap * 100)}%.</p>` : '';
    return `<div class="card">
      <p class="ilabel">${unitLine(sc)}</p>
      <div class="pair">
        <label>Bid<input class="num" id="in-bid" inputmode="decimal" autocomplete="off" value="${preBid || ''}"></label>
        <label>Ask<input class="num" id="in-ask" inputmode="decimal" autocomplete="off" value="${preAsk || ''}"></label>
      </div>
      <p class="hint" id="spread-hint"></p>${cap}</div>`;
  }
  function wireSpreadHint() {
    const f = () => {
      const b = num(el('in-bid').value), a = num(el('in-ask').value);
      const h = el('spread-hint'); if (!h) return;
      if (!isFinite(b) || !isFinite(a)) { h.textContent = ''; return; }
      if (a <= b) { h.textContent = 'Your ask is not above your bid.'; h.className = 'hint bad'; return; }
      const mid = (a + b) / 2;
      let t = `mid ${sig(mid, 4)} · spread ${sig(a - b, 3)} = ${Math.round((a - b) / mid * 100)}% of mid`;
      if (S.preset.spreadCap && (a - b) > S.preset.spreadCap * b) t += ' · over the cap';
      h.textContent = t; h.className = 'hint';
    };
    ['in-bid', 'in-ask'].forEach(id => { const n = el(id); if (n) n.addEventListener('input', f); });
    /* Enter moves bid -> ask -> submit, so a two-number quote is one flow. */
    const bid = el('in-bid'), ask = el('in-ask');
    if (bid) bid.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ask.focus(); } });
    if (bid) setTimeout(() => bid.focus(), 0);
    f();
  }
  const numberInput = (label, hint) => `<div class="card">
      <p class="ilabel">${label}</p>
      <input class="num wide" id="in-one" inputmode="text" autocomplete="off">
      ${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;

  function renderPhase() {
    el('mm-feedback').classList.add('hidden');
    const sc = S.scenario;
    if (phase === 'components') {
      el('mm-step').textContent = 'your inputs';
      el('mm-say').innerHTML = '<b>Before you quote:</b> what are your ' + (sc.components.length === 2 ? 'two' : 'three') + ' numbers? They will be checked against the market you then make.';
      el('mm-inputs').innerHTML = '<div class="card">' + sc.components.map(c =>
        `<label class="stack">${esc(c.label)} <small>${esc(c.unit)}</small>
          <input class="num wide" data-ck="${c.key}" inputmode="decimal" autocomplete="off"></label>`).join('') +
        '<p class="hint">Say them out loud as you type them. This is the decomposition the room hears.</p></div>';
      const first = document.querySelector('#mm-inputs input[data-ck]');
      if (first) setTimeout(() => first.focus(), 0);
      document.querySelectorAll('#mm-inputs input[data-ck]').forEach((n, i, all) =>
        n.addEventListener('keydown', e => {
          if (e.key !== 'Enter' || i >= all.length - 1) return;
          e.preventDefault(); e.stopPropagation(); all[i + 1].focus();
        }));
      startClock(S.preset.openSec, 'mm-timer');
      return;
    }
    if (phase === 'open') {
      el('mm-step').textContent = 'opening quote';
      el('mm-say').innerHTML = '<b>Trader:</b> "Make me a market."';
      el('mm-inputs').innerHTML = quoteInputs();
      wireSpreadHint();
      startClock(S.preset.openSec, 'mm-timer');
      return;
    }
    renderEvent();
  }

  function renderEvent() {
    const ev = S.events[S.idx], sc = S.scenario, q = Engine.lastQuote(S);
    el('mm-step').textContent = `step ${S.idx + 1} of ${S.events.length}`;
    let say = '', inputs = '';
    ctx = {};

    if (ev.type === 'trade') {
      const price = Engine.fillTrade(S, ev);
      const verb = ev.side === 'buy' ? 'buy' : 'sell';
      const at = ev.side === 'buy' ? 'your offer of' : 'your bid of';
      say = `<b>Trader:</b> "I ${verb} ${ev.lots} lot${ev.lots > 1 ? 's' : ''} at ${at} ${sig(price, 4)}. Market?"`;
      inputs = quoteInputs();
    } else if (ev.type === 'news') {
      const n = Engine.makeNews(S); S.newsShown = n;
      say = `<b>Trader:</b> "${esc(n.text)} Market?"`;
      inputs = quoteInputs();
    } else if (ev.type === 'size') {
      say = `<b>Trader:</b> "Would you show me that price in ${ev.mult} times the size?"`;
      inputs = quoteInputs();
    } else if (ev.type === 'position') {
      say = `<b>Trader:</b> "What's your position right now?"`;
      inputs = numberInput('Net position in lots', 'Positive for long, negative for short. Exact.');
    } else if (ev.type === 'pnl') {
      say = `<b>Trader:</b> "What's your P&amp;L, marked at your own current fair?"`;
      inputs = numberInput('P&L in quoted units',
        `Sign matters. Accepted within ${Math.round(settings.pnlTolerance * 100)}%.`);
    } else if (ev.type === 'judgement') {
      say = `<b>Trader:</b> "${esc(ev.item.q)}"`;
      inputs = '<div class="card opts">' + ev.item.opts.map((o, i) =>
        `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('') + '</div>';
    } else if (ev.type === 'derived') {
      const d = Engine.makeDerived(S); ctx.derived = d;
      say = `<b>Trader:</b> "Now make me a market on ${esc(d.label)}."`;
      inputs = `<div class="card">
        <p class="ilabel">${d.scaleName ? 'Quote in <b>' + d.scaleName + 's</b> of ' + esc(d.unit) : 'Quote in ' + esc(d.unit)}.</p>
        <div class="pair">
          <label>Bid<input class="num" id="in-bid" inputmode="decimal" autocomplete="off"></label>
          <label>Ask<input class="num" id="in-ask" inputmode="decimal" autocomplete="off"></label>
        </div>
        <p class="hint">It has to sit consistently beside what you have already quoted.</p></div>`;
    } else if (ev.type === 'digital') {
      const d = Engine.makeDigital(S); ctx.digital = d;
      say = `<b>Trader:</b> "A contract pays 100 if the quantity turns out to be above ${sig(d.strike, 4)}${sc.scaleName ? ' ' + sc.scaleName : ''}. Make me a market on it."`;
      inputs = `<div class="card">
        <p class="ilabel">Quote between 0 and 100.</p>
        <div class="pair">
          <label>Bid<input class="num" id="in-bid" inputmode="decimal" autocomplete="off"></label>
          <label>Ask<input class="num" id="in-ask" inputmode="decimal" autocomplete="off"></label>
        </div>
        <p class="hint">Coherent with your own market, not with a fresh opinion.</p></div>`;
    }

    el('mm-say').innerHTML = say;
    ctx.prompt = plain(say).replace(/^Trader:\s*/, '');
    el('mm-inputs').innerHTML = inputs;
    el('mm-submit').classList.toggle('hidden', ev.type === 'judgement');
    if (ev.type === 'judgement') {
      document.querySelectorAll('#mm-inputs .opt').forEach(b =>
        b.addEventListener('click', () => answerJudgement(+b.dataset.i)));
    } else if (el('in-bid')) wireSpreadHint();
    else if (el('in-one')) setTimeout(() => { const n = el('in-one'); if (n) n.focus(); }, 0);
    renderLedger();
    startClock(ev.type === 'position' || ev.type === 'pnl' ? Math.max(S.preset.stepSec, 15) : S.preset.stepSec, 'mm-timer');
  }

  function answerJudgement(i) {
    const ev = S.events[S.idx];
    const ok = i === ev.item.a;
    Engine.addMark(S, 'judgement', ok, (ok ? 'Right call: ' : 'Wrong call: ') + ev.item.q);
    S.judgeLast = { ok, item: ev.item };
    logStep(ctx.prompt || ev.item.q, ev.item.opts[i], ok, ev.item.opts[ev.item.a], ev.item.why);
    stepFeedback(ok, ok ? 'Right.' : 'Not the answer they want.', ev.item.why);
    advance();
  }

  function stepFeedback(ok, head, body) {
    if (settings.feedback !== 'step') return;
    const f = el('mm-feedback');
    f.className = 'feedback ' + (ok ? 'good' : 'bad');
    f.innerHTML = `<b>${esc(head)}</b>${body ? '<br>' + esc(body) : ''}`;
    f.classList.remove('hidden');
  }

  function submitMM() {
    const sc = S.scenario;
    if (phase === 'components') {
      const vals = {};
      let bad = false;
      document.querySelectorAll('#mm-inputs input[data-ck]').forEach(n => {
        const c = sc.components.find(x => x.key === n.dataset.ck);
        const v = num(n.value);
        if (!isFinite(v) || v <= 0) bad = true;
        vals[c.key] = v * c.entryScale;
      });
      if (bad) return flash('Fill in every input.');
      S.componentEntry = vals;
      for (const c of sc.components) {
        const d = Math.abs(Math.log10(vals[c.key] / c.v));
        Engine.addMark(S, 'inputs', d <= 0.301,
          `${c.label}: you said ${sig(vals[c.key] / c.entryScale, 3)}, true ${sig(c.v / c.entryScale, 3)} ${c.unit}`);
      }
      const within = c => Math.abs(Math.log10(vals[c.key] / c.v)) <= 0.301;
      const showV = (c, v) => sig(v / c.entryScale, 3);
      logStep('Your inputs, before you quote',
        sc.components.map(c => `${c.label} ${showV(c, vals[c.key])}`).join(' | '),
        sc.components.every(within) ? true : sc.components.some(within) ? 'near' : false,
        sc.components.map(c => `${c.label} ${showV(c, c.v)} ${c.unit}`).join(' | '),
        'Within a factor of two on each input is the target; the product then lands close enough to quote around.');
      phase = 'open'; renderPhase(); return;
    }
    if (phase === 'open') {
      const b = num(el('in-bid').value), a = num(el('in-ask').value);
      if (!isFinite(b) || !isFinite(a)) return flash('Two numbers, please.');
      if (a <= b) return flash('Your ask must be above your bid.');
      const q = Engine.submitQuote(S, b, a, elapsed());
      const t = Engine.toScaled(sc, sc.trueValue);
      const openMarks = S.marks.filter(m => ['accuracy', 'capture', 'spread', 'spreadcap', 'consistency'].includes(m.kind));
      logStep('"Make me a market." (opening quote)', `${sig(b, 4)} at ${sig(a, 4)}, mid ${sig((a + b) / 2, 4)}`,
        (t >= b && t <= a) ? true : (q.logErr <= 0.301 ? 'near' : false),
        `True value ${sig(t, 4)}${sc.scaleName ? ' ' + sc.scaleName : ''}; your mid was ${Engine.accuracyWord(q.logErr)} it`,
        openMarks.map(m => m.detail).join('. ') + '.');
      stepFeedback(t >= b && t <= a, t >= b && t <= a ? 'True value is inside your market.' : 'True value is outside your market.',
        'True value ' + sig(t, 4) + (sc.scaleName ? ' ' + sc.scaleName : ''));
      phase = 'event'; S.idx = 0; renderEvent(); return;
    }

    const ev = S.events[S.idx];
    if (['trade', 'news', 'size'].includes(ev.type)) {
      const b = num(el('in-bid').value), a = num(el('in-ask').value);
      if (!isFinite(b) || !isFinite(a)) return flash('Two numbers, please.');
      if (a <= b) return flash('Your ask must be above your bid.');
      const before = S.marks.length;
      const prevQ = Engine.lastQuote(S);
      Engine.submitQuote(S, b, a, elapsed());
      const added = S.marks.slice(before).filter(m => ['flow', 'size', 'news'].includes(m.kind));
      const t = Engine.toScaled(sc, sc.trueValue);
      let truth = '';
      if (ev.type === 'trade') {
        const bk = Engine.book(S.trades);
        const bookNow = (bk.pos === 0 ? 'flat' : bk.pos > 0 ? 'long ' + bk.pos : 'short ' + (-bk.pos)) + ', cash ' + sig(bk.cash, 4);
        truth = `They ${ev.side === 'buy' ? 'bought from you, so your mid should move up' : 'sold to you, so your mid should move down'} from ${sig((prevQ.bid + prevQ.ask) / 2, 4)}. Book now: ${bookNow}`;
      } else if (ev.type === 'size') {
        truth = `Widen for size: clearly wider than ${sig(prevQ.ask - prevQ.bid, 3)} (or refuse the size), and say why`;
      } else if (ev.type === 'news') {
        truth = `Recentre toward the truth, ${sig(t, 4)}${sc.scaleName ? ' ' + sc.scaleName : ''}, and tighten`;
      }
      logStep(ctx.prompt || ev.type, `${sig(b, 4)} at ${sig(a, 4)}, mid ${sig((a + b) / 2, 4)}`,
        added.length ? added.every(m => m.ok) : true, truth,
        added.map(m => m.detail).join('. ') + (ev.type === 'news' && S.newsShown ? '. ' + S.newsShown.follow : ''));
      if (added.length) stepFeedback(added.every(m => m.ok), added.map(m => m.detail).join('. '), ev.type === 'news' && S.newsShown ? S.newsShown.follow : '');
      return advance();
    }
    if (ev.type === 'position') {
      const v = num(el('in-one').value);
      const truth = Engine.book(S.trades).pos;
      const ok = isFinite(v) && Math.round(v) === truth;
      Engine.addMark(S, 'position', ok, `Position: you said ${isFinite(v) ? v : '—'}, it was ${truth}`);
      logStep(ctx.prompt, isFinite(v) ? String(v) : '(blank)', ok,
        truth === 0 ? 'Flat' : (truth > 0 ? 'Long ' + truth : 'Short ' + (-truth)),
        'Count every fill: they buy from you, you go shorter; they sell to you, you go longer.');
      stepFeedback(ok, ok ? 'Correct.' : 'Wrong.', `You are ${truth === 0 ? 'flat' : (truth > 0 ? 'long ' + truth : 'short ' + (-truth))}.`);
      return advance();
    }
    if (ev.type === 'pnl') {
      const v = num(el('in-one').value);
      const mid = Engine.lastMid(S);
      const truth = Engine.pnlAt(S.trades, mid);
      const tol = Math.max(Math.abs(truth) * settings.pnlTolerance, 1e-9);
      const ok = isFinite(v) && Math.abs(v - truth) <= tol && (truth === 0 || Math.sign(v) === Math.sign(truth));
      Engine.addMark(S, 'pnl', ok, `P&L at your fair: you said ${isFinite(v) ? sig(v, 4) : '—'}, it was ${sig(truth, 4)}`);
      {
        const bk = Engine.book(S.trades);
        const near = isFinite(v) && Math.sign(v) === Math.sign(truth) && Math.abs(v - truth) <= Math.max(Math.abs(truth) * 0.25, 1e-9);
        logStep(ctx.prompt, isFinite(v) ? sig(v, 4) : '(blank)', ok ? true : (near ? 'near' : false),
          `${sig(truth, 4)}: cash ${sig(bk.cash, 4)} + position ${bk.pos} x fair ${sig(mid, 4)}`,
          `Accepted within ${Math.round(settings.pnlTolerance * 100)}%. Two numbers, always: position and cash; P&L is cash plus position times your mid.`);
      }
      stepFeedback(ok, ok ? 'Correct.' : 'Off.', `Marked at your fair of ${sig(mid, 4)} the book is ${sig(truth, 4)}.`);
      return advance();
    }
    if (ev.type === 'derived') {
      const b = num(el('in-bid').value), a = num(el('in-ask').value);
      const d = ctx.derived;
      if (!isFinite(b) || !isFinite(a)) return flash('Two numbers, please.');
      if (a <= b) return flash('Your ask must be above your bid.');
      const t = d.v / d.scale, mid = (a + b) / 2;
      const inside = t >= b && t <= a;
      const near = Math.abs(Math.log10(mid / t)) <= 0.301;
      Engine.addMark(S, 'derived', inside || near, `${d.label}: you quoted ${sig(b, 3)} at ${sig(a, 3)}, true ${sig(t, 3)}`);
      logStep(ctx.prompt, `${sig(b, 3)} at ${sig(a, 3)}`, inside ? true : near ? 'near' : false,
        `True ${sig(t, 3)}${d.scaleName ? ' ' + d.scaleName : ''} ${d.unit}`, d.check);
      stepFeedback(inside || near, inside ? 'Inside.' : near ? 'Close enough.' : 'Missed.', d.check);
      return advance();
    }
    if (ev.type === 'digital') {
      const b = num(el('in-bid').value), a = num(el('in-ask').value);
      const d = ctx.digital;
      if (!isFinite(b) || !isFinite(a)) return flash('Two numbers, please.');
      if (a <= b) return flash('Your ask must be above your bid.');
      const mid = (a + b) / 2;
      const ok = Math.abs(mid - d.coherent) <= 15 && b >= 0 && a <= 100;
      const noZero = !(a <= 0.5 && d.coherent > 0.5);
      Engine.addMark(S, 'digital', ok, `Digital: you quoted ${sig(b, 3)} at ${sig(a, 3)}; coherent with your own market was about ${Math.round(d.coherent)}`);
      Engine.addMark(S, 'digital', noZero, noZero ? 'Offered something for the tail' : 'Quoted a zero offer on a tail you cannot rule out');
      logStep(ctx.prompt, `${sig(b, 3)} at ${sig(a, 3)}`, ok && noZero ? true : (ok || noZero) ? 'near' : false,
        `About ${Math.round(d.coherent)}, reading your own spread as one standard deviation; it settled at ${d.settles}`,
        (noZero ? '' : 'Never offer zero on a tail you cannot rule out. ') + 'Price it off your own market, not a fresh opinion.');
      stepFeedback(ok, ok ? 'Coherent.' : 'Not coherent with your own market.',
        `Reading your own spread as one standard deviation, that strike is worth about ${Math.round(d.coherent)}. It settled at ${d.settles}.`);
      return advance();
    }
  }

  function advance() {
    S.idx++;
    if (S.idx >= S.events.length) return finishMM();
    if (settings.feedback === 'step') {
      /* Leave the feedback visible for a beat before the next prompt replaces it. */
      const keep = el('mm-feedback').innerHTML, cls = el('mm-feedback').className;
      renderEvent();
      el('mm-feedback').innerHTML = keep; el('mm-feedback').className = cls;
    } else renderEvent();
  }

  function flash(msg) {
    const f = el('mm-feedback');
    f.className = 'feedback bad'; f.textContent = msg; f.classList.remove('hidden');
    setTimeout(() => { if (settings.feedback !== 'step') f.classList.add('hidden'); }, 1800);
  }

  function renderLedger(target) {
    const node = el(target || 'mm-ledger');
    if (!S) { node.innerHTML = ''; return; }
    /* In the room nobody shows you your fills. Hidden by default in interview mode;
     * the debrief always shows the full ledger. */
    if (!target && settings.ledger === 'hide') {
      node.innerHTML = '<p class="dim">Ledger hidden: keep position and cash yourself.</p>'; return;
    }
    const items = []
      .concat(S.quotes.map(q => ({ seq: q.seq, html:
        `<div class="lrow"><span class="ltag">quote</span><span>${sig(q.bid, 4)} at ${sig(q.ask, 4)}</span><span class="lms">${(q.ms / 1000).toFixed(1)}s${q.late ? ' late' : ''}</span></div>` })))
      .concat(S.trades.map(t => ({ seq: t.seq, html:
        `<div class="lrow trade"><span class="ltag">${t.side === 'buy' ? 'they bought' : 'they sold'}</span><span>${t.lots} @ ${sig(t.price, 4)}</span><span class="lms"></span></div>` })))
      .sort((a, b) => a.seq - b.seq);
    const rows = items.map(i => i.html);
    node.innerHTML = `<h3>Ledger</h3>${rows.join('')}` +
      (target ? '' : '<p class="hint">Position and P&amp;L are deliberately not shown. Carry them yourself.</p>');
  }

  function finishMM() {
    stopClock();
    S.done = true;
    const r = Engine.score(S);
    const sc = S.scenario;
    if (S.mode === 'reported') {
      /* Only a finished sitting counts, so quitting never burns a reported question. */
      const rp = Store.loadReported();
      rp.n = (rp.n || 0) + 1;
      if (S.reportedId && !rp.seen.includes(S.reportedId)) rp.seen.push(S.reportedId);
      Store.saveReported(rp);
    }
    Store.pushMM({
      at: Date.now(), pct: r.pct, kind: sc.kind, preset: S.presetName,
      title: sc.title, settled: r.settled, position: r.position,
      lines: r.lines.map(l => ({ kind: l.kind, frac: l.frac })),
    });
    el('res-score').textContent = r.pct + '%';
    el('res-score').className = 'score ' + (r.pct >= 80 ? 'ok' : r.pct >= 62 ? 'near' : 'no');
    el('res-grade').textContent = r.grade;
    const q0 = S.quotes[0];
    el('res-truth').innerHTML = `
      <h3>${esc(sc.title)}</h3>
      ${sc.src ? `<p class="dim"><b>Reported:</b> ${esc(sc.src)}</p>` : ''}
      ${sc.fairValue != null
        ? `<p><b>Fair value: ${sig(sc.fairValue, 4)} ${esc(sc.unitName)}.</b> It settled at <b>${sig(r.trueScaled, 4)}</b>, which is the draw, not a verdict on your quote.</p>`
        : `<p><b>True value: ${sig(r.trueScaled, 5)}${sc.scaleName ? ' ' + sc.scaleName : ''} ${esc(sc.components ? '' : sc.unitName)}</b></p>`}
      <p>Your opening market was ${sig(q0.bid, 4)} at ${sig(q0.ask, 4)}, a mid of ${sig((q0.bid + q0.ask) / 2, 4)} —
      ${Engine.accuracyWord(q0.logErr)} the ${sc.fairValue != null ? 'fair value' : 'answer'}.</p>
      <p>You finished <b>${r.position === 0 ? 'flat' : r.position > 0 ? 'long ' + r.position : 'short ' + (-r.position)}</b>
      with a settled P&amp;L of <b class="${r.settled >= 0 ? 'pos' : 'neg'}">${r.settled >= 0 ? '+' : ''}${sig(r.settled, 4)}</b> in quoted units.</p>
      <p class="dim">${esc(sc.hint)}</p>`;
    const order = ['accuracy', 'capture', 'spread', 'spreadcap', 'consistency', 'inputs', 'flow', 'size',
                   'news', 'position', 'pnl', 'derived', 'digital', 'judgement', 'timing', 'crossed'];
    const NAMES = {
      accuracy: 'Opening accuracy', capture: 'Captured the truth', spread: 'Spread discipline',
      spreadcap: 'Spread cap', consistency: 'Quote matched your own inputs', inputs: 'Component estimates',
      flow: 'Moved with the flow', size: 'Widened for size', news: 'Updated on news',
      position: 'Position tracking', pnl: 'P&L tracking', derived: 'Derived markets',
      digital: 'Option coherence', judgement: 'Judgement', timing: 'Inside the clock', crossed: 'Crossed your own market',
    };
    el('res-lines').innerHTML = r.lines
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
      .map(l => `<div class="mline ${l.frac >= 0.999 ? 'ok' : l.frac > 0 ? 'near' : 'no'}">
          <div class="mhead"><b>${NAMES[l.kind] || l.kind}</b><span>${Math.round(l.frac * 100)}%</span></div>
          <ul>${l.detail.map(d => '<li>' + esc(d) + '</li>').join('')}</ul></div>`).join('');
    renderLedger('res-ledger');
    const steps = S.steps || [];
    el('res-steps').innerHTML = steps.length ? steps.map((st, i) => `
      <div class="mline step ${st.ok}">
        <div class="mhead"><b>${i + 1}. ${esc(st.prompt)}</b><span>${st.ok === 'ok' ? 'right' : st.ok === 'near' ? 'close' : 'wrong'}${st.late ? ' · over the clock' : ''} · ${st.secs}s</span></div>
        <div class="srow"><span class="slab">You</span><span>${esc(st.answer)}</span></div>
        <div class="srow"><span class="slab">Right</span><span>${esc(st.truth)}</span></div>
        ${st.note ? `<div class="srow"><span class="slab">Why</span><span class="dim">${esc(st.note)}</span></div>` : ''}
      </div>`).join('') : '<p class="dim">No steps recorded.</p>';
    const weak = r.lines.filter(l => l.frac < 1).sort((a, b) => a.frac - b.frac).slice(0, 3);
    el('res-hint').innerHTML = weak.length
      ? '<h3>What to fix first</h3><ul>' + weak.map(l => `<li>${esc(NAMES[l.kind] || l.kind)}</li>`).join('') + '</ul>'
      : '<h3>Clean sheet.</h3><p>Raise the clocks or switch to interview mode.</p>';
    show('mmres');
  }

  /* ================================================================
   *                          FERMI SPRINT
   * ================================================================ */
  let F = null;
  function startFermi() {
    F = Fermi.newRun(settings.fermiCount, settings.fermiInterval, settings.fermiSecs);
    show('fermi'); renderFermi();
  }
  function renderFermi() {
    el('f-feedback').classList.add('hidden');
    const it = F.items[F.idx];
    el('f-step').textContent = `${F.idx + 1} of ${F.items.length}`;
    el('f-q').textContent = it.q;
    el('f-unit').textContent = 'answer in ' + it.unit;
    el('f-inputs').innerHTML = `<div class="card">
      <label class="stack">Your estimate <input class="num wide" id="f-est" inputmode="text" autocomplete="off"></label>
      ${F.withInterval ? `<div class="pair top">
        <label>90% low<input class="num" id="f-lo" inputmode="text" autocomplete="off"></label>
        <label>90% high<input class="num" id="f-hi" inputmode="text" autocomplete="off"></label></div>
        <p class="hint">A range you are 90% sure contains the answer. Nine in ten should.</p>` : ''}
    </div>`;
    el('f-est').focus();
    startClock(F.secs, 'f-timer');
  }
  function submitFermi() {
    const est = num(el('f-est').value);
    if (!isFinite(est) || est <= 0) return;
    const lo = F.withInterval ? num(el('f-lo').value) : NaN;
    const hi = F.withInterval ? num(el('f-hi').value) : NaN;
    const a = Fermi.submit(F, est, lo, hi, elapsed());
    if (settings.feedback === 'step') {
      const f = el('f-feedback');
      const good = a.logErr <= 0.301;
      f.className = 'feedback ' + (good ? 'good' : 'bad');
      f.innerHTML = `<b>${sig(a.item.v, 4)} ${esc(a.item.unit)}</b> — you were ${Engine.accuracyWord(a.logErr)} it.` +
        (a.inside === null ? '' : `<br>Your interval ${a.inside ? 'contained' : 'missed'} the answer.`) +
        `<br><span class="dim">${esc(a.item.hint)}</span>`;
      f.classList.remove('hidden');
    }
    if (F.idx >= F.items.length) return finishFermi();
    renderFermi();
  }
  function finishFermi() {
    stopClock();
    const s = Fermi.summary(F);
    Store.pushFermi({ at: Date.now(), pct: s.pct, n: s.n, medLogErr: s.medLogErr, hit: s.hit, avgMs: s.avgMs, bias: s.bias });
    el('fres-score').textContent = s.pct + '%';
    el('fres-score').className = 'score ' + (s.pct >= 75 ? 'ok' : s.pct >= 50 ? 'near' : 'no');
    el('fres-sub').textContent = `${Math.round(s.within2 * 100)}% within a factor of 2 · ${Math.round(s.within10 * 100)}% within a factor of 10`;
    const biasWord = Math.abs(s.bias) < 0.08 ? 'no systematic bias'
      : (s.bias > 0 ? 'you run high, by about ' : 'you run low, by about ') + sig(Math.pow(10, Math.abs(s.bias)), 2) + 'x on average';
    el('fres-cal').innerHTML = `<h3>Calibration</h3>` +
      (s.hit === null
        ? '<p>Turn on the 90% interval to train calibration. It is the part that transfers straight to quoting a spread.</p>'
        : `<p>${Math.round(s.hit * 100)}% of your intervals contained the answer, against a target of 90%: <b>${esc(s.calibration)}</b>.</p>
           <p class="dim">Average interval width ${sig(Math.pow(10, s.avgWidth), 2)}x from low to high.</p>`) +
      `<p>Median error ${sig(Math.pow(10, s.medLogErr), 2)}x, ${esc(biasWord)}. Average ${(s.avgMs / 1000).toFixed(1)}s a question.</p>`;
    el('fres-list').innerHTML = F.answers.map(a => `
      <div class="mline ${a.logErr <= 0.301 ? 'ok' : a.logErr <= 1 ? 'near' : 'no'}">
        <div class="mhead"><b>${esc(a.item.q)}</b><span>${sig(Math.pow(10, a.logErr), 2)}x</span></div>
        <ul><li>You said ${sig(a.est, 3)}, the answer is ${sig(a.item.v, 4)} ${esc(a.item.unit)}${a.inside === null ? '' : (a.inside ? ' — interval hit' : ' — interval missed')}</li>
        <li class="dim">${esc(a.item.hint)}</li></ul></div>`).join('');
    show('fres');
  }

  /* ================================================================
   *                          JUDGEMENT
   * ================================================================ */
  let J = null;
  function startJudge() {
    const pool = Data.JUDGEMENT.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    J = { pool, idx: 0, right: 0, answered: false };
    show('judge'); renderJudge();
  }
  function renderJudge() {
    const it = J.pool[J.idx];
    J.answered = false;
    el('j-step').textContent = `${J.idx + 1} of ${J.pool.length}`;
    el('j-timer').textContent = `${J.right} right`;
    el('j-q').textContent = it.q;
    el('j-opts').innerHTML = '<div class="card opts">' + it.opts.map((o, i) =>
      `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('') + '</div>';
    el('j-why').classList.add('hidden');
    el('j-next').classList.add('hidden');
    document.querySelectorAll('#j-opts .opt').forEach(b => b.addEventListener('click', () => {
      if (J.answered) return;
      J.answered = true;
      const i = +b.dataset.i, ok = i === it.a;
      if (ok) J.right++;
      document.querySelectorAll('#j-opts .opt').forEach((n, k) => {
        n.classList.toggle('right', k === it.a);
        n.classList.toggle('wrong', k === i && !ok);
      });
      const w = el('j-why');
      w.className = 'feedback ' + (ok ? 'good' : 'bad');
      w.innerHTML = `<b>${ok ? 'Right.' : 'Not that one.'}</b><br>${esc(it.why)}`;
      w.classList.remove('hidden');
      el('j-next').classList.remove('hidden');
      el('j-timer').textContent = `${J.right} right`;
    }));
  }

  /* ---------------- wiring ---------------- */
  el('btn-mm').addEventListener('click', startMM);
  el('btn-fermi').addEventListener('click', startFermi);
  el('btn-judge').addEventListener('click', startJudge);
  el('mm-submit').addEventListener('click', submitMM);
  el('mm-quit').addEventListener('click', () => { stopClock(); show('home'); });
  el('res-again').addEventListener('click', startMM);
  el('res-home').addEventListener('click', () => show('home'));
  el('f-submit').addEventListener('click', submitFermi);
  el('f-quit').addEventListener('click', () => { stopClock(); show('home'); });
  el('fres-again').addEventListener('click', startFermi);
  el('fres-home').addEventListener('click', () => show('home'));
  el('j-quit').addEventListener('click', () => show('home'));
  el('j-next').addEventListener('click', () => {
    J.idx++;
    if (J.idx >= J.pool.length) { alert(`${J.right} of ${J.pool.length} right.`); return show('home'); }
    renderJudge();
  });
  document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (el('screen-mm').classList.contains('active')) { e.preventDefault(); submitMM(); }
    else if (el('screen-fermi').classList.contains('active')) { e.preventDefault(); submitFermi(); }
  });

  wireSettings(); syncSettings(); refreshHome();

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    fetch('./version.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j && j.v > APP_VERSION) el('update-banner').classList.remove('hidden'); })
      .catch(() => {});
  }
  el('btn-reload').addEventListener('click', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
        .then(() => caches.keys()).then(ks => Promise.all(ks.map(k => caches.delete(k))))
        .then(() => location.reload(true));
    } else location.reload(true);
  });
})();
