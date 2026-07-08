import { state } from "../store.js";
import { AI_MODEL } from "../config.js";
import { toast, escapeHtml, fmtMoney, fmtDate } from "../ui.js";

const KEY_STORE = "gj_openrouter_key";
const REVIEW_STORE = "gj_ai_report";
const PROGRESS_MESSAGES = [
  "Reading your trades...",
  "Detecting behavioral patterns...",
  "Analyzing risk habits...",
  "Writing your report...",
];

export function render(container) {
  const savedKey = localStorage.getItem(KEY_STORE) || "";
  const savedReview = localStorage.getItem(REVIEW_STORE) || "";
  const rangeValue = localStorage.getItem("gj_ai_range") || "last_30";
  const customFrom = localStorage.getItem("gj_ai_from") || "";
  const customTo = localStorage.getItem("gj_ai_to") || "";

  container.innerHTML = `
  <div class="page-head">
    <div><h1 class="page-title">AI Mentor</h1><p class="page-sub">Get an AI review of your trading</p></div>
  </div>

  <div class="ai-shell">
    <div class="glass card-pad ai-settings">
      <h6>Settings</h6>
      <label class="field"><span>OpenRouter API key</span>
        <div class="pw-wrap">
          <input type="password" id="ai-key" placeholder="sk-or-..." value="${savedKey}">
          <button type="button" class="pw-toggle" id="ai-key-toggle"><i data-lucide="eye"></i></button>
        </div>
      </label>
      <div class="ai-key-status" id="ai-key-status">${savedKey ? "Key saved locally" : "No key saved"}</div>
      <label class="field"><span>Model</span><input type="text" value="${AI_MODEL}" readonly></label>
      <label class="field"><span>Date range</span>
        <select id="ai-range" class="mini-select">
          <option value="last_7" ${rangeValue === "last_7" ? "selected" : ""}>Last 7 days</option>
          <option value="last_30" ${rangeValue === "last_30" ? "selected" : ""}>Last 30 days</option>
          <option value="this_month" ${rangeValue === "this_month" ? "selected" : ""}>This month</option>
          <option value="all_time" ${rangeValue === "all_time" ? "selected" : ""}>All time</option>
          <option value="custom" ${rangeValue === "custom" ? "selected" : ""}>Custom range</option>
        </select>
      </label>
      <div class="ai-custom-range ${rangeValue === "custom" ? "show" : ""}" id="ai-custom-range">
        <label class="field"><span>From</span><input type="date" id="ai-from" value="${customFrom}"></label>
        <label class="field"><span>To</span><input type="date" id="ai-to" value="${customTo}"></label>
      </div>
      <div class="btn-row">
        <button class="btn btn-gold btn-sm" id="save-key">Save Key</button>
        <button class="btn btn-ghost btn-sm" id="clear-key">Clear Key</button>
      </div>
      <p class="note"><i data-lucide="shield"></i> Your key is stored only in this browser's local storage and never sent to our servers or database.</p>
      <button class="btn btn-gold btn-block mt" id="analyze"><i data-lucide="brain"></i> Analyze Trades</button>
    </div>

    <div class="glass card-pad ai-output" id="ai-output">
      ${savedReview ? renderReview(savedReview) : emptyState()}
    </div>
  </div>`;

  window.lucide?.createIcons({ nameAttr: "data-lucide" });

  const keyInput = container.querySelector("#ai-key");
  const keyStatus = container.querySelector("#ai-key-status");
  const rangeSelect = container.querySelector("#ai-range");
  const customRange = container.querySelector("#ai-custom-range");
  const fromInput = container.querySelector("#ai-from");
  const toInput = container.querySelector("#ai-to");

  container.querySelector("#ai-key-toggle").addEventListener("click", () => {
    keyInput.type = keyInput.type === "password" ? "text" : "password";
  });
  container.querySelector("#save-key").addEventListener("click", () => {
    const v = keyInput.value.trim();
    if (!v) return toast("Enter a valid key.", "warning");
    localStorage.setItem(KEY_STORE, v);
    keyStatus.textContent = "Key saved locally";
    toast("API key saved locally.", "success");
  });
  container.querySelector("#clear-key").addEventListener("click", () => {
    localStorage.removeItem(KEY_STORE);
    keyInput.value = "";
    keyStatus.textContent = "No key saved";
    toast("API key cleared.", "info");
  });
  rangeSelect.addEventListener("change", () => {
    const showCustom = rangeSelect.value === "custom";
    customRange.classList.toggle("show", showCustom);
    localStorage.setItem("gj_ai_range", rangeSelect.value);
  });
  [fromInput, toInput].forEach((input) => {
    input.addEventListener("change", () => {
      localStorage.setItem("gj_ai_from", fromInput.value);
      localStorage.setItem("gj_ai_to", toInput.value);
    });
  });
  container.querySelector("#analyze").addEventListener("click", () => analyze(container));
}

