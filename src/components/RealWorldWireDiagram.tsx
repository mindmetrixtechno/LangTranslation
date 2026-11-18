import { useState } from 'react';
import { Volume2, Loader2, Pause, Cable } from 'lucide-react';
import type { VisualWireDiagram } from '../types/localization';

interface RealWorldWireDiagramProps {
  diagram: VisualWireDiagram;
  isSpeaking: boolean;
  isGeneratingAudio: boolean;
  onListenDiagram: () => void;
}

export function RealWorldWireDiagram({
  diagram,
  isSpeaking,
  isGeneratingAudio,
  onListenDiagram,
}: RealWorldWireDiagramProps) {
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);

  const nodes = diagram.nodes.slice(0, 3);
  const wires = diagram.wires.slice(0, 2);

  // SVG coordinates for 3 nodes across a 640x210 canvas
  const nodePositions = [
    { x: 24, y: 52, w: 164, h: 102, cx: 106 },
    { x: 238, y: 52, w: 164, h: 102, cx: 320 },
    { x: 452, y: 52, w: 164, h: 102, cx: 534 },
  ];

  const activeNode = nodes[activeStepIdx] ?? nodes[0];
  const activeWire =
    activeStepIdx > 0 ? wires[activeStepIdx - 1] : wires[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
            <Cable className="w-3.5 h-3.5 shrink-0" />
            <span>Real-World Wire Connection</span>
          </div>
          <h5 className="text-sm font-semibold text-slate-900">
            {diagram.title}
          </h5>
          <p className="text-xs text-slate-600 leading-relaxed">
            {diagram.analogySummary}
          </p>
        </div>

        <button
          type="button"
          disabled={isGeneratingAudio}
          onClick={onListenDiagram}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isGeneratingAudio ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Preparing...</span>
            </>
          ) : isSpeaking ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen</span>
            </>
          )}
        </button>
      </div>

      {/* Interactive SVG Wire Diagram */}
      <div className="bg-slate-900 rounded-xl p-3">
        <svg
          viewBox="0 0 640 200"
          className="w-full h-auto"
          role="img"
          aria-label={diagram.title}
        >
          {/* Wire 1: Node 1 -> Node 2 */}
          {wires[0] && (
            <g
              onClick={() => setActiveStepIdx(1)}
              className="cursor-pointer"
            >
              <path
                d="M 188 103 C 206 103, 218 103, 238 103"
                fill="none"
                stroke="#0284C7"
                strokeWidth={activeStepIdx === 1 ? '6' : '4'}
                opacity="0.35"
              />
              <path
                d="M 188 103 C 206 103, 218 103, 238 103"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                className="animate-flow"
              />
              <circle cx="188" cy="103" r="4.5" fill="#38BDF8" />
              <circle cx="238" cy="103" r="4.5" fill="#38BDF8" />
              <text
                x="213"
                y="84"
                textAnchor="middle"
                fill="#BAE6FD"
                fontSize="10"
                fontFamily="Plus Jakarta Sans"
              >
                {wires[0].signalLabel.slice(0, 18)}
              </text>
            </g>
          )}

          {/* Wire 2: Node 2 -> Node 3 */}
          {wires[1] && (
            <g
              onClick={() => setActiveStepIdx(2)}
              className="cursor-pointer"
            >
              <path
                d="M 402 103 C 420 103, 432 103, 452 103"
                fill="none"
                stroke="#059669"
                strokeWidth={activeStepIdx === 2 ? '6' : '4'}
                opacity="0.35"
              />
              <path
                d="M 402 103 C 420 103, 432 103, 452 103"
                fill="none"
                stroke="#34D399"
                strokeWidth="3"
                className="animate-flow"
              />
              <circle cx="402" cy="103" r="4.5" fill="#34D399" />
              <circle cx="452" cy="103" r="4.5" fill="#34D399" />
              <text
                x="427"
                y="84"
                textAnchor="middle"
                fill="#A7F3D0"
                fontSize="10"
                fontFamily="Plus Jakarta Sans"
              >
                {wires[1].signalLabel.slice(0, 18)}
              </text>
            </g>
          )}

          {/* Nodes */}
          {nodes.map((node, idx) => {
            const pos = nodePositions[idx];
            const isSelected = activeStepIdx === idx;
            const strokeColor =
              idx === 0
                ? '#38BDF8'
                : idx === 1
                  ? '#FBBF24'
                  : '#34D399';
            return (
              <g
                key={node.id}
                onClick={() => setActiveStepIdx(idx)}
                className="cursor-pointer"
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx="10"
                  fill={isSelected ? '#1E293B' : '#0F172A'}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                />
                <text
                  x={pos.cx}
                  y={pos.y + 24}
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono"
                >
                  {idx === 0
                    ? '01 · REAL WORLD'
                    : idx === 1
                      ? '02 · WIRE LINK'
                      : '03 · HARDWARE'}
                </text>
                <text
                  x={pos.cx}
                  y={pos.y + 52}
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="Plus Jakarta Sans"
                >
                  {node.label.slice(0, 22)}
                </text>
                <text
                  x={pos.cx}
                  y={pos.y + 74}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="10"
                  fontFamily="Plus Jakarta Sans"
                >
                  {node.subLabel.slice(0, 24)}
                </text>
              </g>
            );
          })}

          <text
            x="320"
            y="184"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="10"
            fontFamily="Plus Jakarta Sans"
          >
            Click any block or wire to inspect the connection
          </text>
        </svg>
      </div>

      {/* Step Selector & Active Connection Details */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {nodes.map((node, idx) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setActiveStepIdx(idx)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeStepIdx === idx
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {idx + 1}. {node.label}
            </button>
          ))}
        </div>

        {activeNode && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="font-semibold text-slate-900">
              {activeNode.label} · {activeNode.subLabel}
            </div>
            <p className="text-slate-700 leading-relaxed">
              {activeNode.roleDescription}
            </p>
            {activeWire && (
              <p className="text-sky-800 pt-1 border-t border-slate-200 leading-relaxed">
                <span className="font-medium">{activeWire.signalLabel}:</span>{' '}
                {activeWire.explanation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
