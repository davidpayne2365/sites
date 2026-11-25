/* Idea Lab page. Reads data/ideas.json (written by the daily run). */
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
  Idea: "A trading rule invented by the daily idea session. Its settings were fixed and saved before it was tested.",
  Tested: "The evening it was run through the checks.",
  Checks: "Each bar is one check, in order: green = passed, red = failed. Testing stops at the first failure, so later checks may be missing.",
  "Yearly return": "Average yearly gain in the 2017-2022 test period, after trading costs. Pretend money.",
  Sharpe: "Return per unit of bumpiness. Higher is better. The grey number is plain SPY for comparison; the idea has to beat it.",
  "Worst drop": "The biggest fall from a high point to a low point. The rule allows 25% at most.",
  "Real skill odds": "The luck test: how likely the result is real skill rather than the best of many lucky tries. Needs 95% or more.",
  Result: "Rejected ideas are logged forever so no-one can quietly try again until something looks lucky. A pass becomes a proposal for you to approve.",
};
const GATE = {
  no_lookahead: "No peeking at the future", luck_test: "Luck test (95%+ real-skill odds)", beats_spy: "Smoother than holding SPY",
  drawdown: "Worst drop 25% or less", enough_trades: "30+ trades", survives_costs: "Still profits with higher trading costs",
  market_conditions: "Makes money in 2 of 3 market types", holdout: "Works on 2023-today (looked at once)",
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

const checkBars = (gates) => `<span class="checks" data-tip="${esc(G.Checks + "\n\n" + gates.map((g) => `${g.ok ? "✓" : "✕"} ${GATE[g.gate] || g.gate}`).join("\n"))}">${gates.map((g) => `<i class="${g.ok ? "pass" : "fail"}"></i>`).join("")}</span>`;
const result = (i) => i.passed
  ? `<span class="badge" data-tip="${esc(G.Result)}"><span class="dot" style="background:var(--good)"></span>Passed: awaiting your approval</span>`
  : `<span class="badge" data-tip="${esc(i.verdict)}"><span class="dot" style="background:var(--critical)"></span>Rejected</span>`;
const failedAt = (i) => { const f = (i.gates || []).find((g) => !g.ok); return f ? "failed: " + (GATE[f.gate] || f.gate) : ""; };

function render(d) {
  const ideas = d.ideas || [];
  const bar = fin(d.luck_bar_sharpe) ? d.luck_bar_sharpe.toFixed(2) : "—";
  $("#app").innerHTML = `
  <section class="hero">
    <h1>A new strategy idea every day, held to a strict luck test</h1>
    <p>Every evening at 6:45 PM Central an automated session invents one new trading rule for the same ETFs as the main arena, saves its settings <i>before</i> seeing any results, and runs it through the checks below. Every idea is logged, pass or fail, and each one makes the luck test stricter for the next. <b>No real money, no real orders.</b> A passing idea becomes a proposal you approve before it joins the arena.</p>
  </section>
  <section class="tiles">
    <div class="tile"><div class="label">Ideas tested</div><div class="value num">${d.tried}</div><div class="sub">${d.last_run ? "latest " + day(d.last_run) : "first run tonight"}</div></div>
    <div class="tile"><div class="label">Passed every check</div><div class="value num ${d.passed ? "pos" : ""}">${d.passed}</div><div class="sub">expect most ideas to fail</div></div>
    <div class="tile tt" data-tip="How many strategies have ever been tried (the arena's plus every idea). The more tries, the luckier a result can look by chance, so the bar rises."><div class="label">Strategies ever tried</div><div class="value num">${d.n_trials ?? "—"}</div><div class="sub">counted in the luck test</div></div>
    <div class="tile tt" data-tip="Roughly the Sharpe the best of this many pure-luck strategies would show. A new idea has to clearly beat it."><div class="label">Luck bar (Sharpe)</div><div class="value num">${bar}</div><div class="sub">rises with every idea</div></div>
  </section>
  <section class="card"><div class="card-h"><h2>Every idea tried</h2><span class="hint">newest first · hover any heading or bar for an explanation</span></div>
  ${ideas.length ? `<div class="table-wrap"><table>
    <thead><tr>${th("Idea", 1)}${th("Tested")}${th("Checks", 1)}${th("Yearly return")}${th("Sharpe")}${th("Worst drop")}${th("Real skill odds")}${th("Result", 1)}</tr></thead>
    <tbody>${ideas.map((i) => `<tr>
      <td class="l name" style="max-width:420px"><b>${esc(i.name)}</b><span class="fam" style="white-space:normal">${esc(i.hypothesis)}</span></td>
      <td class="num">${day(i.evaluated_at)}</td>
      <td class="l">${checkBars(i.gates || [])} <span class="num ink2">${(i.gates || []).filter((g) => g.ok).length}/8</span></td>
      <td class="num ${cls(i.cagr)}">${spct(i.cagr)}</td>
      <td class="num">${fin(i.sharpe) ? i.sharpe.toFixed(2) : "—"}${fin(i.spy_sharpe) ? `<span class="muted"> vs ${i.spy_sharpe.toFixed(2)}</span>` : ""}</td>
      <td class="num">${pct(i.max_drawdown)}</td>
      <td class="num">${pct(i.deflated_sharpe)}</td>
      <td class="l">${result(i)}<div class="muted" style="font-size:11.5px;margin-top:3px;white-space:normal">${esc(failedAt(i))}</div></td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">No ideas tested yet. The first daily session runs tonight at 6:45 PM Central, and this page updates after the next market close.</div>'}
  </section>
  <section class="card"><div class="card-h"><h2>The checks, in order</h2></div><div class="card-b prose"><ol>
    ${Object.values(GATE).map((g) => `<li>${esc(g)}</li>`).join("")}
  </ol><p>Checks 2-7 use 2017-2022 only. The 2023-today period is kept hidden and looked at <b>once</b> per idea, so a rule can't be tuned to fit it. If an idea is changed in any way it counts as a brand-new try and raises the luck bar.</p>
  <p class="muted" style="font-size:12.5px">Research experiment, not investment advice. Past results, even honest ones, don't guarantee future returns.</p></div></section>`;
  $("#foot").innerHTML = `Idea Lab · paper research only · prices from Alpaca · full log in trading-lab/ideas/ledger.jsonl on the idea-lab branch`;
}

(async function load() {
  try {
    const r = await fetch("data/ideas.json?t=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    render(await r.json());
  } catch (e) {
    render({ tried: 0, passed: 0, ideas: [] });
  }
})();
