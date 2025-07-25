import { useRouter } from 'next/router';
import { v4 as uuidv4 } from 'uuid';
import { useRef } from 'react';
import { useVideoSummarizer } from '../hooks/useVideoSummarizer';
import Link from 'next/link';

export default function Home() {
  const { summaries, summarize } = useVideoSummarizer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-start justify-start">
      <header className="w-full bg-gray-900 py-4 text-center aphasia-style">
        <h1 className="text-4xl font-bold">Video Summarizer</h1>
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
            <p className="text-sm text-gray-400"> Audio & Video</p>
          </div>
          {/* Record card */}
          <div className="w-48 flex flex-col items-center bg-gray-800 p-6 rounded-lg cursor-pointer aphasia-style">
            <span className="text-3xl mb-2">🎤</span>
            <h3 className="text-lg font-medium">Record</h3>
            <p className="text-sm text-gray-400">Record Video or Audio</p>
          </div>
        </div>
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
        © Dwitee Krishna Panda [MIT license]
      </footer>
    </div>
  );
}