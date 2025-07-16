const EXTERNAL_IP = "34.94.185.123";
const BASE_URL = `https://${EXTERNAL_IP}:8080`;

export const FLASK_BACKEND_UPLOAD = `${BASE_URL}/summarize-upload`;
export const FLASK_JOB_SUBMIT = `${BASE_URL}/submit-job`;
export const FLASK_JOB_RESULT = `${BASE_URL}/job-result/`;
export const MIND_MAP_PATH = `${BASE_URL}/mindmap/`;
export const FLASK_BACKEND_UPLOAD_MINDMAP = `${BASE_URL}/upload-mindmap`;
export const FLASK_BACKEND_GENERATE_MINDMAP = `${BASE_URL}/generate-mindmap`;