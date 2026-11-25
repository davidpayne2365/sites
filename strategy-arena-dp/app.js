/* Strategy Arena dashboard. Reads data/arena.json and data/curves.json (written by the daily run). */
"use strict";

const S = { arena: null, curves: null, view: "paper", family: "all", q: "", sort: null, chartMode: "paper" };
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------------ formatting
const fin = (x) => typeof x === "number" && isFinite(x);
const pct = (x, d = 1, signed = false) => !fin(x) ? "—" : (signed && x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
const spct = (x, d = 1) => pct(x, d, true);
const usd = (x, d = 2) => !fin(x) ? "—" : (x < 0 ? "−$" : "$") + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const susd = (x) => !fin(x) ? "—" : (x > 0 ? "+" : "") + usd(x);
const num = (x, d = 2) => !fin(x) ? "—" : x.toFixed(d);
const cls = (x) => !fin(x) || Math.abs(x) < 1e-9 ? "" : x > 0 ? "pos" : "neg";
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T12:00:00Z"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); };

// ------------------------------------------------------------------ plain-English explanations
const G = {
  rank: "Position in the ranking. Strategies are ordered by how many safety checks they pass, then by how likely their results are real skill rather than luck.",
  name: "The strategy's name: the rule it follows and the funds it trades. Hover the fund symbols to see what they are.",
  status: "The verdict so far. ‘Not proven’ means it failed at least one check. ‘Live-money candidate’ would mean it passed everything, including 4 months of paper trading.",
  checks: "Each bar is one safety check: green = passed, red = failed, yellow = still waiting (the 4-month paper test). A strategy needs all of them green before it's worth real money.",
  bal: "How much the strategy's pretend $1,000 is worth now, including cash and anything it holds.",
  ret: "Total gain or loss since paper trading started. +5% means $1,000 became $1,050.",
  day: "Gain or loss in dollars on the most recent trading day.",
  week: "Gain or loss in dollars so far this week.",
  month: "Gain or loss in dollars so far this month.",
  dd: "Max drawdown: the biggest drop from a high point to a later low. 30% means at its worst moment it had lost 30% from its best value. Lower is safer.",
  sharpe: "Sharpe ratio: return earned per unit of up-and-down swings. Higher is better. Around 1 is good, and SPY scores about 0.9. It's shown once there are 20+ trading days.",
  trades: "How many complete buy-then-sell round trips the strategy has finished.",
  win: "Win rate: the share of finished trades that made money. A high win rate can still lose overall if the losses are bigger than the wins.",
  open: "The funds it holds right now (‘cash’ = it's waiting on the sidelines).",
  curve: "A tiny chart of the account value over time.",
  cagr: "Average yearly growth (CAGR) in the 10-year test, after trading costs. 10% means money grew about 10% per year on average.",
  dsr: "Luck-adjusted score (deflated Sharpe): the estimated chance that the strategy's good results are real skill and not luck from testing so many strategies. 95%+ is required.",
  hold: "Average yearly growth in 2023 to today only. This recent stretch is checked separately to see if the strategy still works on newer data.",
  stress: "Average yearly growth if every trade cost more (10 basis points, i.e. 0.10% per trade instead of 0.03%). A strategy that only works with cheap trading is fragile.",
  aw: "Average winning trade: the typical % gain on trades that made money.",
  al: "Average losing trade: the typical % loss on trades that lost money.",
  pf: "Profit factor: total dollars won ÷ total dollars lost. Above 1 means more won than lost; 2 means $2 won for every $1 lost.",
  exp: "How much of the time money was actually invested rather than sitting in cash.",
  dbl: "Out of every possible 6-month stretch since 2017, the share where the money at least doubled.",
  l30: "Out of every possible 6-month stretch since 2017, the share where it lost 30% or more. This is the price of chasing big gains.",
  "Paper balance": "What the pretend $1,000 is worth now.",
  "Total return": "Total gain or loss since paper trading started.",
  "Today": "Gain or loss in dollars on the most recent trading day.",
  "This week": "Gain or loss in dollars this week.",
  "This month": "Gain or loss in dollars this month.",
  "Realized P&L": "Profit or loss that's locked in: from trades already sold (plus dividends received).",
  "Unrealized P&L": "Profit or loss on things it still holds. It isn't locked in and changes with prices.",
  "Win rate": "Share of finished trades that made money.",
  "Avg winning trade": "Average dollars made on winning trades.",
  "Avg losing trade": "Average dollars lost on losing trades.",
  "Profit factor": "Dollars won ÷ dollars lost. Above 1 is good.",
  "Max drawdown": "Biggest drop from a high point. Lower is safer.",
  "Sharpe": "Return per unit of risk (swings). Higher is better; about 1 is good.",
  "Trades": "Completed buy-then-sell round trips.",
  "Doubled": "Share of 6-month stretches where money at least doubled.",
  "Gained 50%+": "Share of 6-month stretches with a gain of 50% or more.",
  "Typical 6 months": "The middle result: half of all 6-month stretches did better, half did worse.",
  "Typical": "The middle result: half of all 6-month stretches did better, half did worse.",
  "Lost 30%+": "Share of 6-month stretches with a loss of 30% or more.",
  "Lost 50%+": "Share of 6-month stretches that lost half or more.",
  "Worst 6 months": "The worst 6-month result in the whole test.",
  "Best": "The best 6-month result in the whole test.",
  "Worst": "The worst 6-month result in the whole test.",
  "CAGR": "Average yearly growth, after costs.",
  "Total": "Total growth over the whole period.",
  "Max DD": "Biggest drop from a high point. Lower is safer.",
  "Days": "Number of trading days in this market type.",
  "Annualized return": "Average yearly growth during these market conditions.",
  "Strategies competing": "How many different trading rules are being tested at the same time, each with its own pretend $1,000.",
  "Paper trading progress": "Paper trading = trading with pretend money but real prices, starting from today, so nobody can cheat with hindsight. 84 trading days ≈ 4 months.",
  "Best paper return so far": "The strategy with the biggest gain since paper trading began. Early leaders are often just lucky.",
  "SPY over the same period": "SPY is a fund that holds the 500 largest U.S. companies, i.e. ‘the market’. Every strategy must beat simply buying and holding it.",
  "Live-money candidates": "Strategies that passed every check, including 4 months of paper trading. Only these would be worth considering for real money.",
  "Shares": "How many shares (pieces of the fund) it owns. Fractions are allowed.",
  "Entry": "The price paid when buying.",
  "Last": "The most recent closing price.",
  "Value": "Shares × last price.",
  "Unrealized": "Gain or loss on this holding if it were sold at the last price.",
  "Stop": "Stop-loss: if the price falls to this level, the position is sold automatically to limit the loss.",
};
const CHECK_TIPS = {
  profit_after_costs: "Did it make money over 10 years after paying realistic trading costs?",
  market_conditions: "Did it make money in at least 2 of 3 market types: rising (bull), flat (sideways), and falling (bear)?",
  drawdown: "Was its worst drop 25% or less? Big drops are hard to live through and often lead to quitting at the bottom.",
  out_of_sample: "Did it still work in 2023 to today? This guards against rules that only fit the past.",
  beats_spy: "Was it better than simply holding SPY (the whole market) after accounting for risk?",
  worse_execution: "Does it still make money if every trade costs 3x more? Real trading is often messier than a simulation.",
  not_luck: "Like 50 people flipping coins: someone will get 7 heads in a row by pure chance, and that doesn't make them good at flipping. With ~50 strategies tested, a few will look great by chance too. This check asks: is this result better than what the luckiest of 50 random strategies would show? It needs a 95%+ chance that the edge is real.",
  enough_trades: "At least 30 finished trades. With fewer, results could easily be luck.",
  paper_period: "4 months (84 trading days) of trading with pretend money on new, unseen prices. The final and most important test.",
};
const STATUS_TIPS = {
  candidate: "Passed every check, including 4 months of paper trading. Worth discussing for a small real-money test, with your approval.",
  promising: "Passed all the history checks; now waiting for 4 months of paper trading to confirm.",
  failing: "Failed at least one check. It may still make money on paper, but it hasn't proven it's better than luck or than just holding SPY.",
  halted: "Stopped automatically because it lost more than its safety limit.",
  benchmark: "A simple yardstick (like just holding SPY) that every strategy is compared against.",
};
const symTip = (syms) => syms.map((x) => `${x}: ${S.arena.instruments?.[x] || x}`).join("\n");
const tt = (label, tip) => tip ? `<span class="tt" data-tip="${esc(tip)}">${label}</span>` : label;

(function initTips() {
  const box = document.createElement("div");
  box.id = "gtip";
  document.body.appendChild(box);
  let cur = null;
  const show = (el) => {
    cur = el;
    box.textContent = el.dataset.tip;
    box.style.display = "block";
    const r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
    let left = Math.min(innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2));
    let top = r.bottom + 8;
    if (top + bh > innerHeight - 8) top = r.top - bh - 8;
    box.style.left = left + "px";
    box.style.top = top + "px";
  };
  const hide = () => { cur = null; box.style.display = "none"; };
  let lastTouch = 0;
  document.addEventListener("touchstart", () => { lastTouch = Date.now(); }, { passive: true });
  document.addEventListener("mouseover", (e) => {
    if (Date.now() - lastTouch < 800) return; // emulated hover after a tap: handled by click
    const el = e.target.closest("[data-tip]"); if (el) show(el); else if (cur) hide();
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && Date.now() - lastTouch < 800) { el === cur ? hide() : show(el); } else if (!el) hide();
  });
  window.addEventListener("scroll", hide, { passive: true });
})();

