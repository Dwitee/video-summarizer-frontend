

import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/umd/vis-network.min.js';
import { useVideoSummarizer } from '../../hooks/useVideoSummarizer';

export default function VideoDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { summaries } = useVideoSummarizer();
  const summary = summaries.find(s => s.id === id);
  const visRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (summary?.mindmapJson && visRef.current) {
      const nodes: Array<{ id: string; label: string; shape: string; color: string }> = [
        { id: 'central', label: summary.mindmapJson.central.label, shape: 'box', color: 'mediumpurple' }
      ];
      const edges: Array<{ from: string; to: string; arrows: string }> = [];

      summary.mindmapJson.branches.forEach((branch: any, i: number) => {
        const branchId = `branch_${i}`;
        nodes.push({
          id: branchId,
          label: branch.label,
          shape: 'ellipse',
          color: ['deeppink', 'tomato', 'orange', 'limegreen', 'deepskyblue'][i % 5]
        });
        edges.push({ from: 'central', to: branchId, arrows: 'to' });

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
        edges: {
          smooth: {
            enabled: true,
            type: 'curvedCW',
            roundness: 0.4
          }
        },
        physics: {
          barnesHut: {
            gravitationalConstant: -8000,
            centralGravity: 0.3,
            springLength: 95
          },
          minVelocity: 0.75
        }
      });
    }
  }, [summary]);

  if (!summary) {
    return (
      <div className="bg-black text-white min-h-screen p-4 aphasia-style">
        Loading...
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
              src={summary.videoUrl}
              controls
              className="w-full h-auto"
            />
          </div>
          <div className="bg-gray-800 p-6 rounded-lg mb-4">
            <h2 className="text-2xl font-semibold mb-2">Summary</h2>
            {summary.summaryJson ? (
              <div className="space-y-4 aphasia-style">
                {summary.summaryJson.map((chapter, idx) => (
                  <section key={idx} className="bg-gray-700 p-4 rounded">
                    <h3 className="text-xl font-bold mb-1">
                      {chapter.chapterTitle}
                    </h3>
                    <p className="text-base">{chapter.chapterSummary}</p>
                  </section>
                ))}
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
              <div ref={visRef} style={{ height: '600px', width: '100%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}