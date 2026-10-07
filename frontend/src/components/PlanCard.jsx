import React from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Ban,
  Play,
  Loader2,
  Cpu
} from 'lucide-react';

export default function PlanCard({
  plan,
  onSelectCandidate,
  onRunAnalysis,
  isAnalyzing = false,
  hasExecuted = false
}) {
  if (!plan) return null;

  const {
    question,
    operation,
    column,
    group_by,
    status,
    clarification_required,
    clarification_message,
    candidate_columns = []
  } = plan;

  // Case 1: Clarification Required / Refusal State
  if (clarification_required || status === 'unsupported') {
    const missingColMatch = clarification_message?.match(/(?:Group-by )?[Cc]olumn '([^']+)' does not exist/i);
    const nonNumericMatch = clarification_message?.match(/requires a numeric column, but column '([^']+)' is non-numeric/i);
    const ambiguousMatch = clarification_message?.match(/Ambiguous request: multiple/i);
    const noNumericMatch = clarification_message?.match(/Dataset contains no numeric columns/i);
    const predictMatch = clarification_message?.match(/Prediction and forecasting/i);

    let mainMessage = clarification_message || 'The question cannot be mapped to a deterministic calculation.';
    let detailNote = null;

    if (missingColMatch) {
      const colName = missingColMatch[1].replace(/^(?:total|sum(?:\s+of)?|average(?:\s+of)?|mean(?:\s+of)?|count(?:\s+of)?|min(?:\s+of)?|max(?:\s+of)?)\s+/i, '');
      mainMessage = `\`${colName}\` is not present in this dataset.`;
      if (clarification_message?.includes('Available columns are:')) {
        detailNote = clarification_message.slice(clarification_message.indexOf('Available columns are:'));
      } else if (clarification_message?.includes('Available categorical columns are:')) {
        detailNote = clarification_message.slice(clarification_message.indexOf('Available categorical columns are:'));
      }
    } else if (nonNumericMatch) {
      mainMessage = `Column \`${nonNumericMatch[1]}\` is non-numeric and cannot be aggregated mathematically.`;
      if (clarification_message?.includes('Available numeric columns:')) {
        detailNote = clarification_message.slice(clarification_message.indexOf('Available numeric columns:'));
      }
    } else if (ambiguousMatch) {
      mainMessage = 'Multiple matching columns found for this calculation. Selection required.';
      detailNote = clarification_message;
    } else if (noNumericMatch) {
      mainMessage = 'No numeric columns are available in this dataset for this calculation.';
      detailNote = clarification_message;
    } else if (predictMatch) {
      mainMessage = 'Forecasting and prediction queries are outside deterministic scope.';
      detailNote = clarification_message;
    }

    return (
      <section className="panel-card refusal-card-wrapper">
        <div className="refusal-card-inner">
          {/* Refusal Header */}
          <div className="refusal-title-row">
            <div className="panel-icon-circle refusal-icon">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="refusal-heading-title">
                Cannot determine reliably
              </div>
              <div className="refusal-heading-subtitle">
                ProofAI refused to generate an answer rather than guessing.
              </div>
            </div>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Question: <strong style={{ color: '#ffffff' }}>"{question}"</strong>
          </div>

          {/* Main Refusal Message Box */}
          <div className="refusal-message-box">
            <div className="refusal-main-text">
              {mainMessage}
            </div>
            {detailNote && (
              <div className="refusal-detail-subtext">
                {detailNote}
              </div>
            )}
            {!detailNote && clarification_message && clarification_message !== mainMessage && (
              <div className="refusal-detail-subtext">
                {clarification_message}
              </div>
            )}
          </div>

          {/* Trust-Oriented Explanation */}
          <div className="refusal-trust-explanation">
            <ShieldCheck size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              No analysis or proof was generated because the available data does not support this question.
            </span>
          </div>

          {/* Disambiguation candidate column chips (if available) */}
          {candidate_columns && candidate_columns.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '8px' }}>
                Select an available column to continue:
              </div>
              <div className="candidate-chips-list">
                {candidate_columns.map((cand, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="candidate-chip-action"
                    onClick={() => onSelectCandidate && onSelectCandidate(cand)}
                  >
                    <span>{cand}</span>
                    <ArrowRight size={12} style={{ display: 'inline', marginLeft: '4px' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Refusal Guarantee Badge */}
          <div className="refusal-guarantee-footer">
            <AlertTriangle size={12} color="#fbbf24" style={{ flexShrink: 0 }} />
            <span>
              Deterministic Policy: ProofAI guarantees zero hallucination by refusing ungrounded queries.
            </span>
          </div>
        </div>
      </section>
    );
  }

  // Case 3: Ready Analysis Plan (Clean Human-Readable Blueprint)
  return (
    <section className="panel-card plan-blueprint-card">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '16px' }}>
              Validated Analysis Blueprint
            </div>
            <div className="panel-subtitle">
              Schema-validated mathematical plan ready for execution
            </div>
          </div>
        </div>

        <span className="status-badge pass" style={{ fontSize: '11px', padding: '4px 10px' }}>
          <CheckCircle2 size={12} />
          Plan Validated
        </span>
      </div>

      <div className="plan-content-body">
        {/* Interpreted Question Header */}
        <div className="interpreted-question-box">
          <span className="interpreted-label">Interpreted Question</span>
          <div className="interpreted-text">"{question}"</div>
        </div>

        {/* Structured 4-Block Key-Value Blueprint */}
        <div className="plan-attributes-grid">
          <div className="plan-attribute-box">
            <span className="plan-attr-label">Operation</span>
            <span className="plan-attr-value highlight-op">
              {(operation || 'N/A').toUpperCase().replace(/_/g, ' ')}
            </span>
          </div>

          <div className="plan-attribute-box">
            <span className="plan-attr-label">Target Column</span>
            <span className="plan-attr-value">
              {column || '—'}
            </span>
          </div>

          <div className="plan-attribute-box">
            <span className="plan-attr-label">Grouping Clause</span>
            <span className="plan-attr-value">
              {group_by ? `by ${group_by}` : 'Scalar (All Rows)'}
            </span>
          </div>

          <div className="plan-attribute-box">
            <span className="plan-attr-label">Execution Guardrail</span>
            <span className="plan-attr-value" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} />
              Deterministic
            </span>
          </div>
        </div>

        {/* Action Execution Bar */}
        <div className="plan-action-bar">
          <div className="plan-action-text">
            <Cpu size={14} color="#38bdf8" />
            <span>
              {hasExecuted
                ? 'Plan executed. You can re-run to verify fresh calculation & evidence.'
                : 'Click below to execute Pandas aggregation and generate verifiable proof.'}
            </span>
          </div>

          <button
            type="button"
            className="btn-execute-analysis"
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="spinner-icon" />
                <span>Computing & Verifying Proof...</span>
              </>
            ) : (
              <>
                <Play size={15} fill="currentColor" />
                <span>{hasExecuted ? 'Re-run Analysis & Verification' : 'Run Analysis & Prove'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
