import React from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Database,
  BrainCircuit,
  FileCheck2,
  Settings,
  Sparkles
} from 'lucide-react';

export default function Sidebar({
  currentView = 'workspace',
  onNavigate,
  hasDataset = false,
  hasPlan = false,
  hasResult = false,
  isVerified = false,
}) {
  const isWorkspace = currentView === 'workspace';
  const isSettings = currentView === 'settings';

  const handleNavClick = (view, hash = null) => {
    if (onNavigate) {
      onNavigate(view);
    }
    if (hash && view === 'workspace') {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" onClick={() => handleNavClick('workspace')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon-wrapper">
          <ShieldCheck size={20} />
        </div>
        <div className="brand-text-block">
          <div className="brand-name">ProofAI</div>
          <div className="brand-subline">Proof-Carrying Analyst</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-link ${isWorkspace ? 'active' : ''}`}
          onClick={() => handleNavClick('workspace', '#workspace')}
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', font: 'inherit' }}
        >
          <div className="nav-link-left">
            <LayoutDashboard size={17} />
            <span className="nav-link-text">Workspace</span>
          </div>
        </button>

        <a
          className={`nav-link ${hasDataset ? '' : 'disabled'}`}
          href="#dataset"
          onClick={(e) => {
            if (!hasDataset) {
              e.preventDefault();
              return;
            }
            handleNavClick('workspace', '#dataset');
          }}
        >
          <div className="nav-link-left">
            <Database size={17} />
            <span className="nav-link-text">Dataset</span>
          </div>
          {hasDataset && <span className="nav-tag-badge">Loaded</span>}
        </a>

        <a
          className={`nav-link ${hasPlan ? '' : 'disabled'}`}
          href="#plan"
          onClick={(e) => {
            if (!hasPlan) {
              e.preventDefault();
              return;
            }
            handleNavClick('workspace', '#plan');
          }}
        >
          <div className="nav-link-left">
            <BrainCircuit size={17} />
            <span className="nav-link-text">Analysis Plan</span>
          </div>
          {hasPlan && <span className="nav-tag-badge">Ready</span>}
        </a>

        <a
          className={`nav-link ${hasResult ? '' : 'disabled'}`}
          href="#result"
          onClick={(e) => {
            if (!hasResult) {
              e.preventDefault();
              return;
            }
            handleNavClick('workspace', '#result');
          }}
        >
          <div className="nav-link-left">
            <FileCheck2 size={17} />
            <span className="nav-link-text">Proof & Verify</span>
          </div>
          {isVerified && <span className="nav-tag-badge pass">Verified</span>}
          {!isVerified && hasResult && <span className="nav-tag-badge">Computed</span>}
        </a>

        <button
          type="button"
          className={`nav-link ${isSettings ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', font: 'inherit' }}
        >
          <div className="nav-link-left">
            <Settings size={17} />
            <span className="nav-link-text">Settings</span>
          </div>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
          <Sparkles size={14} color="#38bdf8" />
          <span style={{ fontWeight: 600 }}>Deterministic Core</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Zero heuristics • Formally verified
        </div>
      </div>
    </aside>
  );
}
