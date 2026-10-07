import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Sigma,
  AlertTriangle,
  FolderTree
} from 'lucide-react';

export default function ProofCard({ proof }) {
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  if (!proof) return null;

  const {
    proof_version = '1.0.0',
    operation = '',
    target_column = '',
    group_by_column = null,
    source_columns = [],
    dataset_rows = 0,
    rows_considered = 0,
    valid_rows_count = 0,
    missing_values_excluded = 0,
    non_finite_values_excluded = 0,
    rows_excluded = 0,
    exclusion_reasons = [],
    calculation = '',
    formula = '',
    data_quality_status = 'pass',
    data_quality_score = 100,
    group_details = null
  } = proof;

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <FileText size={16} />
          </div>
          <div>
            <div className="panel-title">6. Formal Proof & Calculation Evidence</div>
            <div className="panel-subtitle">Verifiable trace of inputs, exclusions, and mathematical formulation</div>
          </div>
        </div>

        <span className="status-badge pass" style={{ fontSize: '11px', padding: '3px 8px' }}>
          <ShieldCheck size={12} />
          Proof v{proof_version}
        </span>
      </div>

      {/* Formula & Mathematical Formulation */}
      <div style={{
        background: 'rgba(10, 15, 26, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Sigma size={13} color="#38bdf8" />
          <span>Mathematical Formulation Trace</span>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
          {formula || calculation}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Explicit operation trace: <code style={{ color: '#ffffff', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>{calculation}</code>
        </div>
      </div>

      {/* Row Accounting Grid */}
      <div>
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '8px'
        }}>
          Row Accounting & Scope
        </div>
        <div className="metrics-grid">
          <div className="metric-stat-card">
            <span className="metric-label">Dataset Rows</span>
            <div className="metric-value" style={{ fontSize: '18px' }}>{dataset_rows}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Source total</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Evaluated</span>
            <div className="metric-value" style={{ fontSize: '18px' }}>{rows_considered}</div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rows scoped</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Included</span>
            <div className="metric-value" style={{ fontSize: '18px', color: '#34d399' }}>{valid_rows_count}</div>
            <span style={{ fontSize: '11px', color: '#34d399' }}>Valid non-null rows</span>
          </div>

          <div className="metric-stat-card">
            <span className="metric-label">Exclusions</span>
            <div className="metric-value" style={{ fontSize: '18px', color: rows_excluded > 0 ? '#fbbf24' : '#94a3b8' }}>
              {rows_excluded}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {missing_values_excluded} null • {non_finite_values_excluded} inf
            </span>
          </div>
        </div>
      </div>

      {/* Exclusion Reasons (if any rows were excluded) */}
      {exclusion_reasons && exclusion_reasons.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} />
            <span>Exclusion Trace Reasons ({exclusion_reasons.length})</span>
          </div>
          <div style={{ fontSize: '12px', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {exclusion_reasons.map((r, idx) => (
              <div key={idx}>• {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Source Columns & Quality Linkage */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 16px',
        background: 'rgba(17, 25, 40, 0.5)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree size={14} color="#38bdf8" />
          <span style={{ color: 'var(--text-muted)' }}>Source Columns: </span>
          <span style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{source_columns.join(', ')}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Data Quality Link: </span>
          <span className={`status-badge ${data_quality_status}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
            {data_quality_status.toUpperCase()} ({data_quality_score}/100)
          </span>
        </div>
      </div>

      {/* Per-Group Breakdown Trace (if group_by operation) */}
      {group_details && Array.isArray(group_details) && (
        <div style={{ marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => setShowGroupDetails(!showGroupDetails)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0'
            }}
          >
            <span>{showGroupDetails ? 'Hide' : 'Show'} Per-Group Calculation Details ({group_details.length} groups)</span>
            {showGroupDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showGroupDetails && (
            <div style={{
              marginTop: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '10px'
            }}>
              {group_details.map((g, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(10, 15, 26, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{g.group}</strong>
                    <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {typeof g.result === 'number' ? g.result.toLocaleString() : g.result}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    {g.valid_rows_count} valid rows • {g.missing_values_excluded} missing
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
    </section>
  );
}
