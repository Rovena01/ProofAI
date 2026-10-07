import React, { useMemo } from 'react';
import { Search, Sparkles, Loader2, ArrowRight, CornerDownLeft, HelpCircle } from 'lucide-react';

export default function QuestionPlanner({
  question,
  setQuestion,
  onPlan,
  isPlanning,
  hasDataset,
  uploadData,
  error
}) {
  // Derive smart suggestion chips from actual dataset columns if loaded
  const suggestions = useMemo(() => {
    if (!uploadData || !uploadData.profile || !uploadData.profile.column_details) {
      return [
        'Total revenue',
        'Average revenue by product',
        'Highest revenue product',
        'Count of sales by product',
      ];
    }

    const columns = uploadData.profile.column_details;
    const numericCols = columns.filter(
      (c) => c.semantic_type === 'numeric' || c.dtype.includes('int') || c.dtype.includes('float')
    );
    const catCols = columns.filter(
      (c) => c.semantic_type === 'categorical' || c.semantic_type === 'text'
    );

    const primaryNum = numericCols[0]?.name || 'revenue';
    const primaryCat = catCols[0]?.name || 'product';

    const chips = [
      `Total ${primaryNum}`,
      `Average ${primaryNum} by ${primaryCat}`,
      `Highest ${primaryNum} by ${primaryCat}`,
      `Count by ${primaryCat}`,
    ];

    return chips;
  }, [uploadData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || isPlanning || !hasDataset) return;
    onPlan(question);
  };

  const handleChipClick = (q) => {
    setQuestion(q);
  };

  return (
    <section className="panel-card command-center-card">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle command-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '18px', letterSpacing: '-0.01em' }}>
              ASK YOUR DATA
            </div>
            <div className="panel-subtitle">
              Convert natural language questions into verified, deterministic mathematical plans
            </div>
          </div>
        </div>

        {hasDataset && (
          <span className="command-ready-badge">
            <span className="pulse-dot-cyan" />
            <span>Schema Linked</span>
          </span>
        )}
      </div>

      <div className="command-body">
        <form onSubmit={handleSubmit} className="command-form">
          <div className="command-input-container">
            <Search size={18} className="command-search-icon" />
            <input
              type="text"
              className="command-text-input"
              placeholder={
                hasDataset
                  ? "What would you like to know about this dataset? (e.g. 'What is the total revenue by product?')"
                  : "Upload a dataset above to start asking questions..."
              }
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!hasDataset || isPlanning}
            />
            <button
              type="submit"
              className="btn-command-submit"
              disabled={!hasDataset || !question.trim() || isPlanning}
            >
              {isPlanning ? (
                <>
                  <Loader2 size={16} className="spinner-icon" />
                  <span>Planning...</span>
                </>
              ) : (
                <>
                  <span>Plan Query</span>
                  <CornerDownLeft size={14} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggestion Chips */}
        <div className="suggestion-chips-bar">
          <span className="suggestion-label">Suggested Inquiries:</span>
          <div className="suggestion-list">
            {suggestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="btn-suggestion-chip"
                onClick={() => handleChipClick(q)}
                disabled={!hasDataset || isPlanning}
              >
                <span>{q}</span>
                <ArrowRight size={11} className="chip-arrow" />
              </button>
            ))}
          </div>
        </div>

        {/* Empty state nudge if no dataset */}
        {!hasDataset && (
          <div className="command-empty-notice">
            <HelpCircle size={15} color="#38bdf8" />
            <span>Upload a CSV above. Once uploaded, questions are deterministically translated into mathematical execution plans.</span>
          </div>
        )}
      </div>
    </section>
  );
}
