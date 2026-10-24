/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SubsystemId =
  | 'sys-drivetrain'
  | 'sys-wheels'
  | 'sys-cockpit'
  | 'sys-brakes'
  | string;

export type NodeType =
  | 'vehicle'
  | 'subsystem'
  | 'component'
  | 'subcomponent'
  | 'property'
  | 'measurement'
  | 'standard'
  | 'interface'
  | 'material'
  | 'tool'
  | 'procedure'
  | 'symptom'
  | 'failure_mode'
  | 'diagnostic_test'
  | 'compatibility_rule'
  | 'safety_constraint'
  | 'error_code'
  | 'manufacturer'
  | 'product_model'
  | 'evidence_source'
  | 'unknown_requirement';

export type RelationType =
  | 'part_of'
  | 'contains'
  | 'connects_to'
  | 'interfaces_with'
  | 'fits_into'
  | 'mounted_on'
  | 'secured_by'
  | 'retained_by'
  | 'aligned_with'
  | 'depends_on'
  | 'requires'
  | 'constrains'
  | 'affects'
  | 'controls'
  | 'transmits_force_to'
  | 'transmits_motion_to'
  | 'transmits_torque_to'
  | 'supplies_power_to'
  | 'measured_by'
  | 'has_property'
  | 'conforms_to'
  | 'compatible_with'
  | 'conditionally_compatible_with'
  | 'incompatible_with'
  | 'excludes'
  | 'requires_adapter'
  | 'causes'
  | 'may_cause'
  | 'indicates'
  | 'diagnosed_by'
  | 'repaired_by'
  | 'replaced_by'
  | 'lubricated_with'
  | 'tightened_to'
  | 'adjusted_by'
  | 'supported_by'
  | 'contradicted_by'
  | 'supersedes'
  | 'unknown_due_to_missing_evidence';

export type VerificationStatus =
  | 'candidate'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'conflicted'
  | 'superseded';

export type EvidenceGrade =
  | 'A'   // Prose manual text (before [VISUAL DATA] marker; quotable at spec level)
  | 'B+'  // Table image extraction (asserts existence only; verify against printed page)
  | 'B'   // Visual page description (after [VISUAL DATA] marker; locator only, no numbers)
  | 'D';  // Curated error code row without a chunk link (linked_to_chunk=false)

export type EvidenceType =
  | 'manufacturer_specification'
  | 'service_manual'
  | 'measured_observation'
  | 'curated_rule'
  | 'mechanical_principle'
  | 'inference';

export interface EvidenceCitation {
  chunk_id: string;
  book: string;
  page?: number | string;
  section?: string;
  quote: string;
  evidence_grade: EvidenceGrade;
  linked_to_chunk?: boolean;
  confidence?: number;
}

export interface NodeProperty {
  key: string;
  name: string;
  value: string | number | boolean;
  unit?: string;
  tolerance?: string;
  is_critical?: boolean;
  status: 'verified' | 'unmeasured' | 'unknown' | 'conflicted' | 'needs_review';
  note?: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  subsystem?: string;
  aliases: string[];
  description: string;
  properties: Record<string, NodeProperty>;
  status: VerificationStatus;
  evidence?: EvidenceCitation[];
  batch?: string;
}

export interface GraphEdge {
  id: string;
  src: string;
  dst: string;
  type: RelationType;
  claim: string;
  evidence: EvidenceCitation[];
  evidence_type: EvidenceType;
  scope?: {
    manufacturer?: string;
    model_family?: string;
    year_range?: string;
  };
  status: VerificationStatus;
  confidence: number;
  conditions: string[];
  conflicts: string[];
  batch?: string;
}

export interface GraphPayload {
  schema_version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  provenance?: {
    counts?: {
      nodes: number;
      edges: number;
      node_evidence: number;
      edge_evidence: number;
    };
    note?: string;
  };
}

export type ConstraintState =
  | 'verified_compatible'
  | 'conditionally_compatible'
  | 'incompatible'
  | 'unknown_missing_evidence'
  | 'conflicted';

export interface ConstraintEvaluation {
  rule_id: string;
  rule_name: string;
  state: ConstraintState;
  passed: boolean;
  reason: string;
  evidence_citations: EvidenceCitation[];
  conditions?: string[];
  missing_properties?: string[];
}

export interface CompatibilityReport {
  subject_id: string;
  target_id: string;
  verdict: ConstraintState;
  overall_explanation: string;
  evaluations: ConstraintEvaluation[];
}
