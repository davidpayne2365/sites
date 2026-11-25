/* Kalshi Lab page. Reads data/kalshi.json (written by the paper-trading job). */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fin = (x) => typeof x === "number" && isFinite(x);
const pct = (x, d = 1) => !fin(x) ? "—" : (x * 100).toFixed(d) + "%";
const usd = (x) => !fin(x) ? "—" : (x < 0 ? "−$" : "$") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const susd = (x) => !fin(x) ? "—" : (x > 0 ? "+" : "") + usd(x);
const cls = (x) => !fin(x) || Math.abs(x) < 1e-9 ? "" : x > 0 ? "pos" : "neg";
const when = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
const MIN_TRADES = 300;

const G = {
  Strategy: "A rule for choosing which Kalshi contracts to buy. Each strategy trades its own pretend $1,000.",
  Settled: "Trades that are finished: the event happened and the contract paid out $1 or $0.",
  "Win rate": "The share of finished trades that paid out. The small range underneath is the plausible range for the true rate; it's wide until there are hundreds of trades.",
  "Break-even": "The win rate needed just to cover what was paid (price plus fees). Buying at 93 cents means you must win more than about 94% of the time to make money. Real skill = a win rate clearly above this.",
  "P&L": "Profit or loss in dollars from finished trades, after Kalshi's fees.",
  Fees: "What Kalshi charges per trade. It's the main thing that turns thin 'near-certain' profits into losses.",
  "Worst trade": "The biggest single loss so far. With near-certain bets one loss can erase many wins.",
  Open: "Trades placed but not finished yet.",
  Verdict: `Too early until ${MIN_TRADES} finished trades. After that: 'Likely edge' only if the whole plausible range of the win rate is above break-even; 'Losing' if it's entirely below; otherwise 'Unclear'.`,
};
(function tips() {
  const box = document.createElement("div"); box.id = "gtip"; document.body.appendChild(box);
  let cur = null, lastTouch = 0;
  const show = (el) => { cur = el; box.textContent = el.dataset.tip; box.style.display = "block";
    const r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
    box.style.left = Math.min(innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2)) + "px";
    box.style.top = (r.bottom + 8 + bh > innerHeight - 8 ? r.top - bh - 8 : r.bottom + 8) + "px"; };
  const hide = () => { cur = null; box.style.display = "none"; };
  document.addEventListener("touchstart", () => { lastTouch = Date.now(); }, { passive: true });
  document.addEventListener("mouseover", (e) => { if (Date.now() - lastTouch < 800) return; const el = e.target.closest("[data-tip]"); if (el) show(el); else if (cur) hide(); });
  document.addEventListener("click", (e) => { const el = e.target.closest("[data-tip]"); if (el && Date.now() - lastTouch < 800) { el === cur ? hide() : show(el); } else if (!el) hide(); });
  window.addEventListener("scroll", hide, { passive: true });
})();
(function theme() {
  let saved = null; try { saved = localStorage.getItem("arena-theme"); } catch (e) { /* ignore */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next;
    try { localStorage.setItem("arena-theme", next); } catch (e) { /* ignore */ }
  });
})();

function verdict(r) {
  if (r.halted) return { t: "Halted by risk limit", c: "var(--serious)" };
  if (r.settled < MIN_TRADES) return { t: `Too early (${r.settled}/${MIN_TRADES})`, c: "var(--warning)" };
  const [lo, hi] = r.win_rate_ci95 || [0, 1];
  if (lo > r.breakeven_win_rate && r.realized_pnl > 0) return { t: "Likely edge", c: "var(--good)" };
  if (hi < r.breakeven_win_rate) return { t: "Losing", c: "var(--critical)" };
  return { t: "Unclear", c: "var(--ref)" };
}
const th = (k, l) => `<th class="${l ? "l" : ""} tt" data-tip="${esc(G[k] || "")}">${k}</th>`;

