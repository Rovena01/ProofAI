import React, { useState } from 'react';
import {
  Calculator,
  BarChart3,
  TrendingUp,
  Table as TableIcon,
  CheckCircle2,
  Crown,
  Layers,
  Sparkles,
  ShieldCheck,
  Terminal,
  ArrowDown,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { analyzeCounterfactual } from '../services/api';

function formatNumber(val) {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(val);
}

function formatDisplayVal(val, col = '') {
  if (val === null || val === undefined) return 'None';
  const isCurrency = typeof col === 'string' && /revenue|sales|price|cost|amount/i.test(col);
  const prefix = isCurrency ? '₹' : '';

  if (Array.isArray(val)) {
    const sum = val.reduce((acc, curr) => {
      const v = curr.value ?? curr.result ?? 0;
      return acc + (typeof v === 'number' ? v : 0);
    }, 0);
    return `${prefix}${formatNumber(sum)}`;
  }
  if (typeof val === 'number') {
    return `${prefix}${formatNumber(val)}`;
  }
  return String(val);
}

function formatDifference(diff, col = '') {
  if (diff === null || diff === undefined) return '0';
  const isCurrency = typeof col === 'string' && /revenue|sales|price|cost|amount/i.test(col);
  const prefix = isCurrency ? '₹' : '';

  if (typeof diff === 'number') {
    if (diff < 0) {
      return `−${prefix}${formatNumber(Math.abs(diff))}`;
    } else if (diff > 0) {
      return `+${prefix}${formatNumber(diff)}`;
    }
    return `${prefix}0`;
  }
  return String(diff);
}

function formatPctChange(pct) {
  if (pct === null || pct === undefined) return '';
  if (pct < 0) {
    return `−${Math.abs(pct).toFixed(2)}%`;
  }
  return `+${pct.toFixed(2)}%`;
}

function WhatIfSection({
  analysisData,
  datasetId,
  previewData,
  onViewCounterfactualProof,
  onViewCounterfactualCode,
  onCounterfactualChange,
}) {
  const [counterfactualData, setCounterfactualData] = useState(null);
  const [activeExclusion, setActiveExclusion] = useState(null);
  const [isLoadingCf, setIsLoadingCf] = useState(false);
  const [cfError, setCfError] = useState(null);

  const {
    operation = '',
    column = '',
    group_by = null,
    result,
  } = analysisData;

  const isGrouped = Boolean(group_by || operation.startsWith('group_by_'));

  // Dynamically extract exclusion candidate categories
  const exclusionCandidates = [];
  if (isGrouped && Array.isArray(result) && group_by) {
    result.forEach((item) => {
      if (item.group !== null && item.group !== undefined && String(item.group).trim() !== '') {
        exclusionCandidates.push({
          column: group_by,
          value: String(item.group),
        });
      }
    });
  } else if (previewData && previewData.headers && previewData.rows) {
    const catIdx = previewData.headers.findIndex(h => /product|category|region|type|status/i.test(h));
    if (catIdx !== -1) {
      const colName = previewData.headers[catIdx];
      const uniqueVals = [...new Set(previewData.rows.map(r => r[catIdx]).filter(Boolean))];
      uniqueVals.slice(0, 6).forEach((val) => {
        exclusionCandidates.push({
          column: colName,
          value: String(val),
        });
      });
    }
  }

  const handleRunCounterfactual = async (col, val) => {
    setIsLoadingCf(true);
    setCfError(null);
    setActiveExclusion({ column: col, value: val });

    try {
      const payload = {
        dataset_id: analysisData.proof?.dataset_id || datasetId || 'sales',
        operation: analysisData.operation,
        column: analysisData.column,
        group_by: analysisData.group_by || null,
        exclude_column: col,
        exclude_value: val,
      };
      const res = await analyzeCounterfactual(payload);
      setCounterfactualData(res);
      if (onCounterfactualChange) {
        onCounterfactualChange(res);
      }
    } catch (err) {
      setCfError(err.message || 'Counterfactual analysis failed.');
    } finally {
      setIsLoadingCf(false);
    }
  };

  const handleClear = () => {
    setActiveExclusion(null);
    setCounterfactualData(null);
    setCfError(null);
    if (onCounterfactualChange) {
      onCounterfactualChange(null);
    }
  };

  return (
    <section className="panel-card what-if-section-card">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle what-if-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '17px', letterSpacing: '-0.01em' }}>
              WHAT-IF ANALYSIS
            </div>
            <div className="panel-subtitle">
              Counterfactual Proof & Deterministic Impact Re-computation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', fontSize: '11px', padding: '4px 9px' }}>
            COUNTERFACTUAL PROOF
          </span>
          {activeExclusion && (
            <button
              type="button"
              className="btn-proof-control replay"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={handleClear}
              title="Reset What-If exclusion"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="what-if-body">
        {/* Dynamic Categorical Action Bar */}
        {exclusionCandidates.length > 0 && (
          <div className="what-if-actions-strip">
            <span className="strip-title">Categorical Exclusion What-If:</span>
            <div className="what-if-chips-list">
              {exclusionCandidates.map((cand, idx) => {
                const isSelected = activeExclusion && activeExclusion.column === cand.column && activeExclusion.value === cand.value;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`btn-what-if-action ${isSelected ? 'selected' : ''}`}
                    disabled={isLoadingCf}
                    onClick={() => handleRunCounterfactual(cand.column, cand.value)}
                    title={`Exclude ${cand.value} and deterministically recompute proof`}
                  >
                    <span>Exclude {cand.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingCf && (
          <div className="what-if-loading-banner">
            <div className="spinner-small" />
            <span>Computing deterministic counterfactual proof for &quot;Exclude {activeExclusion?.value}&quot;...</span>
          </div>
        )}

        {/* Error Callout */}
        {cfError && (
          <div className="error-callout-box" style={{ margin: '14px 0 0' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{cfError}</span>
          </div>
        )}

        {/* Verified Impact Display */}
        {counterfactualData && !isLoadingCf && (
          <div className="what-if-result-container">
            {/* 4-Stage Verified Flow */}
            <div className="what-if-flow-grid">
              {/* Stage 1: Original Result */}
              <div className="what-if-flow-box">
                <div className="flow-box-label">ORIGINAL RESULT</div>
                <div className="flow-box-value">
                  {formatDisplayVal(counterfactualData.original_result, column)}
                </div>
                <div className="flow-box-pill verified">
                  <CheckCircle2 size={12} />
                  <span>✓ VERIFIED</span>
                </div>
              </div>

              <div className="flow-arrow">↓</div>

              {/* Stage 2: What-If Condition */}
              <div className="what-if-flow-box condition-box">
                <div className="flow-box-label">WHAT-IF CONDITION</div>
                <div className="flow-box-condition-title">
                  Exclude &quot;{counterfactualData.condition?.excluded_value}&quot;
                </div>
                <div className="flow-box-condition-sub">
                  {counterfactualData.rows_excluded_by_condition} rows excluded
                </div>
              </div>

              <div className="flow-arrow">↓</div>

              {/* Stage 3: Counterfactual Result */}
              <div className="what-if-flow-box counterfactual-box">
                <div className="flow-box-label">COUNTERFACTUAL RESULT</div>
                <div className="flow-box-value highlight-cyan">
                  {formatDisplayVal(counterfactualData.counterfactual_result, column)}
                </div>
                <div className="flow-box-pill verified">
                  <CheckCircle2 size={12} />
                  <span>✓ VERIFIED</span>
                </div>
              </div>

              <div className="flow-arrow">↓</div>

              {/* Stage 4: Verified Impact */}
              <div className="what-if-flow-box impact-box">
                <div className="flow-box-label">VERIFIED IMPACT</div>
                <div className="flow-box-value delta-val">
                  {formatDifference(counterfactualData.difference, column)}
                </div>
                {counterfactualData.percentage_change !== null && counterfactualData.percentage_change !== undefined && (
                  <div className="flow-box-delta-pct">
                    {formatPctChange(counterfactualData.percentage_change)}
                  </div>
                )}
              </div>
            </div>

            {/* Row Accounting Box */}
            <div className="what-if-row-accounting">
              <span className="acc-item"><strong>{counterfactualData.original_rows}</strong> baseline rows</span>
              <span className="acc-sep">−</span>
              <span className="acc-item"><strong>{counterfactualData.rows_excluded_by_condition}</strong> excluded</span>
              <span className="acc-sep">=</span>
              <span className="acc-item final-acc"><strong>{counterfactualData.counterfactual_rows}</strong> rows analyzed</span>
            </div>

            {/* Verification & Proof Controls */}
            <div className="what-if-footer-controls">
              <button
                type="button"
                className="btn-proof-control inspect"
                onClick={() => onViewCounterfactualProof && onViewCounterfactualProof(counterfactualData)}
                title="View complete formal counterfactual proof in Proof Explorer"
              >
                <ShieldCheck size={13} />
                <span>View Counterfactual Proof</span>
              </button>

              <button
                type="button"
                className="btn-proof-control code"
                onClick={() => onViewCounterfactualCode && onViewCounterfactualCode(counterfactualData)}
                title="View runnable Python script verifying What-If calculation"
              >
                <Terminal size={13} />
                <span>View Verification Code</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function AnalysisResult({
  analysisData,
  isVerified = false,
  datasetId = null,
  previewData = null,
  uploadData = null,
  onViewCounterfactualProof = null,
  onViewCounterfactualCode = null,
  onCounterfactualChange = null,
}) {
  if (!analysisData) return null;

  const {
    operation = '',
    column = '',
    group_by = null,
    result,
    proof = {},
  } = analysisData;

  const isGrouped = Boolean(group_by || operation.startsWith('group_by_'));
  const rowsConsidered = proof.rows_considered ?? 0;
  const validRows = proof.valid_rows_count ?? 0;
  const rowsExcluded = proof.rows_excluded ?? 0;

  // Grouped Result Presentation
  if (isGrouped && Array.isArray(result)) {
    const groupItems = result.map((item) => ({
      group: String(item.group),
      value: item.value ?? item.result ?? 0,
    }));

    if (groupItems.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="panel-card">
            <div className="panel-header">
              <div className="panel-title-area">
                <div className="panel-icon-circle" style={{ background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' }}>
                  <BarChart3 size={18} />
                </div>
                <div>
                  <div className="panel-title">RESULT (GROUPED)</div>
                  <div className="panel-subtitle">
                    Deterministic calculation for <strong style={{ color: '#ffffff' }}>{column}</strong> grouped by <strong style={{ color: '#ffffff' }}>{group_by}</strong>
                  </div>
                </div>
              </div>
              <span className="status-badge review">NO GROUPS FOUND</span>
            </div>
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No valid groups found to display. All rows in grouping column <strong style={{ color: '#ffffff' }}>{group_by}</strong> were missing or null.
            </div>
          </section>

          <WhatIfSection
            analysisData={analysisData}
            datasetId={datasetId}
            previewData={previewData}
            uploadData={uploadData}
            onViewCounterfactualProof={onViewCounterfactualProof}
            onViewCounterfactualCode={onViewCounterfactualCode}
            onCounterfactualChange={onCounterfactualChange}
          />
        </div>
      );
    }

    const numericValues = groupItems.map((i) => (typeof i.value === 'number' ? i.value : 0));
    const maxValue = Math.max(...numericValues, 1);
    const totalSum = numericValues.reduce((acc, curr) => acc + curr, 0);

    // Identify strongest group for visual emphasis
    let maxIdx = 0;
    for (let i = 1; i < groupItems.length; i++) {
      if ((groupItems[i].value || 0) > (groupItems[maxIdx].value || 0)) {
        maxIdx = i;
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section className="panel-card result-card-showcase">
          <div className="panel-header">
            <div className="panel-title-area">
              <div className="panel-icon-circle result-accent">
                <BarChart3 size={18} />
              </div>
              <div>
                <div className="panel-title" style={{ fontSize: '18px' }}>
                  RESULT (GROUPED)
                </div>
                <div className="panel-subtitle">
                  Deterministic calculation for <strong style={{ color: '#ffffff' }}>{column}</strong> grouped by <strong style={{ color: '#ffffff' }}>{group_by}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-badge pass" style={{ fontSize: '11px', padding: '4px 10px' }}>
                {operation.toUpperCase().replace(/_/g, ' ')}
              </span>
              {isVerified && (
                <span className="verified-seal-pill">
                  <CheckCircle2 size={13} />
                  <span>VERIFIED</span>
                </span>
              )}
            </div>
          </div>

          {/* Group Summary Metric Strip */}
          <div className="group-summary-strip">
            <div className="strip-item">
              <span className="strip-label">Total Groups:</span>
              <strong className="strip-val">{groupItems.length}</strong>
            </div>
            <div className="strip-divider" />
            <div className="strip-item">
              <span className="strip-label">Evaluated Rows:</span>
              <strong className="strip-val">{rowsConsidered}</strong>
            </div>
            <div className="strip-divider" />
            <div className="strip-item">
              <span className="strip-label">Valid Computed:</span>
              <strong className="strip-val highlight-green">{validRows}</strong>
            </div>
            {rowsExcluded > 0 && (
              <>
                <div className="strip-divider" />
                <div className="strip-item">
                  <span className="strip-label">Excluded:</span>
                  <strong className="strip-val highlight-amber">{rowsExcluded}</strong>
                </div>
              </>
            )}
            {totalSum > 0 && operation === 'group_by_sum' && (
              <>
                <div className="strip-divider" />
                <div className="strip-item">
                  <span className="strip-label">Aggregate Total:</span>
                  <strong className="strip-val highlight-cyan">{formatNumber(totalSum)}</strong>
                </div>
              </>
            )}
          </div>

          {/* Proportional Comparison Bars */}
          <div className="comparison-section">
            <div className="section-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} color="#38bdf8" />
                <span className="section-title-tag">Proportional Comparison Breakdown</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Strongest group visually highlighted
              </span>
            </div>

            <div className="bars-stack">
              {groupItems.map((item, idx) => {
                const isStrongest = idx === maxIdx && groupItems.length > 1;
                const numVal = typeof item.value === 'number' ? item.value : 0;
                const barPercent = Math.min(100, Math.max(4, Math.round((numVal / maxValue) * 100)));
                const sharePercent = totalSum > 0 ? ((numVal / totalSum) * 100).toFixed(1) : null;

                return (
                  <div
                    key={idx}
                    className={`comparison-bar-row ${isStrongest ? 'strongest-row' : ''}`}
                  >
                    <div className="bar-label-line">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="group-name-text">{item.group}</span>
                        {isStrongest && (
                          <span className="strongest-badge">
                            <Crown size={11} />
                            <span>TOP</span>
                          </span>
                        )}
                        {sharePercent && (
                          <span className="share-pill">{sharePercent}% of total</span>
                        )}
                      </div>
                      <span className={`group-value-text ${isStrongest ? 'strongest-val' : ''}`}>
                        {formatNumber(item.value)}
                      </span>
                    </div>

                    <div className="progress-track">
                      <div
                        className={`progress-fill ${isStrongest ? 'strongest-fill' : ''}`}
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabular Breakdown */}
          <div className="table-section">
            <div className="section-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TableIcon size={14} color="#94a3b8" />
                <span className="section-title-tag">Tabular Group Data</span>
              </div>
            </div>

            <div className="table-responsive-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>{group_by}</th>
                    <th style={{ textAlign: 'right' }}>{column} ({operation.replace('group_by_', '')})</th>
                    <th style={{ textAlign: 'right' }}>Share of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupItems.map((item, idx) => {
                    const numVal = typeof item.value === 'number' ? item.value : 0;
                    const share = totalSum > 0 ? ((numVal / totalSum) * 100).toFixed(1) + '%' : '—';
                    const isStrongest = idx === maxIdx && groupItems.length > 1;

                    return (
                      <tr key={idx} className={isStrongest ? 'strongest-tr' : ''}>
                        <td style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                          {item.group}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isStrongest ? '#38bdf8' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {formatNumber(item.value)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {share}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* What-If Analysis Section */}
        <WhatIfSection
          analysisData={analysisData}
          datasetId={datasetId}
          previewData={previewData}
          uploadData={uploadData}
          onViewCounterfactualProof={onViewCounterfactualProof}
          onViewCounterfactualCode={onViewCounterfactualCode}
          onCounterfactualChange={onCounterfactualChange}
        />
      </div>
    );
  }

  // Scalar Result Presentation (Hero centerpiece)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <section className="panel-card result-card-showcase">
        <div className="panel-header">
          <div className="panel-title-area">
            <div className="panel-icon-circle result-accent">
              <Calculator size={18} />
            </div>
            <div>
              <div className="panel-title" style={{ fontSize: '18px' }}>
                RESULT
              </div>
              <div className="panel-subtitle">
                Calculated output for <strong style={{ color: '#ffffff' }}>{column}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-badge pass" style={{ fontSize: '11px', padding: '4px 10px' }}>
              {operation.toUpperCase()}
            </span>
            {isVerified && (
              <span className="verified-seal-pill">
                <CheckCircle2 size={13} />
                <span>VERIFIED</span>
              </span>
            )}
          </div>
        </div>

        {/* Scalar Hero Display Card */}
        <div className="scalar-hero-container">
          <div className="scalar-hero-label">
            {operation.toUpperCase()} of {column}
          </div>

          <div className="scalar-hero-value">
            {formatNumber(result)}
          </div>

          <div className="scalar-hero-status-row">
            {isVerified && (
              <div className="verified-pill-large">
                <CheckCircle2 size={15} color="#34d399" />
                <span>✓ VERIFIED</span>
              </div>
            )}

            <div className="scalar-meta-text">
              <strong>{validRows}</strong> rows evaluated · <strong>{rowsExcluded}</strong> excluded
            </div>
          </div>
        </div>
      </section>

      {/* What-If Analysis Section */}
      <WhatIfSection
        analysisData={analysisData}
        datasetId={datasetId}
        previewData={previewData}
        uploadData={uploadData}
        onViewCounterfactualProof={onViewCounterfactualProof}
        onViewCounterfactualCode={onViewCounterfactualCode}
        onCounterfactualChange={onCounterfactualChange}
      />
    </div>
  );
}
