# Trading Station

The IMC trading-station exercise as an installable PWA: quote a two-way market on an invented
quantity, carry your position and P&L in your head while a trader interrupts you, and answer the
follow-ups before the clock runs out. No backend — every session is logged to `localStorage`
and analysed on the device.

## The four drills

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

It serves **a different question every sitting, from the whole bank**. Each sitting draws at random
from four sources: the general Fermi bank (about half of sittings), the reported bank (a third), the
city product (11%) and the town product (7%, plus the times it arrives as a reported question). Nothing repeats until its source has been exhausted, the
same kind of question never comes up twice running, and within the reported bank the better-sourced
questions are weighted up rather than put first: IMC reports with an Amsterdam or European location
count three times, IMC with no office on record twice, other firms and the published lists once. A
question is only marked as seen when you finish the sitting. The debrief shows where a reported
question came from. The same selection is available outside interview mode as the **Interview mix**
scenario setting.

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

### 4. Price a contract

You are shown a two-way market on a quantity, for example `19 at 21 million cars`, and must make a market on a
contract written on it. The convention is printed on every question: **the mid is the fair value and the width is
one standard deviation**, with the quantity treated as roughly normal. That makes every price a mental calculation.

| Contract | How it is priced |
|---|---|
| Digital, pays 100 above or below a strike | `z = (K - fair) / sd`, then 100 times the normal tail |
| Call | `sd x [phi(d) + d Phi(d)]` with `d = (fair - K) / sd`; 0.40 sd at the money |
| Put | the call, then parity against the fair: `put = call - (fair - K)` |
| Put from a quoted call | parity alone, using only the call market shown |
| Reprice after the market moves | old price plus delta times the move; the debrief shows the exact value and calls the gap gamma |

You answer with a bid and an ask. Six of ten points are for a mid close to the model value, two for a market that
contains it, and one each for a legal, sensibly tight quote and for beating the clock; the last three only count once
the price is in the right area, so a tidy quote on the wrong number scores nothing. Offering a tail contract below its
worth is marked as an error. Each answer is followed at once by the working, because this drill is for learning the
mapping rather than for simulating the room, and a collapsible table of the normal tail and call values is on the
screen if you need it. Settings choose the number of questions, the clock, and which family to drill.

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
js/options.js       price a contract: question generator, normal-model pricing, grading
js/storage.js       settings and history
js/stats.js         progress tab
js/app.js           shell and the three drill loops
```
