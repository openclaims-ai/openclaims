let demoData;
let selectedClaim;
let selectedTab = "evidence";

const claimList = document.querySelector("#demo-claim-list");
const selectedStatus = document.querySelector("#demo-selected-status");
const selectedClaimTitle = document.querySelector("#demo-selected-claim");
const tabPanel = document.querySelector("#demo-tab-panel");
const questionText = document.querySelector(".question-text");
const answerBlock = document.querySelector(".answer-block p");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));

init();

async function init() {
  try {
    const response = await fetch("./assets/verified-analysis-demo.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Demo fixture returned ${response.status}`);
    demoData = await response.json();
    selectedClaim = demoData.claims[0];
    questionText.textContent = demoData.question;
    answerBlock.textContent = demoData.answer;
    bindControls();
    render();
  } catch (error) {
    claimList.innerHTML = `<p class="demo-error">Demo fixture could not load.</p>`;
    selectedClaimTitle.textContent = "OpenClaims fixture unavailable";
    tabPanel.textContent = error.message;
  }
}

function bindControls() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedTab = button.dataset.tab;
      render();
    });
  });

  document.querySelector("#demo-show-evidence").addEventListener("click", () => {
    selectedTab = "evidence";
    render();
  });

  document.querySelector("#demo-view-json").addEventListener("click", () => {
    selectedTab = "json";
    render();
  });

  document.querySelector("#demo-export-jsonld").addEventListener("click", () => {
    selectedTab = "jsonld";
    renderTabs();
    renderTabPanel();
  });
}

function renderClaimCards() {
  claimList.innerHTML = demoData.claims.map((claim, index) => `
    <button class="claim-card ${claim.id === selectedClaim.id ? "is-active" : ""}" type="button" data-claim-id="${claim.id}">
      <span class="claim-card-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="claim-card-body">
        <span class="claim-card-status ${claim.status}">${claim.label}</span>
        <span class="claim-card-text">${claim.claimText}</span>
        <span class="claim-card-meta">${claim.source.version} · ${claim.evidence.selector.type} · ${claim.evidence.support_type}</span>
      </span>
    </button>
  `).join("");

  claimList.querySelectorAll(".claim-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedClaim = demoData.claims.find((claim) => claim.id === card.dataset.claimId);
      selectedTab = "evidence";
      render();
    });
  });
}

function renderEvidence(claim) {
  const selector = claim.evidence.selector;
  const quote = claim.evidence.facets?.quote?.text ?? "Quote unavailable";
  const title = claim.source.facets?.document?.title ?? claim.source.uri;
  const latestEvent = claim.events.at(-1);
  const digest = latestEvent.digest;
  const tool = claim.toolRun.tool;

  return `
    <div class="evidence-grid">
      <div>
        <span class="field-label">Verification</span>
        <dl class="field-list">
          <div><dt>Result</dt><dd>${claim.verification.verification_result}</dd></div>
          <div><dt>Method</dt><dd>${claim.verification.verification_method}</dd></div>
          <div><dt>Status</dt><dd>${claim.verification.claim_status}</dd></div>
          <div><dt>Confidence</dt><dd>${Math.round(claim.verification.confidence * 100)}%</dd></div>
        </dl>
      </div>
      <div>
        <span class="field-label">Source</span>
        <dl class="field-list">
          <div><dt>Document</dt><dd>${title}</dd></div>
          <div><dt>Version</dt><dd>${claim.source.version}</dd></div>
          <div><dt>Observed</dt><dd>${claim.source.observed_at}</dd></div>
          <div><dt>Selector</dt><dd>${selector.type} · page ${selector.page}, chars ${selector.start}-${selector.end}</dd></div>
        </dl>
      </div>
    </div>

    <blockquote class="evidence-quote">"${quote}"</blockquote>

    <div class="trace-grid">
      <div class="trace-item">
        <span class="field-label">Tool Run</span>
        <code>${tool.name}@${tool.version}</code>
        <small>${tool.prompt_template_id} · top_k=${claim.toolRun.parameters_summary.top_k} · ${claim.toolRun.parameters_summary.network}</small>
      </div>
      <div class="trace-item">
        <span class="field-label">Canonical Digest</span>
        <code>${digest.algorithm}:${digest.value}</code>
        <small>RFC8785 canonical JSON · SHA-256 base64url</small>
      </div>
    </div>
  `;
}

function renderJson(claim) {
  return `<pre class="json-preview"><code>${escapeHtml(JSON.stringify(claim.events.at(-1), null, 2))}</code></pre>`;
}

function renderJsonLd(claim) {
  const claimGraph = {
    "@context": demoData.jsonld["@context"],
    "@graph": demoData.jsonld["@graph"].filter((node) => JSON.stringify(node).includes(claim.id))
  };
  return `<pre class="json-preview"><code>${escapeHtml(JSON.stringify(claimGraph, null, 2))}</code></pre>`;
}

function renderLifecycle(claim) {
  return `
    <ol class="lifecycle-list">
      ${claim.events.map((event) => `
        <li>
          <span class="lifecycle-time">${new Date(event.event_time).toISOString().slice(11, 19)}Z</span>
          <span class="lifecycle-type">${event.event_type}</span>
          <span class="lifecycle-description">${lifecycleDescription(event)}</span>
        </li>
      `).join("")}
    </ol>
  `;
}

function lifecycleDescription(event) {
  if (event.event_type === "claim.emitted") return "Material claim emitted from the deterministic answer.";
  if (event.event_type === "claim.verified") return "Evidence selector and source digest support the claim.";
  if (event.event_type === "claim.disputed") return event.dispute_rationale;
  return "OpenClaims lifecycle event recorded.";
}

function renderTabPanel() {
  if (selectedTab === "json") {
    tabPanel.innerHTML = renderJson(selectedClaim);
    return;
  }

  if (selectedTab === "jsonld") {
    tabPanel.innerHTML = renderJsonLd(selectedClaim);
    return;
  }

  if (selectedTab === "lifecycle") {
    tabPanel.innerHTML = renderLifecycle(selectedClaim);
    return;
  }

  tabPanel.innerHTML = renderEvidence(selectedClaim);
}

function renderTabs() {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === selectedTab || (selectedTab === "jsonld" && button.dataset.tab === "json");
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function render() {
  selectedStatus.textContent = selectedClaim.label.toUpperCase();
  selectedStatus.className = `status-chip ${selectedClaim.status}`;
  selectedClaimTitle.textContent = selectedClaim.claimText;
  renderClaimCards();
  renderTabs();
  renderTabPanel();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
