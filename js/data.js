/* Scenario data.
 *
 * Every "true" value here is an approximation good to well inside the grading
 * bands (the app scores order-of-magnitude accuracy, so a 10% error in a source
 * figure never changes a grade). City figures are administrative core-municipality
 * unless `basis` says otherwise — which is itself the planted ambiguity the real
 * exercise tests, so the basis is always shown to you.
 */
const Data = (function () {

  /* ---------------- cities: lat, lon, population, area km2 ---------------- */
  const CITIES = [
    { name: 'London',        lat: 51.5074, lon: -0.1278,   pop: 8.90e6,  area: 1572,  basis: 'Greater London' },
    { name: 'Paris',         lat: 48.8566, lon: 2.3522,    pop: 2.10e6,  area: 105,   basis: 'city proper' },
    { name: 'Amsterdam',     lat: 52.3676, lon: 4.9041,    pop: 0.93e6,  area: 219,   basis: 'municipality' },
    { name: 'Berlin',        lat: 52.5200, lon: 13.4050,   pop: 3.80e6,  area: 891,   basis: 'city state' },
    { name: 'Madrid',        lat: 40.4168, lon: -3.7038,   pop: 3.30e6,  area: 604,   basis: 'city proper' },
    { name: 'Barcelona',     lat: 41.3874, lon: 2.1686,    pop: 1.66e6,  area: 101,   basis: 'city proper' },
    { name: 'Rome',          lat: 41.9028, lon: 12.4964,   pop: 2.75e6,  area: 1285,  basis: 'comune' },
    { name: 'Milan',         lat: 45.4642, lon: 9.1900,    pop: 1.37e6,  area: 182,   basis: 'comune' },
    { name: 'Vienna',        lat: 48.2082, lon: 16.3738,   pop: 2.00e6,  area: 415,   basis: 'city state' },
    { name: 'Dublin',        lat: 53.3498, lon: -6.2603,   pop: 0.59e6,  area: 115,   basis: 'city council' },
    { name: 'Copenhagen',    lat: 55.6761, lon: 12.5683,   pop: 0.66e6,  area: 90,    basis: 'municipality' },
    { name: 'Stockholm',     lat: 59.3293, lon: 18.0686,   pop: 1.00e6,  area: 188,   basis: 'municipality' },
    { name: 'Lisbon',        lat: 38.7223, lon: -9.1393,   pop: 0.55e6,  area: 100,   basis: 'city proper' },
    { name: 'Warsaw',        lat: 52.2297, lon: 21.0122,   pop: 1.86e6,  area: 517,   basis: 'city proper' },
    { name: 'Prague',        lat: 50.0755, lon: 14.4378,   pop: 1.38e6,  area: 496,   basis: 'city proper' },
    { name: 'Brussels',      lat: 50.8503, lon: 4.3517,    pop: 1.22e6,  area: 162,   basis: 'Capital Region' },
    { name: 'Munich',        lat: 48.1351, lon: 11.5820,   pop: 1.51e6,  area: 310,   basis: 'city proper' },
    { name: 'Hamburg',       lat: 53.5511, lon: 9.9937,    pop: 1.90e6,  area: 755,   basis: 'city state' },
    { name: 'Zurich',        lat: 47.3769, lon: 8.5417,    pop: 0.44e6,  area: 88,    basis: 'city proper' },
    { name: 'Athens',        lat: 37.9838, lon: 23.7275,   pop: 0.64e6,  area: 39,    basis: 'municipality' },
    { name: 'New York City', lat: 40.7128, lon: -74.0060,  pop: 8.30e6,  area: 778,   basis: 'five boroughs, land' },
    { name: 'Chicago',       lat: 41.8781, lon: -87.6298,  pop: 2.66e6,  area: 606,   basis: 'city proper, land' },
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194, pop: 0.81e6,  area: 121,   basis: 'city proper, land' },
    { name: 'Toronto',       lat: 43.6532, lon: -79.3832,  pop: 2.79e6,  area: 631,   basis: 'city proper' },
    { name: 'Mexico City',   lat: 19.4326, lon: -99.1332,  pop: 9.20e6,  area: 1495,  basis: 'Federal District' },
    { name: 'Sao Paulo',     lat: -23.5505, lon: -46.6333, pop: 11.50e6, area: 1521,  basis: 'municipality' },
    { name: 'Tokyo',         lat: 35.6762, lon: 139.6503,  pop: 9.70e6,  area: 628,   basis: '23 special wards' },
    { name: 'Singapore',     lat: 1.3521,  lon: 103.8198,  pop: 5.90e6,  area: 734,   basis: 'whole country' },
    { name: 'Hong Kong',     lat: 22.3193, lon: 114.1694,  pop: 7.50e6,  area: 1114,  basis: 'whole territory' },
    { name: 'Mumbai',        lat: 19.0760, lon: 72.8777,   pop: 12.50e6, area: 603,   basis: 'city proper' },
  ];

  const R_EARTH = 6371;
  function greatCircle(a, b) {
    const rad = Math.PI / 180;
    const la = a.lat * rad, lb = b.lat * rad, dl = (b.lon - a.lon) * rad;
    const c = Math.sin(la) * Math.sin(lb) + Math.cos(la) * Math.cos(lb) * Math.cos(dl);
    return R_EARTH * Math.acos(Math.min(1, Math.max(-1, c)));
  }
  const density = c => c.pop / c.area;

  /* ---------------- Fermi bank ----------------
   * hint: the decomposition a trader would say out loud, shown only in the debrief.
   */
  const FERMI = [
    { q: 'Stations on the London Underground', v: 272, unit: 'stations', hint: '11 lines, roughly 25 stations each.' },
    { q: 'Passenger journeys on the London Underground in a year', v: 1.18e9, unit: 'journeys', hint: '~4M a weekday x ~300 equivalent days.' },
    { q: 'Passengers through Heathrow in a year', v: 83e6, unit: 'passengers', hint: '~1,300 flights a day x ~180 seats x 0.85 load x 365, both directions.' },
    { q: 'Passengers through Amsterdam Schiphol in a year', v: 67e6, unit: 'passengers', hint: 'Europe’s third busiest, a little under Heathrow.' },
    { q: 'Eurostar passengers in a year', v: 19e6, unit: 'passengers', hint: '~50 trains a day x ~750 seats x 0.7 x 365.' },
    { q: 'Commercial flights worldwide in a day', v: 100e3, unit: 'flights', hint: '~25,000 commercial aircraft, ~4 sectors a day each.' },
    { q: 'Commercial aircraft airborne at a typical moment', v: 10e3, unit: 'aircraft', hint: '100k flights a day, ~2.5h each, so ~10k in the air on average.' },
    { q: 'McDonald’s restaurants worldwide', v: 43e3, unit: 'restaurants', hint: '~13,500 in the US, which is roughly a third.' },
    { q: 'Starbucks stores worldwide', v: 40e3, unit: 'stores', hint: 'Similar order to McDonald’s, more concentrated in the US and China.' },
    { q: 'Licensed pubs in the United Kingdom', v: 45e3, unit: 'pubs', hint: '67M people, roughly one pub per 1,500 people.' },
    { q: 'Bicycles in the Netherlands', v: 23e6, unit: 'bicycles', hint: '17.9M people, more than one bike each.' },
    { q: 'Licensed vehicles in the United Kingdom', v: 41e6, unit: 'vehicles', hint: '~33M cars plus vans, bikes and lorries.' },
    { q: 'Yellow medallion taxis in New York City', v: 13587, unit: 'taxis', hint: 'The medallion count is fixed by law near 13,600.' },
    { q: 'Licensed black cabs in London', v: 15e3, unit: 'cabs', hint: 'Roughly the same order as New York medallions.' },
    { q: 'Goals scored in a full Premier League season', v: 1080, unit: 'goals', hint: '380 matches x ~2.85 goals a match.' },
    { q: 'Seconds in a year', v: 31.56e6, unit: 'seconds', hint: 'pi times ten million is the classic mnemonic.' },
    { q: 'Heartbeats in an 80-year human life', v: 2.5e9, unit: 'beats', hint: '~70 a minute x 42M minutes.' },
    { q: 'Cells in the human body', v: 3.7e13, unit: 'cells', hint: 'Roughly the same order as the bacteria living on you.' },
    { q: 'Hairs on a human head', v: 100e3, unit: 'hairs', hint: '~600cm2 of scalp at ~170 per cm2.' },
    { q: 'Total length of blood vessels in one adult', v: 100e3, unit: 'km', hint: 'Twice around the Earth, mostly capillaries.' },
    { q: 'Distance from the Earth to the Moon', v: 384400, unit: 'km', hint: '~30 Earth diameters; light takes 1.3 seconds.' },
    { q: 'Mass of the Earth', v: 5.97e24, unit: 'kg', hint: 'Volume ~1.08e21 m3 at a mean density of 5,500 kg/m3.' },
    { q: 'Stars in the Milky Way', v: 2e11, unit: 'stars', hint: 'Usually quoted as 100 to 400 billion.' },
    { q: 'Trees on Earth', v: 3e12, unit: 'trees', hint: 'About 400 per living person.' },
    { q: 'People alive on Earth', v: 8.2e9, unit: 'people', hint: 'Know this one exactly.' },
    { q: 'Babies born worldwide in a day', v: 385e3, unit: 'births', hint: '8.2bn people, ~72 year life, so ~140M births a year.' },
    { q: 'Deaths worldwide in a day', v: 170e3, unit: 'deaths', hint: '~62M a year, well below births.' },
    { q: 'Google searches in a day', v: 8.5e9, unit: 'searches', hint: '~5bn internet users, a couple of searches each.' },
    { q: 'iPhones sold in a year', v: 230e6, unit: 'phones', hint: '~1.4bn active iPhones on a ~5 year replacement cycle.' },
    { q: 'Netflix paid subscriptions worldwide', v: 300e6, unit: 'subscriptions', hint: 'Roughly one household in eight outside China.' },
    { q: 'Spotify monthly active users', v: 675e6, unit: 'users', hint: 'Around twice Netflix, because the free tier counts.' },
    { q: 'WhatsApp monthly active users', v: 2.7e9, unit: 'users', hint: 'A third of everyone alive.' },
    { q: 'Amazon employees worldwide', v: 1.55e6, unit: 'employees', hint: 'Second largest private employer after Walmart.' },
    { q: 'People employed by the NHS across the UK', v: 1.7e6, unit: 'employees', hint: 'Roughly one in forty UK workers.' },
    { q: 'Students at UK universities', v: 2.9e6, unit: 'students', hint: '~700k a year across ~3.5 years of study.' },
    { q: 'Barrels of oil consumed worldwide in a day', v: 103e6, unit: 'barrels', hint: '~12 barrels per person per year.' },
    { q: 'Global CO2 emissions from fossil fuels in a year', v: 37e9, unit: 'tonnes', hint: '~4.5 tonnes per person.' },
    { q: 'Container ships in the world fleet', v: 6e3, unit: 'ships', hint: 'Carrying ~26M TEU of capacity between them.' },
    { q: 'ATMs worldwide', v: 3e6, unit: 'machines', hint: 'Falling, roughly one per 2,700 people.' },
    { q: 'Bank of England notes in circulation', v: 4.6e9, unit: 'notes', hint: '~GBP 80bn in value at an average note near GBP 17.' },
    { q: 'Height of the Eiffel Tower', v: 330, unit: 'metres', hint: 'About a 100-storey building.' },
    { q: 'Mass of the Eiffel Tower', v: 10100, unit: 'tonnes', hint: '7,300 tonnes of iron plus foundations.' },
    { q: 'Height of the Burj Khalifa', v: 828, unit: 'metres', hint: 'Two and a half Eiffel Towers.' },
    { q: 'Bricks in the Empire State Building', v: 10e6, unit: 'bricks', hint: 'Facade area over brick area, roughly.' },
    { q: 'Length of the M25 motorway', v: 188, unit: 'km', hint: 'A circle of radius ~30km around London.' },
    { q: 'Member states of the United Nations', v: 193, unit: 'states', hint: 'Know this one exactly.' },
    { q: 'Islands in Indonesia', v: 17500, unit: 'islands', hint: 'Officially 17,504 by the latest survey.' },
    { q: 'Lego bricks produced in a year', v: 110e9, unit: 'bricks', hint: '~14 per person alive, per year.' },
    { q: 'Distinct chess games possible after two moves each', v: 197281, unit: 'games', hint: '20 x 20 first moves, then ~440 replies on average.' },
    { q: 'Ways to shuffle a standard 52-card deck', v: 8.07e67, unit: 'orderings', hint: '52 factorial. log10 is about 67.9.' },
    { q: 'Water in an Olympic swimming pool', v: 2500, unit: 'cubic metres', hint: '50 x 25 x 2 metres.' },
    { q: 'Grains of rice in a one-kilogram bag', v: 50e3, unit: 'grains', hint: 'A grain weighs about 20mg.' },
    { q: 'Atoms in a single grain of sand', v: 6e19, unit: 'atoms', hint: '~0.7mg of SiO2 over a molar mass of 60.' },
    { q: 'Cups of coffee drunk worldwide in a day', v: 2.25e9, unit: 'cups', hint: 'Around one cup per four people alive.' },
    { q: 'Pizzas sold in the United States in a year', v: 3e9, unit: 'pizzas', hint: '~9 per American per year.' },
    { q: 'Takeoff weight of a fully loaded Boeing 747', v: 400, unit: 'tonnes', hint: '~180t empty, ~180t fuel, ~40t payload.' },
    { q: 'Flights handled by Heathrow in a day', v: 1300, unit: 'flights', hint: 'Two runways at near-capacity, ~45 movements an hour each.' },
    { q: 'Postcodes in the United Kingdom', v: 1.8e6, unit: 'postcodes', hint: '~29M addresses at ~15 addresses per postcode.' },
    { q: 'Trains in service on the London Underground at the morning peak', v: 540, unit: 'trains', hint: '11 lines, ~50 trains each at peak.' },
    { q: 'Weight of all the ants on Earth', v: 12e9, unit: 'kg', hint: '~20 quadrillion ants at a few milligrams each.' },
  ];

  /* ---------------- judgement bank: the interruptions, as multiple choice ----------------
   * `why` is the model answer, read aloud in the debrief.
   */
  const JUDGEMENT = [
    {
      q: 'You quote 55 at 67. I buy. You requote, I buy again. I buy a third time. What do you do?',
      opts: [
        'Keep the same market. My estimate has not changed, so my price should not.',
        'Move both prices up, widen, and show less size. Persistent one-way flow is information.',
        'Move both prices up but tighten, to win more of the flow.',
        'Stop quoting and ask what they know.',
      ],
      a: 1,
      why: 'Each fill is evidence your fair is too low, and your short is growing. So you march the price with the flow, widen because the counterparty looks informed, and cut the size you show. Refusing to quote at all is a worse answer than a wide quote.',
    },
    {
      q: 'One of the two traders keeps buying from you and the other keeps selling. What does that change?',
      opts: [
        'Nothing. Each trade is independent.',
        'Widen: two active counterparties means twice the adverse selection.',
        'Tighten. You are capturing the spread with little net inventory, so more flow is pure profit.',
        'Quote only to the seller.',
      ],
      a: 2,
      why: 'Two-sided flow is the market maker’s dream: you earn the spread and your net position barely moves. One-sided flow from an informed room is the dangerous case. Distinguishing the two out loud is the strongest single line available in this exercise.',
    },
    {
      q: 'You are short ten lots and your fair is 61. How should your market look?',
      opts: [
        'Symmetric around 61, just wider: 52 at 70.',
        'Skewed up: lift the bid toward fair and push the offer away, say 60 at 68, with more size on the bid.',
        'Skewed down, to attract buyers who will take you out.',
        'Pull the market entirely until you are flat.',
      ],
      a: 1,
      why: 'Skew, do not merely widen. You want to be hit on the bid and paid richly if you get shorter still. And be willing to pay through your own fair to flatten: a small certain loss beats an uncertain large one.',
    },
    {
      q: '"Would you show that price in ten times the size?"',
      opts: [
        'Yes, the same price. My fair has not changed.',
        'No, I would not trade at all in that size.',
        'Wider, or the normal price for one clip and the rest worked in pieces.',
        'Tighter, because large trades are usually uninformed.',
      ],
      a: 2,
      why: 'Three reasons to widen, and naming all three is the full-marks answer: adverse selection rises with size, inventory risk scales directly, and a large position costs more to unwind. Never simply refuse.',
    },
    {
      q: 'You learn the counterparty can see the true value. What is the right strategy?',
      opts: [
        'Quote very wide so they cannot profit.',
        'Follow their trades: each one tells you which side you are wrong on, and stop when they stop.',
        'Quote randomly so they cannot read you.',
        'Refuse to quote.',
      ],
      a: 1,
      why: 'Against a fully informed counterparty your quote is a measuring instrument. Chase every trade in the direction they hit you, and treat the moment they stop trading as the signal that you have arrived at fair.',
    },
    {
      q: 'You have quoted markets on city A’s population, city B’s density, and the product. What must be true?',
      opts: [
        'Nothing. They are separate estimates.',
        'Only that each bid is below each ask.',
        'The product of your component mid-prices must sit inside your product market, or the three quotes are arbitrageable against each other.',
        'They must all have the same percentage spread.',
      ],
      a: 2,
      why: 'Every fair value in the room must descend from one set of underlying estimates. Re-estimating a quantity independently is how you write someone else a free option against your own book.',
    },
    {
      q: 'Your fair is 61 and news arrives that city A’s population is 20% higher than you assumed. New fair?',
      opts: [
        'About 73, because the value is a product so a proportional move in an input is proportional in the output.',
        'About 66, because one of three inputs moved.',
        'About 81, because uncertainty compounds.',
        'Unchanged until I see the other inputs.',
      ],
      a: 0,
      why: 'A pure product transmits proportional changes one for one. Say that in those words, recentre, and tighten, because the news also removed uncertainty from that leg.',
    },
    {
      q: 'They ask for a contract paying 100 if the quantity exceeds a level far above your fair. What do you quote?',
      opts: [
        '0 bid at 0 offer, since it cannot happen.',
        '0 bid at a small offer, wide, because a far strike is a bet on my uncertainty rather than on my fair.',
        '50 at 55, since I cannot rule it out.',
        'The same spread I use on the underlying.',
      ],
      a: 1,
      why: 'A digital struck near your fair is a bet on your fair; struck far away it is a bet on the tails of your error distribution, which you know far less well. So widen in the wings, and never quote a zero offer: you are selling insurance against your own model being wrong.',
    },
    {
      q: 'The quantity you are quoting suddenly moves 5% and you do not know why. What do you do first?',
      opts: [
        'Recentre immediately on the new level.',
        'Ignore it and hold your fair.',
        'Ask whether it is signal or noise: volume, breadth, news, depth, persistence.',
        'Widen to the maximum and stop trading.',
      ],
      a: 2,
      why: 'Signal means recentre fast. Noise means hold your fair, widen, and let the mean reversion pay you. The graded content is that you asked the question rather than reflexively doing either.',
    },
    {
      q: '"What is your worst-case loss on your current position?"',
      opts: [
        'Unbounded, since the quantity has no ceiling.',
        'Lots times the difference between a stated plausible extreme and my average entry, with the dominant risk named.',
        'My total capital.',
        'The spread I quoted, times the number of lots.',
      ],
      a: 1,
      why: 'Turn a vague question into a number, a method and an identified dominant risk. On a compound city market the real risk is usually definitional, not statistical: if "population" meant the metropolitan area all along, your fair jumps before any randomness is involved.',
    },
    {
      q: 'Another trader in the room starts quoting a market that overlaps yours: their bid is above your ask.',
      opts: [
        'Match their market immediately.',
        'Sell to them at their bid if it is above my fair, and ask myself what they might know that I do not.',
        'Widen so I am never crossed.',
        'Ignore it, my fair is my fair.',
      ],
      a: 1,
      why: 'A crossed market is either free money or information. Take the trade if it beats your fair, and simultaneously update on the possibility that their fair is better than yours. Doing both at once is the answer.',
    },
    {
      q: 'Why is your spread the width it is?',
      opts: [
        'It is a convention: about 10% of the price.',
        'Because of the uncertainty in my fair, the chance the counterparty is informed, the size, my inventory, and the competition.',
        'To make sure I make money on every trade.',
        'Because a narrow spread looks confident.',
      ],
      a: 1,
      why: 'A spread that you can decompose into named inputs is a derived number. A spread you cannot justify is an arbitrary one, and they will find out which it is by asking exactly this.',
    },
    {
      q: 'You quoted 55 at 67 and the true value settles at 63. You sold two lots at 67 and bought one at 55. What is your P&L?',
      opts: ['+16', '+12', '+8', '-4'],
      a: 0,
      why: 'Sold two at 67 against 63 is +4 each, so +8. Bought one at 55 against 63 is +8. Total +16. Say the position first, then the number: short one lot net, and plus sixteen.',
    },
    {
      q: 'Halfway through, you realise your opening fair was wrong by a factor of two. What do you say?',
      opts: [
        'Nothing, and drift the price gradually so it is not obvious.',
        'Name the error, give the corrected fair and the corrected market, and re-mark the existing position.',
        'Defend the original number, since changing your mind looks weak.',
        'Ask to start the exercise again.',
      ],
      a: 1,
      why: 'How you react to being wrong is explicitly what this round assesses. Concede fast, say what the error was, restate the number, and re-mark. Drifting quietly is the worst of the four because it reads as hiding it.',
    },
    {
      q: 'They challenge an answer you are confident is correct: "Are you sure? That does not seem right."',
      opts: [
        'Change the answer; they are the trader.',
        'Re-derive it in one line and hold, changing only if they give an actual argument.',
        'Say you are not sure and offer a range.',
        'Ask them what the right answer is.',
      ],
      a: 1,
      why: 'IMC challenges correct answers deliberately. A candidate in the reported set was rejected with everything correct, for hedging. Re-derive briefly, hold, and if you do fold, say precisely what changed your mind.',
    },
  ];

  return { CITIES, FERMI, JUDGEMENT, greatCircle, density };
})();
