import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import { useRef, useState, useEffect } from 'react';
import { useVideoSummarizer } from '../hooks/useVideoSummarizer';
import Link from 'next/link';
import { FLASK_BACKEND_DOWNLOAD_YOUTUBE } from '../lib/config';

export default function Home() {
  const { summaries, summarize } = useVideoSummarizer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = uuidv4();
      const url = URL.createObjectURL(file);
      // Navigate to detail page, passing video URL and title via query
      router.push({
        pathname: `/video/${id}`,
        query: { videoUrl: url, title: file.name }
      });
      e.target.value = '';
    }
  };

  const handleStartRecording = async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setStream(mediaStream);
    setShowPreview(true);
    const recorder = new MediaRecorder(mediaStream);
    setMediaRecorder(recorder);
    setRecordedChunks([]);
    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        setRecordedChunks(prev => [...prev, event.data]);
      }
    };
    recorder.start();
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    mediaRecorder?.stop();
    stream?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
    setShowPreview(false);
  };

  useEffect(() => {
    if (!isRecording && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
      const id = uuidv4();
      const url = URL.createObjectURL(file);
      router.push({
        pathname: `/video/${id}`,
        query: { videoUrl: url, title: file.name }
      });
    }
  }, [isRecording, recordedChunks]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-start justify-start">
      <header className="w-full bg-gray-900 py-4 text-center aphasia-style">
        <h1 className="text-4xl font-bold font-sans tracking-tight leading-tight text-white">
          ReMindMap <span className="text-gray-300">(Simplifies the content)</span>
        </h1>
      </header>


      <input
        type="file"
        accept="video/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <main className="aphasia-style p-4 w-full">
        {/* Action cards */}
        <div className="flex justify-center flex-wrap gap-4 mb-6">
          {/* Upload card */}
          <div
            className="w-48 flex flex-col items-center bg-gray-800 p-6 rounded-lg cursor-pointer aphasia-style"
            onClick={handleUploadClick}
          >
            <span className="text-3xl mb-2">⤴️</span>
            <h3 className="text-lg font-medium">Upload</h3>
            <p className="text-sm text-gray-400">Upload Audio & Video to simplify</p>
          </div>
          {/* Record card */}
          <div
            className="w-48 flex flex-col items-center bg-gray-800 p-6 rounded-lg cursor-pointer aphasia-style"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
          >
            <span className="text-3xl mb-2">{isRecording ? '⏹️' : '🔴'}</span>
            <h3 className="text-lg font-medium">{isRecording ? 'Stop' : 'Record'}</h3>
            <p className="text-sm text-gray-400">{isRecording ? 'Stop Recording' : 'Record Video to simplify'}</p>
          </div>
          {/* YouTube URL input card */}
          {/*
          <div className="w-96 flex flex-col items-center bg-gray-800 p-6 rounded-lg aphasia-style">
            <span className="text-3xl mb-2">📺</span>
            <h3 className="text-lg font-medium mb-2">YouTube URL</h3>
            <input
              type="text"
              placeholder="Paste YouTube URL"
              className="text-black w-full p-2 rounded mb-2"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const input = (e.target as HTMLInputElement).value;
                  const isValidYoutubeUrl = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/.test(input);
                  if (!isValidYoutubeUrl) {
                    alert('Invalid YouTube URL');
                    return;
                  }

                  try {
                    const res = await fetch(FLASK_BACKEND_DOWNLOAD_YOUTUBE, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: input })
                    });
                    const data = await res.json();
                    if (data.success && data.videoUrl && data.title && data.id) {
                      router.push({
                        pathname: `/video/${data.id}`,
                        query: { videoUrl: data.videoUrl, title: data.title }
                      });
                    } else {
                      alert('Failed to process video');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('Error processing YouTube URL');
                  }
                }
              }}
            />
            <p className="text-sm text-gray-400 text-center">Press Enter to submit. Only first 7 minutes will be used.</p>
          </div>
          */}
        </div>
        {showPreview && stream && (
          <div className="fixed top-20 right-4 bg-black border border-white p-2 rounded z-50">
            <video
              autoPlay
              muted
              playsInline
              ref={video => {
                if (video && stream) {
                  video.srcObject = stream;
                }
              }}
              className="w-64 h-36 object-cover rounded"
            />
            <p className="text-xs text-center mt-1">Recording Preview</p>
          </div>
        )}
        <h2 className="text-2xl font-semibold aphasia-style mb-4">Summarized Videos</h2>
        {summaries.length === 0 ? (
          <p className="text-gray-500">No summaries yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {summaries.map(s => (
              <Link
                key={s.id}
                href={`/video/${s.id}`}
                className="flex flex-col items-center space-y-2 bg-gray-800 p-4 rounded cursor-pointer"
              >
                <img
                  src={s.thumbnailUrl}
                  alt={s.title}
                  className="w-full h-32 object-cover rounded"
                />
                <p className="text-sm aphasia-style text-center">{s.title}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      {/* Footer */}
      <footer className="w-full py-4 text-center aphasia-style text-sm bg-gray-900">
        © Dwitee Krishna Panda [MIT license]( If the server is inaccessible, it might be in sleep mode to conserve energy. Please feel free to reach out at dwitee@gmail.com for access.)
      </footer>
    </div>
  );
}