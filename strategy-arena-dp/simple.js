// Simple home page: the answer first, few words, no jargon. Full detail lives on details.html.
(function () {
  "use strict";
  const $app = document.getElementById("app");
  const KIND = {
    benchmark: "Just hold", ma_momentum: "Follows trends", mean_reversion: "Buys dips", momentum: "Picks the strongest",
    breakout: "Buys new highs", quant: "Math model", high_risk: "High risk", idea: "New idea",
  };
  // Plain names for a non-expert (the technical names stay on the details page).
  const PLAIN = {
    "bench_spy": "SPY (just hold)",
    "bench_core4_ew": "4 big U.S. funds, just hold",
    "bench_60_40": "60% stocks, 40% bonds",
    "ma_ema20_50_spy": "S&P 500 trend, fast",
    "ma_sma50_200_spy": "S&P 500 trend, slow",
    "ma_ema20_50_trend_core4": "Trend, 4 big funds",
    "ma_ema10_30_adx_qqq": "Nasdaq strong trends",
    "ma_ema20_50_lowvol_core4": "Trend, calm markets only",
    "ma_sma200_spy": "S&P 500 above its average",
    "ma_sma200_sectors": "Sectors above their average",
    "rsi2_spy": "Buy S&P 500 dips",
    "rsi2_core4": "Buy dips, 4 big funds",
    "rsi14_30_70_spy": "Buy oversold S&P 500",
    "rsi2_volume_qqq": "Buy Nasdaq panic dips",
    "rsi3_atr_core4": "Buy dips with a stop-loss",
    "bb_reversion_spy": "Buy S&P 500 stretch-downs",
    "ibs_spy": "Buy weak S&P 500 closes",
    "ibs_core4": "Buy weak closes, 4 big funds",
    "mom_sectors_top1_6m": "Best sector (6 months)",
    "mom_sectors_top3_12m": "Best 3 sectors (1 year)",
    "mom_core4_top2_3m": "Best 2 big funds (3 months)",
    "mom_dual_spy_efa": "U.S. or world stocks, or bonds",
    "mom_volume_equity12": "Strongest funds, busy trading",
    "mom_blend_multi": "Strongest of stocks, bonds, gold",
    "mom_trend_pullback_equity12": "Buy pullbacks in winners",
    "brk_donchian20_spy": "S&P 500 new 1-month highs",
    "brk_turtle55_core4": "New 3-month highs, 4 funds",
    "brk_volume_sectors": "Sector new highs, busy trading",
    "brk_pivot_spy": "S&P 500 breaks resistance",
    "brk_pivot_core4": "Breaks resistance, 4 funds",
    "brk_squeeze_equity12": "Breakout after quiet spell",
    "q_zscore_spy": "S&P 500 unusual drops",
    "q_zscore_core4": "Unusual drops, 4 funds",
    "q_multifactor_equity12": "Score: trend + calm + strength",
    "q_lowvol_equity12": "Calmest 3 funds",
    "q_riskparity_multi": "Balanced mix with trend",
    "q_logit_spy": "AI model, S&P 500",
    "q_logit_core4": "AI model, 4 funds",
    "hr_tqqq_hold": "3x Nasdaq, just hold",
    "hr_upro_hold": "3x S&P 500, just hold",
    "hr_tqqq_sma200": "3x Nasdaq in uptrends",
    "hr_upro_sma200": "3x S&P 500 in uptrends",
    "hr_tqqq_ema": "3x Nasdaq, fast trend",
    "hr_tqqq_rsi2": "3x Nasdaq dip-buying",
    "hr_soxl_trend": "3x chip stocks in uptrends",
    "hr_tna_sma200": "3x small companies in uptrends",
    "hr_qld_sma200": "2x Nasdaq in uptrends",
    "hr_lev_momentum": "Hottest 3x fund",
    "hr_lev_dual": "3x stocks or bonds",
    "hr_sector_top1_1m": "Last month's hottest sector"
    };
  const nm = (s) => PLAIN[s.id] || s.name;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const pct = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(1) + "%";
  const cls = (x) => (x > 0.0005 ? "s-up" : x < -0.0005 ? "s-down" : "s-muted");
  const date = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const bust = "?t=" + Date.now();
  const get = (p) => fetch(p + bust).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  Promise.all([get("data/arena.json"), get("data/ideas.json")]).then(([a, ideas]) => {
    if (!a) { $app.innerHTML = `<p class="s-muted">Couldn't load the results. Try again in a minute.</p>`; return; }
    $app.innerHTML = top(a) + answer(a) + now(a) + longRun(a) + ideaCard(ideas) + links();
    const btn = document.getElementById("showAll");
    if (btn) btn.onclick = () => { document.getElementById("all").hidden = false; btn.remove(); };
  });

  function top(a) {
    return `<header class="s-top"><h1>Strategy Arena</h1><span class="s-tag">Pretend money only</span></header>`;
  }

  // 1. The answer.
  function answer(a) {
    const v = a.verdict || {};
    let big, sub;
    if (v.status === "pending") {
      big = "No winner yet";
      sub = "For now, the safe choice is to just hold <b>SPY</b> (the 500 biggest U.S. companies).";
    } else if (v.pick) {
      big = `Winner: ${esc(v.pick.name)}`;
      sub = `It turned $1,000 into <b>${usd(v.pick.paper_balance)}</b> on pretend money.`;
    } else {
      big = "Just hold SPY";
      sub = "Nothing beat simply holding the 500 biggest U.S. companies.";
    }
    let progress = "";
    if (v.status === "pending" && v.sessions_needed) {
      const done = Math.min(1, (v.sessions || 0) / v.sessions_needed);
      const left = Math.max(0, Math.ceil((new Date(v.decision_date + "T21:00:00Z") - Date.now()) / 864e5));
      progress = `<div class="s-bar"><i style="width:${(done * 100).toFixed(1)}%"></i></div>
        <div class="s-small">Final answer on <b>${date(v.decision_date)}</b> · ${left} days to go</div>`;
    }
    return `<section class="s-card"><p class="s-label">What should I do?</p><p class="s-big">${big}</p>
      <p class="s-sub">${sub}</p>${progress}</section>`;
  }

  function row(s, extra = "") {
    const p = s.paper, r = p.summary.total_return;
    return `<div class="s-row ${extra}"><div class="s-name"><b>${esc(nm(s))}</b>
      <span>${esc(s.id === "bench_spy" ? "The one to beat" : KIND[s.family] || "")}</span></div>
      <div class="s-money"><b>${usd(p.balance)}</b><span class="${cls(r)}">${pct(r)}</span></div></div>`;
  }

  // 2. How everyone is doing right now on pretend money.
  function now(a) {
    const all = a.strategies.filter((s) => s.paper && s.paper.balance != null)
      .sort((x, y) => y.paper.balance - x.paper.balance);
    const spy = all.find((s) => s.id === "bench_spy");
    const players = all.filter((s) => !s.benchmark);
    if (!players.length) return "";
    const best = players.slice(0, 3), worst = players.slice(-3).reverse();
    const start = a.verdict?.paper_start;
    return `<section class="s-card"><p class="s-label">$1,000 each${start ? " since " + date(start).replace(/, \d{4}$/, "") : ""}</p>
      ${spy ? row(spy, "s-spy") : ""}
      <p class="s-group">Doing best</p>${best.map((s) => row(s)).join("")}
      <p class="s-group">Doing worst</p>${worst.map((s) => row(s)).join("")}
      <button class="s-btn" id="showAll">Show all ${all.length}</button>
      <div id="all" hidden><p class="s-group">Everyone</p>${all.map((s) => row(s, s.id === "bench_spy" ? "s-spy" : "")).join("")}</div>
    </section>`;
  }

  // 3. The long practice run (backtest), in one glance.
  function longRun(a) {
    const spy = a.strategies.find((s) => s.id === "bench_spy");
    const players = a.strategies.filter((s) => !s.benchmark && s.backtest?.full);
    if (!spy || !players.length) return "";
    const richest = players.slice().sort((x, y) => y.backtest.full.final_equity - x.backtest.full.final_equity)[0];
    const f = richest.backtest.full, sf = spy.backtest.full;
    const year = (f.start || "2017").slice(0, 4);
    return `<section class="s-card"><p class="s-label">Practice run: $1,000 since ${year}</p>
      <div class="s-row s-spy"><div class="s-name"><b>SPY (just hold)</b><span>Worst fall: −${Math.round(sf.max_drawdown * 100)}%</span></div>
        <div class="s-money"><b>${usd(sf.final_equity)}</b></div></div>
      <div class="s-row"><div class="s-name"><b>${esc(nm(richest))}</b><span>Worst fall: <span class="s-down">−${Math.round(f.max_drawdown * 100)}%</span></span></div>
        <div class="s-money"><b>${usd(f.final_equity)}</b></div></div>
      <p class="s-small" style="margin:8px 0 0">Biggest winner, but it crashed hard along the way.</p></section>`;
  }

  // 4. Idea lab in one glance.
  function ideaCard(d) {
    if (!d) return "";
    const last = (d.ideas || [])[0];
    const passed = last && String(last.verdict || "").startsWith("candidate");
    return `<section class="s-card"><p class="s-label">New ideas tested</p>
      <div class="s-ideas"><div><b>${d.tried ?? 0}</b><span class="s-small">tried</span></div>
        <div><b class="${d.passed ? "s-up" : ""}">${d.passed ?? 0}</b><span class="s-small">passed</span></div></div>
      ${last ? `<p class="s-sub">Latest: <b>${esc(last.name)}</b> · <span class="${passed ? "s-up" : "s-down"}">${passed ? "passed" : "didn't pass"}</span></p>` : ""}
      <a class="s-btn" href="ideas.html">See ideas</a></section>`;
  }

  function links() {
    return `<nav class="s-links"><a href="details.html">More detail</a><a href="ideas.html">Idea lab</a>
      <a href="hype.html">Hype lab</a><a href="options.html">Options lab</a><a href="kalshi.html">Kalshi lab</a></nav>`;
  }
})();
