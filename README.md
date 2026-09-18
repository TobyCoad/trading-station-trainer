# Trading Station

The IMC trading-station exercise as an installable PWA: quote a two-way market on an invented
quantity, carry your position and P&L in your head while a trader interrupts you, and answer the
follow-ups before the clock runs out. No backend — every session is logged to `localStorage`
and analysed on the device.

## The three drills

### 1. Make a market

A scenario, an opening quote under a clock, then a scripted sequence of interruptions. The app
executes trades against your live quote, so your requote is the price the next trade happens at.

Two scenario families:

- **City product** — the reported IMC exercise: *distance between two cities x population of the
  first x population density of the second*. You enter your three inputs first, so the app can check
  your quote against your own arithmetic. Thirty cities, so 870 ordered pairs, every true value
  computed from the table rather than looked up.
- **Fermi quantity** — a single estimated quantity from a bank of 266, filtered to the ones you
  can sensibly quote a price on.

The interruptions, all graded:

| Event | What it tests |
|---|---|
| Trades in both directions | Does your market move **with** the flow |
| "What's your position?" | Exact, through sign changes |
| "What's your P&L at your own fair?" | Signed, within a band you set |
| "Ten times the size?" | Do you widen, or refuse |
| A fact that narrows the answer | Do you recentre and tighten |
| A derived market (area, ratio, a component) | Consistency with what you already quoted |
| A digital option on your own quantity | Coherence with your own market, read as one sigma |
| A judgement call, multiple choice | The escalation responses, with model answers |

The debrief opens with **every question in order**: what the trader asked, what you answered, what
the right answer was, and one line on why (for a trade: which way your mid should have moved and
the book after the fill; for P&L: the cash + position x fair breakdown). Each step is marked right,
close or wrong, with the seconds taken and an over-the-clock flag. This is the part to read after an
interview-mode run, since interview mode hides all feedback until the end.

Scoring covers opening accuracy, whether you captured the truth, spread discipline, the spread cap,
consistency with your own inputs, flow response, position and P&L tracking, derived markets, option
coherence, judgement and the clock. The debrief names the three things to fix first.

The running ledger of your own quotes and fills can be hidden during the drill (**Live ledger: Hidden**), so you keep position and cash yourself the way you will have to in the room; the debrief always shows it. Interview mode hides it.

**Interview mode** is one tap: 60 seconds to open, 10 seconds to requote, the spread capped at 10%
of your bid (the corroborated IMC ruleset), derived markets and a digital option in the script, the
live ledger hidden, and no feedback until the debrief.

It serves **questions that were actually reported, best-sourced first**, each once: IMC reports from
Glassdoor with an Amsterdam or European location, then IMC reports with no office on record, then
other firms and the published interview lists. Every fourth sitting is the city product so that
ritual stays warm. A sitting only counts when you finish it, so quitting never burns a question.
Once every reported question has been sat, the mode becomes a weighted mix of everything. The
debrief shows where each question was reported. The same ordering is available outside interview
mode as the **Reported first** scenario setting.

The reported bank (`Data.REPORTED` in `js/data.js`) has four shapes:

| Shape | Example | How it is graded |
|---|---|---|
| A single quantity | Cats in Japan; the population of a country, a fresh country each time | Opening accuracy against the true value, within a factor of two |
| A town product | Dentists in a town times schools in that town, the reported IMC later-round exercise | You give both counts first, then your quote is checked against your own product |
| A market with a computable fair that settles on a draw | The sum of the largest three of five dice; red marbles in an urn of 100 | Accuracy against the **fair**, within 10%; P&L against the **draw**, so you can quote well and still lose |
| An event contract paying 100 | A tennis match with bookmaker odds quoted | Fair is the odds with the margin stripped out; no news or option step, since it settles at 0 or 100 |

### 2. Fermi sprint

A quantity, a clock, a point estimate, and optionally a 90% interval. Graded on order-of-magnitude
accuracy and on **calibration** — the share of your intervals that actually contain the answer,
against a target of 90%. It also reports your signed bias, so you find out whether you run
systematically high or low.

Calibration is the part that transfers straight to quoting: an interval that is too narrow is the
same mistake as a spread that is too tight.

### 3. Follow-ups

The interruptions as flashcards, with the model answer revealed after each. Fifteen of them, drawn
from the reported escalation set.

## Accuracy of the "true" values

City figures are administrative core-municipality unless the app says otherwise, and the basis is
always shown, because the boundary definition is itself the planted ambiguity in the real exercise.
Fermi figures are approximations good to well inside the grading bands — the app scores order of
magnitude, so a ten percent error in a source number never changes a grade.

## Install on iPhone

Open the Pages URL in Safari, Share, **Add to Home Screen**. Works offline after the first load.
When a new version is deployed an update banner appears; bump `APP_VERSION` in `js/app.js`,
`v` in `version.json`, and `CACHE` in `sw.js` together.

## Development

Static files, no build.

```
python -m http.server 8391 --directory .
```

The service worker is stale-while-revalidate, so during development a reload serves the previous
version. Unregister it in devtools, or hard-reload twice.

## Layout

```
index.html          screens
style.css           dark trading-desk theme
js/data.js          30 cities, 60 Fermi quantities, 15 judgement calls
js/engine.js        scenarios, event script, the book, grading
js/fermi.js         the sprint and its calibration maths
js/storage.js       settings and history
js/stats.js         progress tab
js/app.js           shell and the three drill loops
```
