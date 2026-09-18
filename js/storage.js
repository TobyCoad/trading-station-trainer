/* Persistence — settings and session history in localStorage. No backend. */
const Store = (function () {
  const KEY_SETTINGS = 'tst.settings.v1';
  const KEY_MM = 'tst.mm.v1';
  const KEY_FERMI = 'tst.fermi.v1';
  const KEY_REPORTED = 'tst.reported.v1';

  const DEFAULTS = {
    mode: 'mixed',          // 'compound' | 'fermi' | 'mixed'
    preset: 'standard',     // warmup | standard | interview
    feedback: 'end',        // 'end' = interview realism, 'step' = mark as you go
    ledger: 'show',         // 'hide' = no running list of your quotes and fills during the drill
    pnlTolerance: 0.10,
    fermiCount: 10,
    fermiSecs: 45,
    fermiInterval: true,
    speakPrompts: false,
  };

  function load(key, dflt) {
    try { return JSON.parse(localStorage.getItem(key)) || dflt; }
    catch (e) { return dflt; }
  }
  function save(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  const loadSettings = () => Object.assign({}, DEFAULTS, load(KEY_SETTINGS, {}));
  const saveSettings = s => save(KEY_SETTINGS, s);

  function pushMM(rec) {
    const all = load(KEY_MM, []);
    all.push(rec);
    save(KEY_MM, all.slice(-300));
  }
  function pushFermi(rec) {
    const all = load(KEY_FERMI, []);
    all.push(rec);
    save(KEY_FERMI, all.slice(-300));
  }
  const mmHistory = () => load(KEY_MM, []);
  const fermiHistory = () => load(KEY_FERMI, []);
  /* Which reported questions have been sat, and how many interview sittings so far. */
  const loadReported = () => Object.assign({ seen: [], n: 0 }, load(KEY_REPORTED, {}));
  const saveReported = p => save(KEY_REPORTED, p);

  function reset() {
    [KEY_MM, KEY_FERMI, KEY_REPORTED].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  }

  return { DEFAULTS, loadSettings, saveSettings, pushMM, pushFermi, mmHistory, fermiHistory, loadReported, saveReported, reset };
})();
