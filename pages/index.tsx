// pages/index.tsx
import { useState, useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/umd/vis-network.min.js';
import { useVideoSummarizer } from '../hooks/useVideoSummarizer';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string>('');
  const { videoRef, summaries, summarize } = useVideoSummarizer();

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
    }
  }, [summaries]);

  useEffect(() => {
    const nodes: Array<{ id: string; label: string; shape: string; color: string }> = [];
    const edges: Array<{ from: string; to: string; arrows: string }> = [];
    const last = summaries[summaries.length - 1];
    if (last?.mindmapJson && visRef.current) {
      console.log('[DEBUG] rendering mindmap:', last.mindmapJson);
      // central node
      nodes.push({
        id: 'central',
        label: last.mindmapJson.central.label,
        shape: 'box',
        color: 'mediumpurple'
      });
      // branches
      last.mindmapJson.branches.forEach((branch: any, i: number) => {
        const branchId = `branch_${i}`;
        nodes.push({
          id: branchId,
          label: branch.label,
          shape: 'ellipse',
          color: ['deeppink','tomato','orange','limegreen','deepskyblue'][i % 5]
        });
        edges.push({ from: 'central', to: branchId, arrows: 'to' });
        // points
        branch.points.forEach((pt: any, j: number) => {
          const pointId = `${branchId}_point_${j}`;
          nodes.push({
            id: pointId,
            label: pt.label,
            shape: 'ellipse',
            color: 'lightyellow'
          });
          edges.push({ from: branchId, to: pointId, arrows: 'to' });
        });
      });
      new Network(visRef.current, { nodes, edges }, {
        edges: { smooth: { enabled: true, type: 'curvedCW', roundness: 0.4 } },
        physics: { barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 95 }, minVelocity: 0.75 }
      });
    }
  }, [summaries]);

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
    <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center">
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

      <main className="aphasia-style flex flex-col items-center p-4 space-y-4 w-full max-w-[1400px]">
        {videoURL && (
          <div className="flex flex-col lg:flex-row w-full space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Video Section */}
            <div className="flex flex-col items-center">
              <div
                className="bg-black rounded-lg overflow-hidden"
                style={{
                  width: `${1080 * playerScale}px`,
                  height: `${720 * playerScale}px`,
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
                  onClick={handleSummarizeClick}
                  className="px-6 py-2 bg-blue-600 text-white rounded"
                >
                  Summarize
                </button>
              </div>
              {summaries.length > 0 && (
                <div>
                  <div className="mt-6 w-[1080px] max-w-full p-6 bg-gray-800 rounded-lg">
                    <h2 className="text-2xl font-semibold aphasia-style mb-2">
                      Summary
                    </h2>
                    {summaries[summaries.length - 1].summaryJson ? (
                      <div className="space-y-4 aphasia-style">
                        {summaries[summaries.length - 1].summaryJson?.map((chapter, idx) => (
                          <section key={idx} className="bg-gray-700 p-4 rounded">
                            <h3 className="text-xl font-bold mb-1">{chapter.chapterTitle}</h3>
                            <p className="text-base">{chapter.chapterSummary}</p>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="aphasia-style whitespace-pre-wrap">
                        {summaries[summaries.length - 1].summaryText}
                      </p>
                    )}
                  </div>
                  {summaries[summaries.length - 1].mindmapJson && (
                    <div className="mt-6 w-[1080px] max-w-full p-6 bg-gray-800 rounded-lg">
                      <h2 className="text-2xl font-semibold aphasia-style mb-2">
                        Mind Map
                      </h2>
                      <div ref={visRef} style={{ height: '600px', width: '100%' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-80 flex-shrink-0 space-y-4">
              <h2 className="text-xl font-semibold aphasia-style mb-2">
                Summarized Video
              </h2>
              {summaries.map(s => (
                <div
                  key={s.id}
                  className="flex items-center space-x-2 bg-gray-800 p-2 rounded"
                >
                  <img
                    src={s.thumbnail}
                    alt={s.title}
                    className="w-16 h-10 object-cover rounded"
                  />
                  <div>
                    <p className="text-sm aphasia-style">{s.title}</p>
                    <p className="text-xs aphasia-style mt-1 text-green-400">Summarized</p>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}