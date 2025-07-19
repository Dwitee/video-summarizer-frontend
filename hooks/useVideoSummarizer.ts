// hooks/useVideoSummarizer.ts
import { useState, useRef, useEffect } from 'react';
import { captureThumbnail, generateMindmapFromSummary, uploadThumbnail, uploadVideoFile } from '../lib/summarizer';
import { v4 as uuidv4 } from 'uuid';
import { FLASK_JOB_SUBMIT, FLASK_JOB_RESULT } from '../lib/config';
import { FLASK_BACKEND_SAVE_SUMMARY, FLASK_BACKEND_LIST_SUMMARIES } from '../lib/config';
import { FLASK_BACKEND_SUBMIT_VIDEO } from '../lib/config';

// Supported model types for summarization
export enum ModelType {
  T5Small = 't5-small',
  Gemini = 'gemini'
}

// Helper: submit MP3 job, return job ID
async function submitAudioJob(
  audio: Blob,
  filename: string,
  modelType: ModelType = ModelType.T5Small
): Promise<string> {
  console.log('[DEBUG] submitAudioJob: URL=', FLASK_JOB_SUBMIT, 'filename=', filename, 'modelType=', modelType);
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model_name', modelType);
  let res: Response;
  try {
    res = await fetch(FLASK_JOB_SUBMIT, { method: 'POST', body: form });
    console.log('[DEBUG] submitAudioJob: HTTP status', res.status);
  } catch (networkError) {
    console.error('[DEBUG] submitAudioJob: network error', networkError);
    throw networkError;
  }
  if (!res.ok) throw new Error(`Submit job failed: ${res.status}`);
  const json = await res.json();
  return json.job_id;
}

/**
 * Send video metadata (id, title, thumbnailUrl, videoUrl) to backend.
 */
