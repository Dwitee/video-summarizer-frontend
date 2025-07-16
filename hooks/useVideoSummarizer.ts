// hooks/useVideoSummarizer.ts
import { useState, useRef } from 'react';
import { extractAudio, captureThumbnail, generateMindmapFromSummary } from '../lib/summarizer';
import { v4 as uuidv4 } from 'uuid';
import { FLASK_JOB_SUBMIT, FLASK_JOB_RESULT } from '../lib/config';

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
  thumbnail: string;
  summaryText?: string;
  summaryJson?: Array<{ chapterTitle: string; chapterSummary: string }>;
  mindmapJson?: any;
}

export function useVideoSummarizer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [summaries, setSummaries] = useState<SummaryEntry[]>([]);

  const summarize = async (
    file: File,
    title: string,
    modelType: ModelType = ModelType.Gemini
  ) => {
    if (!videoRef.current) return;
    const id = uuidv4();
    const thumbnail = await captureThumbnail(videoRef.current);
    setSummaries(prev => [
      ...prev,
      { id, title, thumbnail, summaryText: 'Generating...' }
    ]);

    const audio = await extractAudio(file, title);
    try {
      console.log('[DEBUG] summarize: submitting job for id', id);
      console.log('[DEBUG] useVideoSummarizer: submitting audio job');
      const jobId = await submitAudioJob(audio, `${title}.mp3`, modelType); //TODO: lets take this model from ui
      console.log('[DEBUG] useVideoSummarizer: job ID', jobId);
      console.log('[DEBUG] summarize: polling result for job', jobId);
      const raw = await pollJobResult(jobId);
      console.log('[DEBUG] useVideoSummarizer: received summary', raw);
      // Format based on modelType
      let formatted: string;
      if (modelType === ModelType.Gemini) {
        try {
          const jsonData = JSON.parse(raw) as Array<{ chapterTitle: string; chapterSummary: string }>;
          // Build summaryTextString from JSON
          const summaryTextString = jsonData
            .map(item => `${item.chapterTitle}: ${item.chapterSummary.trim()}`)
            .join('\n\n');
          // Store both summaryText and summaryJson in state
          setSummaries(prev =>
            prev.map(e =>
              e.id === id
                ? { ...e, summaryText: summaryTextString, summaryJson: jsonData }
                : e
            )
          );
          // Generate mind map from summaryTextString
          try {
            console.log('[DEBUG] summarize: generating mindmap for id', id);
            const mindmap = await generateMindmapFromSummary(summaryTextString, modelType);
            setSummaries(prev =>
              prev.map(e =>
                e.id === id ? { ...e, mindmapJson: mindmap } : e
              )
            );
          } catch (e) {
            console.error('[DEBUG] generateMindmapFromSummary error:', e);
          }
        } catch (e: any) {
          formatted = `Error parsing Gemini summary: ${e.message}`;
          setSummaries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, summaryText: formatted, summaryJson: undefined } : e
            )
          );
          // Generate mind map from error-formatted summary text
          try {
            console.log('[DEBUG] summarize: generating mindmap for id', id);
            const mindmap = await generateMindmapFromSummary(formatted, modelType);
            setSummaries(prev =>
              prev.map(e =>
                e.id === id ? { ...e, mindmapJson: mindmap } : e
              )
            );
          } catch (err) {
            console.error('[DEBUG] generateMindmapFromSummary error:', err);
          }
        }
      } else {
        formatted = raw
          .split('. ')
          .map((line: string) => `• ${line.trim()}`)
          .join('\n');
        setSummaries(prev =>
          prev.map(e =>
            e.id === id ? { ...e, summaryText: formatted, summaryJson: undefined } : e
          )
        );
        // Generate mind map from formatted summary text
        try {
          console.log('[DEBUG] summarize: generating mindmap for id', id);
          const mindmap = await generateMindmapFromSummary(formatted, modelType);
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
  };

  return { videoRef, summaries, summarize };
}