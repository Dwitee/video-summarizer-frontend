// lib/summarizer.ts
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import {
  FLASK_BACKEND_UPLOAD,
  FLASK_BACKEND_GENERATE_MINDMAP,
  FLASK_BACKEND_UPLOAD_THUMBNAIL,
  FLASK_BACKEND_UPLOAD_VIDEO,
} from './config';

export async function captureThumbnail(videoEl: HTMLVideoElement): Promise<string> {
  console.log('[DEBUG] captureThumbnail: starting thumbnail capture');
  await new Promise<void>(resolve => {
    if (videoEl.readyState >= 2) resolve();
    else videoEl.addEventListener('loadeddata', () => resolve(), { once: true });
  });
  console.log('[DEBUG] captureThumbnail: video data loaded, capturing frame');
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d')!.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const thumbnail = canvas.toDataURL('image/png');
  console.log(`[DEBUG] captureThumbnail: thumbnail data-length ${thumbnail.length}`);
  return thumbnail;
}

export async function submitForSummarization(
  audio: Blob,
  filename: string
): Promise<string> {
  console.log(`[DEBUG] submitForSummarization: preparing FormData for file "${filename}"`);
  const form = new FormData();
  form.append('file', audio, filename.replace(/\.[^/.]+$/, '.mp3'));
  form.append('model_type', 'gemini');
  console.log('[DEBUG] submitForSummarization: sending request to', FLASK_BACKEND_UPLOAD);
  const res = await fetch(FLASK_BACKEND_UPLOAD, { method: 'POST', body: form });
  console.log('[DEBUG] submitForSummarization: received response, status', res.status);
  const json = await res.json();
  console.log('[DEBUG] submitForSummarization: summary returned:', json.summary);
  return json.summary ?? 'No summary returned';
}

/**
 * Sends the summarized text to the backend to generate a mind map.
 * @param summary The summary text.
 * @param modelType The model type to use for mind map generation.
 * @returns The mindmap JSON object.
 */
export async function generateMindmapFromSummary(
  summary: string,
  modelType: string
): Promise<any> {
  console.log(`[DEBUG] generateMindmapFromSummary: sending summary with modelType ${modelType}`);
  try {
    const res = await fetch(FLASK_BACKEND_GENERATE_MINDMAP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, model_type: modelType })
    });
    if (!res.ok) {
      throw new Error(`Mindmap request failed: ${res.status}`);
    }
    const result = await res.json();
    console.log('[DEBUG] generateMindmapFromSummary: mind map received', result);
    return result.mindmap ?? result;
  } catch (e: any) {
    console.error('[DEBUG] generateMindmapFromSummary error:', e);
    throw e;
  }
}

/**
 * Uploads a thumbnail Blob to your backend storage and returns its public URL.
 */
export async function uploadThumbnail(id: string, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, `${id}.png`);
  const res = await fetch(FLASK_BACKEND_UPLOAD_THUMBNAIL, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Thumbnail upload failed: ${res.status} ${res.statusText}: ${text}`);
  }
  const { thumbUrl } = await res.json();
  return thumbUrl;
}

/**
 * Uploads a video File to your backend storage and returns its public URL.
 */
export async function uploadVideoFile(id: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file, `${id}.webm`);
  const res = await fetch(FLASK_BACKEND_UPLOAD_VIDEO, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Video upload failed: ${res.status} ${res.statusText}: ${text}`);
  }
  const { videoUrl } = await res.json();
  return videoUrl;
}