async function submitVideoJob(payload: {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
}): Promise<string> {
  console.log('[DEBUG] submitVideoJob: URL=', FLASK_BACKEND_SUBMIT_VIDEO, 'payload=', payload);
  const res = await fetch(FLASK_BACKEND_SUBMIT_VIDEO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log('[DEBUG] submitVideoJob: status', res.status);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit video failed: ${res.status} ${res.statusText}: ${text}`);
  }
  const json = await res.json();
  console.log('[DEBUG] submitVideoJob: received job_id', json.job_id);
  return json.job_id;
}

// Helper: poll job result until summary is ready
async function pollJobResult(jobId: string, maxWait = 600000, interval = 10000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, interval));
    console.log('[DEBUG] pollJobResult: polling URL=', `${FLASK_JOB_RESULT}${jobId}`);
    const res = await fetch(`${FLASK_JOB_RESULT}${jobId}`);
    console.log('[DEBUG] pollJobResult: status', res.status);
    if (!res.ok) throw new Error(`Poll job failed: ${res.status}`);
    const json = await res.json();
    if (json.summary) return json.summary;
    if (json.status !== 'processing') return `Unexpected response: ${JSON.stringify(json)}`;
  }
  return 'Error: Summary not available in time.';
}

// Represents each summarized video entry
interface SummaryEntry {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  summaryText?: string;
  summaryJson?: Array<{ chapterTitle: string; chapterSummary: string }>;
  mindmapJson?: any;
}

export function useVideoSummarizer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [summaries, setSummaries] = useState<SummaryEntry[]>([]);

  // On hook initialization, fetch any previously saved summaries
  useEffect(() => {
    (async () => {
      try {
        console.log('[DEBUG] loadSummaries: fetching saved entries');
        const res = await fetch(FLASK_BACKEND_LIST_SUMMARIES);
        const text = await res.text();
        if (!res.ok) {
          console.error('[DEBUG] loadSummaries error status:', res.status, text);
          setSummaries([]);
          return;
        }
        let saved: SummaryEntry[];
        try {
          saved = JSON.parse(text) as SummaryEntry[];
        } catch (jsonErr) {
          console.error('[DEBUG] loadSummaries: invalid JSON', text, jsonErr);
          saved = [];
        }
        console.log('[DEBUG] loadSummaries: received', saved);
        setSummaries(saved);
      } catch (e) {
        console.error('[DEBUG] loadSummaries error:', e);
      }
    })();
  }, []);

  const summarize = async (
    file: File,
    title: string,
    modelType: ModelType = ModelType.Gemini
  ) => {
    if (!videoRef.current) return;
    const id = uuidv4();
    const thumbnailDataUrl = await captureThumbnail(videoRef.current);
    const thumbBlob = await (await fetch(thumbnailDataUrl)).blob();
    const thumbnailUrl = await uploadThumbnail(id, thumbBlob);
    console.log('[DEBUG] uploadThumbnail succeeded:', thumbnailUrl);
    const videoUrl = await uploadVideoFile(id, file);
    console.log('[DEBUG] uploadVideoFile succeeded:', videoUrl);
    console.log('[DEBUG] submitVideoJob payload:', { id, title, thumbnailUrl, videoUrl });
    const videoJobId = await submitVideoJob({ id, title, thumbnailUrl, videoUrl });
    
    // Local holders for final metadata
    let finalSummaryText: string = 'Generating...';
    let finalSummaryJson: Array<{ chapterTitle: string; chapterSummary: string }> | undefined = undefined;
    let finalMindmapJson: any = undefined;

    // Optimistically add placeholder to UI
    setSummaries(prev => [
      ...prev,
      { id, title, thumbnailUrl, videoUrl, summaryText: finalSummaryText }
    ]);

    // Poll the video‐processing job for summary text
    try {
      console.log('[DEBUG] summarize: polling result for video job', videoJobId);
      const raw = await pollJobResult(videoJobId);
      console.log('[DEBUG] useVideoSummarizer: received video summary', raw);
      // Format the raw summary just like we did for audio
      let formatted: string;
      if (modelType === ModelType.Gemini) {
        // parse JSON for Gemini‐style summary
        const jsonData = JSON.parse(raw) as Array<{ chapterTitle: string; chapterSummary: string }>;
        const summaryTextString = jsonData
          .map(item => `${item.chapterTitle}: ${item.chapterSummary.trim()}`)
          .join('\n\n');
        finalSummaryText = summaryTextString;
        finalSummaryJson = jsonData;
        setSummaries(prev =>
          prev.map(e =>
            e.id === id
              ? { ...e, summaryText: summaryTextString, summaryJson: jsonData }
              : e
          )
        );
        // generate mindmap
        try {
          console.log('[DEBUG] summarize: generating mindmap for id', id);
          const mindmap = await generateMindmapFromSummary(summaryTextString, modelType);
          finalMindmapJson = mindmap;
          setSummaries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, mindmapJson: mindmap } : e
            )
          );
        } catch (e) {
          console.error('[DEBUG] generateMindmapFromSummary error:', e);
        }
      } else {
        formatted = raw
          .split('. ')
          .map((line: string) => `• ${line.trim()}`)
          .join('\n');
        finalSummaryText = formatted;
        finalSummaryJson = undefined;
        setSummaries(prev =>
          prev.map(e =>
            e.id === id ? { ...e, summaryText: formatted, summaryJson: undefined } : e
          )
        );
        // generate mindmap
        try {
          console.log('[DEBUG] summarize: generating mindmap for id', id);
          const mindmap = await generateMindmapFromSummary(formatted, modelType);
          finalMindmapJson = mindmap;
          setSummaries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, mindmapJson: mindmap } : e
            )
          );
        } catch (e) {
          console.error('[DEBUG] generateMindmapFromSummary error:', e);
        }
      }
    } catch (err) {
      console.error('[DEBUG] useVideoSummarizer: error', err);
      setSummaries(prev =>
        prev.map(e => (e.id === id ? { ...e, summaryText: 'Error generating summary' } : e))
      );
    }

    // Persist full metadata after summary and mindmap are ready
    try {
      const fullEntry = {
        id,
        title,
        thumbnailUrl,
        videoUrl,
        summaryText: finalSummaryText,
        summaryJson: finalSummaryJson,
        mindmapJson: finalMindmapJson,
      };
      console.log('[DEBUG] saveSummary: saving full entry', fullEntry);
      const saveRes = await fetch(FLASK_BACKEND_SAVE_SUMMARY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEntry),
      });
      if (!saveRes.ok) throw new Error(`Save full entry failed: ${saveRes.status}`);
      console.log('[DEBUG] saveSummary: full entry saved successfully for id', id);
    } catch (saveErr) {
      console.error('[DEBUG] saveSummary full entry error:', saveErr);
    }
  };

  return { videoRef, summaries, summarize };
}