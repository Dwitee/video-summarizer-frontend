import { useState, useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/umd/vis-network.min.js';
import { useVideoSummarizer } from '../hooks/useVideoSummarizer';
import { FLASK_BACKEND_SAVE_SUMMARY } from '../lib/config';
import { title } from 'process';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string>('');
  const { videoRef, summaries, summarize } = useVideoSummarizer();
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const selectedSummary = summaries.find(s => s.id === selectedSummaryId);

  // vis-network ref
  const visRef = useRef<HTMLDivElement>(null);

  const [playerScale, setPlayerScale] = useState(1);

  // Handle video file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] handleFileChange: file selected', e.target.files?.[0]?.name);
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setVideoURL(URL.createObjectURL(selected));
  };
  useEffect(() => {
    if (videoURL) {
      console.log('[DEBUG] videoURL updated:', videoURL);
    }
  }, [videoURL]);

useEffect(() => {
  if (summaries.length) {
    const last = summaries[summaries.length - 1];
    console.log('[DEBUG] New summary entry:', last.id, last.title);
    setSelectedSummaryId(last.id);
    setVideoURL(last.videoUrl);
  }
}, [summaries]);

  useEffect(() => {
    if (selectedSummary?.mindmapJson && visRef.current) {
      const nodes: Array<{ id: string; label: string; shape: string; color: string }> = [];
      const edges: Array<{ from: string; to: string; arrows: string }> = [];
      const mindmap = selectedSummary.mindmapJson;
      // central node
      nodes.push({
        id: 'central',
        label: mindmap.central.label,
        shape: 'box',
        color: 'mediumpurple',
      });
      // branches and points
      mindmap.branches.forEach((branch: any, i: number) => {
        const branchId = `branch_${i}`;
        nodes.push({
          id: branchId,
          label: branch.label,
          shape: 'ellipse',
          color: ['deeppink', 'tomato', 'orange', 'limegreen', 'deepskyblue'][i % 5],
        });
        edges.push({ from: 'central', to: branchId, arrows: 'to' });
        branch.points.forEach((pt: any, j: number) => {
          const pointId = `${branchId}_point_${j}`;
          nodes.push({
            id: pointId,
            label: pt.label,
            shape: 'ellipse',
            color: 'lightyellow',
          });
          edges.push({ from: branchId, to: pointId, arrows: 'to' });
        });
      });
      new Network(visRef.current, { nodes, edges }, {
        edges: { smooth: { enabled: true, type: 'curvedCW', roundness: 0.4 } },
        physics: { barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 95 }, minVelocity: 0.75 },
      });
      (async () => {
        try {
          await fetch(FLASK_BACKEND_SAVE_SUMMARY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selectedSummary.id,
              title: selectedSummary.title,
              thumbnailUrl: selectedSummary.thumbnailUrl,
              videoUrl: selectedSummary.videoUrl,
              summaryJson: selectedSummary.summaryJson,
              mindmapJson: selectedSummary.mindmapJson
            }),
          });
        } catch (error) {
          console.error('[DEBUG] saveSummary mindmap error in index:', error);
        }
      })();
    }
  }, [selectedSummary]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const thresh = 300; // px over which to shrink
      const scale = Math.max(0.5, 1 - scrollY / thresh);
      setPlayerScale(scale);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSummarizeClick = () => {
    console.log('[DEBUG] handleSummarizeClick: invoking summarize for', file?.name);
    if (file) {
      summarize(file, file.name);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-start justify-start">
      <header className="w-full bg-gray-900 py-4 text-center aphasia-style">
        <h1 className="text-4xl font-bold">Video Summarizer</h1>
        <div className="mt-2">
          <label
            htmlFor="file-input"
            className="px-4 py-2 bg-red-600 text-white rounded cursor-pointer"
          >
            Upload Video
          </label>
          <input
            id="file-input"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </header>

      <main className="aphasia-style flex flex-col items-start p-4 space-y-4 w-full">
        <div className="flex flex-col lg:flex-row w-full justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col flex-grow items-start">
            {videoURL && (
              <>
                <div
                  className="bg-black rounded-lg overflow-hidden"
                  style={{
                    width: `${1080 * playerScale * 0.75}px`,
                    height: `${720 * playerScale * 0.75}px`,
                    position: playerScale <= 0.5 ? 'sticky' : 'relative',
                    top: playerScale <= 0.5 ? 0 : 'auto',
                    transition: 'width 0.1s, height 0.1s'
                  }}
                >
                  <video
                    ref={videoRef}
                    src={videoURL}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex justify-center mt-4">
                  <button
                    onClick={async () => {
                      if (!file) return;
                      // Check cache: use existing summary if available
                      const cached = summaries.find(s => s.title === file.name);
                      if (cached) {
                        console.log('[DEBUG] summarize: using cached summary for title', file.name);
                        setSelectedSummaryId(cached.id);
                        setVideoURL(cached.videoUrl);
                      } else {
                        await summarize(file, file.name);
                      }
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded"
                  >
                    Summarize
                  </button>
                </div>
              </>
            )}

            {selectedSummary && (
              <div>
                <div className="mt-6 w-full p-6 bg-gray-800 rounded-lg">
                  <h2 className="text-2xl font-semibold aphasia-style mb-2">Summary</h2>
                  {selectedSummary.summaryJson ? (
                    <div className="space-y-4 aphasia-style">
                      {selectedSummary.summaryJson.map((chapter, idx) => (
                        <section key={idx} className="bg-gray-700 p-4 rounded">
                          <h3 className="text-xl font-bold mb-1">{chapter.chapterTitle}</h3>
                          <p className="text-base">{chapter.chapterSummary}</p>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="aphasia-style whitespace-pre-wrap">{selectedSummary.summaryText}</p>
                  )}
                </div>
                {selectedSummary.mindmapJson && (
                  <div className="mt-6 w-full p-6 bg-gray-800 rounded-lg">
                    <h2 className="text-2xl font-semibold aphasia-style mb-2">Mind Map</h2>
                    <div ref={visRef} style={{ height: '600px', width: '100%' }} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-none lg:w-80">
            <aside className="space-y-4">
              <h2 className="text-xl font-semibold aphasia-style mb-2">Summarized Video</h2>
              {summaries.length === 0 ? (
                <p className="text-gray-500">No summaries yet.</p>
              ) : (
                summaries.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSummaryId(s.id);
                      setVideoURL(s.videoUrl);
                    }}
                    className="cursor-pointer flex items-center space-x-2 bg-gray-800 p-2 rounded mb-2"
                  >
                    <img
                      src={s.thumbnailUrl}
                      alt={s.title}
                      className="w-16 h-10 object-cover rounded"
                    />
                    <div>
                      <p className="text-sm aphasia-style">{s.title}</p>
                      <p className="text-xs aphasia-style mt-1 text-green-400">Summarized</p>
                    </div>
                  </div>
                ))
              )}
            </aside>
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full py-4 text-center aphasia-style text-sm bg-gray-900">
        © Dwitee Krishna Panda [MIT license]
      </footer>
    </div>
  );
}