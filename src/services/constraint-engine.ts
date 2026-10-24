/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphNode,
  GraphEdge,
  ConstraintState,
  ConstraintEvaluation,
  CompatibilityReport,
} from '../types/graph.ts';

export interface EvaluationContext {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  isDatabaseAttached: boolean;
}

/**
 * Hi5 Constraint Engine
 * Evaluates mechanical fitment, interface standards, and physical constraints across 5 strict states.
 * Missing critical properties or unresolved standards NEVER produce a positive fitment verdict.
 */
export class ConstraintEngine {
  private nodes: Map<string, GraphNode>;
  private edges: GraphEdge[];
  private isDatabaseAttached: boolean;

  constructor(context: EvaluationContext) {
    this.nodes = context.nodes;
    this.edges = context.edges;
    this.isDatabaseAttached = context.isDatabaseAttached;
  }

  public setDatabaseAttached(attached: boolean) {
    this.isDatabaseAttached = attached;
  }

  public getDatabaseAttached(): boolean {
    return this.isDatabaseAttached;
  }

  /**
   * Evaluates compatibility between a subject component and a target component/interface.
   */
  public evaluateCompatibility(subjectId: string, targetId: string): CompatibilityReport {
    const subject = this.nodes.get(subjectId);
    const target = this.nodes.get(targetId);

    if (!subject || !target) {
      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'unknown_missing_evidence',
        overall_explanation: `Cannot evaluate: Node ${!subject ? subjectId : targetId} not found in knowledge graph.`,
        evaluations: [],
      };
    }

    const evaluations: ConstraintEvaluation[] = [];

    // 1. Direct Edge Constraints (incompatible_with, fits_into, compatible_with, unknown_due_to_missing_evidence)
    const directEdges = this.edges.filter(
      (e) =>
        (e.src === subjectId && e.dst === targetId) ||
        (e.src === targetId && e.dst === subjectId)
    );

