// lib/summarizer.ts
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { FLASK_BACKEND_UPLOAD, FLASK_BACKEND_GENERATE_MINDMAP } from './config';

const ffmpeg = createFFmpeg({ log: true, corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js' });

export async function extractAudio(file: File, filename: string): Promise<Blob> {
  console.log(`[DEBUG] extractAudio: starting audio extraction for file "${filename}"`);
  console.log(`[DEBUG] extractAudio: ffmpeg.isLoaded = ${ffmpeg.isLoaded()}`);
  if (!ffmpeg.isLoaded()) await ffmpeg.load();
  console.log('[DEBUG] extractAudio: ffmpeg loaded');
  console.log(`[DEBUG] extractAudio: writing "${filename}" to FFmpeg FS`);
  await ffmpeg.FS('writeFile', filename, await fetchFile(file));
  console.log('[DEBUG] extractAudio: running ffmpeg command to extract audio');
  await ffmpeg.run('-i', filename, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', 'out.mp3');
  console.log('[DEBUG] extractAudio: ffmpeg.run completed');
  const data = ffmpeg.FS('readFile', 'out.mp3');
  console.log(`[DEBUG] extractAudio: read ${data.length} bytes of output data`);
  console.log('[DEBUG] extractAudio: cleaning up FFmpeg FS');
  ffmpeg.FS('unlink', filename);
  ffmpeg.FS('unlink', 'out.mp3');
  const blob = new Blob([data.buffer], { type: 'audio/mp3' });
  console.log(`[DEBUG] extractAudio: returning Blob of size ${blob.size}`);
  return blob;
}

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