const STATUS = {
  candidate: { label: "Live-money candidate", color: "var(--good)" },
  promising: { label: "Promising · awaiting paper", color: "var(--warning)" },
  failing: { label: "Not proven", color: "var(--critical)" },
  halted: { label: "Halted by risk limit", color: "var(--serious)" },
  benchmark: { label: "Benchmark", color: "var(--ref)" },
};
const badge = (st) => { const s = STATUS[st] || { label: st, color: "var(--muted)" }; return `<span class="badge" data-tip="${esc(STATUS_TIPS[st] || "")}"><span class="dot" style="background:${s.color}"></span>${s.label}</span>`; };
const checkBars = (checks) => `<span class="checks" data-tip="${esc(G.checks + "\n\n" + checks.map((c) => `${c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "…"} ${c.label}`).join("\n"))}">${checks.map((c) => `<i class="${c.status}"></i>`).join("")}</span>`;

// ------------------------------------------------------------------ theme
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("arena-theme"); } catch (e) { /* storage unavailable */ }
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("arena-theme", next); } catch (e) { /* ignore */ }
    route();
  });
})();

// ------------------------------------------------------------------ data
async function load() {
  try {
    const bust = "?t=" + Date.now();
    const [a, c] = await Promise.all([fetch("data/arena.json" + bust), fetch("data/curves.json" + bust)]);
    if (!a.ok || !c.ok) throw new Error("HTTP " + a.status + "/" + c.status);
    S.arena = await a.json();
    S.curves = await c.json();
    // Until there are a few paper sessions, the backtest is the more informative default.
    if (paperDays() < 5) { S.view = "backtest"; S.chartMode = "backtest"; }
  } catch (e) {
    $("#app").innerHTML = `<div class="empty">Could not load arena data (${esc(e.message)}). The daily run may not have published yet.</div>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

const byId = (id) => S.arena.strategies.find((s) => s.id === id);
const spy = () => byId("bench_spy");
const paperDays = () => Math.max(0, ...S.arena.strategies.map((s) => s.paper?.summary?.days || 0));

function route() {
  const m = location.hash.match(/^#s\/(.+)$/);
  renderTop();
  if (m && byId(decodeURIComponent(m[1]))) renderDetail(byId(decodeURIComponent(m[1])));
  else renderHome();
  renderFoot();
  attachTips();
}

function attachTips(root = document) {
  root.querySelectorAll("th, .tile .label, .kv span").forEach((el) => {
    if (el.dataset.tip) return;
    const key = el.dataset.k || el.textContent.replace(/[↑↓]/g, "").trim();
    const tip = G[key] || G[el.textContent.replace(/[↑↓]/g, "").trim()];
    if (tip) { el.dataset.tip = tip; el.classList.add("tt"); }
  })
}

function renderTop() {
  const a = S.arena;
  const dataOk = a.data.ok;
  const trading = a.control?.trading_enabled !== false;
  $("#topMeta").innerHTML = `
    <span class="pill num"${staleDays() >= 4 ? ' style="color:var(--critical-ink);border-color:var(--critical)"' : ""}>${staleDays() >= 4 ? "⛔ Stale · " : ""}Data as of ${fmtDate(a.as_of)}</span>
    <span class="pill"><span class="dot" style="background:${dataOk ? "var(--good)" : "var(--critical)"}"></span>${dataOk ? "Data checks passed" : "Data problem"}</span>
    <span class="pill"><span class="dot" style="background:${trading ? "var(--good)" : "var(--critical)"}"></span>${trading ? "Paper trading on" : "Kill switch ON"}</span>`;
}


// Warn loudly if the daily run has stopped (weekends/holidays allowed for).
function staleDays() { return (Date.now() - Date.parse(S.arena.generated_at)) / 864e5; }
function staleBanner() {
  const d = staleDays();
  if (d < 4) return "";
  return `<div class="notice" style="border-left-color:var(--critical)"><span>⛔</span><div><b>This data is ${Math.floor(d)} days old.</b> The daily run seems to have stopped, so the numbers below are out of date. Check the GitHub Actions tab and your email for an alert (common causes: an expired key or token).</div></div>`;
}

// ------------------------------------------------------------------ home
function renderHome() {
  const a = S.arena;
  const tested = a.strategies.filter((s) => !s.benchmark);
  const days = paperDays();
  const need = a.rules.paper_min_sessions;
  const withPaper = tested.filter((s) => s.paper);
  const best = withPaper.slice().sort((x, y) => (y.paper.summary.total_return ?? -9) - (x.paper.summary.total_return ?? -9))[0];
  const spyP = spy()?.paper;
  const cands = tested.filter((s) => s.status === "candidate");
  const start = withPaper[0]?.paper?.start;

  $("#app").innerHTML = `
  <section class="hero">
    <h1>${tested.length} strategies. $1,000 each. Does any of them really beat SPY?</h1>
    <p>Every strategy trades its own simulated $1,000 in U.S. ETFs, using real market prices, realistic fills, and strict risk limits. Each one is scored against SPY with checks built to separate real skill from luck.</p>
  </section>
  <section class="tiles">
    <div class="tile"><div class="label">Strategies competing</div><div class="value num">${tested.length}</div><div class="sub">+ ${a.strategies.length - tested.length} benchmarks · ${Object.keys(a.families).length - 1} families</div></div>
    <div class="tile"><div class="label">Paper trading progress</div><div class="value num">Day ${days} <span class="muted" style="font-size:15px">/ ${need}</span></div><div class="progress"><i style="width:${Math.min(100, (days / need) * 100)}%"></i></div><div class="sub">Started ${fmtDate(start)}</div></div>
    <div class="tile"><div class="label">Best paper return so far</div><div class="value num ${cls(best?.paper.summary.total_return)}">${best && days > 1 ? spct(best.paper.summary.total_return, 2) : "—"}</div><div class="sub">${best && days > 1 ? esc(best.name) : "First simulated fills at the next open"}</div></div>
    <div class="tile"><div class="label">SPY over the same period</div><div class="value num ${cls(spyP?.summary.total_return)}">${spyP && days > 1 ? spct(spyP.summary.total_return, 2) : "—"}</div><div class="sub">${spyP ? usd(spyP.balance) + " from $1,000" : "—"}</div></div>
    <div class="tile"><div class="label">Live-money candidates</div><div class="value num">${cands.length}</div><div class="sub">Need all ${(tested[0]?.checks.length) || 9} checks, incl. 4 months of paper</div></div>
  </section>
  ${staleBanner()}
  <div class="notice"><span>⚠️</span><div><b>Read the results with care.</b> With ${tested.length} strategies, the best backtest would show a Sharpe of about <b>${num(a.backtest_meta.expected_max_sharpe_by_luck)}</b> above its true value by luck alone. The “Real skill, not a fluke” check corrects for this. A few good weeks prove nothing, so no strategy can become a live-money candidate before ${need} sessions (about 4 months) of paper trading.</div></div>

  ${verdictCard()}
  ${winnerCard()}
  ${doublingCard()}

  <section class="card">
    <div class="card-h">
      <h2>Leaderboard</h2><span class="hint">ranked by checks passed, then luck-adjusted Sharpe · click a row for details</span>
      <div class="controls">
        <div class="seg" role="group" aria-label="Metrics">
          <button data-view="paper" aria-pressed="${S.view === "paper"}">Paper trading</button>
          <button data-view="backtest" aria-pressed="${S.view === "backtest"}">Backtest 2017–now</button>
        </div>
        <select id="fam" aria-label="Family"><option value="all">All families</option>${Object.entries(a.families).map(([k, v]) => `<option value="${k}" ${S.family === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
        <input type="search" id="q" placeholder="Search strategies" value="${esc(S.q)}" aria-label="Search">
      </div>
    </div>
    <div class="table-wrap" id="board"></div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Risk vs. return</h2><span class="hint">backtest ${fmtDate(a.backtest_meta.start)} to today, after costs · up and to the left is better · click a dot</span></div>
    <div class="card-b"><div class="legend"><span><i style="background:var(--series-1);height:8px;width:8px;border-radius:50%"></i>Strategy</span><span><i style="background:transparent;border:2px solid var(--ref);height:8px;width:8px;border-radius:50%"></i>Benchmark</span></div><div class="chart" id="scatter"></div></div>
  </section>

  ${methodology()}
  ${dataQuality()}`;

  $("#app").querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { S.view = b.dataset.view; S.sort = null; renderHome(); }));
  $("#fam").addEventListener("change", (e) => { S.family = e.target.value; renderBoard(); });
  $("#q").addEventListener("input", (e) => { S.q = e.target.value; renderBoard(); });
  renderBoard();
  scatter($("#scatter"));
}

const COLS = {
  paper: [
    ["rank", "#", (s) => s.rank ?? 999, (s) => s.rank ?? "—", "rank"],
    ["name", "Strategy", (s) => s.name, null, "l"],
    ["status", "Status", (s) => s.checks_passed, (s) => badge(s.status), "l"],
    ["checks", "Checks", (s) => s.checks_passed, (s) => `${checkBars(s.checks)} <span class="num ink2">${s.checks_passed}/${s.checks.length}</span>`, "l"],
    ["bal", "Balance", (s) => s.paper?.balance, (s) => usd(s.paper?.balance)],
    ["ret", "Return", (s) => s.paper?.summary.total_return, (s) => `<span class="${cls(s.paper?.summary.total_return)}">${spct(s.paper?.summary.total_return, 2)}</span>`],
    ["day", "Today", (s) => s.paper?.pnl.day, (s) => `<span class="${cls(s.paper?.pnl.day)}">${susd(s.paper?.pnl.day)}</span>`],
    ["week", "Week", (s) => s.paper?.pnl.week, (s) => `<span class="${cls(s.paper?.pnl.week)}">${susd(s.paper?.pnl.week)}</span>`],
    ["month", "Month", (s) => s.paper?.pnl.month, (s) => `<span class="${cls(s.paper?.pnl.month)}">${susd(s.paper?.pnl.month)}</span>`],
    ["dd", "Max DD", (s) => -(s.paper?.summary.max_drawdown ?? 0), (s) => pct(s.paper?.summary.max_drawdown)],
    ["sharpe", "Sharpe", (s) => s.paper?.summary.sharpe, (s) => (s.paper?.summary.days || 0) < 20 ? '<span class="muted" title="Needs 20+ sessions">—</span>' : num(s.paper?.summary.sharpe)],
    ["trades", "Trades", (s) => s.paper?.summary.trades, (s) => s.paper?.summary.trades ?? "—"],
    ["win", "Win rate", (s) => s.paper?.summary.win_rate, (s) => pct(s.paper?.summary.win_rate, 0)],
    ["open", "Open", (s) => s.paper?.positions.length, (s) => s.paper ? s.paper.positions.map((p) => p.symbol).join(" ") || '<span class="muted">cash</span>' : "—", "l"],
    ["curve", "Equity", null, (s) => spark(S.curves.paper[s.id], s.benchmark), "l"],
  ],
  backtest: [
    ["rank", "#", (s) => s.rank ?? 999, (s) => s.rank ?? "—", "rank"],
    ["name", "Strategy", (s) => s.name, null, "l"],
    ["checks", "Checks", (s) => s.checks_passed, (s) => `${checkBars(s.checks)} <span class="num ink2">${s.checks_passed}/${s.checks.length}</span>`, "l"],
    ["cagr", "CAGR", (s) => s.backtest.full.cagr, (s) => `<span class="${cls(s.backtest.full.cagr)}">${spct(s.backtest.full.cagr)}</span>`],
    ["sharpe", "Sharpe", (s) => s.backtest.full.sharpe, (s) => num(s.backtest.full.sharpe)],
    ["dsr", "Luck-adj.", (s) => s.backtest.full.deflated_sharpe ?? -1, (s) => s.benchmark ? "—" : pct(s.backtest.full.deflated_sharpe, 0)],
    ["dd", "Max DD", (s) => -s.backtest.full.max_drawdown, (s) => pct(s.backtest.full.max_drawdown)],
    ["hold", "2023+ CAGR", (s) => s.backtest.holdout.cagr, (s) => `<span class="${cls(s.backtest.holdout.cagr)}">${spct(s.backtest.holdout.cagr)}</span>`],
    ["stress", "10 bps CAGR", (s) => s.backtest.stress.cagr, (s) => `<span class="${cls(s.backtest.stress.cagr)}">${spct(s.backtest.stress.cagr)}</span>`],
    ["trades", "Trades", (s) => s.backtest.full.trades, (s) => s.backtest.full.trades || "—"],
    ["win", "Win rate", (s) => s.backtest.full.win_rate, (s) => pct(s.backtest.full.win_rate, 0)],
    ["aw", "Avg win", (s) => s.backtest.full.avg_win_pct, (s) => spct(s.backtest.full.avg_win_pct)],
    ["al", "Avg loss", (s) => s.backtest.full.avg_loss_pct, (s) => spct(s.backtest.full.avg_loss_pct)],
    ["pf", "Profit factor", (s) => s.backtest.full.profit_factor, (s) => num(s.backtest.full.profit_factor)],
    ["exp", "Invested", (s) => s.backtest.full.exposure, (s) => pct(s.backtest.full.exposure, 0)],
    ["dbl", "Doubled in 6 mo", (s) => s.backtest.six_month?.doubled, (s) => pct(s.backtest.six_month?.doubled, 1)],
    ["l30", "Lost 30%+ in 6 mo", (s) => -(s.backtest.six_month?.loss_30 ?? 0), (s) => `<span class="${(s.backtest.six_month?.loss_30 || 0) > 0 ? "neg" : ""}">${pct(s.backtest.six_month?.loss_30, 1)}</span>`],
    ["curve", "Equity", null, (s) => spark(S.curves.backtest[s.id], s.benchmark), "l"],
  ],
};

function renderBoard() {
  const cols = COLS[S.view];
  const q = S.q.trim().toLowerCase();
  let rows = S.arena.strategies.filter((s) => (S.family === "all" || s.family === S.family) &&
    (!q || (s.name + " " + s.id + " " + s.symbols.join(" ") + " " + s.family_label).toLowerCase().includes(q)));
  const sort = S.sort || { key: "rank", dir: 1 };
  const col = cols.find((c) => c[0] === sort.key);
  rows.sort((x, y) => {
    if (x.benchmark !== y.benchmark && sort.key === "rank") return x.benchmark ? 1 : -1;
    const a = col[2](x), b = col[2](y);
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return (typeof a === "string" ? a.localeCompare(b) : a - b) * sort.dir;
  });
  $("#board").innerHTML = `<table>
    <thead><tr>${cols.map((c) => `<th class="${c[4] || ""}" data-k="${c[0]}" ${sort.key === c[0] ? `aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}>${c[1]}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((s) => `<tr class="${s.benchmark ? "bench" : ""}" data-id="${esc(s.id)}">${cols.map((c) => c[0] === "name"
      ? `<td class="l name"><b>${esc(s.name)}</b><span class="fam">${esc(s.family_label)} · ${tt(esc(s.symbols.length > 4 ? s.symbols.length + " ETFs" : s.symbols.join(", ")), symTip(s.symbols))}</span></td>`
      : `<td class="num ${c[4] || ""}">${c[3](s)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">No strategies match.</td></tr>`}</tbody></table>`;
  $("#board").querySelectorAll("th[data-k]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.k;
    if (k === "curve") return;
    const cur = S.sort || { key: "rank", dir: 1 };
    const defDir = ["rank", "name", "dd"].includes(k) ? 1 : -1;
    S.sort = { key: k, dir: cur.key === k ? -cur.dir : (k === "dd" ? -1 : defDir) };
    renderBoard();
  }));
  attachTips($("#board"));
  $("#board").querySelectorAll("tbody tr[data-id]").forEach((tr) => tr.addEventListener("click", () => { location.hash = "#s/" + encodeURIComponent(tr.dataset.id); window.scrollTo(0, 0); }));
}

function spark(points, muted) {
  if (!points || points.length < 2) return '<span class="muted">—</span>';
  const w = 96, h = 26, vals = points.map((p) => p[1]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join("");
  const up = vals[vals.length - 1] >= vals[0];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="equity ${up ? "up" : "down"}"><path d="${d}" fill="none" stroke="${muted ? "var(--ref)" : "var(--series-1)"}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ------------------------------------------------------------------ detail
function renderDetail(s) {
  const p = s.paper;
  const ps = p?.summary || {};
  const b = s.backtest;
  const k = (label, val, c = "") => `<div><span>${label}</span><b class="num ${c}">${val}</b></div>`;
  $("#app").innerHTML = `
  <div style="padding:20px 0 12px"><button class="back" onclick="location.hash='';">← All strategies</button></div>
  <section class="card"><div class="card-b">
    <div class="detail-head">
      <div style="flex:1;min-width:260px">
        <div class="muted" style="font-size:12px">${esc(s.family_label)} · ${tt(esc(s.symbols.join(", ")), symTip(s.symbols))}${s.rank ? ` · rank #${s.rank}` : ""}</div>
        <h2>${esc(s.name)}</h2>
        <p>${esc(s.description)}</p>
      </div>
      <div>${badge(s.status)}</div>
    </div>
    ${p ? `<div class="kv">
      ${k("Paper balance", usd(p.balance))}
      ${k("Total return", spct(ps.total_return, 2), cls(ps.total_return))}
      ${k("Today", susd(p.pnl.day), cls(p.pnl.day))}
      ${k("This week", susd(p.pnl.week), cls(p.pnl.week))}
      ${k("This month", susd(p.pnl.month), cls(p.pnl.month))}
      ${k("Realized P&L", susd(p.realized_pnl), cls(p.realized_pnl))}
      ${k("Unrealized P&L", susd(p.unrealized_pnl), cls(p.unrealized_pnl))}
      ${k("Win rate", pct(ps.win_rate, 0))}
      ${k("Avg winning trade", susd(ps.avg_win_usd))}
      ${k("Avg losing trade", susd(ps.avg_loss_usd))}
      ${k("Profit factor", num(ps.profit_factor))}
      ${k("Max drawdown", pct(ps.max_drawdown))}
      ${k("Sharpe", (ps.days || 0) < 20 ? "—" : num(ps.sharpe))}
      ${k("Trades", ps.trades ?? 0)}
    </div>` : `<p class="muted">Paper trading has not started for this strategy yet.</p>`}
    ${p?.halted ? `<div class="notice" style="border-left-color:var(--critical)"><b>Halted:</b>&nbsp;${esc(p.halt_reason)}</div>` : ""}
  </div></section>

  <div class="grid2">
    <section class="card">
      <div class="card-h"><h2>Equity vs. SPY</h2>
        <div class="controls"><div class="seg">
          <button data-cm="paper" aria-pressed="${S.chartMode === "paper"}">Paper</button>
          <button data-cm="backtest" aria-pressed="${S.chartMode === "backtest"}">Backtest</button>
        </div></div></div>
      <div class="card-b"><div id="legend" class="legend"></div><div class="chart" id="eq"></div></div>
    </section>
    <section class="card">
      <div class="card-h"><h2>Scorecard</h2><span class="hint">all must pass before real money</span></div>
      <div class="card-b"><ul class="checklist">${s.checks.map((c) => `<li><span class="ic ${c.status}" aria-hidden="true">${c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "…"}</span><div><div class="t">${tt(esc(c.label), CHECK_TIPS[c.id])} <span class="muted" style="font-weight:400">· ${c.status === "pending" ? "pending" : c.status}</span></div><div class="d">${esc(c.detail)}</div></div></li>`).join("")}</ul></div>
    </section>
  </div>

  <section class="card"><div class="card-h"><h2>Open positions</h2><span class="hint">simulated, marked at the last close</span></div>
    <div class="table-wrap">${p && p.positions.length ? `<table class="mini"><thead><tr><th class="l">Symbol</th><th>Shares</th><th class="l">Since</th><th>Entry</th><th>Last</th><th>Value</th><th>Unrealized</th><th>Stop</th></tr></thead><tbody>
      ${p.positions.map((x) => `<tr><td class="l"><b>${esc(x.symbol)}</b></td><td class="num">${num(x.shares, 4)}</td><td class="l">${fmtDate(x.entry_date)}</td><td class="num">${usd(x.entry_price)}</td><td class="num">${usd(x.last_price)}</td><td class="num">${usd(x.value)}</td><td class="num ${cls(x.unrealized_pnl)}">${susd(x.unrealized_pnl)}</td><td class="num">${x.stop ? usd(x.stop) : "—"}</td></tr>`).join("")}
      </tbody></table>` : `<div class="empty">No open positions${p ? ` · ${usd(p.cash)} in cash` : ""}.</div>`}</div>
    ${p && Object.keys(p.pending_orders || {}).length ? `<div class="card-b muted" style="font-size:12.5px">Target for next open: ${Object.entries(p.pending_orders).map(([sym, o]) => `${esc(sym)} ${pct(o.w, 0)}`).join(" · ")}</div>` : ""}
  </section>

  <div class="grid2">
    <section class="card"><div class="card-h"><h2>Recent paper fills</h2></div><div class="table-wrap">
      ${p && p.recent_fills.length ? `<table class="mini"><thead><tr><th class="l">Date</th><th class="l">Side</th><th class="l">Symbol</th><th>Shares</th><th>Price</th><th>Amount</th><th class="l">Reason</th><th>P&L</th></tr></thead><tbody>
      ${p.recent_fills.map((f) => `<tr><td class="l">${fmtDate(f.date)}</td><td class="l">${f.side}</td><td class="l">${esc(f.symbol)}</td><td class="num">${num(f.shares, 4)}</td><td class="num">${usd(f.price)}</td><td class="num">${usd(f.notional)}</td><td class="l">${esc(f.reason)}</td><td class="num ${cls(f.realized_pnl)}">${f.realized_pnl != null ? susd(f.realized_pnl) : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No paper trades yet.</div>`}
    </div></section>
    <section class="card"><div class="card-h"><h2>Events</h2><span class="hint">risk actions, splits, catch-ups</span></div><div class="card-b">
      ${p && p.events.length ? `<ul class="checklist">${p.events.map((e) => `<li><span class="muted num" style="font-size:12px">•</span><div><div class="t" style="font-weight:500">${esc(e.type.replace(/_/g, " "))}</div><div class="d">${fmtDate(e.date)} ${esc(e.reason || e.detail || (e.sessions ? e.sessions + " sessions" : "") || "")}</div></div></li>`).join("")}</ul>` : `<div class="empty">Nothing unusual.</div>`}
    </div></section>
  </div>

  <section class="card"><div class="card-h"><h2>Backtest by period</h2><span class="hint">same engine as paper trading; parameters were not tuned to these results</span></div><div class="table-wrap">
    <table class="mini"><thead><tr><th class="l">Period</th><th>CAGR</th><th>Total</th><th>Sharpe</th><th>Max DD</th><th>Trades</th><th>Win rate</th><th>Profit factor</th></tr></thead><tbody>
    ${[["Full, " + fmtDate(b.full.start) + " – " + fmtDate(b.full.end), b.full], ["Design years 2017–2022", b.design], ["Holdout 2023 – today", b.holdout], ["Full at 10 bps slippage (stress)", b.stress]].map(([n, m]) =>
      `<tr><td class="l">${n}</td><td class="num ${cls(m.cagr)}">${spct(m.cagr)}</td><td class="num">${spct(m.total_return, 0)}</td><td class="num">${num(m.sharpe)}</td><td class="num">${pct(m.max_drawdown)}</td><td class="num">${m.trades ?? "—"}</td><td class="num">${pct(m.win_rate, 0)}</td><td class="num">${num(m.profit_factor)}</td></tr>`).join("")}
    </tbody></table>
    <table class="mini" style="margin-top:8px"><thead><tr><th class="l">Market regime</th><th>Days</th><th>Annualized return</th><th>Sharpe</th></tr></thead><tbody>
    ${["bull", "sideways", "bear"].map((r) => { const g = b.regimes[r]; return `<tr><td class="l">${r[0].toUpperCase() + r.slice(1)}</td><td class="num">${g.days}</td><td class="num ${cls(g.ann_return)}">${spct(g.ann_return)}</td><td class="num">${num(g.sharpe)}</td></tr>`; }).join("")}
    </tbody></table>
    ${b.six_month?.windows ? `<table class="mini" style="margin-top:8px"><thead><tr><th class="l">Any 6-month stretch</th><th>Doubled</th><th>Gained 50%+</th><th>Typical</th><th>Lost 30%+</th><th>Best</th><th>Worst</th></tr></thead><tbody><tr><td class="l">${b.six_month.windows.toLocaleString()} rolling windows</td><td class="num">${pct(b.six_month.doubled, 1)}</td><td class="num">${pct(b.six_month.gain_50, 1)}</td><td class="num ${cls(b.six_month.median)}">${spct(b.six_month.median)}</td><td class="num ${b.six_month.loss_30 > 0 ? "neg" : ""}">${pct(b.six_month.loss_30, 1)}</td><td class="num pos">${spct(b.six_month.best)}</td><td class="num neg">${spct(b.six_month.worst)}</td></tr></tbody></table>` : ""}
    <div class="card-b muted" style="font-size:12.5px">Sharpe 90% range (bootstrap): ${num(b.full.sharpe_ci90?.[0])} to ${num(b.full.sharpe_ci90?.[1])} · luck-adjusted (deflated) Sharpe probability: ${s.benchmark ? "n/a" : pct(b.full.deflated_sharpe, 0)} · correlation with SPY: ${num(b.full.correlation_spy)} · stop-losses hit: ${b.stops_hit}${b.drawdown_breach ? ` · would have hit the ${pct(s.risk.max_drawdown, 0)} drawdown halt on ${fmtDate(b.drawdown_breach)}` : ""}</div>
  </div></section>

  <section class="card"><div class="card-h"><h2>Rules & risk settings</h2><span class="hint">frozen while paper trading; a change means a new strategy id</span></div><div class="card-b">
    <div class="kv">${Object.entries(s.params).map(([kk, v]) => k(esc(kk), esc(typeof v === "object" ? JSON.stringify(v) : v ?? "none"))).join("") || k("parameters", "none")}
    ${s.benchmark ? "" : Object.entries(s.risk).map(([kk, v]) => k(esc(kk.replace(/_/g, " ")), ["max_daily_loss", "max_drawdown", "vol_target", "max_position_weight", "max_gross_exposure", "rebalance_threshold"].includes(kk) && fin(v) ? pct(v, 0) : esc(v ?? "none"))).join("")}</div>
  </div></section>`;

  $("#app").querySelectorAll("[data-cm]").forEach((bt) => bt.addEventListener("click", () => { S.chartMode = bt.dataset.cm; renderDetail(s); }));
  const src = S.chartMode === "paper" ? S.curves.paper : S.curves.backtest;
  const series = [{ name: s.name, color: "var(--series-1)", points: src[s.id] || [] }];
  if (s.id !== "bench_spy") series.push({ name: "SPY buy & hold", color: "var(--ref)", dash: true, points: src.bench_spy || [] });
  $("#legend").innerHTML = series.map((x) => `<span><i class="${x.dash ? "dash" : ""}" style="background:${x.color}"></i>${esc(x.name)}</span>`).join("");
  lineChart($("#eq"), series);
}

// ------------------------------------------------------------------ charts
const NS = "http://www.w3.org/2000/svg";
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || Math.abs(hi) || 1;
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
  const out = [];
  const first = Math.floor(lo / step + 1e-9) * step, last = Math.ceil(hi / step - 1e-9) * step;
  for (let v = first; v <= last + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}

function lineChart(el, series) {
  const all = series.filter((s) => s.points.length > 1);
  if (!all.length) { el.innerHTML = `<div class="empty">Not enough data yet. Paper results appear after the first trading days.</div>`; return; }
  const W = Math.max(320, el.clientWidth || 600), H = Math.round(Math.min(340, Math.max(220, W * 0.45)));
  const m = { l: 56, r: 16, t: 10, b: 26 };
  const t = (d) => Date.parse(d + "T00:00:00Z");
  const xs = all.flatMap((s) => s.points.map((p) => t(p[0]))), ys = all.flatMap((s) => s.points.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.08 || 10; y0 -= pad; y1 += pad;
  const ticks = niceTicks(y0, y1, 5); y0 = Math.min(y0, ticks[0]); y1 = Math.max(y1, ticks[ticks.length - 1]);
  const X = (v) => m.l + ((v - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);
  const span = x1 - x0, years = span / 3.15e10;
  const xt = [];
  const d0 = new Date(x0);
  if (years > 2) { for (let y = d0.getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= x1; y += years > 6 ? 2 : 1) xt.push([Date.UTC(y, 0, 1), String(y)]); }
  else { const stepM = span > 2.6e10 ? 3 : span > 8e9 ? 1 : 0; if (stepM) { for (let d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)); d.getTime() <= x1; d.setUTCMonth(d.getUTCMonth() + stepM)) xt.push([d.getTime(), d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })]); }
    else { const pts = all[0].points; const every = Math.max(1, Math.ceil(pts.length / 6)); pts.forEach((p, i) => { if (i % every === 0) xt.push([t(p[0]), new Date(t(p[0])).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })]); }); } }
  const money = (v) => (Math.abs(v) >= 10000 ? "$" + (v / 1000).toFixed(0) + "k" : "$" + Math.round(v).toLocaleString("en-US"));
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity curve">`;
  ticks.forEach((v) => { svg += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${money(v)}</text>`; });
  svg += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
  xt.forEach(([v, lab]) => { svg += `<text class="tick" x="${X(v)}" y="${H - 8}" text-anchor="middle">${lab}</text>`; });
  if (y0 < 1000 && y1 > 1000) svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(1000)}" y2="${Y(1000)}" stroke="var(--axis)" stroke-dasharray="2 3"/>`;
  [...all].reverse().forEach((s) => {
    const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(t(p[0])).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ""}/>`;
  });
  svg += `<g id="hover" style="display:none"><line id="hx" y1="${m.t}" y2="${H - m.b}" stroke="var(--axis)"/>${all.map((s, i) => `<circle id="hc${i}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("")}</g>`;
  svg += `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" id="hit"/></svg>`;
  el.innerHTML = svg + `<div class="tip"></div>`;
  const tip = $(".tip", el), g = $("#hover", el), hit = $("#hit", el);
  const maps = all.map((s) => new Map(s.points.map((p) => [p[0], p[1]])));
  const base = all[0].points;
  const move = (ev) => {
    const r = el.querySelector("svg").getBoundingClientRect();
    const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
    const tv = x0 + ((px - m.l) / (W - m.l - m.r)) * (x1 - x0);
    let best = 0, bd = Infinity;
    base.forEach((p, i) => { const dd = Math.abs(t(p[0]) - tv); if (dd < bd) { bd = dd; best = i; } });
    const date = base[best][0], xx = X(t(date));
    g.style.display = "";
    $("#hx", el).setAttribute("x1", xx); $("#hx", el).setAttribute("x2", xx);
    all.forEach((s, i) => { const v = maps[i].get(date); const c = $("#hc" + i, el); if (v == null) { c.style.display = "none"; return; } c.style.display = ""; c.setAttribute("cx", xx); c.setAttribute("cy", Y(v)); });
    tip.innerHTML = `<div class="tdate">${fmtDate(date)}</div>` + all.map((s, i) => { const v = maps[i].get(date); return `<div class="row"><span><span class="dot" style="background:${s.color}"></span>${esc(s.name.length > 26 ? s.name.slice(0, 25) + "…" : s.name)}</span><b>${v == null ? "—" : usd(v)}</b></div>`; }).join("");
    tip.style.display = "block";
    const left = (xx / W) * r.width;
    tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + "px";
    tip.style.top = "8px";
  };
  hit.addEventListener("mousemove", move);
  hit.addEventListener("touchmove", move, { passive: true });
  hit.addEventListener("mouseleave", () => { g.style.display = "none"; tip.style.display = "none"; });
}

function scatter(el) {
  const pts = S.arena.strategies.map((s) => ({ s, x: s.backtest.full.max_drawdown, y: s.backtest.full.cagr }));
  const W = Math.max(320, el.clientWidth || 600), H = Math.round(Math.min(380, Math.max(240, W * 0.42)));
  const m = { l: 52, r: 20, t: 12, b: 38 };
  const xt = niceTicks(0, Math.max(...pts.map((p) => p.x)) * 1.05, 5), yt = niceTicks(Math.min(0, ...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)) * 1.08, 5);
  const xa = 0, xb = xt[xt.length - 1], ya = Math.min(0, yt[0]), yb = yt[yt.length - 1];
  const X = (v) => m.l + ((v - xa) / (xb - xa)) * (W - m.l - m.r), Y = (v) => m.t + (1 - (v - ya) / (yb - ya)) * (H - m.t - m.b);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Risk versus return scatter">`;
  yt.forEach((v) => { svg += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`; });
  xt.forEach((v) => { svg += `<text class="tick" x="${X(v)}" y="${H - 20}" text-anchor="middle">${Math.round(v * 100)}%</text>`; });
  svg += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  svg += `<text class="tick" x="${(m.l + W - m.r) / 2}" y="${H - 3}" text-anchor="middle">Max drawdown (worst peak-to-trough loss)</text>`;
  svg += `<text class="tick" transform="translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">Annual return</text>`;
  pts.forEach((p, i) => {
    const cx = X(p.x), cy = Y(p.y);
    svg += p.s.benchmark ? `<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--surface)" stroke="var(--ref)" stroke-width="2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>`;
    if (p.s.id === "bench_spy") svg += `<text class="dlabel" x="${cx + 9}" y="${cy + 4}">SPY</text>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="11" fill="transparent" data-i="${i}" style="cursor:pointer"/>`;
  });
  svg += `</svg>`;
  el.innerHTML = svg + `<div class="tip"></div>`;
  const tip = $(".tip", el);
  el.querySelectorAll("[data-i]").forEach((c) => {
    const p = pts[+c.dataset.i];
    c.addEventListener("mouseenter", () => {
      tip.innerHTML = `<div class="tdate">${esc(p.s.family_label)}</div><div style="font-weight:600;margin-bottom:4px">${esc(p.s.name)}</div>
        <div class="row"><span>Annual return</span><b>${spct(p.y)}</b></div><div class="row"><span>Max drawdown</span><b>${pct(p.x)}</b></div><div class="row"><span>Sharpe</span><b>${num(p.s.backtest.full.sharpe)}</b></div>`;
      tip.style.display = "block";
      const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, cr.left - r.left + 14) + "px";
      tip.style.top = Math.max(0, cr.top - r.top - 10) + "px";
    });
    c.addEventListener("mouseleave", () => { tip.style.display = "none"; });
    c.addEventListener("click", () => { location.hash = "#s/" + encodeURIComponent(p.s.id); window.scrollTo(0, 0); });
  });
}



// ------------------------------------------------------------------ the 4-month verdict
function verdictCard() {
  const v = S.arena.verdict;
  if (!v) return "";
  const link = (b) => `<a href="#s/${esc(b.id)}">${esc(b.name)}</a>`;
  const trades = (b) => b.symbols.map((x) => tt(esc(x), `${x}: ${S.arena.instruments?.[x] || x}`)).join(", ");
  const rule = `<ol style="margin:6px 0 0;padding-left:20px">${v.rule.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>`;
  let body, color;
  if (v.status === "pending") {
    color = "var(--warning)";
    const l = v.provisional_leader;
    body = `<p style="margin:0"><b>Verdict day: ${fmtDate(v.decision_date)}</b>, after ${v.sessions_needed} trading days of paper trading (day ${v.sessions} so far). On that day you get one email naming the strategy to use for your $1,000, picked by the rule below. It's also shown here.</p>
      ${l ? `<p style="margin:10px 0 0">Provisional leader under this rule: ${link(l)} (trades ${trades(l)}): ${l.checks_passed}/${l.checks_total} checks, ${spct(l.paper_return, 2)} on paper so far. <b>Not a recommendation yet.</b> Early leaders often change.</p>` : ""}`;
  } else if (v.pick) {
    color = "var(--good)";
    const p = v.pick;
    body = `<p style="margin:0;font-size:16px"><b>Recommended for the $1,000 test: ${link(p)}</b>, which trades ${trades(p)}.</p>
      <p style="margin:6px 0 0">Paper trading: $1,000 → <b>${usd(p.paper_balance)}</b> (${spct(p.paper_return)}), worst drop ${pct(p.paper_max_drawdown)}. SPY did ${spct(v.spy_paper_return)} over the same period. Real money stays off until you approve the live module.</p>`;
  } else {
    color = "var(--critical)";
    body = `<p style="margin:0;font-size:16px"><b>No strategy qualified.</b> ${esc(v.fallback || "")}</p><p style="margin:6px 0 0">SPY returned ${spct(v.spy_paper_return)} over the paper period. This means no rule set proved it beats simply holding the market, and that protects your money.</p>`;
  }
  return `<section class="card" style="border-left:3px solid ${color}">
    <div class="card-h"><h2>Your $1,000 pick</h2><span class="hint">${v.status === "pending" ? "decided automatically on verdict day" : "decided " + fmtDate(v.decision_date)}</span></div>
    <div class="card-b prose" style="font-size:14px">${body}
      <details style="margin-top:10px"><summary>How the pick is made (fixed in advance, so it can't be cherry-picked)</summary>${rule}</details></div>
  </section>`;
}

// ------------------------------------------------------------------ plain-English "who's winning?"
function winnerCard() {
  const a = S.arena, days = paperDays();
  const tested = a.strategies.filter((s) => !s.benchmark);
  const spyS = spy();
  const syms = (s) => s.symbols.filter((x) => !(s.kind === "leveraged_signal" && x === s.params.signal));
  const what = (s) => syms(s).map((x) => `<b>${tt(esc(x), `${x}: ${a.instruments?.[x] || x}`)}</b>`).join(", ");
  const link = (s) => `<a href="#s/${esc(s.id)}">${esc(s.name)}</a>`;
  const usd0 = (x) => usd(x, 0);
  const top = tested.slice().sort((x, y) => (x.rank ?? 999) - (y.rank ?? 999))[0];
  const richest = tested.slice().sort((x, y) => y.backtest.full.final_equity - x.backtest.full.final_equity)[0];
  const cands = tested.filter((s) => s.status === "candidate");
  const paperLeader = tested.filter((s) => s.paper).sort((x, y) => y.paper.summary.total_return - x.paper.summary.total_return)[0];
  const sb = spyS.backtest.full;
  const lines = [];
  lines.push(days < 20
    ? `<li><b>Paper trading: too early to tell.</b> It has run ${days} trading day${days === 1 ? "" : "s"} of the ${a.rules.paper_min_sessions} needed. Results from a few days are mostly luck.${paperLeader && days > 1 ? ` Current leader: ${link(paperLeader)} (${spct(paperLeader.paper.summary.total_return, 2)}).` : ""}</li>`
    : `<li><b>Paper trading leader:</b> ${link(paperLeader)}, holding ${what(paperLeader)}: ${usd(paperLeader.paper.balance)} from $1,000 (${spct(paperLeader.paper.summary.total_return, 1)}), vs SPY ${spct(spyS.paper?.summary.total_return, 1)}.</li>`);
  lines.push(`<li><b>Best in the 10-year test, adjusted for risk:</b> ${link(top)}, which trades ${what(top)}. $1,000 in Feb 2017 became <b>${usd0(top.backtest.full.final_equity)}</b>, and its worst drop along the way was ${pct(top.backtest.full.max_drawdown, 0)}. It passes ${top.checks_passed} of ${top.checks.length} checks.</li>`);
  lines.push(`<li><b>Most money in the 10-year test:</b> ${link(richest)}, which trades ${what(richest)}. $1,000 became <b>${usd0(richest.backtest.full.final_equity)}</b>, but at one point it was down <b>${pct(richest.backtest.full.max_drawdown, 0)}</b> from its peak. Big wins came with big crashes.</li>`);
  lines.push(`<li><b>For comparison, just holding SPY</b> (the 500 largest U.S. companies): $1,000 became <b>${usd0(sb.final_equity)}</b>, with a worst drop of ${pct(sb.max_drawdown, 0)}.</li>`);
  return `<section class="card" style="border-left:3px solid var(--series-1)">
    <div class="card-h"><h2>Who's winning? In plain English</h2></div>
    <div class="card-b prose" style="font-size:14px"><ul style="margin:0;padding-left:18px">${lines.join("")}</ul>
    <p style="margin:12px 0 0"><b>Bottom line:</b> ${cands.length ? `${cands.map(link).join(", ")} passed every check.` : "there is <b>no winner yet</b>. No strategy has passed every check, so none is recommended for real money. Hover any underlined word or number for an explanation."}</p></div>
  </section>`;
}

// ------------------------------------------------------------------ doubling odds
function doublingCard() {
  const all = S.arena.strategies.filter((s) => s.backtest.six_month?.windows);
  const top = all.slice().sort((a, b) => (b.backtest.six_month.doubled - a.backtest.six_month.doubled) ||
    (b.backtest.six_month.gain_50 - a.backtest.six_month.gain_50)).slice(0, 8);
  const spyRow = byId("bench_spy");
  if (spyRow && !top.includes(spyRow)) top.push(spyRow);
  const n = all[0]?.backtest.six_month.windows || 0;
  return `<section class="card">
    <div class="card-h"><h2>Goal check: doubling money in 6 months</h2><span class="hint">every rolling 6-month window in the backtest (${n.toLocaleString()} windows, ${fmtDate(S.arena.backtest_meta.start)} to today)</span></div>
    <div class="table-wrap"><table class="mini"><thead><tr><th class="l">Strategy</th><th>Doubled</th><th>Gained 50%+</th><th>Typical 6 months</th><th>Lost 30%+</th><th>Lost 50%+</th><th>Worst 6 months</th></tr></thead><tbody>
    ${top.map((s) => { const o = s.backtest.six_month; return `<tr class="${s.benchmark ? "bench" : ""}" style="cursor:pointer" onclick="location.hash='#s/${esc(s.id)}';scrollTo(0,0)"><td class="l"><b>${esc(s.name)}</b> <span class="muted" style="font-size:11.5px">${esc(s.family_label)}</span></td><td class="num">${pct(o.doubled, 1)}</td><td class="num">${pct(o.gain_50, 1)}</td><td class="num ${cls(o.median)}">${spct(o.median)}</td><td class="num ${o.loss_30 > 0 ? "neg" : ""}">${pct(o.loss_30, 1)}</td><td class="num ${o.loss_50 > 0 ? "neg" : ""}">${pct(o.loss_50, 1)}</td><td class="num neg">${spct(o.worst)}</td></tr>`; }).join("")}
    </tbody></table></div>
    <div class="card-b muted" style="font-size:12.5px">Doubling in 6 months only happened with 2x–3x leveraged ETFs, and those carry the biggest crash risk. This decade was unusually good for tech, so the leveraged figures likely flatter what to expect.</div>
  </section>`;
}

// ------------------------------------------------------------------ static sections
function methodology() {
  const a = S.arena, r = a.rules;
  return `<section class="card"><div class="card-h"><h2>How the arena works</h2></div><div class="card-b prose">
  <ul>
    <li><b>Real prices, simulated money.</b> Daily prices for ${new Set(a.strategies.flatMap((s) => s.symbols)).size} U.S. ETFs come from Alpaca's consolidated (SIP) feed. Each run happens after the close. Nothing is sent to a broker.</li>
    <li><b>Realistic fills.</b> Decisions use the close, and orders fill at the <i>next day's open</i>, with ${a.backtest_meta.base_bps} bps slippage plus SEC/FINRA fees. A stop that gaps fills at the open, not at the stop price. Dividends and splits are applied. Fractional shares are allowed, as at Alpaca.</li>
    <li><b>Risk limits on every strategy.</b> Volatility-based position caps, no leverage, no new buys the day after a 3% loss, and a full halt at a ${pct(r.max_drawdown, 0)} drawdown. Position sizes never grow to win back losses.</li>
    <li><b>Backtest 2017–today</b> uses the same engine. Parameters are textbook defaults chosen before testing, never tuned. 2023 onward is reported separately as a recent holdout, and results are re-run at ${a.backtest_meta.stress_bps} bps to test worse execution.</li>
    <li><b>Luck adjustment.</b> Testing ${a.backtest_meta.n_trials} strategies at once makes some look skilled by chance. The deflated Sharpe ratio (Bailey & López de Prado) estimates the probability that an edge is real. The scorecard requires ${pct(r.dsr_min, 0)}.</li>
    <li><b>Live money is a separate decision.</b> Becoming a candidate needs every check, including ${r.paper_min_sessions} sessions of paper trading. Even then, real-money trading is not built and needs the owner's explicit approval.</li>
  </ul>
  <p class="muted" style="font-size:12.5px">Sharpe uses a 0% risk-free rate. Past and simulated performance does not guarantee future results. This is a research tool, not investment advice.</p>
  </div></section>`;
}

function dataQuality() {
  const d = S.arena.data;
  const issues = d.issues.filter((i) => i.severity !== "info");
  return `<section class="card"><div class="card-h"><h2>Data quality</h2><span class="hint">checked every run; any error stops trading</span></div><div class="card-b prose" style="font-size:13px">
    <p>${d.ok ? "✓ All error checks passed" : "✕ Errors found, so trading was skipped"} · feed: ${esc(d.feed.toUpperCase())} · ${issues.length} warning${issues.length === 1 ? "" : "s"}</p>
    ${d.overrides.length ? `<p><b>Reviewed corrections:</b> ${d.overrides.map((o) => `${esc(o.symbol)} ${fmtDate(o.ex_date)}: ${esc(o.reason)}`).join("; ")}</p>` : ""}
    ${issues.length ? `<details><summary>Show warnings</summary><ul>${issues.map((i) => `<li>${esc(i.symbol)} ${i.session_date ? fmtDate(i.session_date) : ""}: ${esc(i.check.replace(/_/g, " "))}, ${esc(i.detail)}</li>`).join("")}</ul></details>` : ""}
  </div></section>`;
}

function renderFoot() {
  const a = S.arena;
  $("#foot").innerHTML = `Strategy Arena · updated ${esc(a.generated_at.replace("T", " ").slice(0, 16))} UTC · paper trading only, no real orders · not investment advice`;
}

let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => S.arena && route(), 150); });
load();
