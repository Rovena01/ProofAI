import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PipelineProgress from './components/PipelineProgress';
import DatasetUpload from './components/DatasetUpload';
import DatasetSummary from './components/DatasetSummary';
import QuestionPlanner from './components/QuestionPlanner';
import PlanCard from './components/PlanCard';
import AnalysisResult from './components/AnalysisResult';
import ProofExplorer from './components/ProofExplorer';
import VerificationCard from './components/VerificationCard';
import ReplayProof from './components/ReplayProof';
import CalculationInspector from './components/CalculationInspector';
import SettingsView from './components/SettingsView';
import {
  uploadDataset,
  planQuestion,
  analyzeDataset,
  verifyProof,
} from './services/api';
import { AlertCircle, Sparkles, Database } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('workspace'); // 'workspace' | 'settings'
  const [datasetId, setDatasetId] = useState(null);
  const [filename, setFilename] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [question, setQuestion] = useState('');
  const [plan, setPlan] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planError, setPlanError] = useState(null);

  const [analysisData, setAnalysisData] = useState(null);
  const [verificationData, setVerificationData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // Counterfactual What-If State
  const [counterfactualData, setCounterfactualData] = useState(null);
  const [activeProofMode, setActiveProofMode] = useState('original'); // 'original' | 'counterfactual'

  // Modals / Overlays
  const [showReplay, setShowReplay] = useState(false);
  const [showCalcInspector, setShowCalcInspector] = useState(false);
  const [calcInspectorTab, setCalcInspectorTab] = useState('trace');

  const handleUpload = async (file) => {
    setIsUploading(true);
    setUploadError(null);
    setPreviewData(null);
    setPlan(null);
    setPlanError(null);
    setAnalysisData(null);
    setVerificationData(null);
    setAnalysisError(null);
    setCounterfactualData(null);
    setActiveProofMode('original');
    setShowReplay(false);
    setShowCalcInspector(false);

    try {
      // Extract actual first 8 rows from uploaded file for preview
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length > 1) {
          const parseCsvLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headers = parseCsvLine(lines[0]);
          const previewRows = lines.slice(1, 9).map(l => parseCsvLine(l));
          setPreviewData({ headers, rows: previewRows });
        }
      } catch {
        // Fallback: preview gracefully hidden
      }

      const res = await uploadDataset(file);
      setDatasetId(res.dataset_id);
      setFilename(res.filename);
      setUploadData(res);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setDatasetId(null);
    setFilename(null);
    setUploadData(null);
    setPreviewData(null);
    setPlan(null);
    setQuestion('');
    setUploadError(null);
    setPlanError(null);
    setAnalysisData(null);
    setVerificationData(null);
    setAnalysisError(null);
    setCounterfactualData(null);
    setActiveProofMode('original');
    setShowReplay(false);
    setShowCalcInspector(false);
  };

  const handleQuestionChange = (newQuestion) => {
    setQuestion(newQuestion);
    // Strict execution flow guard: modifying or typing a question must NEVER
    // display an analysis result or retain an outdated plan. Clear all downstream state.
    setPlan(null);
    setPlanError(null);
    setAnalysisData(null);
    setVerificationData(null);
    setAnalysisError(null);
    setCounterfactualData(null);
    setActiveProofMode('original');
    setShowReplay(false);
    setShowCalcInspector(false);
  };

  const handlePlan = async (queryText) => {
    const textToPlan = queryText || question;
    if (!datasetId || !textToPlan.trim()) return;

    setIsPlanning(true);
    setPlanError(null);
    setAnalysisData(null);
    setVerificationData(null);
    setAnalysisError(null);
    setCounterfactualData(null);
    setActiveProofMode('original');
    setShowReplay(false);
    setShowCalcInspector(false);

    try {
      const planRes = await planQuestion(datasetId, textToPlan);
      setPlan(planRes);
    } catch (err) {
      setPlanError(err.message || 'Failed to generate plan.');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleSelectCandidate = (candidateCol) => {
    const refinedQuery = `${question} for ${candidateCol}`.trim();
    setQuestion(refinedQuery);
    handlePlan(refinedQuery);
  };

  const handleRunAnalysis = async () => {
    if (!plan || plan.status !== 'ready' || plan.clarification_required) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisData(null);
    setVerificationData(null);
    setCounterfactualData(null);
    setActiveProofMode('original');
    setShowReplay(false);
    setShowCalcInspector(false);

    try {
      // Step A: POST /analyze
      const analysisPayload = {
        dataset_id: plan.dataset_id || datasetId,
        operation: plan.operation,
        column: plan.column,
        group_by: plan.group_by || null,
      };

      const analysisRes = await analyzeDataset(analysisPayload);
      setAnalysisData(analysisRes);

      // Step B: POST /verify (using analysisRes.proof)
      if (analysisRes && analysisRes.proof) {
        try {
          const verifyRes = await verifyProof(analysisRes.proof);
          setVerificationData(verifyRes);
        } catch (verifyErr) {
          setVerificationData({
            verified: false,
            verification_status: 'failed',
            verification_method: 'deterministic_internal_consistency',
            message: verifyErr.message || 'Verification check failed to complete.',
            checks_performed: [],
          });
        }
      }
    } catch (err) {
      setAnalysisError(err.message || 'Failed to execute deterministic analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const overallStatus = uploadData?.data_quality?.overall_status || null;
  const isVerified = Boolean(
    verificationData &&
    (verificationData.verified === true ||
      verificationData.verification_status === 'passed' ||
      verificationData.status === 'VERIFIED')
  );

  const currentProof = (activeProofMode === 'counterfactual' && counterfactualData?.counterfactual_proof)
    ? counterfactualData.counterfactual_proof
    : analysisData?.proof;

  const currentResult = (activeProofMode === 'counterfactual' && counterfactualData)
    ? counterfactualData.counterfactual_result
    : analysisData?.result;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        hasDataset={Boolean(datasetId)}
        hasPlan={Boolean(plan && !plan.clarification_required)}
        hasResult={Boolean(analysisData)}
        isVerified={isVerified}
      />

      {/* Main Workspace */}
      <main className="main-content">
        <Header
          filename={filename}
          datasetId={datasetId}
          overallStatus={overallStatus}
          isVerified={isVerified}
        />

        {currentView === 'settings' ? (
          <SettingsView
            filename={filename}
            datasetId={datasetId}
            onReset={handleReset}
            onBackToWorkspace={() => setCurrentView('workspace')}
          />
        ) : (
          <div className="workspace-body">
            {/* Workspace Hero */}
          <section className="hero-section">
            <div className="hero-pill">
              <Sparkles size={13} color="#38bdf8" />
              <span>Verifiable Analytics Workspace</span>
            </div>
            <h1 className="hero-title">
              Ask your data. Get an answer you can verify.
            </h1>
            <p className="hero-subtitle">
              Every mathematical operation is deterministically planned, computed with zero heuristics, and accompanied by formal evidence you can inspect and verify.
            </p>
          </section>

          {/* 1. Dataset Ingestion */}
          <div id="dataset">
            <DatasetUpload
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadedFile={filename}
              datasetId={datasetId}
              error={uploadError}
              onReset={handleReset}
            />
          </div>

          {/* 2. Dataset Health & Schema Summary (if loaded) */}
          {uploadData && (
            <DatasetSummary uploadData={uploadData} previewData={previewData} />
          )}

          {/* 3. Ask Your Data — Command Center */}
          <div id="workspace">
            <QuestionPlanner
              question={question}
              setQuestion={handleQuestionChange}
              onPlan={handlePlan}
              isPlanning={isPlanning}
              hasDataset={Boolean(datasetId)}
              uploadData={uploadData}
              error={planError}
            />
          </div>

          {/* Real-time Pipeline Visualizer */}
          <PipelineProgress
            hasDataset={Boolean(datasetId)}
            isPlanning={isPlanning}
            hasPlan={Boolean(plan && !plan.clarification_required)}
            planFailed={Boolean(planError)}
            isAnalyzing={isAnalyzing}
            hasResult={Boolean(analysisData)}
            analysisFailed={Boolean(analysisError)}
            hasProof={Boolean(analysisData?.proof)}
            isVerified={isVerified}
            verificationFailed={Boolean(verificationData && !isVerified)}
          />

          {/* Plan Error Callout */}
          {planError && (
            <div className="error-callout-box">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Planner Error: </strong>
                <span>{planError}</span>
              </div>
            </div>
          )}

          {/* 4. Validated Analysis Plan Card */}
          {plan && (
            <div id="plan">
              <PlanCard
                plan={plan}
                onSelectCandidate={handleSelectCandidate}
                onRunAnalysis={handleRunAnalysis}
                isAnalyzing={isAnalyzing}
                hasExecuted={Boolean(analysisData)}
              />
            </div>
          )}

          {/* Analysis Error Callout */}
          {analysisError && (
            <div className="error-callout-box">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Analysis Execution Error: </strong>
                <span>{analysisError}</span>
              </div>
            </div>
          )}

          {/* 5. Centerpiece Analysis Result */}
          {analysisData && (
            <div id="result">
              <AnalysisResult
                analysisData={analysisData}
                isVerified={isVerified}
                datasetId={datasetId}
                previewData={previewData}
                uploadData={uploadData}
                onCounterfactualChange={(cf) => {
                  setCounterfactualData(cf);
                  if (!cf) {
                    setActiveProofMode('original');
                  }
                }}
                onViewCounterfactualProof={(cf) => {
                  setCounterfactualData(cf);
                  setActiveProofMode('counterfactual');
                  const el = document.getElementById('proof');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                onViewCounterfactualCode={(cf) => {
                  setCounterfactualData(cf);
                  setActiveProofMode('counterfactual');
                  setCalcInspectorTab('code');
                  setShowCalcInspector(true);
                }}
              />
            </div>
          )}

          {/* 6. ⭐ Proof Explorer: WHY THIS RESULT? */}
          {analysisData && currentProof && (
            <div id="proof" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {counterfactualData && (
                <div className="proof-selector-bar">
                  <button
                    type="button"
                    className={`btn-proof-tab ${activeProofMode === 'original' ? 'active' : ''}`}
                    onClick={() => setActiveProofMode('original')}
                  >
                    Original Verified Proof (Baseline)
                  </button>
                  <button
                    type="button"
                    className={`btn-proof-tab ${activeProofMode === 'counterfactual' ? 'active' : ''}`}
                    onClick={() => setActiveProofMode('counterfactual')}
                  >
                    What-If Counterfactual Proof (Exclude &quot;{counterfactualData.condition?.excluded_value}&quot;)
                  </button>
                </div>
              )}

              <ProofExplorer
                proof={currentProof}
                result={currentResult}
                operation={analysisData.operation}
                column={analysisData.column}
                group_by={analysisData.group_by}
                onReplay={() => setShowReplay(true)}
                onViewCalculation={() => {
                  setCalcInspectorTab('trace');
                  setShowCalcInspector(true);
                }}
                onViewVerificationCode={() => {
                  setCalcInspectorTab('code');
                  setShowCalcInspector(true);
                }}
                isVerified={activeProofMode === 'counterfactual' ? true : isVerified}
              />
            </div>
          )}

          {/* 7. Formal Verification Card */}
          {verificationData && (
            <VerificationCard verificationData={verificationData} />
          )}
        </div>
      )}
      </main>

      {/* Replay Proof Modal */}
      {showReplay && currentProof && (
        <ReplayProof
          proof={currentProof}
          result={currentResult}
          operation={analysisData?.operation}
          column={analysisData?.column}
          onClose={() => setShowReplay(false)}
        />
      )}

      {/* Calculation & Verification Code Inspector Modal */}
      {showCalcInspector && currentProof && (
        <CalculationInspector
          proof={currentProof}
          result={currentResult}
          operation={analysisData?.operation}
          column={analysisData?.column}
          group_by={analysisData?.group_by}
          filename={filename}
          initialTab={calcInspectorTab}
          onClose={() => setShowCalcInspector(false)}
        />
      )}
    </div>
  );
}
