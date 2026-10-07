import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DatasetUpload({
  onUpload,
  isUploading,
  uploadedFile,
  datasetId,
  error,
  onReset
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientError, setClientError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelection = (file) => {
    setClientError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setClientError('Invalid file format: Please select a comma-separated CSV (.csv) file.');
      return;
    }

    onUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  return (
    <section className="panel-card upload-panel">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-circle upload-accent">
            <UploadCloud size={18} />
          </div>
          <div>
            <div className="panel-title">1. Dataset Ingestion</div>
            <div className="panel-subtitle">Upload a tabular CSV dataset to audit schema and inspect quality</div>
          </div>
        </div>

        {uploadedFile && (
          <button
            type="button"
            className="btn-browse-compact"
            onClick={onReset}
          >
            <RefreshCw size={12} />
            <span>Replace CSV</span>
          </button>
        )}
      </div>

      {(clientError || error) && (
        <div className="error-callout-box">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Upload Error</div>
            <div>{clientError || error}</div>
          </div>
        </div>
      )}

      {uploadedFile ? (
        <div className="file-confirmed-bar">
          <div className="file-info-group">
            <div className="file-icon-square">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="file-name-text">{uploadedFile}</div>
              <div className="file-id-subtext">Dataset ID: {datasetId}</div>
            </div>
          </div>
          <div className="file-status-badge">
            <CheckCircle2 size={16} />
            <span>Audited & Stored</span>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone-container ${isDragOver ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept=".csv"
            style={{ display: 'none' }}
          />

          <div className="dropzone-icon-box">
            {isUploading ? (
              <Loader2 size={24} className="spinner-icon" />
            ) : (
              <UploadCloud size={24} />
            )}
          </div>

          <div>
            <div className="dropzone-heading">
              {isUploading ? 'Uploading and auditing dataset...' : 'Drag & drop your CSV file here'}
            </div>
            <div className="dropzone-subtext">
              {isUploading
                ? 'Profiling rows, verifying data quality, and checking for missing/infinite values.'
                : 'Supports comma-delimited tabular datasets (.csv up to 50MB)'}
            </div>
          </div>

          {!isUploading && (
            <button
              type="button"
              className="btn-browse"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Browse Local Files</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
