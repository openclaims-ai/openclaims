export type AgentType = "human" | "organization" | "service" | "model" | "pipeline";
export type ClaimType = "factual" | "calculation" | "inference" | "recommendation" | "prediction";
export type EventType = "claim.emitted" | "claim.verified" | "claim.disputed" | "claim.retracted";
export type SupportType =
  | "supports_directly"
  | "supports_partially"
  | "computed_from"
  | "contradicts"
  | "context_only"
  | "provenance_only";
export type VerificationResult = "supported" | "contradicted" | "inconclusive";
export type VerificationMethod = "human_review" | "model_check" | "source_attestation" | "consensus" | "formal_proof";
export type ClaimStatus = "active" | "disputed" | "retracted";

export interface Digest {
  algorithm: "sha256";
  encoding: "base64url";
  value: string;
}

export interface Agent {
  agent_id: string;
  agent_type: AgentType;
  name?: string;
  uri?: string;
  facets?: Record<string, unknown>;
}

export interface Claim {
  claim_id: string;
  text: string;
  claim_type: ClaimType;
  asserted_at: string;
  valid_at?: string;
  subject?: unknown;
  context?: unknown;
  derived_from_claims?: string[];
  relations?: ClaimRelation[];
  facets?: Record<string, unknown>;
}

export interface ClaimRelation {
  relation_type: "derived_from" | "summarizes" | "refines" | "contradicts";
  claim_ref: string;
  confidence?: number;
}

export interface Selector {
  type: "text_span" | "page_span" | "json_pointer" | "table_cell" | "uri_fragment" | "byte_range";
  start?: number;
  end?: number;
  page?: number;
  path?: string;
  row?: number;
  column?: number | string;
  fragment?: string;
}

export interface Evidence {
  evidence_id: string;
  source_ref: string;
  selector: Selector;
  support_type: SupportType;
  claim_ref?: string;
  content_digest?: Digest;
  observed_at?: string;
  facets?: Record<string, unknown>;
}

export interface Source {
  source_id: string;
  uri?: string;
  version?: string;
  observed_at?: string;
  retrieved_at?: string;
  digest?: Digest;
  license?: string;
  facets?: Record<string, unknown>;
}

export interface ToolRun {
  tool_run_id: string;
  tool_type: string;
  tool: {
    name: string;
    version?: string;
    container_digest?: Digest;
    provider?: string;
    model?: string;
    model_version?: string;
    prompt_template_id?: string;
  };
  parameters_summary?: unknown;
  parameters_digest?: Digest;
  trace_ref?: string;
  facets?: Record<string, unknown>;
}

export interface Verification {
  verification_id: string;
  verification_result: VerificationResult;
  verification_method: VerificationMethod;
  claim_status: ClaimStatus;
  validator: Agent;
  verified_at: string;
  confidence?: number;
  facets?: Record<string, unknown>;
}

export interface ClaimEvent {
  event_id: string;
  event_type: EventType;
  event_time: string;
  spec_version: "0.1.0";
  schema_url: string;
  producer: Agent;
  digest: Digest;
  claim?: Claim;
  claim_ref?: string;
  sources?: Source[];
  evidence?: Evidence[];
  contradicting_evidence?: Evidence[];
  tool_runs?: ToolRun[];
  inferences?: unknown[];
  verification?: Verification;
  dispute_rationale?: string;
  retracted_at?: string;
  retraction_reason?: string;
  original_event_ref?: string;
  auditable_trace?: unknown;
}

export function canonicalize(value: unknown): string;
export function digestValue(value: unknown): Digest;
export function eventDigest(event: ClaimEvent): Digest;
export function withEventDigest<T extends object>(event: T): T & { digest: Digest };
export function verifyEventDigest(event: ClaimEvent): boolean;
export function claimId(text: string, context?: unknown): string;
export function sourceId(uri: string, digestOrVersion?: string): string;
export function evidenceId(sourceRef: string, selector: Selector, contentDigest?: string): string;
export function toolRunId(tool: unknown): string;
export function eventId(eventLike: unknown): string;
export function createClaim(input: Partial<Claim> & { text: string; asserted_at: string }): Claim;
export function createClaimEmittedEvent(input: {
  claim: Claim;
  producer: Agent;
  sources?: Source[];
  evidence?: Evidence[];
  tool_runs?: ToolRun[];
  inferences?: unknown[];
  agents?: Agent[];
  auditable_trace?: unknown;
  event_time?: string;
}): ClaimEvent;
export function createVerificationEvent(input: { claim_ref: string; producer: Agent; verification: Verification; event_time?: string; evidence?: Evidence[]; agents?: Agent[] }): ClaimEvent;
export function createDisputeEvent(input: { claim_ref: string; producer: Agent; verification?: Verification; contradicting_evidence?: Evidence[]; dispute_rationale?: string; event_time?: string }): ClaimEvent;
export function createRetractionEvent(input: { claim_ref: string; producer: Agent; retracted_at: string; retraction_reason?: string; original_event_ref?: string; event_time?: string }): ClaimEvent;
export function validateEvent(event: unknown, options?: { verifyDigest?: boolean }): { valid: boolean; errors: Array<{ path: string; message: string }> };
export function assertValidEvent(event: ClaimEvent, options?: { verifyDigest?: boolean }): ClaimEvent;
export function validateAgainstSchema(event: unknown): { valid: boolean; errors: Array<{ path: string; message: string }> };
export function wrapCloudEvent(event: ClaimEvent): unknown;
export function embeddedResponse(payload: unknown, events: ClaimEvent[]): unknown;
