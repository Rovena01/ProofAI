import React from 'react';
import { BrainCircuit, Cpu, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Check } from 'lucide-react';

export default function PipelineProgress({
  hasDataset = false,
  isPlanning = false,
  hasPlan = false,
  planFailed = false,
  isAnalyzing = false,
  hasResult = false,
  analysisFailed = false,
  hasProof = false,
  isVerified = false,
  verificationFailed = false,
}) {
  // Real deterministic pipeline stage calculations
  const planState = planFailed
    ? 'failed'
    : isPlanning
    ? 'active'
    : hasPlan
    ? 'completed'
    : 'idle';

  const analyzeState = analysisFailed
    ? 'failed'
    : isAnalyzing
    ? 'active'
    : hasResult
    ? 'completed'
    : 'idle';

  const proveState = analysisFailed
    ? 'failed'
    : isAnalyzing
    ? 'active'
    : hasProof
    ? 'completed'
    : 'idle';

  const verifyState = verificationFailed
    ? 'failed'
    : (isAnalyzing && hasResult)
    ? 'active'
    : isVerified
    ? 'completed'
    : 'idle';

  const stages = [
    {
      id: 'plan',
      label: 'PLAN',
      sublabel: 'Deterministic Intent',
      icon: BrainCircuit,
      state: planState,
    },
    {
      id: 'analyze',
      label: 'ANALYZE',
      sublabel: 'Pandas Aggregation',
      icon: Cpu,
      state: analyzeState,
    },
    {
      id: 'prove',
      label: 'PROVE',
      sublabel: 'Evidence & Accounting',
      icon: ShieldCheck,
      state: proveState,
    },
    {
      id: 'verify',
      label: 'VERIFY',
      sublabel: 'Internal Consistency',
      icon: CheckCircle2,
      state: verifyState,
    },
  ];

  return (
    <div className="pipeline-visualizer-container">
      <div className="pipeline-stages-track">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isCurrentActive = stage.state === 'active';
          const isDone = stage.state === 'completed';
          const isError = stage.state === 'failed';

          return (
            <React.Fragment key={stage.id}>
              <div className={`pipeline-stage-pill ${stage.state}`}>
                <div className="stage-icon-circle">
                  {isCurrentActive && <Loader2 size={16} className="spinner-icon" />}
                  {isDone && <Check size={16} strokeWidth={3} />}
                  {isError && <AlertCircle size={16} />}
                  {!isCurrentActive && !isDone && !isError && <Icon size={16} />}
                </div>

                <div className="stage-text-block">
                  <div className="stage-label-row">
                    <span className="stage-label">{stage.label}</span>
                    <span className={`stage-state-tag ${stage.state}`}>
                      {stage.state.toUpperCase()}
                    </span>
                  </div>
                  <span className="stage-sublabel">{stage.sublabel}</span>
                </div>
              </div>

              {idx < stages.length - 1 && (
                <div className={`pipeline-connector ${stages[idx + 1].state === 'completed' || isDone ? 'connected' : ''}`}>
                  <div className="connector-line" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