    // Check for hard exclusions (incompatible_with)
    const incompEdge = directEdges.find((e) => e.type === 'incompatible_with');
    if (incompEdge) {
      // Check if there are contradictory edges (e.g. both compatible_with and incompatible_with)
      const compEdge = directEdges.find((e) => e.type === 'compatible_with' || e.type === 'fits_into');
      if (compEdge) {
        evaluations.push({
          rule_id: 'rule-contradictory-edges',
          rule_name: 'Evidence Consistency Check',
          state: 'conflicted',
          passed: false,
          reason: `Contradictory evidence: Edge ${compEdge.id} asserts fitment while Edge ${incompEdge.id} asserts explicit incompatibility.`,
          evidence_citations: [...incompEdge.evidence, ...compEdge.evidence],
        });
        return {
          subject_id: subjectId,
          target_id: targetId,
          verdict: 'conflicted',
          overall_explanation: 'Evaluation conflicted: Contradictory source evidence exists for this interface.',
          evaluations,
        };
      }

      evaluations.push({
        rule_id: incompEdge.id,
        rule_name: 'Explicit Interface Incompatibility Rule',
        state: 'incompatible',
        passed: false,
        reason: incompEdge.claim,
        evidence_citations: incompEdge.evidence,
        conditions: incompEdge.conditions,
      });

      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'incompatible',
        overall_explanation: `Incompatible: ${incompEdge.claim}`,
        evaluations,
      };
    }

    // Check for unknown due to missing evidence
    const unknownEdge = directEdges.find((e) => e.type === 'unknown_due_to_missing_evidence');
    if (unknownEdge || subject.type === 'unknown_requirement' || target.type === 'unknown_requirement') {
      const missingReason =
        unknownEdge?.claim ||
        `Unresolved requirement ${subject.type === 'unknown_requirement' ? subject.name : target.name} is missing critical evidence in kb.db.`;

      evaluations.push({
        rule_id: unknownEdge ? unknownEdge.id : 'rule-unknown-requirement',
        rule_name: 'Knowledge Base Evidence Sufficiency',
        state: 'unknown_missing_evidence',
        passed: false,
        reason: missingReason,
        evidence_citations: unknownEdge ? unknownEdge.evidence : [],
        missing_properties: [subject.type === 'unknown_requirement' ? subject.name : target.name],
        conditions: unknownEdge ? unknownEdge.conditions : ['Requires physical measurement or manual citation'],
      });

      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'unknown_missing_evidence',
        overall_explanation: `Unknown: ${missingReason}`,
        evaluations,
      };
    }

    // Check for conditional compatibility
    const condEdge = directEdges.find(
      (e) => e.type === 'conditionally_compatible_with' || (e.conditions && e.conditions.length > 0)
    );
    if (condEdge && (condEdge.type === 'conditionally_compatible_with' || condEdge.type === 'conforms_to')) {
      evaluations.push({
        rule_id: condEdge.id,
        rule_name: 'Conditional Fitment Specification',
        state: 'conditionally_compatible',
        passed: true,
        reason: condEdge.claim,
        evidence_citations: condEdge.evidence,
        conditions: condEdge.conditions,
      });

      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'conditionally_compatible',
        overall_explanation: `Conditionally compatible subject to: ${condEdge.conditions.join('; ')}`,
        evaluations,
      };
    }

    // Check for fitment (fits_into, compatible_with)
    const fitEdge = directEdges.find((e) => e.type === 'fits_into' || e.type === 'compatible_with');
    if (fitEdge) {
      if (fitEdge.status !== 'verified') {
        const isConflict = fitEdge.status === 'conflicted' || (fitEdge.conflicts && fitEdge.conflicts.length > 0);
        const unreviewedState = isConflict ? 'conflicted' : 'conditionally_compatible';
        const unreviewedReason = isConflict
          ? `Conflicted edge: ${fitEdge.claim}`
          : `edge not yet reviewed: ${fitEdge.claim}`;

        evaluations.push({
          rule_id: fitEdge.id,
          rule_name: 'Unreviewed Interface Review Check',
          state: unreviewedState,
          passed: !isConflict,
          reason: unreviewedReason,
          evidence_citations: fitEdge.evidence,
          conditions: ['Edge not yet reviewed'],
        });

        return {
          subject_id: subjectId,
          target_id: targetId,
          verdict: unreviewedState,
          overall_explanation: isConflict
            ? 'Evaluation conflicted: Edge is flagged as conflicted.'
            : `Conditionally compatible: ${unreviewedReason}`,
          evaluations,
        };
      }

      evaluations.push({
        rule_id: fitEdge.id,
        rule_name: 'Verified Physical Fitment',
        state: 'verified_compatible',
        passed: true,
        reason: fitEdge.claim,
        evidence_citations: fitEdge.evidence,
      });

      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'verified_compatible',
        overall_explanation: `Verified compatible: ${fitEdge.claim}`,
        evaluations,
      };
    }

    // Default: If no direct edge exists, evaluate properties
    const subjectProps = Object.values(subject.properties);
    const hasUnmeasuredCritical = subjectProps.some(
      (p: any) => p.is_critical && p.status === 'unknown'
    );

    if (hasUnmeasuredCritical) {
      evaluations.push({
        rule_id: 'rule-property-completeness',
        rule_name: 'Critical Property Completeness',
        state: 'unknown_missing_evidence',
        passed: false,
        reason: 'One or more critical mounting properties are unresolved in the knowledge base.',
        evidence_citations: [],
      });
      return {
        subject_id: subjectId,
        target_id: targetId,
        verdict: 'unknown_missing_evidence',
        overall_explanation: 'Fitment unknown: Critical geometric properties are unmeasured.',
        evaluations,
      };
    }

    // Unconnected components without rule
    evaluations.push({
      rule_id: 'rule-no-documented-relation',
      rule_name: 'Documented Interface Rule Check',
      state: 'unknown_missing_evidence',
      passed: false,
      reason: `No documented interface, standard conformance, or compatibility rule connects ${subject.name} and ${target.name} in kb.db.`,
      evidence_citations: [],
    });

    return {
      subject_id: subjectId,
      target_id: targetId,
      verdict: 'unknown_missing_evidence',
      overall_explanation: 'Unknown: No documented connection or rule in knowledge graph.',
      evaluations,
    };
  }
}

export type VerdictState = ConstraintState;

import { getMergedGraph } from './graph-loader.ts';

const mergedGraph = getMergedGraph();
const defaultNodeMap = new Map<string, GraphNode>();
for (const n of mergedGraph.nodes) {
  defaultNodeMap.set(n.id, n);
}
const defaultEdges = mergedGraph.edges;

/**
 * Convenience helper to evaluate compatibility between two components
 */
export function evaluateCompatibility(
  subjectId: string,
  targetId: string,
  customNodes?: GraphNode[],
  customEdges?: GraphEdge[]
): CompatibilityReport {
  let nodeMap = defaultNodeMap;
  let edges = defaultEdges;

  if (customNodes) {
    nodeMap = new Map<string, GraphNode>();
    for (const n of customNodes) {
      nodeMap.set(n.id, n);
    }
  }
  if (customEdges) {
    edges = customEdges;
  }

  const engine = new ConstraintEngine({
    nodes: nodeMap,
    edges,
    isDatabaseAttached: false,
  });

  return engine.evaluateCompatibility(subjectId, targetId);
}