function render(d) {
  const ctrl = d.strategies.find((s) => s.kind === "random");
  const open = d.strategies.reduce((a, s) => a + s.open_positions, 0);
  const lr = d.last_run || {};
  const ageH = (Date.now() - Date.parse(d.generated_at)) / 36e5;
  const stale = ageH > 36;
  $("#app").innerHTML = `
  <section class="hero">
    <h1>Can a bot make money on Kalshi? We're testing it with pretend money first.</h1>
    <p>Kalshi lets you trade yes/no contracts on real-world events (weather, interest rates, sports). A contract pays $1 if the event happens and $0 if not, so a 93-cent price means the market thinks it's about 93% likely. Each rule trades $1,000 of pretend money on live Kalshi prices, with fees and pessimistic fills. <b>Nothing here uses real money or a Kalshi account.</b></p>
  </section>
  ${stale ? `<div class="notice" style="border-left-color:var(--critical)"><span>⛔</span><div><b>This data is ${Math.floor(ageH)} hours old.</b> The scheduled job may have stopped.</div></div>` : ""}
  ${lr.status && lr.status !== "ok" ? `<div class="notice"><span>⚠️</span><div><b>The latest run was cut short</b> (${esc(lr.status.replace(/_/g, " "))}). Kalshi limits how fast outsiders can read its data, so some scans are partial. Results continue to build up.</div></div>` : ""}
  <section class="tiles">
    <div class="tile"><div class="label">Strategies</div><div class="value num">${d.strategies.length}</div><div class="sub">incl. 1 random control &amp; 4 weather</div></div>
    <div class="tile"><div class="label tt" data-tip="${esc(G.Settled)}">Finished trades</div><div class="value num">${d.settled_trades_total}</div><div class="sub">need ${MIN_TRADES}+ each to judge</div></div>
    <div class="tile"><div class="label tt" data-tip="${esc(G.Open)}">Open trades</div><div class="value num">${open}</div><div class="sub">waiting to settle</div></div>
    <div class="tile"><div class="label">Random control P&amp;L</div><div class="value num ${cls(ctrl?.realized_pnl)}">${ctrl ? susd(ctrl.realized_pnl) : "—"}</div><div class="sub">what fees &amp; spreads cost alone</div></div>
    <div class="tile"><div class="label">Last updated</div><div class="value" style="font-size:16px;line-height:1.5">${esc(when(d.generated_at))}</div><div class="sub">scan covered ${lr.scanned ?? "—"} markets</div></div>
  </section>
  <div class="notice" style="border-left-color:var(--series-1)"><span>ℹ️</span><div><b>How to read this.</b> A strategy only matters if its win rate is clearly above its <b>break-even</b> rate <i>and</i> it beats the random control. Almost any result looks great or terrible over a few dozen trades, so every strategy shows “Too early” until it has ${MIN_TRADES} finished trades. Trades in the same city or on the same day are not fully independent, which makes real confidence even lower than the ranges suggest.</div></div>

  <section class="card"><div class="card-h"><h2>The strategies</h2><span class="hint">click a row for its trades</span></div>
  <div class="table-wrap"><table>
    <thead><tr>${th("Strategy", 1)}${th("Verdict", 1)}${th("Settled")}${th("Win rate")}${th("Break-even")}${th("P&L")}${th("Fees")}${th("Worst trade")}${th("Open")}</tr></thead>
    <tbody>${d.strategies.map((r) => { const v = verdict(r); return `<tr data-id="${esc(r.id)}" class="${r.kind === "random" ? "bench" : ""}">
      <td class="l name"><b>${esc(r.name)}</b><span class="fam">${esc(r.description)}</span></td>
      <td class="l"><span class="badge"><span class="dot" style="background:${v.c}"></span>${esc(v.t)}</span></td>
      <td class="num">${r.settled}</td>
      <td class="num">${pct(r.win_rate)}${r.win_rate_ci95 ? `<br><span class="muted" style="font-size:11px">${pct(r.win_rate_ci95[0], 0)}–${pct(r.win_rate_ci95[1], 0)}</span>` : ""}</td>
      <td class="num">${pct(r.breakeven_win_rate)}</td>
      <td class="num ${cls(r.realized_pnl)}">${susd(r.realized_pnl)}</td>
      <td class="num">${usd(r.fees_paid)}</td>
      <td class="num ${cls(r.biggest_loss)}">${susd(r.biggest_loss)}</td>
      <td class="num">${r.open_positions}</td></tr>`; }).join("")}</tbody></table></div></section>
  <div id="detail"></div>
  ${weatherCard(d.weather)}
  <div id="history"></div>

  <section class="card"><div class="card-h"><h2>How the test is run</h2></div><div class="card-b prose"><ul>
    <li><b>Real prices, pretend money.</b> Every few hours a program reads Kalshi's public prices (no account or key) for markets settling within ${d.assumptions.window_hours} hours, and each strategy "buys" according to rules fixed in advance. It never places real orders.</li>
    <li><b>Deliberately pessimistic.</b> It pays ${(d.assumptions.slippage * 100).toFixed(0)} cent more than the asking price, assumes only half the visible size can be bought, skips thin markets (spread over ${(d.assumptions.max_spread * 100).toFixed(0)} cents), and pays Kalshi's trading fee on every trade.</li>
    <li><b>Hold to the end.</b> Each trade is kept until the event settles. Cost per trade is about $${d.assumptions.stake_usd}, no more than one trade per event per strategy, and a strategy stops itself if it loses ${pct(d.assumptions.max_drawdown, 0)} of its pretend money.</li>
    <li><b>Random control.</b> One strategy buys a random side at random. Anything that can't beat it has no skill, however good it looks.</li>
    <li><b>Known limits.</b> Kalshi allows only a trickle of free data requests, so each scan covers part of the market list (mostly weather, rates and sports). There is no historical test yet, only forward results as they arrive. Fee formulas and fill behavior are approximations, and real orders can fill worse. Nothing here is investment advice.</li>
  </ul></div></section>`;
  $("#foot").innerHTML = `Kalshi Lab · started ${esc(when(d.started_at))} · paper trading only · not affiliated with Kalshi`;
  $("#app").querySelectorAll("tbody tr[data-id]").forEach((tr) => tr.addEventListener("click", () => detail(d, tr.dataset.id)));
  detail(d, d.strategies.find((s) => s.settled) ?.id || d.strategies[0].id, true);
}


