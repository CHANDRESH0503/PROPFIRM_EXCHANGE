/** Dashboard figures computed from a member's trades for a period. Money in minor units. */

export type StatTrade = {
  id: string;
  closed_at: string;
  local_day: string;
  symbol: string;
  direction: string;
  session: string | null;
  strategy_id: string | null;
  net_cents: number;
  r_multiple: number | null;
  tags: { id: string; kind: string; name: string }[];
};

export type Breakdown = { key: string; trades: number; wins: number; net: number };

export type JournalSummary = {
  trades: number;
  wins: number;
  losses: number;
  net: number;
  winRate: number | null;
  /** Gross profit over gross loss; null with no losing trades. */
  profitFactor: number | null;
  avgR: number | null;
  best: number | null;
  worst: number | null;
  longestWin: number;
  longestLoss: number;
  daily: { day: string; net: number; trades: number; wins: number; losses: number }[];
  equity: { day: string; value: number }[];
  bySymbol: Breakdown[];
  bySession: Breakdown[];
  byDirection: Breakdown[];
  byStrategy: Breakdown[];
  byWeekday: Breakdown[];
  mistakes: { id: string; name: string; trades: number; cost: number }[];
};

function group(trades: StatTrade[], key: (t: StatTrade) => string | null): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const t of trades) {
    const k = key(t);
    if (k === null) continue;
    const b = map.get(k) ?? { key: k, trades: 0, wins: 0, net: 0 };
    b.trades += 1;
    b.net += t.net_cents;
    if (t.net_cents > 0) b.wins += 1;
    map.set(k, b);
  }
  return [...map.values()].sort((a, b) => b.net - a.net);
}

export function summarize(input: StatTrade[]): JournalSummary {
  const trades = [...input].sort((a, b) => a.closed_at.localeCompare(b.closed_at));
  let wins = 0,
    losses = 0,
    net = 0,
    grossWin = 0,
    grossLoss = 0,
    rSum = 0,
    rCount = 0,
    run = 0,
    longestWin = 0,
    longestLoss = 0;
  for (const t of trades) {
    net += t.net_cents;
    if (t.net_cents > 0) {
      wins += 1;
      grossWin += t.net_cents;
      run = run > 0 ? run + 1 : 1;
    } else if (t.net_cents < 0) {
      losses += 1;
      grossLoss -= t.net_cents;
      run = run < 0 ? run - 1 : -1;
    } else run = 0;
    longestWin = Math.max(longestWin, run);
    longestLoss = Math.max(longestLoss, -run);
    if (t.r_multiple !== null) {
      rSum += Number(t.r_multiple);
      rCount += 1;
    }
  }
  const dailyMap = new Map<string, { net: number; trades: number; wins: number; losses: number }>();
  for (const t of trades) {
    const d = dailyMap.get(t.local_day) ?? { net: 0, trades: 0, wins: 0, losses: 0 };
    d.net += t.net_cents;
    d.trades += 1;
    if (t.net_cents > 0) d.wins += 1;
    if (t.net_cents < 0) d.losses += 1;
    dailyMap.set(t.local_day, d);
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({ day, ...d }));
  let running = 0;
  const equity = daily.map((d) => ({ day: d.day, value: (running += d.net) }));

  const mistakes = new Map<string, { id: string; name: string; trades: number; cost: number }>();
  for (const t of trades) {
    for (const tag of t.tags) {
      if (tag.kind !== "mistake") continue;
      const m = mistakes.get(tag.id) ?? { id: tag.id, name: tag.name, trades: 0, cost: 0 };
      m.trades += 1;
      if (t.net_cents < 0) m.cost += t.net_cents;
      mistakes.set(tag.id, m);
    }
  }
  const decided = wins + losses;
  const weekday = (day: string) => String((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7);
  return {
    trades: trades.length,
    wins,
    losses,
    net,
    winRate: decided ? (wins / decided) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgR: rCount ? rSum / rCount : null,
    best: trades.length ? Math.max(...trades.map((t) => t.net_cents)) : null,
    worst: trades.length ? Math.min(...trades.map((t) => t.net_cents)) : null,
    longestWin,
    longestLoss,
    daily,
    equity,
    bySymbol: group(trades, (t) => t.symbol),
    bySession: group(trades, (t) => t.session),
    byDirection: group(trades, (t) => t.direction),
    byStrategy: group(trades, (t) => t.strategy_id),
    byWeekday: group(trades, (t) => weekday(t.local_day)).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    mistakes: [...mistakes.values()].sort((a, b) => a.cost - b.cost),
  };
}
