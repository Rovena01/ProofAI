import React, { useState } from 'react';
import {
  Calculator,
  X,
  Sigma,
  CheckCircle2,
  Layers,
  Hash,
  Code,
  Copy,
  Check,
  Terminal
} from 'lucide-react';

function formatNumber(val) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(val);
}

function generateVerificationCode({ filename, operation, column, group_by, proof }) {
  const targetCol = column || proof?.target_column || 'revenue';
  const groupCol = group_by || proof?.group_by_column || '';
  const op = (operation || proof?.operation || 'sum').toLowerCase();
  const cleanOp = op.replace('group_by_', '');
  const isGrouped = Boolean(groupCol || op.startsWith('group_by_'));
  const cfCtx = proof?.counterfactual_context;

  let file = filename;
  if (!file) {
    const dsId = proof?.dataset_id || 'sales';
    file = dsId.endsWith('.csv') ? dsId : `${dsId}.csv`;
  }

  // Format What-If exclusion line if present
  let whatIfSnippet = '';
  if (cfCtx && cfCtx.column && cfCtx.excluded_value !== undefined) {
    whatIfSnippet = `\n# Apply What-If condition\ndf = df[df["${cfCtx.column}"] != "${cfCtx.excluded_value}"]\n`;
  }

  if (isGrouped) {
    if (cleanOp === 'count') {
      return `import pandas as pd

# 1. Load dataset
df = pd.read_csv("${file}")${whatIfSnippet}
# 2. Apply valid-row rules: non-null group and non-null target
valid = df["${groupCol}"].notna() & df["${targetCol}"].notna()
filtered_df = df.loc[valid]

# 3. Group by '${groupCol}' and calculate count independently
result = (
    filtered_df.groupby("${groupCol}", sort=True)["${targetCol}"]
    .count()
    .reset_index(name="count")
)

# 4. Print independently calculated groups
print(result)
`;
    }

    const pandasMethod = cleanOp === 'average' ? 'mean' : cleanOp;
    return `import pandas as pd
import numpy as np

# 1. Load dataset
df = pd.read_csv("${file}")${whatIfSnippet}
# 2. Apply valid-row rules: non-null group and non-null finite target
valid = (
    df["${groupCol}"].notna() &
    df["${targetCol}"].notna() &
    np.isfinite(pd.to_numeric(df["${targetCol}"], errors="coerce"))
)
filtered_df = df.loc[valid].copy()
filtered_df["${targetCol}"] = pd.to_numeric(filtered_df["${targetCol}"])

# 3. Group by '${groupCol}' and calculate ${cleanOp} independently
result = (
    filtered_df.groupby("${groupCol}", sort=True)["${targetCol}"]
    .${pandasMethod}()
    .reset_index()
)

# 4. Print independently calculated groups
print(result)
`;
  }

  // Scalar Operations
  if (cleanOp === 'count') {
    return `import pandas as pd

# 1. Load dataset
df = pd.read_csv("${file}")${whatIfSnippet}
# 2. Apply valid-row rules: non-null target
valid = df["${targetCol}"].notna()

# 3. Calculate count independently
result = int(valid.sum())

# 4. Print independently calculated result
print(result)
`;
  }

  const pandasMethod = cleanOp === 'average' ? 'mean' : cleanOp;

  return `import pandas as pd
import numpy as np

# 1. Load dataset
df = pd.read_csv("${file}")${whatIfSnippet}
# 2. Apply valid-row rules: non-null and finite
valid = df["${targetCol}"].notna() & np.isfinite(pd.to_numeric(df["${targetCol}"], errors="coerce"))
numeric_values = pd.to_numeric(df.loc[valid, "${targetCol}"])

# 3. Calculate ${cleanOp} independently
result = numeric_values.${pandasMethod}()

# 4. Print independently calculated result
print(result)
`;
}

