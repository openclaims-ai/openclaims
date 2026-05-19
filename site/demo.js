const sourcePolicy = {
  source_id: "src_travel_policy_2026_v3",
  title: "Acme Travel and Expense Policy",
  uri: "policy://acme/travel-expense",
  version: "2026.3",
  observed_at: "2026-05-19T15:02:11Z",
  digest: {
    algorithm: "sha256",
    value: "o7K-S3n8DMdS4gWbU6fkW9Vv1h4dAl9tKQ3QePqqG0A"
  }
};

const revisedPolicy = {
  source_id: "src_travel_policy_2026_v4",
  title: "Acme Travel and Expense Policy",
  uri: "policy://acme/travel-expense",
  version: "2026.4",
  observed_at: "2026-05-19T15:04:33Z",
  digest: {
    algorithm: "sha256",
    value: "f6UBgoa2z9dUXlp4R6O2pUiE4Lq87dl7hZCby6iw3OY"
  }
};

const toolRun = {
  tool_run_id: "toolrun_policy_index_01JWB8H62D3J1PS3MGBHEK7F3N",
  name: "policy-index-search",
  version: "0.8.2",
  provider: "openclaims-demo",
  model: "retrieval-reranker",
  model_version: "2026-05-01",
  prompt_template_id: "travel-policy-qa-v1",
  parameters_digest: {
    algorithm: "sha256",
    value: "UMfPRF5dcuPnI01DUm4DUBNz1tDpmYnLD80OSU-fF9M"
  },
  redacted_parameters_summary: {
    query: "overnight trip approval policy",
    top_k: 6,
    rerank: true
  }
};

const claims = [
  {
    id: "claim_overnight_manager_approval",
    status: "supported",
    eventType: "claim.verified",
    label: "Supported",
    claimText: "Overnight business trips require manager approval before booking.",
    verification: {
      verification_result: "supported",
      verification_method: "source_attestation",
      claim_status: "active",
      confidence: 0.96
    },
    evidence: {
      evidence_id: "ev_policy_page_7_manager_approval",
      quote: "Overnight business travel must be approved by the employee's manager before airfare, lodging, or rail is booked.",
      selector: {
        type: "page_span",
        page: 7,
        start: 1220,
        end: 1310
      },
      source: sourcePolicy,
      support_type: "supports_directly"
    },
    digest: "sha256:ttgwj92hGq53QIkf88f-pTNVV8M6jmA6N9-cEj-bEAw",
    lifecycle: [
      ["15:02:14Z", "claim.emitted", "AI answer created a material claim."],
      ["15:02:16Z", "claim.verified", "Policy evidence directly supports the claim."]
    ]
  },
  {
    id: "claim_evidence_page_7",
    status: "supported",
    eventType: "claim.verified",
    label: "Supported",
    claimText: "The supporting evidence comes from page 7 of the travel policy.",
    verification: {
      verification_result: "supported",
      verification_method: "model_check",
      claim_status: "active",
      confidence: 0.99
    },
    evidence: {
      evidence_id: "ev_policy_page_7_selector",
      quote: "Section 4.2 Overnight Travel Approval, page 7.",
      selector: {
        type: "page_span",
        page: 7,
        start: 1188,
        end: 1219
      },
      source: sourcePolicy,
      support_type: "supports_directly"
    },
    digest: "sha256:SOrpUvUA80G9RXm7X0r8jwbGk-wk3EUWwypcEYRBlis",
    lifecycle: [
      ["15:02:14Z", "claim.emitted", "Citation-location claim was extracted."],
      ["15:02:16Z", "claim.verified", "Selector confirms page 7 provenance."]
    ]
  },
  {
    id: "claim_director_not_required",
    status: "disputed",
    eventType: "claim.disputed",
    label: "Disputed",
    claimText: "Director approval is not required for overnight trips.",
    verification: {
      verification_result: "contradicted",
      verification_method: "human_review",
      claim_status: "disputed",
      confidence: 0.91
    },
    evidence: {
      evidence_id: "ev_revised_policy_director_approval",
      quote: "International overnight travel requires both manager approval and director approval before booking.",
      selector: {
        type: "page_span",
        page: 7,
        start: 1394,
        end: 1484
      },
      source: revisedPolicy,
      support_type: "contradicts"
    },
    disputeRationale: "The revised 2026.4 policy adds director approval for international overnight travel.",
    digest: "sha256:zZubG5rsZoHJ2FG5WZzpE2PxOPvC29PZvLRnlQB_Vqo",
    lifecycle: [
      ["15:02:14Z", "claim.emitted", "Answer included an approval-threshold claim."],
      ["15:02:20Z", "claim.verified", "Earlier policy version did not require director approval."],
      ["15:04:38Z", "claim.disputed", "Revised-policy evidence contradicts the prior claim."]
    ]
  }
];

const producer = {
  agent_id: "agent_openclaims_demo",
  type: "service",
  name: "OpenClaims Static Demo"
};

let selectedClaim = claims[0];
let selectedTab = "evidence";

const claimList = document.querySelector("#demo-claim-list");
const selectedStatus = document.querySelector("#demo-selected-status");
const selectedClaimTitle = document.querySelector("#demo-selected-claim");
const tabPanel = document.querySelector("#demo-tab-panel");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));