function weatherCard(w) {
  if (!w) return "";
  const lr = w.last_run || {};
  const cal = (lr.calibration || {});
  const head = `<section class="card"><div class="card-h"><h2>Weather model vs. the market</h2><span class="hint">the scoreboard that matters most</span></div><div class="card-b">
    <p class="prose" style="margin-top:0">For every temperature market it sees, the weather model writes down its own probability, using the National Weather Service forecast and live observations for the exact station the market settles on. When the market settles, the model and the market's own price are both scored. <b>A lower score is better.</b> If the model can't beat the market's score over hundreds of markets, its bets aren't worth making, whatever the profit looks like.</p>`;
  if (!w.n) return head + `<div class="empty">No markets scored yet. The first ones settle within a day or two. Last run checked ${lr.series ?? "—"} weather series, priced ${lr.priced ?? 0} markets, with ${lr.stations_ok ?? 0} stations OK and ${lr.stations_failed ?? 0} unavailable.</div></div></section>`;
  const better = w.advantage > 0, sig = w.advantage_se && Math.abs(w.advantage) > 2 * w.advantage_se;
  const verdict = w.n < 300 ? `Too early (${w.n}/300 scored)` : !sig ? "No clear difference yet" : better ? "Model is beating the market" : "Market is beating the model";
  return head + `<div class="kv">
      <div><span class="tt" data-tip="How wrong the model's probabilities were on average (0 = perfect, 0.25 = coin flip). Lower is better.">Model score</span><b class="num">${w.brier_model.toFixed(4)}</b></div>
      <div><span class="tt" data-tip="The same score for the market's own price at the time. This is the bar to beat.">Market score</span><b class="num">${w.brier_market.toFixed(4)}</b></div>
      <div><span>Markets scored</span><b class="num">${w.n}</b></div>
      <div><span>Verdict</span><b style="font-size:14px;white-space:normal">${verdict}</b></div>
    </div>
    <h3>Does it mean what it says?</h3>
    <div class="table-wrap"><table class="mini"><thead><tr><th class="l">Model said</th><th>Markets</th><th class="tt" data-tip="Average probability the model gave">Predicted</th><th class="tt" data-tip="How often it actually happened. A good model has these two columns close.">Happened</th></tr></thead><tbody>
      ${(w.calibration || []).map((b) => `<tr><td class="l">${Math.round(b.range[0] * 100)}–${Math.round(b.range[1] * 100)}%</td><td class="num">${b.n}</td><td class="num">${pct(b.predicted, 0)}</td><td class="num">${pct(b.actual, 0)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="muted" style="font-size:12.5px">Forecast error size used now (°F, by hours ahead): ${(cal.sigma || []).map(([h, s]) => `≤${h}h: ${s.toFixed(1)}`).join(" · ")}. These start deliberately wide and are re-measured from settled results once each range has 30+ examples (${Object.values(cal.n || {}).reduce((a, b) => a + b, 0)} measured so far).</p>
  </div></section>`;
}


function historyCard(h) {
  if (!h || !h.strategies) return "";
  const verdict = (r) => {
    if (!r.trades || r.trades < 100) return { t: `Too few trades (${r.trades || 0})`, c: "var(--warning)" };
    const [lo, hi] = r.win_rate_ci95;
    if (lo > r.breakeven_win_rate && (r.t_stat ?? 0) > 2) return { t: "Made money in history", c: "var(--good)" };
    if (hi < r.breakeven_win_rate || (r.t_stat ?? 0) < -2) return { t: "Lost money in history", c: "var(--critical)" };
    return { t: "No clear edge", c: "var(--ref)" };
  };
  return `<section class="card"><div class="card-h"><h2>History test: how the price rules would have done</h2>
    <span class="hint">${esc(h.start)} to ${esc(h.end)} · ${(h.sampled_markets || 0).toLocaleString()} settled markets across ${h.series || 0} series${h.status !== "ok" ? " · partial run" : ""}</span></div>
    <div class="card-b prose" style="padding-bottom:4px"><p style="margin:0">The same rules were replayed on markets that already settled, using Kalshi's hourly price history: same check times, same pessimistic prices and fees, one bet per event. The weather strategies can't be replayed this way (old NWS forecasts aren't kept), so they're judged only by the live scoreboard above.</p></div>
    <div class="table-wrap"><table>
      <thead><tr>${th("Strategy", 1)}${th("Verdict", 1)}<th class="tt" data-tip="Number of past bets the rule would have made.">Trades</th>${th("Win rate")}${th("Break-even")}<th class="tt" data-tip="Total profit or loss at about $10 per bet, after fees.">P&amp;L</th><th class="tt" data-tip="Average profit or loss per bet.">Per bet</th><th class="tt" data-tip="How strong the evidence is. Beyond +2 or -2 is unlikely to be luck; near 0 means no real signal.">Evidence</th></tr></thead>
      <tbody>${h.strategies.map((r) => { const v = verdict(r); return `<tr class="${r.kind === "random" ? "bench" : ""}">
        <td class="l name"><b>${esc(r.name)}</b>${r.by_category && r.by_category.length ? `<span class="fam">${r.by_category.slice(0, 3).map((c) => `${esc(c.category)}: ${c.trades} bets, ${susd(c.pnl)}`).join(" · ")}</span>` : ""}</td>
        <td class="l"><span class="badge"><span class="dot" style="background:${v.c}"></span>${esc(v.t)}</span></td>
        <td class="num">${(r.trades || 0).toLocaleString()}</td>
        <td class="num">${pct(r.win_rate)}${r.win_rate_ci95 ? `<br><span class="muted" style="font-size:11px">${pct(r.win_rate_ci95[0], 0)}–${pct(r.win_rate_ci95[1], 0)}</span>` : ""}</td>
        <td class="num">${pct(r.breakeven_win_rate)}</td>
        <td class="num ${cls(r.total_pnl)}">${susd(r.total_pnl)}</td>
        <td class="num ${cls(r.pnl_per_trade)}">${susd(r.pnl_per_trade)}</td>
        <td class="num">${r.t_stat == null ? "—" : r.t_stat.toFixed(1)}</td></tr>`; }).join("")}</tbody></table></div>
    <div class="card-b muted" style="font-size:12.5px">Limits: the price history has no order-book depth, so it can't tell whether there were enough contracts at that price. Each series is capped so a few busy markets (crypto, esports) don't dominate. About two months of recent history, so one season and one market mood.</div>
  </section>`;
}

function detail(d, id, quiet) {
  const r = d.strategies.find((s) => s.id === id);
  $("#detail").innerHTML = `<section class="card"><div class="card-h"><h2>${esc(r.name)}</h2><span class="hint">${esc(r.description)}</span></div><div class="card-b">
    <div class="kv">
      <div><span>Pretend balance</span><b class="num">${usd(r.equity)}</b></div>
      <div><span>Cash</span><b class="num">${usd(r.cash)}</b></div>
      <div><span>Tied up in open trades</span><b class="num">${usd(r.open_cost)}</b></div>
      <div><span>Average price paid</span><b class="num">${r.avg_price ? (r.avg_price * 100).toFixed(1) + "¢" : "—"}</b></div>
    </div>
    ${r.halted ? `<div class="notice" style="border-left-color:var(--critical)"><b>Halted:</b>&nbsp;${esc(r.halt_reason)}</div>` : ""}
    <div class="grid2"><div>
      <h3>Recent finished trades</h3>${r.recent_trades.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th class="l">Market</th><th class="l">Bet</th><th>Price</th><th>Result</th><th>P&amp;L</th></tr></thead><tbody>
        ${r.recent_trades.map((t) => `<tr><td class="l" style="white-space:normal;min-width:180px">${esc(t.title || t.ticker)}</td><td class="l">${esc(t.side.toUpperCase())}</td><td class="num">${(t.price * 100).toFixed(0)}¢</td><td class="l">${esc(t.outcome)}</td><td class="num ${cls(t.pnl)}">${susd(t.pnl)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">None finished yet. Most trades settle within a day or two.</div>`}
    </div><div>
      <h3>Open trades</h3>${r.open.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th class="l">Market</th><th class="l">Bet</th><th>Price</th></tr></thead><tbody>
        ${r.open.map((p) => `<tr><td class="l" style="white-space:normal;min-width:180px">${esc(p.title || p.ticker)}</td><td class="l">${esc(p.side.toUpperCase())}</td><td class="num">${(p.price * 100).toFixed(0)}¢</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No open trades.</div>`}
      ${r.top_series.length ? `<h3>Where its trades come from</h3><div class="table-wrap"><table class="mini"><thead><tr><th class="l">Market type</th><th>Trades</th><th>P&amp;L</th></tr></thead><tbody>${r.top_series.map((s) => `<tr><td class="l">${esc(s.series)}</td><td class="num">${s.trades}</td><td class="num ${cls(s.pnl)}">${susd(s.pnl)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </div></div></div></section>`;
  if (!quiet) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

(async function load() {
  try {
    const r = await fetch("data/kalshi.json?t=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    render(await r.json());
    try {
      const hb = await fetch("data/kalshi_backtest.json?t=" + Date.now());
      if (hb.ok) $("#history").innerHTML = historyCard(await hb.json());
    } catch (e) { /* history test not published yet */ }
  } catch (e) {
    $("#app").innerHTML = `<section class="hero"><h1>Kalshi Lab is warming up</h1><p>The first paper-trading run hasn't been published yet. Check back after the next scheduled run (every few hours).</p></section>`;
  }
})();
