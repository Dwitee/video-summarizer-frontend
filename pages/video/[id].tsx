import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network/standalone/umd/vis-network.min.js';
import { useVideoSummarizer } from '../../hooks/useVideoSummarizer';

export default function VideoDetail() {
  const router = useRouter();
  const { id, title: queryTitle } = router.query as { id: string; title?: string };
  // Safely retrieve videoUrl from query (could be array)
  const rawQueryVideoUrl = Array.isArray(router.query.videoUrl)
    ? router.query.videoUrl[0]
    : router.query.videoUrl;
  const [videoSrc, setVideoSrc] = useState<string>(rawQueryVideoUrl || '');
  const { videoRef, summaries, summarize } = useVideoSummarizer();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [radialLayout, setRadialLayout] = useState(false);
  const summary = summaries.find(s => s.id === id);

  // Once router populates the query, update videoSrc
  useEffect(() => {
    if (rawQueryVideoUrl) {
      setVideoSrc(rawQueryVideoUrl);
    }
  }, [rawQueryVideoUrl]);

  const isNew = !!rawQueryVideoUrl && !summary;

  const displayTitle = (queryTitle as string) || summary?.title || '';
  const visRef = useRef<HTMLDivElement>(null);

  const handleSummarize = async () => {
    if (!videoSrc) return;
    setIsSummarizing(true);
    try {
      const blob = await fetch(videoSrc).then(res => res.blob());
      const file = new File([blob], displayTitle || 'video.mp4', { type: blob.type });
      await summarize(file, displayTitle, id as string);
    } finally {
      setIsSummarizing(false);
    }
  };

  // helper to convert "HH:MM:SS" or "MM:SS" into seconds
  const parseTime = (ts: string) => {
    const parts = ts.split(':').map(Number);
    return parts
      .reverse()
      .reduce((acc, val, i) =>
        acc + val * (i === 0 ? 1 : i === 1 ? 60 : 3600),
      0);
  };

  useEffect(() => {
    if (summary?.mindmapJson && visRef.current) {
      // -- Mindmap styling configuration --
      const centralShape = 'box';
      const centralColor = 'mediumpurple';

      const branchShape = radialLayout ? 'box' : 'ellipse';
      const branchColors = radialLayout
        ? ['#2196f3', '#2196f3', '#2196f3', '#2196f3', '#2196f3']
        : ['deeppink', 'tomato', 'orange', 'limegreen', 'deepskyblue'];

      const pointShape = radialLayout ? 'box' : 'ellipse';
      const pointColor = radialLayout ? '#4caf50' : 'lightyellow';


      const nodes: Array<{ id: string; label: string; shape: string; color: string }> = [
        {
          id: 'central',
          label: summary.mindmapJson.central.label,
          shape: centralShape,
          color: centralColor
        }
      ];
      const edges: Array<{ from: string; to: string }> = [];

      summary.mindmapJson.branches.forEach((branch: any, i: number) => {
        const branchId = `branch_${i}`;
        nodes.push({
          id: branchId,
          label: branch.label,
          shape: branchShape,
          color: branchColors[i % branchColors.length]
        });
        edges.push({ from: 'central', to: branchId });

        branch.points.forEach((pt: any, j: number) => {
          const pointId = `${branchId}_point_${j}`;
          nodes.push({
            id: pointId,
            label: pt.label,
            shape: pointShape,
            color: pointColor
          });
          edges.push({ from: branchId, to: pointId });
        });
      });

      const options = {
        edges: {
          color: '#8AB6D6',
          arrows: {
            to: {
              enabled: true,
              type: 'arrow',
              scaleFactor: 0.5
            }
          },
          smooth: {
            enabled: true,
            type: 'curvedCW',
            forceDirection: 'horizontal',
            roundness: 0.2
          }
        },
        physics: {
          barnesHut: {
            gravitationalConstant: -8000,
            centralGravity: 0.3,
            springLength: 95
          },
          minVelocity: 0.75
        },
        layout: radialLayout
          ? {
              hierarchical: {
                enabled: true,
                direction: 'LR',
                sortMethod: 'directed',
                nodeSpacing: 100,
                levelSeparation: 100,
                treeSpacing: 100
              }
            }
          : {},
      };
      new Network(visRef.current, { nodes, edges }, options);
    }
  }, [summary, radialLayout]);

  if (isNew) {
    return (
      <div className="bg-black text-white min-h-screen p-4 aphasia-style">
        <button
          onClick={handleSummarize}
          disabled={isSummarizing}
          className="mb-4 px-4 py-2 bg-blue-600 rounded"
        >
          {isSummarizing ? 'Summarizing...' : 'Summarize'}
        </button>
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc || undefined}
            controls
            className="w-full h-auto"
          />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-black text-white min-h-screen p-4 aphasia-style">
        <p>Summary not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen p-4 aphasia-style">
      <button
        onClick={() => router.back()}
        className="mb-4 px-4 py-2 bg-gray-700 rounded"
      >
        ← Back
      </button>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: video & summary */}
        <div className="flex flex-col flex-shrink-0 w-full lg:w-3/5">
          <div className="bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              src={videoSrc || summary.videoUrl || undefined}
              controls
              className="w-full h-auto"
            />
          </div>
          <div className="bg-gray-800 p-6 rounded-lg mb-4">
            <h2 className="text-2xl font-semibold mb-2">Summary</h2>
            {summary.summaryJson ? (
              <div className="space-y-4 aphasia-style">
                {summary.summaryJson.map((chapter, idx) => {
                  // jump video to chapter time on click
                  const handleJump = () => {
                    if (videoRef.current && chapter.startTime) {
                      const seconds = parseTime(chapter.startTime);
                      videoRef.current.currentTime = seconds;
                      videoRef.current.play();
                    }
                  };

                  return (
                    <section
                      key={idx}
                      onClick={handleJump}
                      className="bg-gray-700 p-4 rounded cursor-pointer hover:bg-gray-600 transition"
                    >
                      <div className="flex items-center mb-1">
                        {chapter.startTime && (
                          <span className="text-sm text-gray-400 mr-2">
                            {chapter.startTime}
                          </span>
                        )}
                        <h3 className="text-xl font-bold">
                          {chapter.chapterTitle}
                        </h3>
                      </div>
                      <p className="text-base">{chapter.chapterSummary}</p>
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className="aphasia-style whitespace-pre-wrap">
                {summary.summaryText}
              </p>
            )}
          </div>
        </div>

        {/* Right column: mind map */}
        {summary.mindmapJson && (
          <div className="flex-shrink-0 w-full lg:w-2/5">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold mb-2">Mind Map</h2>
              <div className="text-right mb-2">
                <button
                  onClick={() => setRadialLayout(prev => !prev)}
                  className="px-2 py-1 bg-blue-500 text-white rounded"
                >
                  {radialLayout ? 'Standard' : 'Radial'}
                </button>
              </div>
              <div ref={visRef} style={{ height: '600px', width: '100%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}