export default function CalculationInspector({
  proof,
  result,
  operation,
  column,
  group_by,
  filename,
  initialTab = 'trace',
  onClose
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copied, setCopied] = useState(false);

  if (!proof) return null;

  const {
    formula = '',
    calculation = '',
    evidence = {},
    group_details = null,
    valid_rows_count = 0,
    rows_excluded = 0,
  } = proof;

  const isGrouped = Boolean(group_by || operation.startsWith('group_by_'));

  const pythonCode = generateVerificationCode({
    filename,
    operation,
    column,
    group_by,
    result,
    proof
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(pythonCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="inspector-overlay-container">
      <div className="inspector-card">
        {/* Header */}
        <div className="inspector-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="inspector-icon-badge">
              <Calculator size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                Deterministic Calculation & Code Inspector
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Exact mathematical formulation and runnable independent verification code
              </div>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              className="btn-replay-action"
              onClick={onClose}
              title="Close Inspector"
              style={{ padding: '6px' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <div className="inspector-tabs-bar">
          <button
            type="button"
            className={`inspector-tab-btn ${activeTab === 'trace' ? 'active' : ''}`}
            onClick={() => setActiveTab('trace')}
          >
            <Sigma size={14} />
            <span>Calculation Trace</span>
          </button>

          <button
            type="button"
            className={`inspector-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <Terminal size={14} />
            <span>Runnable Verification Code</span>
          </button>
        </div>

        {/* TAB 1: Calculation Trace */}
        {activeTab === 'trace' && (
          <>
            {/* High-level Formula Box */}
            <div className="inspector-formula-box">
              <div className="inspector-section-label">
                <Sigma size={13} color="#38bdf8" />
                <span>Mathematical Formula Trace</span>
              </div>
              <div className="inspector-formula-text">
                {formula || calculation}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Deterministic operation: <code className="code-pill">{calculation}</code>
              </div>
            </div>

            {/* Calculation Step Breakdown */}
            {!isGrouped && (
              <div className="inspector-steps-container">
                <div className="inspector-section-label">
                  <Hash size={13} color="#34d399" />
                  <span>Scalar Arithmetic Derivation</span>
                </div>

                <div className="inspector-math-breakdown">
                  {operation === 'average' && evidence.sum !== undefined && evidence.count !== undefined && (
                    <div className="math-derivation-block">
                      <div className="math-step-row">
                        <span className="math-step-name">Sum of Valid Values:</span>
                        <span className="math-step-val">{formatNumber(evidence.sum)}</span>
                      </div>
                      <div className="math-step-row">
                        <span className="math-step-name">Count of Valid Rows:</span>
                        <span className="math-step-val">{formatNumber(evidence.count)}</span>
                      </div>
                      <div className="math-divider" />
                      <div className="math-step-row final">
                        <span className="math-step-name">Arithmetic Mean:</span>
                        <span className="math-step-val highlight">{formatNumber(result)}</span>
                      </div>
                    </div>
                  )}

                  {operation === 'sum' && (
                    <div className="math-derivation-block">
                      <div className="math-step-row">
                        <span className="math-step-name">Target Column:</span>
                        <span className="math-step-val">{column}</span>
                      </div>
                      <div className="math-step-row">
                        <span className="math-step-name">Operable Rows Included:</span>
                        <span className="math-step-val">{valid_rows_count}</span>
                      </div>
                      <div className="math-step-row">
                        <span className="math-step-name">Excluded (Null / Non-finite):</span>
                        <span className="math-step-val">{rows_excluded}</span>
                      </div>
                      <div className="math-divider" />
                      <div className="math-step-row final">
                        <span className="math-step-name">Deterministic Sum:</span>
                        <span className="math-step-val highlight">{formatNumber(result)}</span>
                      </div>
                    </div>
                  )}

                  {operation !== 'average' && operation !== 'sum' && (
                    <div className="math-derivation-block">
                      <div className="math-step-row">
                        <span className="math-step-name">Operation:</span>
                        <span className="math-step-val">{operation.toUpperCase()}</span>
                      </div>
                      <div className="math-step-row">
                        <span className="math-step-name">Column:</span>
                        <span className="math-step-val">{column}</span>
                      </div>
                      <div className="math-step-row">
                        <span className="math-step-name">Valid Rows Evaluated:</span>
                        <span className="math-step-val">{valid_rows_count}</span>
                      </div>
                      <div className="math-divider" />
                      <div className="math-step-row final">
                        <span className="math-step-name">Calculated Value:</span>
                        <span className="math-step-val highlight">{formatNumber(result)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grouped Breakdown Table */}
            {isGrouped && group_details && Array.isArray(group_details) && (
              <div className="inspector-steps-container">
                <div className="inspector-section-label">
                  <Layers size={13} color="#38bdf8" />
                  <span>Per-Group Calculation Evidence ({group_details.length} Groups)</span>
                </div>

                <div className="inspector-table-wrapper">
                  <table className="inspector-table">
                    <thead>
                      <tr>
                        <th>Group ({group_by})</th>
                        <th>Calculation Trace</th>
                        <th style={{ textAlign: 'right' }}>Valid Rows</th>
                        <th style={{ textAlign: 'right' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group_details.map((g, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                            {g.group}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                            {g.calculation}
                          </td>
                          <td style={{ textAlign: 'right', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                            {g.valid_rows_count}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                            {formatNumber(g.result)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: Runnable Verification Code */}
        {activeTab === 'code' && (
          <div className="inspector-code-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="inspector-section-label">
                <Terminal size={13} color="#38bdf8" />
                <span>Python 3 Verification Script (PS08 Independent Check)</span>
              </div>

              <button
                type="button"
                className="btn-copy-code"
                onClick={handleCopyCode}
              >
                {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Python Code'}</span>
              </button>
            </div>

            {/* Optional ProofAI Reference Metadata (OUTSIDE executable code) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px',
              marginBottom: '10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              fontSize: '12px'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                ProofAI Reported Result:
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38bdf8' }}>
                {isGrouped ? `${Array.isArray(group_details) ? group_details.length : ''} Groups` : formatNumber(result)}
              </span>
            </div>

            <div className="code-editor-box">
              <pre className="code-block font-mono">
                <code>{pythonCode}</code>
              </pre>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '8px' }}>
              Run this script directly in Python with Pandas. It independently filters valid rows and calculates the result directly from the source dataset without relying on precomputed outputs.
            </div>
          </div>
        )}

        {/* Verification Footer Note */}
        <div className="inspector-footer-note">
          <CheckCircle2 size={15} color="#34d399" style={{ flexShrink: 0 }} />
          <span>
            Every arithmetic step strictly matches deterministic pandas aggregation contracts without heuristic approximations.
          </span>
        </div>
      </div>
    </div>
  );
}