function buildEvent(claim) {
  const base = {
    event_id: `evt_${claim.id}`,
    event_type: claim.eventType,
    event_time: claim.status === "disputed" ? "2026-05-19T15:04:38Z" : "2026-05-19T15:02:16Z",
    spec_version: "0.1.0",
    schema_url: `https://openclaims.dev/schemas/openclaims/0.1/${eventSchemaName(claim.eventType)}`,
    producer,
    claim_ref: {
      claim_id: claim.id
    },
    verification: claim.verification,
    evidence: [
      {
        evidence_id: claim.evidence.evidence_id,
        support_type: claim.evidence.support_type,
        quote: claim.evidence.quote,
        selector: claim.evidence.selector,
        source: claim.evidence.source
      }
    ],
    tool_run: toolRun,
    digest: {
      algorithm: "sha256",
      value: claim.digest.replace("sha256:", "")
    },
    auditable_trace: {
      previous_event_digest: "sha256:uYYzALx1yAilqZehdT2d7iHxJMe3c8wZGgo1QqJHxsg",
      canonicalization: "RFC8785",
      digest_encoding: "base64url"
    }
  };

  if (claim.status === "disputed") {
    return {
      ...base,
      dispute_rationale: claim.disputeRationale,
      contradicting_evidence: base.evidence
    };
  }

  return base;
}

function eventSchemaName(eventType) {
  return {
    "claim.emitted": "ClaimEmittedEvent.schema.json",
    "claim.verified": "ClaimVerifiedEvent.schema.json",
    "claim.disputed": "ClaimDisputedEvent.schema.json",
    "claim.retracted": "ClaimRetractedEvent.schema.json"
  }[eventType];
}

function jsonLdForClaim(claim) {
  return {
    "@context": "https://openclaims.dev/schemas/openclaims/0.1/context.jsonld",
    "@id": claim.id,
    "@type": "prov:Entity",
    "oc:claimText": claim.claimText,
    "oc:verificationResult": claim.verification.verification_result,
    "oc:claimStatus": claim.verification.claim_status,
    "prov:wasDerivedFrom": {
      "@id": claim.evidence.evidence_id,
      "@type": "prov:Entity",
      "oc:selector": claim.evidence.selector,
      "prov:wasAttributedTo": claim.evidence.source.source_id
    },
    "prov:wasGeneratedBy": {
      "@id": toolRun.tool_run_id,
      "@type": "prov:Activity",
      "prov:used": claim.evidence.source.source_id
    }
  };
}

function renderClaimCards() {
  claimList.innerHTML = claims.map((claim, index) => `
    <button class="claim-card ${claim.id === selectedClaim.id ? "is-active" : ""}" type="button" data-claim-id="${claim.id}">
      <span class="claim-card-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="claim-card-body">
        <span class="claim-card-status ${claim.status}">${claim.label}</span>
        <span class="claim-card-text">${claim.claimText}</span>
        <span class="claim-card-meta">${claim.evidence.source.version} · ${claim.evidence.selector.type} · ${claim.evidence.support_type}</span>
      </span>
    </button>
  `).join("");

  claimList.querySelectorAll(".claim-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedClaim = claims.find((claim) => claim.id === card.dataset.claimId);
      selectedTab = "evidence";
      render();
    });
  });
}

function renderEvidence(claim) {
  const selector = claim.evidence.selector;
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
          <div><dt>Document</dt><dd>${claim.evidence.source.title}</dd></div>
          <div><dt>Version</dt><dd>${claim.evidence.source.version}</dd></div>
          <div><dt>Observed</dt><dd>${claim.evidence.source.observed_at}</dd></div>
          <div><dt>Selector</dt><dd>${selector.type} · page ${selector.page}, chars ${selector.start}-${selector.end}</dd></div>
        </dl>
      </div>
    </div>

    <blockquote class="evidence-quote">"${claim.evidence.quote}"</blockquote>

    <div class="trace-grid">
      <div class="trace-item">
        <span class="field-label">Tool Run</span>
        <code>${toolRun.name}@${toolRun.version}</code>
        <small>${toolRun.prompt_template_id} · top_k=${toolRun.redacted_parameters_summary.top_k}</small>
      </div>
      <div class="trace-item">
        <span class="field-label">Canonical Digest</span>
        <code>${claim.digest}</code>
        <small>RFC8785 canonical JSON · SHA-256 base64url</small>
      </div>
    </div>
  `;
}

function renderJson(claim) {
  return `<pre class="json-preview"><code>${escapeHtml(JSON.stringify(buildEvent(claim), null, 2))}</code></pre>`;
}

function renderLifecycle(claim) {
  return `
    <ol class="lifecycle-list">
      ${claim.lifecycle.map(([time, type, description]) => `
        <li>
          <span class="lifecycle-time">${time}</span>
          <span class="lifecycle-type">${type}</span>
          <span class="lifecycle-description">${description}</span>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderTabPanel() {
  if (selectedTab === "json") {
    tabPanel.innerHTML = renderJson(selectedClaim);
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
    const isActive = button.dataset.tab === selectedTab;
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
  selectedTab = "json";
  renderTabs();
  tabPanel.innerHTML = `<pre class="json-preview"><code>${escapeHtml(JSON.stringify(jsonLdForClaim(selectedClaim), null, 2))}</code></pre>`;
});

render();
