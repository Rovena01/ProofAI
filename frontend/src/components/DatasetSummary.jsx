import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Layers,
  Hash,
  ChevronDown,
  ChevronUp,
  Table as TableIcon
} from 'lucide-react';

function getIssueDetails(w) {
  const type = w.type || '';
  const col = w.column || '';

  switch (type) {
    case 'missing_values':
      return {
        title: 'Missing Values',
        icon: 'warning',
        severity: w.severity || 'warning',
        detail: col
          ? `${col} — ${w.count ?? 'some'} missing value(s)${w.percentage !== undefined ? ` (${w.percentage}%)` : ''}`
          : `${w.count ?? ''} missing values detected`,
        explanation: w.message || 'Missing values excluded from mathematical computations according to proof contracts.'
      };
    case 'duplicate_rows':
      return {
        title: 'Duplicate Rows',
        icon: 'warning',
        severity: w.severity || 'warning',
        detail: `${w.count ?? ''} duplicate row(s) detected${w.percentage !== undefined ? ` (${w.percentage}%)` : ''}`,
        explanation: w.message || 'Duplicate rows remain preserved in dataset; no silent deduplication performed.'
      };
    case 'invalid_dates':
      return {
        title: 'Invalid / Unparseable Dates',
        icon: 'warning',
        severity: w.severity || 'warning',
        detail: col
          ? `${col} — ${w.unparseable_values ?? 'several'} value(s) could not be parsed${w.parse_success_percentage !== undefined ? ` (${w.parse_success_percentage}% parse success)` : ''}`
          : `${w.unparseable_values ?? ''} unparseable date values`,
        explanation: w.message || 'Date parsing failed for some rows; cannot be safely utilized for temporal queries.'
      };
    case 'infinite_values':
      return {
        title: 'Non-Finite Numeric Values',
        icon: 'warning',
        severity: w.severity || 'warning',
        detail: col ? `${col} — ${w.count ?? 'multiple'} infinite / non-finite value(s)` : `${w.count ?? ''} infinite values`,
        explanation: w.message || 'Infinite / non-finite values are excluded from numeric aggregations to preserve numerical validity.'
      };
    case 'empty_column':
      return {
        title: 'Empty Columns',
        icon: 'critical',
        severity: 'critical',
        detail: col ? `${col} — empty column (100% missing)` : 'Column is empty',
        explanation: w.message || 'Every value in this column is missing. Mathematical operations on this column are refused.'
      };
    case 'constant_column':
      return {
        title: 'Constant Columns',
        icon: 'info',
        severity: 'info',
        detail: col ? `${col} — contains only 1 unique value` : 'Constant column detected',
        explanation: w.message || 'Column has zero variance. Often legitimate for partition/category metadata.'
      };
    case 'negative_values':
      return {
        title: 'Negative Numeric Values',
        icon: 'info',
        severity: 'info',
        detail: col ? `${col} — contains negative values${w.min !== undefined ? ` (minimum: ${w.min})` : ''}` : 'Negative numbers present',
        explanation: w.message || 'Negative values detected. Informational note; may be legitimate depending on domain.'
      };
    default:
      return {
        title: type ? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Quality Observation',
        icon: w.severity === 'critical' ? 'critical' : (w.severity === 'info' ? 'info' : 'warning'),
        severity: w.severity || 'warning',
        detail: col ? `${col} — ${w.message}` : w.message,
        explanation: w.message
      };
  }
}

