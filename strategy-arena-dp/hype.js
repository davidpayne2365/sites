/* Hype Lab page. Reads data/hype.json (written by the daily run). */
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
  Strategy: "A fixed rule for which hyped stocks to buy (or bet against). Each trades its own pretend $1,000.",
  Balance: "What the pretend $1,000 is worth now.",
  Return: "Gain or loss since the start.",
  Bets: "Finished positions: bought (or shorted) at an open and closed 5 trading days later.",
  "Won": "Share of finished positions that made money.",
  "Avg bet": "Average return per finished position, after costs.",
  "Holding": "What it holds right now.",
  "Calls": "How many of that group's calls have finished their 5-day test.",
  "Beat SPY": "Share of calls that did better than simply holding SPY over the same 5 days.",
  "Avg vs SPY": "Average return of the calls minus SPY's return over the same days. Above 0 means the calls added value.",
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
  const sig = d.latest_signal;
  const calls = d.calls || { sources: [], recent: [], calls: 0, pending: 0 };
  $("#app").innerHTML = `
  <section class="hero">
    <h1>Does following the crowd work, or betting against it?</h1>
    <p>Every evening this counts how often each stock is mentioned across Reddit's stock communities (via ApeWisdom). Four rules, fixed in advance, then trade pretend money: buy the stocks whose mentions are spiking, bet against them, buy the most-talked-about, or just hold SPY on the same schedule. Each position is held 5 trading days. <b>No real money, no real orders.</b></p>
  </section>
  <div class="notice"><span>⚠️</span><div><b>Why this matters.</b> In pump-and-dump groups, the people who buy on the alert are usually the ones left holding the bag. Studies have often found heavily hyped stocks do worse afterwards. Only liquid US stocks are used here (price $${c.min_price}+, $${(c.min_dollar_volume / 1e6).toFixed(0)}M+ traded per day). Penny-stock pumps are excluded on purpose.</div></div>
  <section class="tiles">
    <div class="tile"><div class="label">Rules competing</div><div class="value num">${d.strategies.length}</div><div class="sub">$1,000 pretend money each</div></div>
    <div class="tile"><div class="label">Latest hype spike</div><div class="value" style="font-size:17px">${sig && sig.spike.length ? esc(sig.spike.join(", ")) : "none"}</div><div class="sub">mentions at least ${c.spike_ratio}× in 24h</div></div>
    <div class="tile"><div class="label">Most talked about</div><div class="value" style="font-size:17px">${sig ? esc(sig.top.slice(0, 3).join(", ")) : "—"}</div><div class="sub">${sig ? "as of " + day(sig.date) : "no data yet"}</div></div>
    <div class="tile"><div class="label">Days of data</div><div class="value num">${d.signals}</div><div class="sub">started ${day(d.started)}</div></div>
    <div class="tile"><div class="label">Group calls scored</div><div class="value num">${(calls.sources || []).reduce((a, x) => a + x.calls, 0)}</div><div class="sub">${calls.pending || 0} waiting for 5 days to pass</div></div>
  </section>
  <section class="card"><div class="card-h"><h2>The four rules</h2><span class="hint">hover any heading for an explanation</span></div>
  <div class="table-wrap"><table>
    <thead><tr>${th("Strategy", 1)}${th("Balance")}${th("Return")}${th("Bets")}${th("Won")}${th("Avg bet")}${th("Holding", 1)}<th>Balance over time</th></tr></thead>
    <tbody>${d.strategies.map((r) => `<tr class="${r.id === "hype_spy_control" ? "bench" : ""}">
      <td class="l name"><b>${esc(r.name)}</b><span class="fam" style="white-space:normal">${esc(r.description)}</span></td>
      <td class="num">${usd(r.balance)}</td><td class="num ${cls(r.return)}">${spct(r.return)}</td>
      <td class="num">${r.trades}</td><td class="num">${pct(r.win_rate)}</td><td class="num ${cls(r.avg_return)}">${spct(r.avg_return)}</td>
      <td class="l" style="white-space:normal;min-width:140px">${r.open.length ? esc([...new Set(r.open.map((p) => p.symbol))].join(", ")) : (d.pending && d.pending[r.id] ? `<span class="muted">${r.side === "short" ? "betting against" : "buying"} ${esc(d.pending[r.id].symbols.join(", "))} at the next open</span>` : '<span class="muted">cash</span>')}</td>
      <td class="l">${spark(r.curve)}</td></tr>`).join("")}</tbody></table></div></section>

  <div class="grid2">
    <section class="card"><div class="card-h"><h2>Today's mention counts</h2><span class="hint">top of the Reddit stock communities</span></div><div class="table-wrap">
      ${sig ? `<table class="mini"><thead><tr><th class="l">Ticker</th><th>Mentions</th><th>24h ago</th><th>Change</th></tr></thead><tbody>${sig.top_mentions.map((m) => `<tr><td class="l"><b>${esc(m.ticker)}</b></td><td class="num">${m.mentions}</td><td class="num">${m.mentions_24h_ago ?? "—"}</td><td class="num">${m.mentions_24h_ago ? "×" + (m.mentions / m.mentions_24h_ago).toFixed(1) : "—"}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">No mention data yet. The first live run happens after the next market close.</div>'}
    </div></section>
    <section class="card"><div class="card-h"><h2>Score a group's calls</h2><span class="hint">Discord, Reddit, newsletters…</span></div><div class="card-b">
      ${calls.sources.length ? `<div class="table-wrap"><table class="mini"><thead><tr><th class="l">Group</th>${th("Calls")}${th("Won")}${th("Beat SPY")}${th("Avg vs SPY")}</tr></thead><tbody>${calls.sources.map((s) => `<tr><td class="l"><b>${esc(s.source)}</b></td><td class="num">${s.calls}</td><td class="num">${pct(s.win_rate)}</td><td class="num">${pct(s.beat_spy)}</td><td class="num ${cls(s.avg_excess)}">${spct(s.avg_excess)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted" style="margin-top:0">No calls added yet.</p>'}
      <p class="prose" style="font-size:13px">Add a line to <code>trading-lab/calls/calls.csv</code> in the GitHub repo for each call you see: <code>date,ticker,direction,source,note</code>, e.g. <code>2026-11-13,NBIS,long,my-discord,"loading up"</code>. Each call is tested from the next market open for 5 trading days and compared with SPY. After 20-30 calls you'll know whether that group adds anything.</p>
    </div></section>
  </div>

  <section class="card"><div class="card-h"><h2>How the test is run</h2></div><div class="card-b prose"><ul>
    <li><b>No hindsight.</b> Mention counts are read right after the close and the baskets are bought at the <i>next</i> morning's open. A late run logs the day as missed instead of trading it after the fact.</li>
    <li><b>Costs.</b> Each trade pays ${c.slippage_bps / 100}% slippage each way. The short rule pays an assumed ${pct(c.borrow_fee_annual)} a year to borrow shares, and hyped stocks can cost far more. Shorting for real needs a margin account.</li>
    <li><b>Money split into ${c.tranches} batches,</b> so each day's basket uses about a fifth of the money and the 5-day holds overlap smoothly.</li>
    <li><b>Limits.</b> Mention data comes from one free third-party source (ApeWisdom) and has no history, so this test starts now and builds its own. Ticker mentions can be ambiguous (e.g. "HR", "AI"). Results over a few weeks mean little.</li>
  </ul><p class="muted" style="font-size:12.5px">Research experiment, not investment advice. Only paste group calls you're allowed to share. This repository may be public.</p></div></section>`;
  $("#foot").innerHTML = `Hype Lab · paper trading only · mention data from ApeWisdom, prices from Alpaca`;
}

(async function load() {
  try {
    const r = await fetch("data/hype.json?t=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    render(await r.json());
  } catch (e) {
    $("#app").innerHTML = `<section class="hero"><h1>Hype Lab is warming up</h1><p>The first daily run after the market close will publish this page.</p></section>`;
  }
})();
