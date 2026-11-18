import { useState } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import type { LocalizedContent } from '../types/localization';
import { UnoR3BlockStage } from './UnoR3BlockStage';

interface ComponentStageProps {
  componentId: string;
  localizedHeaderTitle?: string;
}

function formatBits(num: number): string {
  return (num & 0xf).toString(2).padStart(4, '0');
}

function AluStage() {
  const [inputA, setInputA] = useState(5);
  const [inputB, setInputB] = useState(3);
  const [opcode, setOpcode] = useState<'ADD' | 'SUB' | 'AND' | 'XOR'>('ADD');

  let rawResult = 0;
  let carry = false;
  if (opcode === 'ADD') {
    rawResult = inputA + inputB;
    carry = rawResult > 15;
  } else if (opcode === 'SUB') {
    rawResult = inputA - inputB;
    carry = rawResult < 0;
    rawResult = (rawResult + 16) & 0xf;
  } else if (opcode === 'AND') {
    rawResult = inputA & inputB;
  } else {
    rawResult = inputA ^ inputB;
  }

  const output = rawResult & 0xf;
  const zeroFlag = output === 0;

  const toggleBit = (val: number, bit: number, setter: (n: number) => void) => {
    setter(val ^ (1 << bit));
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100">
        <svg
          viewBox="0 0 640 270"
          className="w-full h-auto"
          role="img"
          aria-label="Interactive 4-bit Arithmetic Logic Unit schematic"
        >
          {/* Input A Bus */}
          <rect x="20" y="28" width="136" height="58" rx="8" fill="#1E293B" stroke="#334155" />
          <text x="34" y="50" fill="#94A3B8" fontSize="11" fontFamily="IBM Plex Mono">
            OPERAND A
          </text>
          <text x="34" y="73" fill="#38BDF8" fontSize="18" fontWeight="600" fontFamily="IBM Plex Mono">
            {formatBits(inputA)} ({inputA})
          </text>

          {/* Input B Bus */}
          <rect x="20" y="182" width="136" height="58" rx="8" fill="#1E293B" stroke="#334155" />
          <text x="34" y="204" fill="#94A3B8" fontSize="11" fontFamily="IBM Plex Mono">
            OPERAND B
          </text>
          <text x="34" y="227" fill="#38BDF8" fontSize="18" fontWeight="600" fontFamily="IBM Plex Mono">
            {formatBits(inputB)} ({inputB})
          </text>

          {/* Signal wires into ALU */}
          <path
            d="M 156 57 L 235 57 L 265 92"
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="3"
            className="animate-flow"
          />
          <path
            d="M 156 211 L 235 211 L 265 176"
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="3"
            className="animate-flow"
          />

          {/* ALU Trapezoid */}
          <polygon
            points="260,36 395,78 395,190 260,232 260,156 286,134 260,112"
            fill="#0F172A"
            stroke="#0284C7"
            strokeWidth="2.5"
          />
          <text
            x="334"
            y="124"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="16"
            fontWeight="700"
            fontFamily="Plus Jakarta Sans"
          >
            ALU
          </text>
          <text
            x="334"
            y="147"
            textAnchor="middle"
            fill="#38BDF8"
            fontSize="13"
            fontWeight="600"
            fontFamily="IBM Plex Mono"
          >
            OP: {opcode}
          </text>

          {/* Output Bus */}
          <path
            d="M 395 134 L 468 134"
            fill="none"
            stroke="#10B981"
            strokeWidth="3.5"
            className="animate-flow"
          />
          <rect x="468" y="88" width="152" height="92" rx="8" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" />
          <text x="482" y="112" fill="#94A3B8" fontSize="11" fontFamily="IBM Plex Mono">
            OUTPUT BUS
          </text>
          <text x="482" y="141" fill="#34D399" fontSize="20" fontWeight="600" fontFamily="IBM Plex Mono">
            {formatBits(output)} ({output})
          </text>
          <text x="482" y="165" fill="#CBD5E1" fontSize="11" fontFamily="IBM Plex Mono">
            Z={zeroFlag ? '1' : '0'} · C={carry ? '1' : '0'}
          </text>
        </svg>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Operand A Bits</span>
            <span className="text-xs font-mono tabular-nums text-slate-900">{inputA}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[3, 2, 1, 0].map((bit) => {
              const active = Boolean((inputA >> bit) & 1);
              return (
                <button
                  key={bit}
                  type="button"
                  onClick={() => toggleBit(inputA, bit, setInputA)}
                  className={`py-2 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {active ? '1' : '0'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Operand B Bits</span>
            <span className="text-xs font-mono tabular-nums text-slate-900">{inputB}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[3, 2, 1, 0].map((bit) => {
              const active = Boolean((inputB >> bit) & 1);
              return (
                <button
                  key={bit}
                  type="button"
                  onClick={() => toggleBit(inputB, bit, setInputB)}
                  className={`py-2 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {active ? '1' : '0'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">ALU Opcode</span>
            <span className="text-xs font-mono text-sky-700">{opcode}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['ADD', 'SUB', 'AND', 'XOR'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setOpcode(op)}
                className={`py-2 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  opcode === op
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RamCellStage() {
  const [matrix, setMatrix] = useState<number[]>([
    1, 0, 1, 1,
    0, 1, 0, 0,
    1, 1, 0, 1,
    0, 0, 1, 0,
  ]);
  const [selectedIdx, setSelectedIdx] = useState(5);
  const [chargeLevel, setChargeLevel] = useState(92);

  const selectedRow = Math.floor(selectedIdx / 4);
  const selectedCol = selectedIdx % 4;

  const handleCellClick = (idx: number) => {
    setSelectedIdx(idx);
    setMatrix((prev) => prev.map((v, i) => (i === idx ? (v === 1 ? 0 : 1) : v)));
    setChargeLevel(96);
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-7">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-3">
              <span>WORDLINE ROW {selectedRow} ACTIVE</span>
              <span>BITLINE COL {selectedCol} SENSED</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {matrix.map((bit, idx) => {
                const r = Math.floor(idx / 4);
                const c = idx % 4;
                const isSelected = idx === selectedIdx;
                const onWordline = r === selectedRow;
                const onBitline = c === selectedCol;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCellClick(idx)}
                    className={`py-3 rounded-lg font-mono text-sm font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : onWordline || onBitline
                          ? 'bg-slate-800 border-sky-700/60 text-sky-300'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {bit}
                    <span className="block text-[10px] font-normal opacity-75">
                      R{r}C{c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-5 bg-slate-800/80 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="text-xs font-mono text-slate-400">
              CELL R{selectedRow}C{selectedCol} CAPACITOR
            </div>
            <div className="text-2xl font-mono font-semibold tabular-nums text-white">
              Bit = {matrix[selectedIdx]}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Stored Charge</span>
                <span className="font-mono tabular-nums">
                  {matrix[selectedIdx] === 1 ? `${chargeLevel}%` : '0% (Discharged)'}
                </span>
              </div>
              <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    matrix[selectedIdx] === 1 ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                  style={{ width: `${matrix[selectedIdx] === 1 ? chargeLevel : 6}%` }}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setChargeLevel(100)}
                className="flex-1 py-2 px-3 rounded-md bg-sky-700 hover:bg-sky-600 text-xs font-medium text-white cursor-pointer transition-colors"
              >
                Refresh Row
              </button>
              <button
                type="button"
                onClick={() => setChargeLevel((c) => Math.max(25, c - 22))}
                className="flex-1 py-2 px-3 rounded-md bg-slate-700 hover:bg-slate-600 text-xs font-medium text-slate-100 cursor-pointer transition-colors"
              >
                Simulate Leak
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Click any cell in the 4x4 DRAM array to activate its Wordline and Bitline and flip its stored capacitor charge.
      </p>
    </div>
  );
}

function MosfetStage() {
  const [gateVoltage, setGateVoltage] = useState(3.2);
  const [drainEnabled, setDrainEnabled] = useState(true);
  const threshold = 1.8;
  const conducting = gateVoltage >= threshold && drainEnabled;
  const channelStrength = Math.max(0, Math.min(1, (gateVoltage - threshold) / 3.2));

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100">
        <svg
          viewBox="0 0 640 245"
          className="w-full h-auto"
          role="img"
          aria-label="Interactive MOSFET semiconductor cross section"
        >
          {/* P-type substrate */}
          <rect x="40" y="96" width="560" height="124" rx="8" fill="#1E293B" stroke="#334155" />
          <text x="320" y="196" textAnchor="middle" fill="#64748B" fontSize="12" fontFamily="IBM Plex Mono">
            P-TYPE SILICON SUBSTRATE
          </text>

          {/* Source & Drain n+ wells */}
          <rect x="70" y="96" width="120" height="58" rx="4" fill="#0369A1" />
          <text x="130" y="129" textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="600" fontFamily="IBM Plex Mono">
            N+ SOURCE
          </text>

          <rect x="450" y="96" width="120" height="58" rx="4" fill="#0369A1" />
          <text x="510" y="129" textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="600" fontFamily="IBM Plex Mono">
            N+ DRAIN
          </text>

          {/* SiO2 Insulator */}
          <rect x="190" y="76" width="260" height="20" fill="#475569" />
          <text x="320" y="90" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontFamily="IBM Plex Mono">
            SiO₂ INSULATING OXIDE
          </text>

          {/* Gate Metal */}
          <rect
            x="210"
            y="42"
            width="220"
            height="34"
            rx="4"
            fill={gateVoltage >= threshold ? '#0EA5E9' : '#334155'}
          />
          <text x="320" y="64" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="600" fontFamily="IBM Plex Mono">
            GATE ({gateVoltage.toFixed(1)} V)
          </text>

          {/* Inversion Channel */}
          <rect
            x="190"
            y="96"
            width="260"
            height={Math.round(4 + channelStrength * 26)}
            fill={gateVoltage >= threshold ? '#34D399' : '#1E293B'}
            opacity={gateVoltage >= threshold ? 0.35 + channelStrength * 0.65 : 0}
          />

          {/* Current flow line when conducting */}
          {conducting && (
            <path
              d="M 130 112 L 510 112"
              fill="none"
              stroke="#6EE7B7"
              strokeWidth="4"
              className="animate-flow"
            />
          )}

          {/* Status readout */}
          <text
            x="320"
            y="24"
            textAnchor="middle"
            fill={conducting ? '#34D399' : '#FBBF24'}
            fontSize="12"
            fontWeight="600"
            fontFamily="IBM Plex Mono"
          >
            {conducting
              ? 'CHANNEL FORMED · DRAIN CURRENT FLOWING'
              : gateVoltage < threshold
                ? `BELOW THRESHOLD (${threshold.toFixed(1)} V) · SWITCH OFF`
                : 'DRAIN SUPPLY OFF · ZERO CURRENT'}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-700">
            <label htmlFor="mosfet-gate-slider">Gate Voltage (Vgs)</label>
            <span className="font-mono tabular-nums text-sky-700">
              {gateVoltage.toFixed(1)} V
            </span>
          </div>
          <input
            id="mosfet-gate-slider"
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={gateVoltage}
            onChange={(e) => setGateVoltage(Number(e.target.value))}
            className="w-full accent-sky-700 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>0.0 V (Off)</span>
            <span>Threshold: 1.8 V</span>
            <span>5.0 V (Full On)</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-700">Drain Supply (Vds)</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {drainEnabled ? '3.3 V Connected' : '0.0 V Disconnected'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrainEnabled((v) => !v)}
            className={`px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              drainEnabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
            }`}
          >
            {drainEnabled ? 'Supply On' : 'Supply Off'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlashCellStage() {
  const [trappedElectrons, setTrappedElectrons] = useState(true);
  const [lastAction, setLastAction] = useState<'READ' | 'PROGRAM' | 'ERASE'>('READ');

  const thresholdV = trappedElectrons ? 4.2 : 1.1;
  const storedBit = trappedElectrons ? 0 : 1;

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100">
        <svg
          viewBox="0 0 640 240"
          className="w-full h-auto"
          role="img"
          aria-label="Interactive NAND Flash Floating Gate Cell"
        >
          <rect x="60" y="150" width="520" height="65" rx="6" fill="#1E293B" stroke="#334155" />
          <text x="320" y="188" textAnchor="middle" fill="#64748B" fontSize="12" fontFamily="IBM Plex Mono">
            SILICON CHANNEL
          </text>

          {/* Tunnel Oxide */}
          <rect x="190" y="128" width="260" height="22" fill="#475569" />
          <text x="320" y="143" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontFamily="IBM Plex Mono">
            TUNNEL OXIDE BARRIER
          </text>

          {/* Floating Gate */}
          <rect
            x="200"
            y="84"
            width="240"
            height="44"
            rx="4"
            fill={trappedElectrons ? '#0369A1' : '#334155'}
            stroke="#38BDF8"
            strokeWidth="1.5"
          />
          <text x="320" y="104" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="600" fontFamily="IBM Plex Mono">
            FLOATING GATE ({trappedElectrons ? 'ELECTRONS TRAPPED' : 'EMPTY'})
          </text>
          {trappedElectrons && (
            <text x="320" y="121" textAnchor="middle" fill="#BAE6FD" fontSize="12" fontFamily="IBM Plex Mono">
              e⁻  e⁻  e⁻  e⁻  e⁻  e⁻
            </text>
          )}

          {/* Control Gate */}
          <rect x="200" y="34" width="240" height="32" rx="4" fill="#0F172A" stroke="#64748B" />
          <text x="320" y="55" textAnchor="middle" fill="#CBD5E1" fontSize="12" fontFamily="IBM Plex Mono">
            CONTROL GATE · ACTION: {lastAction}
          </text>

          <text
            x="320"
            y="22"
            textAnchor="middle"
            fill={trappedElectrons ? '#38BDF8' : '#34D399'}
            fontSize="12"
            fontWeight="600"
            fontFamily="IBM Plex Mono"
          >
            STORED BIT: {storedBit} · THRESHOLD VOLTAGE: {thresholdV.toFixed(1)} V
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            setTrappedElectrons(true);
            setLastAction('PROGRAM');
          }}
          className="py-2.5 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium cursor-pointer transition-colors"
        >
          Program Bit 0 (18V)
        </button>
        <button
          type="button"
          onClick={() => {
            setTrappedElectrons(false);
            setLastAction('ERASE');
          }}
          className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer transition-colors"
        >
          Erase to Bit 1
        </button>
        <button
          type="button"
          onClick={() => setLastAction('READ')}
          className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer transition-colors"
        >
          Sense Read (2.5V)
        </button>
      </div>
    </div>
  );
}

function BuckConverterStage() {
  const [dutyCycle, setDutyCycle] = useState(35);
  const vin = 12.0;
  const vout = (vin * dutyCycle) / 100;
  const rippleMv = Math.round(18 + (50 - Math.abs(50 - dutyCycle)) * 0.7);

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
            <div className="text-[11px] font-mono text-slate-400">INPUT SUPPLY</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-white mt-0.5">
              {vin.toFixed(1)} V
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-3 border border-sky-700/60">
            <div className="text-[11px] font-mono text-slate-400">PWM DUTY CYCLE</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-sky-400 mt-0.5">
              {dutyCycle}%
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-lg p-3 border border-emerald-700/60">
            <div className="text-[11px] font-mono text-slate-400">REGULATED VOUT</div>
            <div className="text-xl font-mono font-semibold tabular-nums text-emerald-400 mt-0.5">
              {vout.toFixed(2)} V
            </div>
          </div>
        </div>

        <svg viewBox="0 0 600 120" className="w-full h-auto" role="img" aria-label="PWM switching waveform">
          <line x1="20" y1="95" x2="580" y2="95" stroke="#334155" strokeWidth="1" />
          {[0, 1, 2, 3].map((cycle) => {
            const xStart = 20 + cycle * 140;
            const highWidth = Math.round((140 * dutyCycle) / 100);
            return (
              <path
                key={cycle}
                d={`M ${xStart} 95 L ${xStart} 25 L ${xStart + highWidth} 25 L ${xStart + highWidth} 95 L ${xStart + 140} 95`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
              />
            );
          })}
          {/* Smoothed Vout line */}
          <line
            x1="20"
            y1={95 - (dutyCycle / 100) * 70}
            x2="580"
            y2={95 - (dutyCycle / 100) * 70}
            stroke="#34D399"
            strokeWidth="2.5"
            strokeDasharray="5 4"
          />
        </svg>
      </div>

      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
        <div className="flex justify-between text-xs font-medium text-slate-700">
          <label htmlFor="buck-duty-slider">Switching Duty Cycle (D)</label>
          <span className="font-mono tabular-nums text-sky-700">
            {dutyCycle}% · Ripple ~{rippleMv} mV
          </span>
        </div>
        <input
          id="buck-duty-slider"
          type="range"
          min="10"
          max="90"
          step="1"
          value={dutyCycle}
          onChange={(e) => setDutyCycle(Number(e.target.value))}
          className="w-full accent-sky-700 cursor-pointer"
        />
      </div>
    </div>
  );
}

function IrqControllerStage() {
  const [activeIrq, setActiveIrq] = useState<{ id: number; name: string; vector: string }>({
    id: 0,
    name: 'System Timer',
    vector: '0x20',
  });
  const [maskLowPriority, setMaskLowPriority] = useState(false);

  const devices = [
    { id: 0, name: 'System Timer', vector: '0x20', priority: 'Highest' },
    { id: 1, name: 'Keyboard Input', vector: '0x21', priority: 'Medium' },
    { id: 4, name: 'NVMe Storage DMA', vector: '0x24', priority: 'Lower' },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl p-5 text-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <span>ACTIVE VECTOR DISPATCHED TO CPU</span>
          <span className="text-emerald-400">
            IRQ {activeIrq.id} ({activeIrq.name}) → Vector {activeIrq.vector}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {devices.map((dev) => {
            const masked = maskLowPriority && dev.id > 1;
            const selected = activeIrq.id === dev.id;
            return (
              <button
                key={dev.id}
                type="button"
                disabled={masked}
                onClick={() => setActiveIrq(dev)}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  masked
                    ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
                    : selected
                      ? 'bg-sky-700 border-sky-400 text-white cursor-pointer'
                      : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500 cursor-pointer'
                }`}
              >
                <div className="text-[11px] font-mono opacity-80">
                  IRQ {dev.id} · {dev.priority}
                </div>
                <div className="text-sm font-semibold mt-1">{dev.name}</div>
                <div className="text-xs font-mono mt-1 opacity-75">
                  {masked ? 'Masked' : `Vector ${dev.vector}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-700">Interrupt Priority Masking</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {maskLowPriority
              ? 'IRQ > 1 masked during critical kernel work'
              : 'All peripheral interrupt lines unmasked'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMaskLowPriority((m) => !m)}
          className={`px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            maskLowPriority
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {maskLowPriority ? 'Unmask All' : 'Mask Low IRQ'}
        </button>
      </div>
    </div>
  );
}

export function ComponentStage({ componentId }: ComponentStageProps) {
  switch (componentId) {
    case 'alu':
      return <AluStage />;
    case 'ram-cell':
      return <RamCellStage />;
    case 'mosfet':
      return <MosfetStage />;
    case 'flash-cell':
      return <FlashCellStage />;
    case 'buck-converter':
      return <BuckConverterStage />;
    case 'irq-controller':
      return <IrqControllerStage />;
    case 'uno-r3':
      return <UnoR3BlockStage />;
    default:
      return <AluStage />;
  }
}

export interface AudioPlayerControlsProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioUrl: string | null;
  disabled?: boolean;
  isPlaying: boolean;
  isGeneratingAudio: boolean;
  audioStatusText: string;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onChangeRate: (rate: number) => void;
  onReplay: () => void;
  languageLabel: string;
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayerBar({
  audioUrl,
  disabled = false,
  isPlaying,
  isGeneratingAudio,
  audioStatusText,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onSeek,
  onChangeRate,
  onReplay,
  languageLabel,
}: AudioPlayerControlsProps & { localization?: LocalizedContent | null }) {
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Volume2 className="w-4 h-4 text-sky-700 shrink-0" />
          <div className="text-xs text-slate-600 truncate">
            <span className="font-medium text-slate-900">{languageLabel} Audio</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span>{audioStatusText}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {[0.85, 1, 1.25].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => onChangeRate(rate)}
              className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums cursor-pointer transition-colors ${
                playbackRate === rate
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || isGeneratingAudio}
          onClick={onTogglePlay}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>{isGeneratingAudio ? 'Preparing Audio...' : 'Listen'}</span>
            </>
          )}
        </button>

        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <input
            type="range"
            aria-label="Audio playback position"
            min={0}
            max={duration || 1}
            step={0.1}
            disabled={!audioUrl}
            value={Math.min(currentTime, duration || 1)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full accent-sky-700 cursor-pointer disabled:opacity-40"
          />
          <span className="text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap shrink-0">
            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
          </span>
        </div>

        {audioUrl && (
          <button
            type="button"
            onClick={onReplay}
            title="Restart audio"
            aria-label="Restart audio"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {audioUrl && (
        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-700 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
