/**
 * Deterministic API Service Layer.
 * Communicates with the FastAPI backend through the Vite proxy.
 */

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string'
          ? errorJson.detail
          : JSON.stringify(errorJson.detail);
      }
    } catch {
      // Fallback to text or default
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

/**
 * Upload a CSV dataset to the backend.
 * Returns dataset_id, profile, and data-quality assessment.
 * @param {File} file
 */
export async function uploadDataset(file) {
  if (!file) {
    throw new Error('Please select a CSV file to upload.');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the backend server at http://127.0.0.1:8000. Please verify the backend is running.');
    }
    throw err;
  }
}

/**
 * Send a natural-language query to the planner layer.
 * Returns an AnalysisPlan blueprint.
 * @param {string} datasetId
 * @param {string} question
 */
export async function planQuestion(datasetId, question) {
  if (!datasetId || !datasetId.trim()) {
    throw new Error('A valid dataset_id is required to plan a question.');
  }
  if (!question || !question.trim()) {
    throw new Error('Please enter a question to analyze.');
  }

  try {
    const res = await fetch('/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataset_id: datasetId.trim(),
        question: question.trim(),
      }),
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the backend server at http://127.0.0.1:8000. Please verify the backend is running.');
    }
    throw err;
  }
}

/**
 * Execute deterministic mathematical analysis on the backend.
 * Returns analysis result, evidence, formal proof, and optional group mapping.
 * @param {Object} analysisRequest - { dataset_id, operation, column, group_by }
 */
export async function analyzeDataset(analysisRequest) {
  if (!analysisRequest || !analysisRequest.dataset_id || !analysisRequest.operation || !analysisRequest.column) {
    throw new Error('Invalid analysis request: dataset_id, operation, and column are required.');
  }

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysisRequest),
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the backend server at http://127.0.0.1:8000. Please verify the backend is running.');
    }
    throw err;
  }
}

/**
 * Verify the formal proof with the backend verification engine.
 * Validates internal mathematical and structural consistency.
 * @param {Object} proof - AnalysisProof object
 */
export async function verifyProof(proof) {
  if (!proof) {
    throw new Error('A proof object is required for verification.');
  }

  try {
    const res = await fetch('/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof: proof,
      }),
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the backend server at http://127.0.0.1:8000. Please verify the backend is running.');
    }
    throw err;
  }
}

/**
 * Execute deterministic counterfactual / what-if analysis on the backend.
 * Re-runs deterministic analysis on a filtered copy, returns baseline vs counterfactual proof and difference.
 * @param {Object} payload - { dataset_id, operation, column, group_by, exclude_column, exclude_value }
 */
export async function analyzeCounterfactual(payload) {
  if (!payload || !payload.dataset_id || !payload.operation || !payload.column || !payload.exclude_column || !payload.exclude_value) {
    throw new Error('Invalid counterfactual request: dataset_id, operation, column, exclude_column, and exclude_value are required.');
  }

  try {
    const res = await fetch('/analyze/counterfactual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await handleResponse(res);
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to the backend server at http://127.0.0.1:8000. Please verify the backend is running.');
    }
    throw err;
  }
}