function emptyState() {
  return `<div class="empty-state"><i data-lucide="message-square-text"></i><p>No review yet. Add your OpenRouter key and click <strong>Analyze Trades</strong>.</p></div>`;
}

function renderReview(text) {
  const parsed = parseReview(text);
  const gradeClass = (parsed.grade || "F").toUpperCase();
  return `
    <div class="ai-report-shell">
      <div class="ai-report-toolbar">
        <button class="btn btn-ghost btn-sm" id="copy-report"><i data-lucide="copy"></i> Copy Report</button>
        <button class="btn btn-gold btn-sm" id="download-pdf"><i data-lucide="file-down"></i> Download as PDF</button>
      </div>
      <div class="ai-report-card">
        <div class="ai-grade-row">
          <div class="ai-grade-badge grade-${String(gradeClass).toLowerCase()}">${escapeHtml(parsed.grade || "F")}</div>
          <div>
            <div class="ai-report-title">${escapeHtml(parsed.title || "Trading Report")}</div>
            <div class="ai-report-subtitle">${escapeHtml(parsed.verdict || "")}</div>
          </div>
        </div>
        <div class="ai-report-body">
          ${parsed.sections.map((section) => `
            <details class="ai-accordion" ${section.open ? "open" : ""}>
              <summary>${escapeHtml(section.title)}</summary>
              <div class="ai-accordion-body">${mdToHtml(section.body)}</div>
            </details>
          `).join("")}
        </div>
        ${parsed.rules.length ? `
          <div class="ai-rules">
            <h4>Homework Rules</h4>
            <div class="ai-rules-grid">
              ${parsed.rules.map((rule) => `<div class="ai-rule-card">${escapeHtml(rule)}</div>`).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </div>`;
}

function summarise(range) {
  const allTrades = state.trades || [];
  const filteredTrades = filterTrades(allTrades, range);
  const skipped = filterTrades(state.skipped || [], range);
  const wins = filteredTrades.filter((x) => String(x.result || "").toLowerCase() === "win").length;
  const losses = filteredTrades.filter((x) => String(x.result || "").toLowerCase() === "loss").length;
  const breakevens = filteredTrades.filter((x) => String(x.result || "").toLowerCase() === "breakeven" || String(x.result || "").toLowerCase() === "break-even" || String(x.result || "").toLowerCase() === "be").length;
  const decided = wins + losses;
  const pnl = filteredTrades.reduce((s, x) => s + Number(x.pnl || 0), 0);
  const riskVals = filteredTrades.map((x) => Number(x.risk_amount || x.risk || x.risk_usd || x.risk_dollar || x.risk_dollars || 0)).filter((n) => Number.isFinite(n));
  const rewardVals = filteredTrades.map((x) => Number(x.reward_amount || x.reward || x.reward_usd || x.reward_dollar || x.reward_dollars || 0)).filter((n) => Number.isFinite(n));
  const rrVals = filteredTrades.map((x) => Number(x.r_ratio || x.rr_ratio || x.rr || x.risk_reward || 0)).filter((n) => Number.isFinite(n));
  const avgRisk = riskVals.length ? (riskVals.reduce((a, b) => a + b, 0) / riskVals.length).toFixed(2) : "0.00";
  const avgReward = rewardVals.length ? (rewardVals.reduce((a, b) => a + b, 0) / rewardVals.length).toFixed(2) : "0.00";
  const avgRR = rrVals.length ? (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2) : "0.00";

  return {
    range,
    totalTrades: filteredTrades.length,
    wins,
    losses,
    breakEven: breakevens,
    winRate: decided ? ((wins / decided) * 100).toFixed(1) : 0,
    totalPnl: pnl.toFixed(2),
    averageRisk: avgRisk,
    averageReward: avgReward,
    averageRRPlanned: avgRR,
    trades: filteredTrades.map((x) => ({
      date: x.trade_date,
      session: x.session,
      level: x.level,
      timeframe: x.timeframe,
      setup_quality: x.setup_quality,
      confirmation_type: x.confirmation_type,
      market_condition: x.market_condition,
      bias_alignment: x.bias_alignment,
      sl_placement: x.sl_placement,
      tp_placement: x.tp_placement,
      patience_score: x.patience_score,
      mistake_tag: x.mistake_tag || x.mistake,
      hold_quality: x.hold_quality,
      risk_amount: x.risk_amount || x.risk || x.risk_usd || x.risk_dollar || x.risk_dollars || null,
      reward_amount: x.reward_amount || x.reward || x.reward_usd || x.reward_dollar || x.reward_dollars || null,
      rr_ratio: x.r_ratio || x.rr_ratio || x.rr || x.risk_reward || null,
      result: x.result,
      pnl: x.pnl,
      notes: x.notes || x.note || x.comment || "",
    })),
    skippedTrades: skipped.map((x) => ({
      date: x.trade_date,
      session: x.session,
      level: x.level,
      setup_quality: x.setup_quality,
      result: x.result,
      outcome: x.outcome || x.result,
      notes: x.notes || x.note || x.comment || "",
    })),
  };
}

function filterTrades(items, range) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const now = new Date();
  let from = null;
  let to = null;

  if (range?.type === "custom") {
    from = range.from ? new Date(`${range.from}T00:00:00`) : null;
    to = range.to ? new Date(`${range.to}T23:59:59`) : null;
  } else if (range?.type === "last_7") {
    from = new Date(now); from.setDate(now.getDate() - 7);
  } else if (range?.type === "last_30") {
    from = new Date(now); from.setDate(now.getDate() - 30);
  } else if (range?.type === "this_month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (range?.type === "all_time") {
    from = null; to = null;
  }

  return list.filter((item) => {
    const dateValue = item.trade_date || item.date || item.created_at || "";
    if (!dateValue) return true;
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

async function analyze(container) {
  const savedKey = localStorage.getItem(KEY_STORE) || "";
  const out = container.querySelector("#ai-output");
  const btn = container.querySelector("#analyze");
  if (!savedKey) {
    out.innerHTML = `<div class="ai-error-state"><p>No API key saved. Enter your OpenRouter key above.</p></div>`;
    return toast("No API key saved. Enter your OpenRouter key above.", "warning");
  }
  if (!state.trades.length) return toast("No trades to analyse.", "warning");

  const rangeSelect = container.querySelector("#ai-range");
  const fromInput = container.querySelector("#ai-from");
  const toInput = container.querySelector("#ai-to");
  const range = {
    type: rangeSelect.value,
    from: fromInput?.value || "",
    to: toInput?.value || "",
  };
  if (range.type === "custom" && (!range.from || !range.to)) {
    out.innerHTML = `<div class="ai-error-state"><p>Please choose both a start and end date for the custom range.</p></div>`;
    return toast("Choose both dates for the custom range.", "warning");
  }

  btn.disabled = true; btn.classList.add("loading");
  let tick = 0;
  const progressTimer = setInterval(() => {
    out.querySelector(".ai-loading p") && (out.querySelector(".ai-loading p").textContent = PROGRESS_MESSAGES[tick % PROGRESS_MESSAGES.length]);
    tick += 1;
  }, 3000);
  out.innerHTML = `<div class="ai-loading"><div class="ai-orb"></div><p>${PROGRESS_MESSAGES[0]}</p></div>`;

  const data = summarise(range);
  const systemPrompt = `You are a professional XAUUSD trading mentor and performance analyst. Your job is to give the trader an honest, direct, and sometimes uncomfortable assessment of their trading data. You are NOT a yes-man. You do NOT give empty encouragement. You do NOT say 'great job' unless the data actually supports it. If the trader is making mistakes, you name them clearly and specifically. Your tone is like a strict but fair coach who wants the trader to actually improve — not feel good.

The trader's notes may be in Roman Urdu (Urdu written in Latin script). Read and analyze them normally.

Structure every analysis report in this exact order:

---
TRADING REPORT CARD — [date range]
Overall Grade: [A / B / C / D / F]
One-line verdict: [brutally honest summary in one sentence]
---

1. CORE METRICS
- Win Rate: X% [benchmark: 50%+ is minimum acceptable]
- Profit Factor: X [below 1.5 = you are losing money long term]
- Average Win vs Average Loss: $X vs $X
- Average R:R achieved vs planned: X vs X
- If profit factor is below 1.5, say so directly and explain what it means

2. BEHAVIORAL PATTERNS DETECTED
Analyze the sequence, timing, and clustering of trades to detect:

REVENGE TRADING: Flag if the trader took a trade within 30 minutes of a loss AND that trade had higher risk than their average. State how many times this happened and the total dollar damage caused.

FOMO / CHASING: Flag if the trader entered during high-momentum sessions (New York open, news events) without their A+ or A setup. Cross-reference setup quality with session timing.

OVERTRADING: Flag any day with 3+ trades where the win rate on that day was below 40%. Name those dates specifically.

EMOTIONAL EXIT PATTERNS: Compare Hold Quality field — if "Early exit" appears frequently on winning trades, call it out: "You are cutting your winners short. This is costing you $X based on the R:R you planned vs what you actually captured."

DISCIPLINE SCORE: Give a score out of 10 for trading discipline this period. Base it on: how often setup quality was A/A+, how consistent risk sizing was, how often rules were broken. Explain the score.

3. RISK MANAGEMENT ANALYSIS
- Is the trader risking a consistent amount? Calculate standard deviation of Risk $ across trades. High variance = inconsistent, call it out.
- Are winners being cut short? Compare average planned R:R vs actual R:R achieved. If actual is lower, state: "You planned X but captured Y on average. That gap is costing you $Z per period."
- Loss holding: If any trade notes mention holding through SL or moving SL, flag it. State the dollar cost of SL violations.

4. BLIND SPOTS & PATTERNS
Run these analyses on the actual data:

WORST SESSION: Which session has the lowest win rate AND lowest profit factor? State it directly: "You should stop trading [Session] until you fix [specific issue]. Your numbers there are: X% win rate, $Y net loss."

WORST SETUP: Which setup (A, B, A+) loses the most money? If B setups are net negative, say: "Your B setups are costing you money. Take only A and A+ until your discipline improves."

WORST LEVEL: Which level (TJL2, QML, RBS etc.) has the lowest performance? Name it.

BEST CONDITIONS: What combination of session + setup + level produces the best results? Tell the trader to focus there.

5. NOTES SENTIMENT ANALYSIS
Read all trade notes (including Roman Urdu). Identify:
- Emotional words: fear (dar, dar gaya), rush (jaldi, jaldi ki), confidence (mast entry, bilkul sahi), doubt (pata nahi, dekhta hun)
- Correlate: trades where notes show fear or rush — what was the outcome?
- State finding: "On trades where your notes showed fear or hesitation, your win rate was X%. On confident trades, it was Y%. This proves [insight]."

6. ACTIONABLE HOMEWORK (3 rules only, specific and measurable)
Generate exactly 3 rules for the coming week. Each rule must:
- Reference a specific finding from above
- Be measurable (not vague like "trade better")
- Have a clear condition

Example format:
"Rule 1: Do not take any trade in [worst session] this week. Your net P&L there is -$X across Y trades. No exceptions."

"Rule 2: If you take a loss, wait minimum 45 minutes before your next entry. You have taken [N] revenge trades this period costing $X total."

"Rule 3: Only take A+ and A setups this week. Your B setups have a [X]% win rate and -$Y net P&L. They are not worth the risk."

---
End report. No motivational closing. No 'keep it up'. End with the grade and one sentence: what is the single most important thing this trader must fix right now.
---`;
  const payload = {
    dateRange: range,
    summary: data,
    trades: data.trades,
    skippedTrades: data.skippedTrades,
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${savedKey}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this trader's journal data and return the report exactly in the requested structure.\n\nDATA:\n${JSON.stringify(payload, null, 2)}` },
        ],
      }),
    });
    if (res.status === 401) throw new Error("Invalid API key.");
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}${await res.text().then((text) => (text ? `: ${text}` : ""))}`);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from model.");
    localStorage.setItem(REVIEW_STORE, text);
    out.innerHTML = renderReview(text);
    attachReportActions(out, text);
    window.lucide?.createIcons({ nameAttr: "data-lucide" });
    toast("Review generated.", "success");
  } catch (err) {
    out.innerHTML = `<div class="ai-error-state"><p>${escapeHtml(err.message || "AI request failed.")}</p></div>`;
    window.lucide?.createIcons({ nameAttr: "data-lucide" });
    toast(err.message || "AI request failed.", "error");
  } finally {
    clearInterval(progressTimer);
    btn.disabled = false; btn.classList.remove("loading");
  }
}

function attachReportActions(container, text) {
  container.querySelector("#copy-report")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Report copied to clipboard.", "success");
    } catch {
      toast("Clipboard access is unavailable.", "warning");
    }
  });
  container.querySelector("#download-pdf")?.addEventListener("click", () => {
    const printWindow = window.open("", "_blank", "width=900,height=900");
    if (!printWindow) {
      toast("Please allow popups to print the report.", "warning");
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>AI Mentor Report</title><style>body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#111;background:#fff}h1{font-size:24px;margin:0 0 8px}h2{font-size:16px;margin:16px 0 8px}p{line-height:1.5}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px}</style></head><body>${escapeHtml(text).replace(/\n/g, "<br>")}</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });
}

function parseReview(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = [];
  let currentTitle = "Report";
  let currentBody = [];
  const rules = [];
  let grade = "F";
  let verdict = "";
  let title = "Trading Report";

  const commitSection = () => {
    if (currentBody.length || currentTitle !== "Report") {
      sections.push({ title: currentTitle, body: currentBody.join("\n").trim(), open: currentTitle !== "Report" });
    }
  };

  for (const line of lines) {
    const gradeMatch = line.match(/Overall Grade:\s*([A-F])/i);
    if (gradeMatch) grade = gradeMatch[1].toUpperCase();
    const verdictMatch = line.match(/One-line verdict:\s*(.+)$/i);
    if (verdictMatch) verdict = verdictMatch[1].trim();
    const titleMatch = line.match(/^TRADING REPORT CARD — (.+)$/i);
    if (titleMatch) title = titleMatch[1].trim();
    const sectionMatch = line.match(/^\d+\.\s+(.+)$/);
    if (sectionMatch) {
      commitSection();
      currentTitle = sectionMatch[1].trim();
      currentBody = [];
      continue;
    }
    if (/^Rule\s+[1-3]:/i.test(line)) {
      rules.push(line.trim());
      continue;
    }
    currentBody.push(line);
  }
  commitSection();

  return { grade, verdict, title, sections, rules };
}

// minimal markdown -> html (headers, bold, lists)
function mdToHtml(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "", inList = false;
  for (let line of lines) {
    const boldLine = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^#{1,6}\s/.test(boldLine)) {
      if (inList) { html += "</ul>"; inList = false; }
      const level = boldLine.match(/^#+/)[0].length;
      html += `<h${Math.min(level + 2, 6)}>${boldLine.replace(/^#+\s/, "")}</h${Math.min(level + 2, 6)}>`;
    } else if (/^\s*[-*]\s/.test(boldLine)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${boldLine.replace(/^\s*[-*]\s/, "")}</li>`;
    } else if (boldLine.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${boldLine}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}