export default function DatasetSummary({ uploadData, previewData }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!uploadData) return null;

  const { profile = {}, data_quality = {} } = uploadData;
  const rowCount = data_quality.row_count ?? profile.rows ?? 0;
  const columnCount = data_quality.column_count ?? profile.columns ?? 0;
  const qualityScore = data_quality.quality_score ?? 100;
  const overallStatus = data_quality.overall_status ?? 'pass';
  const warnings = data_quality.warnings || [];
  const columnDetails = profile.column_details || [];

  return (
    <section className="panel-card summary-panel">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle summary-accent">
            <Activity size={18} />
          </div>
          <div>
            <div className="panel-title">2. Dataset Health & Schema</div>
            <div className="panel-subtitle">Deterministic quality audit and structural inspection</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`status-badge ${overallStatus}`}>
            {overallStatus === 'pass' && <ShieldCheck size={12} />}
            {overallStatus !== 'pass' && <AlertTriangle size={12} />}
            Quality: {overallStatus.toUpperCase()}
          </span>

          <button
            type="button"
            className="btn-toggle-compact"
            onClick={() => setIsExpanded(!isExpanded)}
            title="Toggle schema visibility"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Prominent Compact Dataset Health Summary Banner */}
      <div className="dataset-health-compact-card">
        <div className="health-compact-left">
          <span className="health-compact-tag">DATASET HEALTH</span>
          <div className="health-compact-status-row">
            {overallStatus === 'pass' && (
              <span className="health-badge-pill pass">
                <ShieldCheck size={15} />
                <span>✓ PASS — {qualityScore}/100</span>
              </span>
            )}
            {overallStatus === 'review' && (
              <span className="health-badge-pill review">
                <AlertTriangle size={15} />
                <span>⚠ REVIEW — {qualityScore}/100</span>
              </span>
            )}
            {overallStatus === 'fail' && (
              <span className="health-badge-pill fail">
                <AlertCircle size={15} />
                <span>✕ FAIL — {qualityScore}/100</span>
              </span>
            )}
          </div>
        </div>

        <div className="health-compact-right">
          <div className="health-compact-metrics">
            <strong style={{ color: '#ffffff' }}>{rowCount.toLocaleString()}</strong> rows · <strong style={{ color: '#ffffff' }}>{columnCount}</strong> columns
          </div>
          {warnings.length > 0 ? (
            <span className="health-obs-tag warning">
              <AlertTriangle size={11} />
              <span>{warnings.length} quality observation{warnings.length !== 1 ? 's' : ''}</span>
            </span>
          ) : (
            <span className="health-obs-tag pass">
              <CheckCircle2 size={11} />
              <span>0 issues detected</span>
            </span>
          )}
        </div>
      </div>

      {/* 4-Stat Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-stat-card">
          <span className="metric-label">Dataset Rows</span>
          <div className="metric-value-row">
            <Hash size={18} color="#94a3b8" />
            <span className="metric-value">{rowCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <span className="metric-label">Total Columns</span>
          <div className="metric-value-row">
            <Layers size={18} color="#94a3b8" />
            <span className="metric-value">{columnCount}</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <span className="metric-label">Quality Score</span>
          <div className="metric-value-row">
            <span className="metric-value">{qualityScore}</span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>/ 100</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <span className="metric-label">Audit Outcome</span>
          <div className="metric-value-row">
            <span className={`status-badge ${overallStatus}`} style={{ fontSize: '13px', padding: '4px 10px' }}>
              {overallStatus.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Schema & Issues */}
      {isExpanded && (
        <div className="summary-expanded-section">
          {/* Prominent DATA QUALITY ISSUES / OBSERVATIONS Panel */}
          <div className="quality-issues-panel">
            <div className="quality-issues-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {warnings.length > 0 ? (
                  <AlertTriangle size={15} color="#fbbf24" />
                ) : (
                  <CheckCircle2 size={15} color="#34d399" />
                )}
                <span className="quality-issues-title">
                  {warnings.length > 0 ? 'DATA QUALITY ISSUES & OBSERVATIONS' : 'DATA QUALITY AUDIT'}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {warnings.length > 0 ? `${warnings.length} finding${warnings.length > 1 ? 's' : ''}` : 'Clean Audit'}
              </span>
            </div>

            {warnings.length === 0 ? (
              <div className="quality-clean-banner">
                <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#34d399', fontSize: '13px' }}>
                    ✓ No critical data quality issues detected
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    All rows and columns pass deterministic structural integrity audits without missing values, duplicates, or non-finite values.
                  </div>
                </div>
              </div>
            ) : (
              <div className="quality-issues-list">
                {warnings.map((w, idx) => {
                  const meta = getIssueDetails(w);
                  const isCritical = meta.severity === 'critical';
                  const isWarning = meta.severity === 'warning';

                  return (
                    <div key={idx} className={`quality-issue-card ${meta.severity}`}>
                      <div className="issue-card-top">
                        <div className="issue-type-row">
                          {isCritical && <AlertCircle size={15} color="#ef4444" />}
                          {isWarning && <AlertTriangle size={15} color="#fbbf24" />}
                          {!isCritical && !isWarning && <Info size={15} color="#38bdf8" />}
                          <span className="issue-type-name">{meta.title}</span>
                        </div>
                        <span className={`issue-severity-badge ${meta.severity}`}>
                          {meta.severity.toUpperCase()}
                        </span>
                      </div>

                      <div className="issue-detail-highlight">
                        {meta.detail}
                      </div>

                      {meta.explanation && meta.explanation !== meta.detail && (
                        <div className="issue-explanation-text">
                          {meta.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schema Columns */}
          <div>
            <div className="schema-section-label">
              Identified Columns & Semantic Types
            </div>
            <div className="schema-chips-wrap">
              {columnDetails.map((col, idx) => (
                <div key={idx} className="column-pill">
                  <span>{col.name}</span>
                  <span className="column-type-tag">{col.semantic_type || col.dtype}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Dataset Preview Table (First 5-8 actual rows) */}
          {previewData && previewData.rows && previewData.rows.length > 0 && (
            <div className="dataset-preview-panel">
              <div className="preview-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TableIcon size={14} color="#38bdf8" />
                  <span className="preview-title">Dataset Preview</span>
                  <span className="preview-count-badge">First {previewData.rows.length} rows</span>
                </div>
                <span className="preview-meta-hint">
                  Showing first {previewData.rows.length} of {rowCount.toLocaleString()} rows
                </span>
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th className="preview-th-num">#</th>
                      {previewData.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="preview-td-num">{rIdx + 1}</td>
                        {previewData.headers.map((_, cIdx) => (
                          <td key={cIdx} className="preview-td-val">
                            {row[cIdx] !== undefined && row[cIdx] !== '' ? (
                              row[cIdx]
                            ) : (
                              <span className="preview-null">null</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
