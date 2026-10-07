import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Check,
  Info,
  Layers,
  Cpu
} from 'lucide-react';

const CHECK_DEFINITIONS = {
  field_completeness: {
    label: 'Field Completeness',
    description: 'All mandatory proof attributes, mathematical formulation, and metadata versioning are present.',
  },
  operation_column_validation: {
    label: 'Operation & Column Validation',
    description: 'Operation and target columns strictly match schema definitions and deterministic contracts.',
  },
  exclusion_accounting: {
    label: 'Exclusion Accounting Identity',
    description: 'Evaluated rows exactly equal valid rows plus missing and non-finite excluded counts.',
  },
  result_type_matching: {
    label: 'Result Type Matching',
    description: 'Computed result structure strictly conforms to the expected scalar or grouped schema.',
  },
  data_quality_status_link: {
    label: 'Data Quality Status Linkage',
    description: 'Formal proof binds directly to the verified dataset data-quality assessment.',
  },
  numeric_json_safety: {
    label: 'Numeric JSON Safety',
    description: 'All numeric aggregates are finite, real numbers with zero NaN or Infinity values.',
  },
};

export default function VerificationCard({ verificationData }) {
  if (!verificationData) return null;

  const {
    verified,
    verification_status,
    status,
    verification_method,
    method = 'deterministic_internal_consistency',
    message = 'Formal verification complete.',
    checks_performed = [],
  } = verificationData;

  const isVerified = verified === true || verification_status === 'passed' || status === 'VERIFIED';
  const effectiveMethod = verification_method || method;

  return (
    <section className={`panel-card verification-panel ${isVerified ? 'verified-border' : 'failed-border'}`}>
      <div className="panel-header">
        <div className="panel-title-area">
          <div
            className="panel-icon-circle"
            style={{
              background: isVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isVerified ? '#34d399' : '#f87171'
            }}
          >
            {isVerified ? <ShieldCheck size={18} /> : <XCircle size={18} />}
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '18px' }}>
              {isVerified ? '✓ PROOF VERIFIED' : '✕ VERIFICATION FAILED'}
            </div>
            <div className="panel-subtitle">
              Deterministic internal consistency audit of mathematical proof and row accounting
            </div>
          </div>
        </div>

        <span
          className={`status-badge ${isVerified ? 'pass' : 'fail'}`}
          style={{ fontSize: '12px', padding: '4px 12px' }}
        >
          {isVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {isVerified ? 'VERIFIED' : 'FAILED'}
        </span>
      </div>

      {/* Hero Banner */}
      <div className={`verification-hero-banner ${isVerified ? 'pass-bg' : 'fail-bg'}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className={`verification-badge-circle ${isVerified ? 'pass' : 'fail'}`}>
              {isVerified ? <Check size={22} strokeWidth={3} /> : <XCircle size={22} />}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                {isVerified ? 'Formal Verification Passed' : 'Verification Check Inconsistent'}
              </div>
              <div style={{ fontSize: '13px', color: isVerified ? '#a7f3d0' : '#fca5a5', marginTop: '2px' }}>
                {message}
              </div>
            </div>
          </div>

          <div className="verification-method-pill">
            <Cpu size={14} color="#38bdf8" />
            <span>Method: <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{effectiveMethod}</strong></span>
          </div>
        </div>
      </div>

      {/* 6 Invariant Checklist */}
      <div>
        <div className="checklist-heading">
          <Layers size={13} color="#38bdf8" />
          <span>Verification Consistency Audit ({checks_performed.length} Invariants Audited)</span>
        </div>

        <div className="invariants-grid">
          {checks_performed.map((checkKey) => {
            const def = CHECK_DEFINITIONS[checkKey] || {
              label: checkKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              description: 'Invariant verified by the deterministic engine.',
            };

            return (
              <div key={checkKey} className="invariant-item-card">
                <div className={`invariant-check-dot ${isVerified ? 'pass' : 'fail'}`}>
                  <Check size={12} strokeWidth={3} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="invariant-title">{def.label}</div>
                    <span className={`invariant-status-tag ${isVerified ? 'pass' : 'fail'}`}>
                      PASSED
                    </span>
                  </div>
                  <div className="invariant-desc">{def.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
