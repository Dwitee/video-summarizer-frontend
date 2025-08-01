import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network/standalone/umd/vis-network.min.js';
import { DataSet } from 'vis-data';
import { useVideoSummarizer } from '../../hooks/useVideoSummarizer';

function getDescendants(nodeId: string, edgesData: DataSet<any>): string[] {
  const descendants: string[] = [];
  const queue: string[] = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    const childrenEdges = edgesData.get({ filter: e => e.from === current });
    childrenEdges.forEach(e => {
      descendants.push(e.to);
      queue.push(e.to);
    });
  }
  return descendants.filter(d => d !== nodeId);
}

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
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [narrationRate, setNarrationRate] = useState(1);
  const [narrationVolume, setNarrationVolume] = useState(1);
  const [narratedEmoji, setNarratedEmoji] = useState<string | null>(null);
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
      // clear existing canvas so full-screen container can initialize
      visRef.current.innerHTML = '';
      // -- Mindmap styling configuration --
      const centralShape = 'box';
      const centralColor = 'mediumpurple';

      const branchShape = radialLayout ? 'box' : 'ellipse';
      const branchColors = radialLayout
        ? ['#2196f3', '#2196f3', '#2196f3', '#2196f3', '#2196f3']
        : ['deeppink', 'tomato', 'orange', 'limegreen', 'deepskyblue'];

      const pointShape = radialLayout ? 'box' : 'ellipse';
      const pointColor = radialLayout ? '#4caf50' : 'lightyellow';

      const nodesArray: Array<{ id: string; label: string; shape: string; color: string; baseLabel?: string; hidden?: boolean }> = [
        {
          id: 'central',
          label: summary.mindmapJson.central.label,
          shape: centralShape,
          color: centralColor
        }
      ];
      const edgesArray: Array<{ id: string; from: string; to: string; hidden?: boolean }> = [];

      summary.mindmapJson.branches.forEach((branch: any, i: number) => {
        const branchId = `branch_${i}`;
        nodesArray.push({
          id: branchId,
          baseLabel: branch.label,
          label: radialLayout
            ? `${branch.label} ▶️`
            : branch.label,
          shape: branchShape,
          color: branchColors[i % branchColors.length]
        });
        edgesArray.push({ id: `central_${branchId}`, from: 'central', to: branchId });

        branch.points.forEach((pt: any, j: number) => {
          const pointId = `${branchId}_point_${j}`;
          nodesArray.push({
            id: pointId,
            label: pt.label,
            shape: pointShape,
            color: pointColor,
            hidden: radialLayout // hide only in radial mode
          });
          edgesArray.push({
            id: `${branchId}_${pointId}`,
            from: branchId,
            to: pointId,
            hidden: radialLayout // hide edge only in radial mode
          });
        });
      });

      const nodesData = new DataSet<{
        id: string;
        label: string;
        shape: string;
        color: string;
        hidden?: boolean;
        baseLabel?: string;
        // allow pinning by axis
        fixed?: boolean | { x: boolean; y: boolean };
        font?: { size: number; face: string; bold: boolean };
      }>(nodesArray);
      const edgesData = new DataSet<{
        id: string;
        from: string;
        to: string;
        hidden?: boolean;
      }>(edgesArray);

      // --- Narration (Text-to-Speech) ---
      const synth = window.speechSynthesis;
      let cancelled = false;

      const playNarration = async () => {
        if (!synth) return;

        // Highlight the node while narrating, update font styling instead of label
        const speak = async (nodeId: string, text: string) => {
          return new Promise<void>((resolve) => {
            const utterance = new window.SpeechSynthesisUtterance(text);
            utterance.rate = narrationRate;
            utterance.volume = narrationVolume;
            utterance.onstart = () => {
              if (cancelled) return;
              // Extract emoji from label (not text) and always set a fallback if none
              const labelText = nodesData.get(nodeId)?.label ?? '';
              const emojiRegex = /([\u231A-\u231B\u23E9-\u23EC\u23F0-\u23F3\u25FD-\u25FE\u2600-\u27BF])/g;
              const matchedEmoji = labelText.match(emojiRegex);
              const selectedEmoji = matchedEmoji && matchedEmoji.length > 0 ? matchedEmoji[0] : '🎙️';
              setNarratedEmoji(selectedEmoji);
              // Set color and bold font
              nodesData.update({
                id: nodeId,
                color: 'gold',
                font: {
                  size: 24,
                  face: 'arial',
                  bold: true,
                }
              });
            };
            utterance.onend = () => {
              if (cancelled) return;
              // Remove color and revert font
              nodesData.update({
                id: nodeId,
                color: undefined,
                font: {
                  size: 14,
                  face: 'arial',
                  bold: false,
                }
              });
              setNarratedEmoji(null);
              resolve();
            };
            synth.speak(utterance);
          });
        };

        // Start from central
        const central = summary.mindmapJson.central;
        if (central.narration && !cancelled) {
          await speak('central', central.narration);
        }

        for (let i = 0; i < summary.mindmapJson.branches.length; i++) {
          if (cancelled) break;
          const branch = summary.mindmapJson.branches[i];
          const branchId = `branch_${i}`;
          if (branch.narration && !cancelled) {
            await speak(branchId, branch.narration);
          }
          for (let j = 0; j < branch.points.length; j++) {
            if (cancelled) break;
            const pt = branch.points[j];
            const pointId = `${branchId}_point_${j}`;
            if (pt.narration && !cancelled) {
              await speak(pointId, pt.narration);
            }
          }
        }
      };

      if (narrationEnabled) {
        playNarration();
      }

      // Choose physics settings based on layout
      const physicsOptions = radialLayout
        ? { enabled: false }
        : {
            barnesHut: {
              gravitationalConstant: -8000,
              centralGravity: 0.3,
              springLength: 95
            },
            minVelocity: 0.75
          };

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
        physics: physicsOptions,
        layout: radialLayout
          ? {
              hierarchical: {
                enabled: true,
                direction: 'LR',
                sortMethod: 'directed',
                nodeSpacing: 100,
                levelSeparation: 150,
                treeSpacing: 50
              },
              improvedLayout: true
            }
          : {
              improvedLayout: true
            },
      };
      const network = new Network(
        visRef.current,
        { nodes: nodesData as any, edges: edgesData as any },
        options
      );

      if (radialLayout) {
        network.on('click', params => {
          if (params.nodes.length > 0) {
            // Pin this node's x-axis so it doesn't move horizontally; y-axis can move
            const clickedId = params.nodes[0] as string;
            nodesData.update({ id: clickedId, fixed: { x: true, y: false } });

            // If the central node was clicked, toggle all descendants at once
            if (radialLayout && clickedId === 'central') {
              const allDesc = getDescendants('central', edgesData);
              if (allDesc.length) {
                const anyVisibleAll = allDesc.some(dId => !nodesData.get(dId)?.hidden);
                // Toggle all other nodes
                allDesc.forEach(dId => {
                  nodesData.update({ id: dId, hidden: anyVisibleAll });
                });
                // Toggle all edges from central subtree
                const allEdges = edgesData.get({ filter: e => allDesc.includes(e.to) });
                allEdges.forEach(edge => {
                  edgesData.update({ id: edge.id, hidden: anyVisibleAll });
                });
              }
              return;
            }
            const childEdges = edgesData.get({ filter: e => e.from === clickedId });
            childEdges.forEach(edge => {
              const childId = edge.to as string;
              const nodeItem = nodesData.get(childId);
              if (nodeItem) {
                nodesData.update({ id: childId, hidden: !nodeItem.hidden });
              }
              edgesData.update({ id: edge.id, hidden: !edge.hidden });
            });
            // Update branch icon based on any visible child
            const branchNode = nodesData.get(clickedId);
            if (branchNode?.baseLabel) {
              const children = edgesData.get({ filter: e => e.from === clickedId });
              const anyVisible = children.some(e => {
                const child = nodesData.get(e.to as string);
                return child && !child.hidden;
              });
              const newLabel = `${branchNode.baseLabel} ${anyVisible ? '◀️' : '▶️'}`;
              nodesData.update({ id: clickedId, label: newLabel });
            }
          }
        });
      }

      // Add node click narration when narrationEnabled is false
      if (!narrationEnabled) {
        network.on('click', async (params) => {
          const clickedId = params.nodes[0];
          if (!clickedId) return;

          const node = nodesData.get(clickedId);
          if (!node) return;

          const findNarration = (id: string): string | null => {
            if (id === 'central') return summary?.mindmapJson?.central?.narration || null;
            const branchMatch = id.match(/^branch_(\d+)$/);
            if (branchMatch) {
              const branchIndex = Number(branchMatch[1]);
              return summary?.mindmapJson?.branches?.[branchIndex]?.narration || null;
            }
            const pointMatch = id.match(/^branch_(\d+)_point_(\d+)$/);
            if (pointMatch) {
              const [_, branchIndex, pointIndex] = pointMatch.map(Number);
              return summary?.mindmapJson?.branches?.[branchIndex]?.points?.[pointIndex]?.narration || null;
            }
            return null;
          };

          const text = findNarration(clickedId);
          if (text) {
            // Update the narratedEmoji state based on the clicked node's label
            const labelText = typeof node.label === 'string' ? node.label : '';
            const emojiRegex = /([\u231A-\u231B\u23E9-\u23EC\u23F0-\u23F3\u25FD-\u25FE\u2600-\u27BF])/g;
            const matchedEmoji = labelText.match(emojiRegex);
            const selectedEmoji = matchedEmoji && matchedEmoji.length > 0 ? matchedEmoji[0] : '🎙️';
            setNarratedEmoji(selectedEmoji);

            const utterance = new window.SpeechSynthesisUtterance(text);
            utterance.rate = narrationRate;
            utterance.volume = narrationVolume;
            window.speechSynthesis.speak(utterance);
          }
        });
      }

      // Cleanup function to cancel narration if component unmounts or narrationEnabled changes
      return () => {
        cancelled = true;
        if (synth?.speaking) {
          synth.cancel();
        }
      };
    }
  }, [summary, radialLayout, mapFullscreen, narrationEnabled]);

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
          <>
            {mapFullscreen ? (
              <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                  <h2 className="text-2xl font-semibold text-white">Mind Map</h2>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setRadialLayout(prev => !prev)}
                      className="px-2 py-1 bg-blue-500 text-white rounded"
                    >
                      {radialLayout ? 'Standard' : 'Radial'}
                    </button>
                    <button
                      onClick={() => setNarrationEnabled(prev => !prev)}
                      className="px-2 py-1 bg-green-600 text-white rounded"
                    >
                      {narrationEnabled ? 'Stop Narration' : 'Narrate'}
                    </button>
                    <select
                      value={narrationRate}
                      onChange={(e) => setNarrationRate(Number(e.target.value))}
                      className="px-2 py-1 bg-gray-700 text-white rounded"
                    >
                      <option value={0.25}>0.25x</option>
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                    </select>
                    <button
                      onClick={() => setMapFullscreen(false)}
                      className="text-white text-2xl"
                    >
                      ╳
                    </button>
                  </div>
                </div>
                <div className="flex-grow relative">
                  {narratedEmoji && (
                    <div className="absolute top-4 left-4 text-7xl z-50">
                      {narratedEmoji}
                    </div>
                  )}
                  <div ref={visRef} className="h-full w-full" />
                  <div className="absolute bottom-4 right-4 bg-gray-800 p-2 rounded shadow-lg z-10 flex items-center">
                    <span role="img" aria-label="Volume" className="mr-2">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={narrationVolume}
                      onChange={(e) => setNarrationVolume(Number(e.target.value))}
                      className="w-32"
                      title="Narration Volume"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 w-full lg:w-2/5">
                <div className="bg-gray-800 p-6 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-semibold">Mind Map</h2>
                    <button
                      onClick={() => setMapFullscreen(true)}
                      className="text-white text-xl"
                    >
                      ⛶
                    </button>
                  </div>
                  <div className="text-right mb-2 space-x-2">
                    <button
                      onClick={() => setRadialLayout(prev => !prev)}
                      className="px-2 py-1 bg-blue-500 text-white rounded"
                    >
                      {radialLayout ? 'Standard' : 'Radial'}
                    </button>
                    <button
                      onClick={() => setNarrationEnabled(prev => !prev)}
                      className="px-2 py-1 bg-green-600 text-white rounded"
                    >
                      {narrationEnabled ? 'Stop Narration' : 'Narrate'}
                    </button>
                    <select
                      value={narrationRate}
                      onChange={(e) => setNarrationRate(Number(e.target.value))}
                      className="px-2 py-1 bg-gray-700 text-white rounded"
                    >
                      <option value={0.25}>0.25x</option>
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                    </select>
                  </div>
                  <div className="relative">
                    {narratedEmoji && (
                      <div className="absolute top-4 left-4 text-7xl z-50">
                        {narratedEmoji}
                      </div>
                    )}
                    <div ref={visRef} style={{ height: '600px', width: '100%' }} />
                    <div className="absolute bottom-4 right-4 bg-gray-800 p-2 rounded shadow-lg z-10 flex items-center">
                      <span role="img" aria-label="Volume" className="mr-2">🔊</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={narrationVolume}
                        onChange={(e) => setNarrationVolume(Number(e.target.value))}
                        className="w-32"
                        title="Narration Volume"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}