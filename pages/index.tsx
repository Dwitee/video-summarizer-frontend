import { useVideoSummarizer } from '../hooks/useVideoSummarizer';
import Link from 'next/link';

export default function Home() {
  const { summaries } = useVideoSummarizer();

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-start justify-start">
      <header className="w-full bg-gray-900 py-4 text-center aphasia-style">
        <h1 className="text-4xl font-bold">Video Summarizer</h1>
      </header>

      <main className="aphasia-style p-4 w-full">
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