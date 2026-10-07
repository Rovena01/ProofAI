import React from 'react';
import { Database, ShieldAlert, CheckCircle2, Cpu } from 'lucide-react';

export default function Header({ filename, datasetId, overallStatus, isVerified = false }) {
  return (
    <header className="top-header">
      <div className="header-left">
        <div className="header-title-badge">
          <Database size={15} color="#38bdf8" />
          <span>Active Dataset:</span>
          {filename ? (
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{filename}</span>
          ) : (
            <span style={{ color: '#64748b', fontStyle: 'italic' }}>None loaded</span>
          )}
        </div>
      </div>

      <div className="header-right">
        {overallStatus && (
          <span className={`status-badge ${overallStatus}`}>
            {overallStatus === 'pass' && <CheckCircle2 size={12} />}
            {overallStatus !== 'pass' && <ShieldAlert size={12} />}
            Quality: {overallStatus.toUpperCase()}
          </span>
        )}

        {isVerified && (
          <span className="status-badge pass" style={{ gap: '5px' }}>
            <CheckCircle2 size={12} />
            Proof: Verified
          </span>
        )}

        <div className="badge-engine-status">
          <span className="pulse-dot"></span>
          <span>Deterministic Engine Active</span>
        </div>
      </div>
    </header>
  );
}
