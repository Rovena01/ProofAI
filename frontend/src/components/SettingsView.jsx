import React, { useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  Server,
  FileCheck2,
  Scale
} from 'lucide-react';

export default function SettingsView({
  filename,
  datasetId,
  onReset,
  onBackToWorkspace
}) {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleConfirmReset = () => {
    setShowConfirmReset(false);
    if (onReset) {
      onReset();
    }
    if (onBackToWorkspace) {
      onBackToWorkspace();
    }
  };

  const supportedOps = [
    { name: 'Sum', type: 'Scalar Numeric' },
    { name: 'Average', type: 'Scalar Numeric' },
    { name: 'Count', type: 'Scalar Non-Null' },
    { name: 'Minimum', type: 'Scalar Numeric' },
    { name: 'Maximum', type: 'Scalar Numeric' },
    { name: 'Median', type: 'Scalar Numeric' },
    { name: 'Group-by Sum', type: 'Categorical Grouping' },
    { name: 'Group-by Average', type: 'Categorical Grouping' },
    { name: 'Group-by Count', type: 'Categorical Grouping' }
  ];

  const verificationInvariants = [
    { id: '1', name: 'Field Completeness', desc: 'All mandatory formal proof fields and schema keys are verified.' },
    { id: '2', name: 'Operation & Column Validation', desc: 'Validates target column and operation against dataset schema.' },
    { id: '3', name: 'Exclusion Accounting', desc: 'Mathematical identity: valid_rows + excluded = considered.' },
    { id: '4', name: 'Result Type Matching', desc: 'Asserts computed structure matches expected numeric or group contract.' },
    { id: '5', name: 'Data Quality Status Linkage', desc: 'Integrity link ensuring quality audit status is bonded to proof.' },
    { id: '6', name: 'Numeric JSON Safety', desc: 'Certifies zero NaN, Infinity, or float corruption in serialisation.' }
  ];

  return (
    <div className="settings-container">
      {/* Settings Header */}
      <div className="settings-page-header">
        <div>
          <div className="settings-page-tag">
            <Sparkles size={13} color="#38bdf8" />
            <span>SYSTEM SPECIFICATIONS & ARCHITECTURE</span>
          </div>
          <h1 className="settings-page-title">Workspace Settings</h1>
          <p className="settings-page-subtitle">
            Transparent architectural specifications, deterministic engine parameters, and verification guarantees.
          </p>
        </div>

        {onBackToWorkspace && (
          <button
            type="button"
            className="btn-back-workspace"
            onClick={onBackToWorkspace}
          >
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
            <span>Back to Workspace</span>
          </button>
        )}
      </div>

      <div className="settings-sections-stack">
        {/* 1. GENERAL */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge">
                <Cpu size={16} />
              </div>
              <div>
                <div className="settings-card-title">GENERAL</div>
                <div className="settings-card-desc">Application runtime identification and operational state</div>
              </div>
            </div>
            <div className="badge-engine-status" style={{ margin: 0 }}>
              <span className="pulse-dot"></span>
              <span>Deterministic Engine Active</span>
            </div>
          </div>

          <div className="settings-grid-rows">
            <div className="settings-row">
              <span className="settings-row-label">Application:</span>
              <strong className="settings-row-value">ProofAI</strong>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Description:</span>
              <span className="settings-row-value" style={{ color: '#cbd5e1' }}>
                Proof-carrying data analysis with deterministic planning, calculation, proof generation, and verification.
              </span>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Engine Status:</span>
              <div className="settings-row-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
                <CheckCircle2 size={14} />
                <span>🟢 Deterministic Engine Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. ANALYSIS SETTINGS */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge">
                <Scale size={16} />
              </div>
              <div>
                <div className="settings-card-title">ANALYSIS SETTINGS</div>
                <div className="settings-card-desc">Deterministic execution engine contracts and mathematical scope</div>
              </div>
            </div>
            <span className="status-badge pass" style={{ fontSize: '11px', padding: '3px 9px' }}>
              PANDAS CORE
            </span>
          </div>

          <div className="settings-grid-rows">
            <div className="settings-row">
              <span className="settings-row-label">Analysis Engine:</span>
              <strong className="settings-row-value" style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                Pandas Deterministic Engine
              </strong>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Execution Mode:</span>
              <span className="settings-row-value" style={{ color: '#ffffff', fontWeight: 600 }}>
                Deterministic
              </span>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Heuristics:</span>
              <span className="settings-row-value" style={{ color: '#f87171', fontWeight: 600 }}>
                Disabled (Zero guessing or probabilistic sampling)
              </span>
            </div>

            <div className="settings-row" style={{ alignItems: 'flex-start' }}>
              <span className="settings-row-label" style={{ paddingTop: '6px' }}>Supported Operations:</span>
              <div className="settings-ops-wrap">
                {supportedOps.map((op, idx) => (
                  <div key={idx} className="settings-op-pill">
                    <span>{op.name}</span>
                    <span className="settings-op-sub">{op.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. VERIFICATION */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="settings-card-title">VERIFICATION</div>
                <div className="settings-card-desc">Internal mathematical consistency checks and formal verification contracts</div>
              </div>
            </div>
            <span className="status-badge pass" style={{ fontSize: '11px', padding: '3px 9px' }}>
              6 INVARIANTS
            </span>
          </div>

          <div className="settings-grid-rows">
            <div className="settings-row">
              <span className="settings-row-label">Verification Mode:</span>
              <strong className="settings-row-value" style={{ color: '#34d399' }}>
                Deterministic Internal Consistency
              </strong>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Proof Version:</span>
              <span className="settings-row-value" style={{ fontFamily: 'var(--font-mono)' }}>
                1.0.0
              </span>
            </div>

            <div className="settings-row" style={{ alignItems: 'flex-start' }}>
              <span className="settings-row-label" style={{ paddingTop: '4px' }}>Verification Checks:</span>
              <div className="settings-invariants-list">
                {verificationInvariants.map((inv) => (
                  <div key={inv.id} className="settings-invariant-item">
                    <CheckCircle2 size={13} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '12px' }}>{inv.name}</strong>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{inv.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-explanation-box">
              <Info size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                ProofAI verifies mathematical proof structure, result consistency, row accounting, data-quality linkage, and numeric safety.
              </div>
            </div>

            <div className="settings-disclosure-box">
              <ShieldCheck size={14} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                Verification validates deterministic internal consistency of the mathematical proof and row accounting. It does not claim cryptographic attestation or independent source-data recomputation.
              </div>
            </div>
          </div>
        </section>

        {/* 4. DATASET SPECIFICATIONS */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge">
                <Database size={16} />
              </div>
              <div>
                <div className="settings-card-title">DATASET</div>
                <div className="settings-card-desc">Ingestion boundaries, file constraints, and active dataset metadata</div>
              </div>
            </div>
          </div>

          <div className="settings-grid-rows">
            <div className="settings-row">
              <span className="settings-row-label">Maximum Upload Size:</span>
              <strong className="settings-row-value">50 MB</strong>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Current Dataset:</span>
              <span className="settings-row-value">
                {filename ? (
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{filename} (ID: {datasetId})</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None loaded</span>
                )}
              </span>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Supported Current Format:</span>
              <strong className="settings-row-value" style={{ fontFamily: 'var(--font-mono)' }}>CSV</strong>
            </div>
          </div>
        </section>

        {/* 5. WHY PROOFAI? */}
        <section className="settings-card why-proofai-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div className="settings-card-title">WHY PROOFAI?</div>
                <div className="settings-card-desc">The verifiable trust paradigm: replacing blind trust with mathematical evidence</div>
              </div>
            </div>
            <span className="status-badge pass" style={{ fontSize: '11px', padding: '3px 9px' }}>
              ZERO HALLUCINATIONS
            </span>
          </div>

          <div className="why-proofai-body">
            {/* Visual Comparison Grid */}
            <div className="why-comparison-grid">
              {/* Traditional Analytics */}
              <div className="why-compare-card traditional">
                <div className="why-card-tag traditional-tag">Traditional Analytics</div>
                <div className="why-flow-row">
                  <span className="why-step-pill">Answer</span>
                  <ArrowRight size={13} className="why-arrow-muted" />
                  <span className="why-step-pill muted">Trust</span>
                </div>
                <p className="why-card-caption">
                  Opaque calculation, black-box execution, and reliance on unverified assumptions.
                </p>
              </div>

              {/* ProofAI */}
              <div className="why-compare-card proofai">
                <div className="why-card-tag proofai-tag">ProofAI Paradigm</div>
                <div className="why-flow-row proofai-flow">
                  <span className="why-step-pill active">Answer</span>
                  <ArrowRight size={12} className="why-arrow-active" />
                  <span className="why-step-pill active">Evidence</span>
                  <ArrowRight size={12} className="why-arrow-active" />
                  <span className="why-step-pill active">Proof</span>
                  <ArrowRight size={12} className="why-arrow-active" />
                  <span className="why-step-pill active">Verification</span>
                  <ArrowRight size={12} className="why-arrow-active" />
                  <span className="why-step-pill active code-pill">Reproducible Code</span>
                </div>
                <p className="why-card-caption">
                  Formal deterministic proof, row-level accounting invariants, and independent Python verification.
                </p>
              </div>
            </div>

            {/* Explanation */}
            <div className="why-explanation-card">
              <p className="why-explanation-lead">
                Most analytics tools give you a number and ask you to trust it.
                ProofAI provides the reasoning evidence, deterministic proof,
                verification status, and independently reproducible code behind the result.
              </p>
            </div>

            {/* Core Principle Callout */}
            <div className="why-principle-banner">
              <ShieldCheck size={16} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div className="why-principle-quote">
                  "Cannot determine reliably &gt; confident guess"
                </div>
                <div className="why-principle-desc">
                  Deterministic refusal guarantee: ProofAI refuses to hallucinate, speculate, or guess when question parameters exceed dataset constraints.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. ABOUT PROOFAI */}
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge">
                <FileCheck2 size={16} />
              </div>
              <div>
                <div className="settings-card-title">ABOUT PROOFAI</div>
                <div className="settings-card-desc">Project context and verifiable analytics methodology</div>
              </div>
            </div>
          </div>

          <div className="settings-grid-rows">
            <div className="settings-row">
              <span className="settings-row-label">Built for:</span>
              <strong className="settings-row-value">HackNex / Proof-Carrying Data Analyst</strong>
            </div>

            <div className="settings-row" style={{ alignItems: 'flex-start' }}>
              <span className="settings-row-label" style={{ paddingTop: '6px' }}>Core Pipeline:</span>
              <div className="settings-pipeline-flow">
                <span className="flow-step">UPLOAD</span>
                <span className="flow-arrow">↓</span>
                <span className="flow-step">PLAN</span>
                <span className="flow-arrow">↓</span>
                <span className="flow-step">ANALYZE</span>
                <span className="flow-arrow">↓</span>
                <span className="flow-step">PROVE</span>
                <span className="flow-arrow">↓</span>
                <span className="flow-step highlight">VERIFY</span>
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-row-label">Core Principle:</span>
              <blockquote className="settings-quote">
                "Never guess when the data cannot reliably answer the question."
              </blockquote>
            </div>
          </div>
        </section>

        {/* 6. DANGER ZONE */}
        <section className="settings-card danger-zone">
          <div className="settings-card-header">
            <div className="settings-card-title-row">
              <div className="settings-icon-badge danger">
                <AlertTriangle size={16} />
              </div>
              <div>
                <div className="settings-card-title" style={{ color: '#f87171' }}>DANGER ZONE</div>
                <div className="settings-card-desc">Reset local session state and loaded artifacts</div>
              </div>
            </div>
          </div>

          <div className="danger-zone-content">
            <div>
              <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '13px' }}>
                Reset Current Workspace
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Flushes currently loaded dataset, planned analysis queries, computed results, and verified proofs from the active session. Does not delete any files on your computer.
              </div>
            </div>

            {showConfirmReset ? (
              <div className="confirm-reset-box">
                <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 600 }}>
                  Reset session and clear all active results?
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-danger-confirm"
                    onClick={handleConfirmReset}
                  >
                    Yes, Reset Workspace
                  </button>
                  <button
                    type="button"
                    className="btn-cancel-compact"
                    onClick={() => setShowConfirmReset(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-danger-action"
                onClick={() => setShowConfirmReset(true)}
              >
                <RefreshCw size={13} />
                <span>Reset Workspace</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
