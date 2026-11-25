/* Options Lab page. Reads data/options.json (written by the daily run). */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fin = (x) => typeof x === "number" && isFinite(x);
const pct = (x, d = 0) => !fin(x) ? "—" : (x * 100).toFixed(d) + "%";
const spct = (x, d = 1) => !fin(x) ? "—" : (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
const usd = (x) => !fin(x) ? "—" : (x < 0 ? "−$" : "$") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const susd = (x) => !fin(x) ? "—" : (x > 0 ? "+" : "") + usd(x);
const cls = (x) => !fin(x) || Math.abs(x) < 1e-9 ? "" : x > 0 ? "pos" : "neg";
const day = (iso) => iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

const G = {
  Strategy: "A fixed rule for when to buy a call option and which one. Each trades its own pretend $1,000.",
  Balance: "What the pretend $1,000 is worth now, with any open option valued at its current bid (what you could sell it for).",
  Return: "Gain or loss since the start.",
  Bets: "Finished bets: options that were sold or expired.",
  "Won": "Share of finished bets that made money. For these bets, most lose and a few win big.",
  "Best bet": "Biggest single profit so far.",
  "Worst bet": "Biggest single loss. Usually the whole amount paid, because the option expired worthless.",
  "Open bet": "The option it holds right now: the strike (the SPY price it needs to beat) and the expiry date.",
  "Peak": "The highest the balance has been. Compare it with today's balance to see how much a hot streak can give back.",
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
const th = (k, l) => `<th class="${l ? "l" : ""} tt" data-tip="${esc(G[k] || "")}">${k}</th>`;

function spark(points) {
  if (!points || points.length < 2) return '<span class="muted">—</span>';
  const w = 96, h = 26, vals = points.map((p) => p[1]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join("");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="var(--series-1)" stroke-width="1.5"/></svg>`;
}

function render(d) {
  const c = d.common || {};
  const openBets = d.strategies.filter((s) => s.position).length;
  const crashes = (d.signals || []).filter((s) => s.crash).length;
  $("#app").innerHTML = `
  <section class="hero">
    <h1>Can "buy calls after a crash" win, like the $1,300-to-$1M Reddit post?</h1>
    <p>A <b>call option</b> is a cheap bet that SPY (the S&amp;P 500 fund) will be above a set price, the <b>strike</b>, by a set date. If it is, the payout can be many times the cost. If not, the option expires worth <b>$0</b>. Four rules, fixed in advance, bet pretend money using real end-of-day option prices. <b>No real money and no real orders.</b></p>
  </section>
  <div class="notice"><span>⚠️</span><div><b>Read this first.</b> Most short-dated options like these expire worthless. In the last 10 years SPY rose 4% or more within 3 trading days only about 1.6% of the time. You see big wins on Reddit because the thousands of people who lost the same bet don't post. A few lucky weeks here prove nothing.</div></div>
  <section class="tiles">
    <div class="tile"><div class="label">Rules competing</div><div class="value num">${d.strategies.length}</div><div class="sub">$${d.bankroll_each.toLocaleString()} pretend money each</div></div>
    <div class="tile"><div class="label">Crash signals so far</div><div class="value num">${crashes}</div><div class="sub">SPY down ${Math.abs(c.crash_one_day * 100)}%+ in a day or ${Math.abs(c.crash_two_day * 100)}%+ in two</div></div>
    <div class="tile"><div class="label">Open bets</div><div class="value num">${openBets}</div><div class="sub">options held right now</div></div>
    <div class="tile"><div class="label">Running since</div><div class="value" style="font-size:16px;line-height:1.5">${day(d.started)}</div><div class="sub">last update ${day(d.last_session)}</div></div>
    <div class="tile"><div class="label">History test</div><div class="value" style="font-size:16px;line-height:1.5">Not yet</div><div class="sub">needs Alpaca's free OPRA data agreement</div></div>
  </section>
  <section class="card"><div class="card-h"><h2>The four rules</h2><span class="hint">hover any heading for a plain-English explanation</span></div>
  <div class="table-wrap"><table>
    <thead><tr>${th("Strategy", 1)}${th("Balance")}${th("Return")}${th("Bets")}${th("Won")}${th("Best bet")}${th("Worst bet")}${th("Peak")}${th("Open bet", 1)}<th>Balance over time</th></tr></thead>
    <tbody>${d.strategies.map((r) => `<tr>
      <td class="l name"><b>${esc(r.name)}</b><span class="fam" style="white-space:normal">${esc(r.description)}</span></td>
      <td class="num">${usd(r.balance)}</td><td class="num ${cls(r.return)}">${spct(r.return)}</td>
      <td class="num">${r.trades}</td><td class="num">${pct(r.win_rate)}</td>
      <td class="num ${cls(r.best)}">${susd(r.best)}</td><td class="num ${cls(r.worst)}">${susd(r.worst)}</td>
      <td class="num">${usd(r.max_balance)}</td>
      <td class="l">${r.position ? `${r.position.contracts}× SPY ${r.position.strike} call, ${day(r.position.expiry)}<br><span class="muted" style="font-size:11.5px">paid ${usd(r.position.cost)} when SPY was ${usd(r.position.spy_at_entry)}</span>` : '<span class="muted">waiting for a signal</span>'}</td>
      <td class="l">${spark(r.curve)}</td></tr>`).join("")}</tbody></table></div></section>

  <div class="grid2">
    <section class="card"><div class="card-h"><h2>Recent finished bets</h2></div><div class="table-wrap">
      ${(() => { const all = d.strategies.flatMap((r) => (r.recent || []).map((t) => ({ ...t, name: r.name }))).sort((a, b) => String(b.exited).localeCompare(String(a.exited))).slice(0, 10);
        return all.length ? `<table class="mini"><thead><tr><th class="l">Rule</th><th class="l">Option</th><th>Paid</th><th>Got back</th><th>Result</th></tr></thead><tbody>${all.map((t) => `<tr><td class="l" style="white-space:normal">${esc(t.name)}</td><td class="l">SPY ${t.strike} call, ${day(t.expiry)}<br><span class="muted" style="font-size:11.5px">${esc(t.reason === "take_profit" ? "sold early at 4×" : "held to expiry")}${t.spy_at_exit ? `, SPY ${usd(t.spy_at_exit)}` : ""}</span></td><td class="num">${usd(t.paid)}</td><td class="num">${usd(t.received)}</td><td class="num ${cls(t.pnl)}">${susd(t.pnl)}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">No finished bets yet. Weekly bets settle after about a week, and crash bets only happen after a big drop.</div>'; })()}
    </div></section>
    <section class="card"><div class="card-h"><h2>Signals</h2><span class="hint">every trigger, including ones too late to trade</span></div><div class="card-b">
      ${(d.signals || []).length ? `<ul class="checklist">${d.signals.map((s) => `<li><span class="muted">•</span><div><div class="t" style="font-weight:500">${day(s.date)}: ${s.type === "missed_signal" ? "missed (the run was too late to use that close's prices)" : [s.crash ? `crash${fin(s.r1) ? ` (SPY ${spct(s.r1)} in a day)` : ""}` : "", s.weekly ? "weekly bet day" : ""].filter(Boolean).join(" + ")}</div></div></li>`).join("")}</ul>` : '<div class="empty">No signals yet.</div>'}
    </div></section>
  </div>

  <section class="card"><div class="card-h"><h2>How the test is run</h2></div><div class="card-b prose"><ul>
    <li><b>Real prices, pretend money.</b> After each market close, the daily job reads real end-of-day SPY option quotes from Alpaca and makes the "trades" a rule calls for. It never places real orders.</li>
    <li><b>Pessimistic.</b> It buys ${pct(c.slippage_pct)} above the asking price and sells ${pct(c.slippage_pct)} below the bid, plus fees. It sells early if an option is worth ${c.take_profit_x}× what was paid; otherwise it holds to expiry and is paid what the option is worth at SPY's closing price.</li>
    <li><b>No hindsight.</b> Prices can't be replayed later, so if a run is late and misses a close, the signal is logged as "missed", never traded after the fact.</li>
    <li><b>Small account limits.</b> A true at-the-money weekly SPY call costs about $900, nearly the whole $1,000, so the rules use cheaper out-of-the-money calls. That's also why they so often expire worthless.</li>
    <li><b>History test not yet possible.</b> Past option prices need Alpaca's free OPRA market-data agreement, which the account owner signs in the Alpaca dashboard. A pricing-formula guess would be misleading for these options, so there's no backtest until then.</li>
  </ul><p class="muted" style="font-size:12.5px">Options can lose 100% of what you pay. This is a research experiment, not investment advice.</p></div></section>`;
  $("#foot").innerHTML = `Options Lab · paper trading only · prices from Alpaca's indicative options feed`;
}

(async function load() {
  try {
    const r = await fetch("data/options.json?t=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    render(await r.json());
  } catch (e) {
    $("#app").innerHTML = `<section class="hero"><h1>Options Lab is warming up</h1><p>The first daily run after the market close will publish this page. Check back tonight.</p></section>`;
  }
})();
