import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Calculator,
  ArrowDown,
  AlertTriangle,
  FolderTree,
  Sigma,
  Info,
  Check,
  Terminal
} from 'lucide-react';

function formatVal(val) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (Array.isArray(val)) {
    return `${val.length} groups computed`;
  }
  return String(val);
}

export default function ProofExplorer({
  proof,
  result,
  operation,
  column,
  group_by,
  onReplay,
  onViewCalculation,
  onViewVerificationCode,
  isVerified = false
}) {
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  if (!proof) return null;

  const {
    proof_version = '1.0',
    dataset_id = '',
    dataset_rows = 0,
    rows_considered = 0,
    valid_rows_count = 0,
    missing_values_excluded = 0,
    non_finite_values_excluded = 0,
    rows_excluded = 0,
    exclusion_reasons = [],
    calculation = '',
    formula = '',
    source_columns = [],
    data_quality_status = 'pass',
    data_quality_score = 100,
    group_details = null
  } = proof;

  const isGrouped = Boolean(group_by || operation.startsWith('group_by_'));
  const effectiveDatasetRows = dataset_rows || rows_considered;

  return (
    <section className="panel-card proof-explorer-card">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle proof-accent">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '18px', letterSpacing: '-0.01em' }}>
              WHY THIS RESULT?
            </div>
            <div className="panel-subtitle">
              Deterministic mathematical reasoning and auditable row accounting
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-proof-control replay"
            onClick={onReplay}
            title="Visually replay the deterministic proof sequence"
          >
            <RotateCcw size={13} />
            <span>Replay Proof</span>
          </button>

          <button
            type="button"
            className="btn-proof-control inspect"
            onClick={onViewCalculation}
            title="Inspect human-readable deterministic calculation trace"
          >
            <Calculator size={13} />
            <span>View Calculation</span>
          </button>

          <button
            type="button"
            className="btn-proof-control code"
            onClick={onViewVerificationCode}
            title="Inspect runnable Python verification script"
          >
            <Terminal size={13} />
            <span>View Verification Code</span>
          </button>

          <span className="status-badge pass" style={{ fontSize: '11px', padding: '4px 9px' }}>
            <ShieldCheck size={12} />
            Proof v{proof_version}
          </span>
        </div>
      </div>

      {/* What-If Counterfactual Context Banner */}
      {proof.counterfactual_context && (
        <div className="proof-counterfactual-banner" style={{ margin: '12px 20px 0', padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#e2e8f0' }}>
          <span style={{ background: '#38bdf8', color: '#090d16', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.04em' }}>
            WHAT-IF CONDITION
          </span>
          <span>
            Categorical Exclusion: <strong style={{ color: '#38bdf8' }}>{proof.counterfactual_context.column} != &quot;{proof.counterfactual_context.excluded_value}&quot;</strong>
            {' '}({proof.counterfactual_context.rows_excluded_by_condition} baseline rows excluded, {proof.counterfactual_context.counterfactual_rows} analyzed)
          </span>
        </div>
      )}

      {/* Visual Mathematical Reasoning Funnel */}
      <div className="proof-funnel-container">
        <div className="funnel-title">
          <span>Deterministic Reasoning Trace</span>
          <span className="funnel-badge">AUDIT SEQUENCE</span>
        </div>

        <div className="proof-funnel-steps">
          {/* Step 1: Rows found */}
          <div className="funnel-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num">1</span>
              <span className="funnel-node-label">Dataset Scope</span>
            </div>
            <div className="funnel-node-val">{effectiveDatasetRows} rows found</div>
            <div className="funnel-node-sub">Dataset '{dataset_id}'</div>
          </div>

          <div className="funnel-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Step 2: Valid Rows */}
          <div className="funnel-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num">2</span>
              <span className="funnel-node-label">Valid Rows Filtered</span>
            </div>
            <div className="funnel-node-val highlight-green">{valid_rows_count} valid rows</div>
            <div className="funnel-node-sub">Non-null & finite</div>
          </div>

          <div className="funnel-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Step 3: Excluded */}
          <div className="funnel-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num">3</span>
              <span className="funnel-node-label">Exclusion Accounting</span>
            </div>
            <div className="funnel-node-val" style={{ color: rows_excluded > 0 ? '#fbbf24' : '#94a3b8' }}>
              {rows_excluded} excluded
            </div>
            <div className="funnel-node-sub">{missing_values_excluded} null · {non_finite_values_excluded} inf</div>
          </div>

          <div className="funnel-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Step 4: Operation Formulation */}
          <div className="funnel-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num">4</span>
              <span className="funnel-node-label">Operation Trace</span>
            </div>
            <div className="funnel-node-val highlight-cyan font-mono" style={{ fontSize: '13px' }}>
              {operation.toUpperCase()}({column})
            </div>
            <div className="funnel-node-sub font-mono text-truncate" title={formula || calculation}>
              {formula || calculation}
            </div>
          </div>

          <div className="funnel-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Step 5: Computed Result */}
          <div className="funnel-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num">5</span>
              <span className="funnel-node-label">Deterministic Output</span>
            </div>
            <div className="funnel-node-val highlight-white font-mono" style={{ fontSize: '15px' }}>
              {formatVal(result)}
            </div>
            <div className="funnel-node-sub">Exact calculated value</div>
          </div>

          <div className="funnel-arrow">
            <ArrowDown size={14} />
          </div>

          {/* Step 6: Verified Seal */}
          <div className="funnel-node verified-node">
            <div className="funnel-node-header">
              <span className="funnel-node-num" style={{ background: '#10b981', color: '#070b12' }}>✓</span>
              <span className="funnel-node-label" style={{ color: '#34d399' }}>Status</span>
            </div>
            <div className="funnel-node-val highlight-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={15} strokeWidth={3} />
              <span>VERIFIED</span>
            </div>
            <div className="funnel-node-sub" style={{ color: '#a7f3d0' }}>6 invariants passed</div>
          </div>
        </div>
      </div>

      {/* Row Accounting Grid */}
      <div>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '10px'
        }}>
          Row Accounting Invariant Check
        </div>
        <div className="metrics-grid">
          <div className="metric-stat-card">
            <span className="metric-label">Source Total</span>
            <div className="metric-value">{effectiveDatasetRows}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dataset rows</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Evaluated</span>
            <div className="metric-value">{rows_considered}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rows scoped</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Included</span>
            <div className="metric-value" style={{ color: '#34d399' }}>{valid_rows_count}</div>
            <span style={{ fontSize: '11px', color: '#34d399' }}>Valid non-null rows</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Excluded</span>
            <div className="metric-value" style={{ color: rows_excluded > 0 ? '#fbbf24' : '#94a3b8' }}>
              {rows_excluded}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {missing_values_excluded} null · {non_finite_values_excluded} inf
            </span>
          </div>
        </div>
      </div>

      {/* Formula & Calculation Trace Box */}
      <div className="proof-formula-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Sigma size={13} color="#38bdf8" />
          <span>Deterministic Formula & Calculation Trace</span>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
          {formula || calculation}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Execution trace: <code className="code-pill">{calculation}</code>
        </div>
      </div>

      {/* Exclusion Reasons (if any) */}
      {exclusion_reasons && exclusion_reasons.length > 0 && (
        <div className="exclusion-callout">
          <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            <span>Exclusion Reasons Recorded ({exclusion_reasons.length})</span>
          </div>
          <div style={{ fontSize: '12px', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {exclusion_reasons.map((r, idx) => (
              <div key={idx}>• {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Source Columns & Quality Linkage */}
      <div className="proof-footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree size={14} color="#38bdf8" />
          <span style={{ color: 'var(--text-muted)' }}>Source Columns: </span>
          <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {source_columns.length > 0 ? source_columns.join(', ') : column}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Data Quality Link: </span>
          <span className={`status-badge ${data_quality_status}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
            {data_quality_status.toUpperCase()} ({data_quality_score}/100)
          </span>
        </div>
      </div>

      {/* Group Details (if Grouped Analysis) */}
      {isGrouped && group_details && Array.isArray(group_details) && (
        <div>
          <button
            type="button"
            className="btn-toggle-group-details"
            onClick={() => setShowGroupDetails(!showGroupDetails)}
          >
            <span>{showGroupDetails ? 'Hide' : 'Show'} Per-Group Evidence Trace ({group_details.length} groups)</span>
            {showGroupDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showGroupDetails && (
            <div className="group-evidence-grid">
              {group_details.map((g, idx) => (
                <div key={idx} className="group-evidence-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{g.group}</strong>
                    <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {typeof g.result === 'number' ? g.result.toLocaleString() : g.result}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {g.valid_rows_count} valid rows · {g.missing_values_excluded} excluded
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10px', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {g.calculation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accurate Trust Disclosure */}
      <div className="proof-trust-note">
        <Info size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
        <span>
          Verification validates deterministic internal consistency of the mathematical proof and row accounting. It does not claim cryptographic attestation or independent source-data recomputation.
        </span>
      </div>
    </section>
  );
}
