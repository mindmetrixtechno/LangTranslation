import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Copy,
  Check,
  Download,
  Usb,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Terminal,
  AlertCircle,
  Volume2,
  VolumeX,
  GripVertical,
} from 'lucide-react';
import {
  DIGITAL_PINS,
  PWM_PINS,
  UNO_PIN_INFO,
  UNO_PRESETS,
  clonePresetBlocks,
  createDefaultBlock,
  evaluateSensorCondition,
  generateArduinoIno,
  type LogicLevel,
  type MotorDir,
  type PwmPin,
  type SensorConditionKind,
  type SensorSnapshot,
  type UnoBlock,
  type UnoPinMode,
  type UnoPreset,
} from '../data/unoBlocks';

type PaletteCategory = 'setup' | 'led' | 'sensors' | 'motors' | 'logic' | 'serial';

interface CategorySpec {
  id: PaletteCategory;
  label: string;
  barColor: string;
  activeBg: string;
}

const CATEGORIES: CategorySpec[] = [
  {
    id: 'led',
    label: 'LED & Pins',
    barColor: 'bg-emerald-500',
    activeBg: 'bg-emerald-50 text-emerald-950 font-semibold',
  },
  {
    id: 'setup',
    label: 'Setup',
    barColor: 'bg-amber-500',
    activeBg: 'bg-amber-50 text-amber-950 font-semibold',
  },
  {
    id: 'sensors',
    label: 'Sensors',
    barColor: 'bg-cyan-500',
    activeBg: 'bg-cyan-50 text-cyan-950 font-semibold',
  },
  {
    id: 'motors',
    label: 'Motors & Sound',
    barColor: 'bg-orange-500',
    activeBg: 'bg-orange-50 text-orange-950 font-semibold',
  },
  {
    id: 'logic',
    label: 'Wait & Loops',
    barColor: 'bg-sky-500',
    activeBg: 'bg-sky-50 text-sky-950 font-semibold',
  },
  {
    id: 'serial',
    label: 'Serial',
    barColor: 'bg-slate-600',
    activeBg: 'bg-slate-100 text-slate-900 font-semibold',
  },
];

interface PaletteItem {
  kind: UnoBlock['kind'];
  category: PaletteCategory;
  target: 'setup' | 'loop';
  title: string;
  subtitle: string;
  blockColor: string;
  iconKind: 'led' | 'pin' | 'servo' | 'motor' | 'buzzer' | 'sensor' | 'clock' | 'logic' | 'serial';
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: 'digital_write',
    category: 'led',
    target: 'loop',
    title: 'Set pin 13 HIGH / LOW',
    subtitle: 'Turn LED ON or OFF',
    blockColor: 'bg-emerald-500 text-white border-emerald-600',
    iconKind: 'led',
  },
  {
    kind: 'analog_write',
    category: 'led',
    target: 'loop',
    title: 'Set PWM brightness',
    subtitle: 'Dim LED 0 to 255',
    blockColor: 'bg-emerald-600 text-white border-emerald-700',
    iconKind: 'led',
  },
  {
    kind: 'pin_mode',
    category: 'setup',
    target: 'setup',
    title: 'Set pin as OUTPUT / INPUT',
    subtitle: 'Put inside Setup',
    blockColor: 'bg-amber-500 text-white border-amber-600',
    iconKind: 'pin',
  },
  {
    kind: 'servo_attach',
    category: 'setup',
    target: 'setup',
    title: 'Attach Servo motor',
    subtitle: 'Put inside Setup',
    blockColor: 'bg-amber-500 text-white border-amber-600',
    iconKind: 'servo',
  },
  {
    kind: 'serial_begin',
    category: 'setup',
    target: 'setup',
    title: 'Start Serial (9600)',
    subtitle: 'Put inside Setup',
    blockColor: 'bg-amber-500 text-white border-amber-600',
    iconKind: 'serial',
  },
  {
    kind: 'if_else',
    category: 'sensors',
    target: 'loop',
    title: 'If Sensor / Pin → Else',
    subtitle: 'Ultrasonic, IR, LDR, Temp',
    blockColor: 'bg-cyan-600 text-white border-cyan-700',
    iconKind: 'sensor',
  },
  {
    kind: 'serial_print',
    category: 'sensors',
    target: 'loop',
    title: 'Read & Print Sensor',
    subtitle: 'Show sensor on screen',
    blockColor: 'bg-cyan-700 text-white border-cyan-800',
    iconKind: 'sensor',
  },
  {
    kind: 'servo_write',
    category: 'motors',
    target: 'loop',
    title: 'Rotate Servo (0°–180°)',
    subtitle: 'Move robotic arm / gate',
    blockColor: 'bg-orange-500 text-white border-orange-600',
    iconKind: 'servo',
  },
  {
    kind: 'dc_motor',
    category: 'motors',
    target: 'loop',
    title: 'Spin DC Motor',
    subtitle: 'Forward, Reverse, Stop',
    blockColor: 'bg-orange-600 text-white border-orange-700',
    iconKind: 'motor',
  },
  {
    kind: 'buzzer_tone',
    category: 'motors',
    target: 'loop',
    title: 'Play Buzzer Tone',
    subtitle: 'Beep alert on pin D4',
    blockColor: 'bg-violet-600 text-white border-violet-700',
    iconKind: 'buzzer',
  },
  {
    kind: 'delay',
    category: 'logic',
    target: 'loop',
    title: 'Wait milliseconds',
    subtitle: 'Pause before next step',
    blockColor: 'bg-sky-500 text-white border-sky-600',
    iconKind: 'clock',
  },
  {
    kind: 'repeat',
    category: 'logic',
    target: 'loop',
    title: 'Repeat N times',
    subtitle: 'Loop inner blocks',
    blockColor: 'bg-indigo-600 text-white border-indigo-700',
    iconKind: 'logic',
  },
  {
    kind: 'serial_print',
    category: 'serial',
    target: 'loop',
    title: 'Print to Serial Monitor',
    subtitle: 'Send text or data',
    blockColor: 'bg-slate-700 text-white border-slate-800',
    iconKind: 'serial',
  },
];

function MiniHardwareIcon({ kind }: { kind: PaletteItem['iconKind'] }) {
  switch (kind) {
    case 'led':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <path d="M9 15V9a3 3 0 0 1 6 0v6z" fill="#FDE047" stroke="#0F172A" strokeWidth="1.3" />
          <rect x="8" y="15" width="8" height="2.2" rx="1" fill="#FACC15" stroke="#0F172A" strokeWidth="1.2" />
          <line x1="10" y1="17.5" x2="10" y2="21.5" stroke="#E2E8F0" strokeWidth="1.5" />
          <line x1="14" y1="17.5" x2="14" y2="21.5" stroke="#E2E8F0" strokeWidth="1.5" />
        </svg>
      );
    case 'servo':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="4" y="7" width="16" height="12" rx="2" fill="#2563EB" stroke="#F8FAFC" strokeWidth="1.2" />
          <circle cx="15" cy="11" r="2.5" fill="#F8FAFC" />
          <rect x="13.5" y="3.5" width="3" height="8" rx="1.5" fill="#F8FAFC" />
        </svg>
      );
    case 'motor':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" fill="#1E293B" stroke="#F8FAFC" strokeWidth="1.4" />
          <line x1="12" y1="6" x2="12" y2="18" stroke="#34D399" strokeWidth="2" />
          <line x1="6" y1="12" x2="18" y2="12" stroke="#34D399" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.2" fill="#F8FAFC" />
        </svg>
      );
    case 'buzzer':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="7" fill="#0F172A" stroke="#F8FAFC" strokeWidth="1.4" />
          <circle cx="12" cy="12" r="2.2" fill="#E2E8F0" />
        </svg>
      );
    case 'sensor':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="2.5" y="6.5" width="19" height="11" rx="2" fill="#0284C7" stroke="#F8FAFC" strokeWidth="1.2" />
          <circle cx="8" cy="12" r="3" fill="#CBD5E1" stroke="#0F172A" strokeWidth="1" />
          <circle cx="16" cy="12" r="3" fill="#CBD5E1" stroke="#0F172A" strokeWidth="1" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" fill="#FFFFFF" fillOpacity="0.2" stroke="#FFFFFF" strokeWidth="1.6" />
          <path d="M12 8v4.5l3 1.5" stroke="#FFFFFF" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" fill="#0F172A" stroke="#F8FAFC" strokeWidth="1.3" />
          <circle cx="12" cy="12" r="2.5" fill="#FACC15" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="4" y="6" width="16" height="4" rx="1.5" fill="#FFFFFF" />
          <rect x="7" y="13" width="13" height="4" rx="1.5" fill="#FFFFFF" fillOpacity="0.85" />
        </svg>
      );
  }
}

interface PinState {
  mode: UnoPinMode;
  digital: 0 | 1;
  pwm: number | null;
}

type PinMap = Record<number, PinState>;

function createInitialPins(): PinMap {
  const map: PinMap = {};
  for (let p = 0; p <= 13; p++) {
    map[p] = { mode: 'INPUT', digital: 0, pwm: null };
  }
  return map;
}

interface SerialPortLike {
  open: (opts: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: ReadableStream<Uint8Array> | null;
  writable?: WritableStream<Uint8Array> | null;
}

function updateBlockInTree(
  list: UnoBlock[],
  id: string,
  updater: (b: UnoBlock) => UnoBlock
): UnoBlock[] {
  return list.map((b) => {
    if (b.id === id) return updater(b);
    if (b.kind === 'repeat') {
      return { ...b, children: updateBlockInTree(b.children, id, updater) };
    }
    if (b.kind === 'if_else') {
      return {
        ...b,
        thenBlocks: updateBlockInTree(b.thenBlocks, id, updater),
        elseBlocks: updateBlockInTree(b.elseBlocks, id, updater),
      };
    }
    return b;
  });
}

function removeBlockInTree(list: UnoBlock[], id: string): UnoBlock[] {
  return list
    .filter((b) => b.id !== id)
    .map((b) => {
      if (b.kind === 'repeat') {
        return { ...b, children: removeBlockInTree(b.children, id) };
      }
      if (b.kind === 'if_else') {
        return {
          ...b,
          thenBlocks: removeBlockInTree(b.thenBlocks, id),
          elseBlocks: removeBlockInTree(b.elseBlocks, id),
        };
      }
      return b;
    });
}

function moveInArray<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function UnoR3BlockStage() {
  const [setupBlocks, setSetupBlocks] = useState<UnoBlock[]>(() =>
    clonePresetBlocks(UNO_PRESETS[0].setup)
  );
  const [loopBlocks, setLoopBlocks] = useState<UnoBlock[]>(() =>
    clonePresetBlocks(UNO_PRESETS[0].loop)
  );
  const [activePresetId, setActivePresetId] = useState<string>('blink');
  const [activeCategory, setActiveCategory] = useState<PaletteCategory>('led');
  const [rightPaneTab, setRightPaneTab] = useState<'board' | 'code'>('board');

  // Simulator states
  const [isRunning, setIsRunning] = useState(false);
  const [pins, setPins] = useState<PinMap>(createInitialPins);
  const [servoAngle, setServoAngle] = useState(0);
  const [motorState, setMotorState] = useState<{ dir: MotorDir; speed: number }>({
    dir: 'STOP',
    speed: 0,
  });
  const [buzzerState, setBuzzerState] = useState<{
    active: boolean;
    freq: number;
  }>({ active: false, freq: 0 });
  const [buzzerSoundEnabled, setBuzzerSoundEnabled] = useState(false);
  const [selectedPinInfo, setSelectedPinInfo] = useState<string>(
    'D13 · Built-in L LED & SPI SCK — classic Blink output pin.'
  );

  // Sensors
  const [sensors, setSensors] = useState<SensorSnapshot>({
    ultrasonicCm: 20,
    irDetected: false,
    ldrValue: 380,
    tempC: 32,
  });

  // Execution engine refs/state
  const [phaseLabel, setPhaseLabel] = useState<'setup' | 'loop'>('setup');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [serialLogs, setSerialLogs] = useState<string[]>([
    'UNO R3 ready · Press Run to watch your blocks blink and control pins.',
  ]);
  const [txPulse, setTxPulse] = useState(false);
  const [motorSpinDeg, setMotorSpinDeg] = useState(0);

  // Code / Drag / USB
  const [copiedCode, setCopiedCode] = useState(false);
  const [dragKindFromPalette, setDragKindFromPalette] =
    useState<UnoBlock['kind'] | null>(null);
  const [dragReorder, setDragReorder] = useState<{
    section: 'setup' | 'loop';
    index: number;
  } | null>(null);
  const [dropHighlight, setDropHighlight] = useState<'setup' | 'loop' | null>(
    null
  );

  const [usbMode, setUsbMode] = useState<'serial' | 'firmata'>('serial');
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbStatus, setUsbStatus] = useState<string | null>(null);
  const serialPortRef = useRef<SerialPortLike | null>(null);
  const serialWriterRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(
    null
  );
  const serialAbortRef = useRef(false);

  const pinsRef = useRef(pins);
  const sensorsRef = useRef(sensors);
  const setupRef = useRef(setupBlocks);
  const loopRef = useRef(loopBlocks);
  const buzzerSoundRef = useRef(buzzerSoundEnabled);
  const usbModeRef = useRef(usbMode);
  const usbConnectedRef = useRef(usbConnected);

  pinsRef.current = pins;
  sensorsRef.current = sensors;
  setupRef.current = setupBlocks;
  loopRef.current = loopBlocks;
  buzzerSoundRef.current = buzzerSoundEnabled;
  usbModeRef.current = usbMode;
  usbConnectedRef.current = usbConnected;

  const execPhaseRef = useRef<'setup' | 'loop'>('setup');
  const execQueueRef = useRef<UnoBlock[]>([]);
  const setupSeededRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setPins((prev) => ({
      ...prev,
      2: {
        ...(prev[2] ?? { mode: 'INPUT', pwm: null }),
        digital: sensors.irDetected ? 1 : 0,
      },
    }));
  }, [sensors.irDetected]);

  useEffect(() => {
    if (motorState.dir === 'STOP' || motorState.speed === 0) return;
    const id = window.setInterval(() => {
      const step = Math.max(8, Math.round((motorState.speed / 255) * 32));
      setMotorSpinDeg((d) =>
        (d + (motorState.dir === 'FWD' ? step : -step) + 360) % 360
      );
    }, 60);
    return () => window.clearInterval(id);
  }, [motorState]);

  const inoCode = useMemo(
    () => generateArduinoIno(setupBlocks, loopBlocks),
    [setupBlocks, loopBlocks]
  );

  const pushSerialLine = useCallback((line: string) => {
    setSerialLogs((prev) => [...prev.slice(-14), line]);
    setTxPulse(true);
    window.setTimeout(() => setTxPulse(false), 180);
  }, []);

  const playWebBeep = useCallback((freq: number, ms: number) => {
    if (!buzzerSoundRef.current) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = Math.max(120, Math.min(2400, freq));
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + Math.min(0.4, ms / 1000));
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      // Audio restricted
    }
  }, []);

  const sendFirmataPinMode = useCallback(
    async (pin: number, mode: UnoPinMode) => {
      if (!usbConnectedRef.current || usbModeRef.current !== 'firmata') return;
      const writer = serialWriterRef.current;
      if (!writer) return;
      const modeByte =
        mode === 'OUTPUT' ? 0x01 : mode === 'INPUT_PULLUP' ? 0x0b : 0x00;
      try {
        await writer.write(new Uint8Array([0xf4, pin & 0x7f, modeByte]));
      } catch {
        // Ignore
      }
    },
    []
  );

  const sendFirmataDigital = useCallback(
    async (pin: number, val: 0 | 1, latestPins: PinMap) => {
      if (!usbConnectedRef.current || usbModeRef.current !== 'firmata') return;
      const writer = serialWriterRef.current;
      if (!writer) return;
      const port = Math.floor(pin / 8);
      let mask = 0;
      for (let bit = 0; bit < 8; bit++) {
        const p = port * 8 + bit;
        const v = p === pin ? val : latestPins[p]?.digital ?? 0;
        if (v) mask |= 1 << bit;
      }
      try {
        await writer.write(
          new Uint8Array([0x90 + port, mask & 0x7f, (mask >> 7) & 0x7f])
        );
      } catch {
        // Ignore
      }
    },
    []
  );

  const sendFirmataPwm = useCallback(async (pin: number, value: number) => {
    if (!usbConnectedRef.current || usbModeRef.current !== 'firmata') return;
    const writer = serialWriterRef.current;
    if (!writer) return;
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    try {
      await writer.write(new Uint8Array([0xf4, pin & 0x7f, 0x03]));
      await writer.write(
        new Uint8Array([
          0xe0 + (pin & 0x0f),
          clamped & 0x7f,
          (clamped >> 7) & 0x7f,
        ])
      );
    } catch {
      // Ignore
    }
  }, []);

  const executeSingleStep = useCallback((): number => {
    if (!setupSeededRef.current) {
      setupSeededRef.current = true;
      execPhaseRef.current = 'setup';
      execQueueRef.current = [...setupRef.current];
    }

    if (execQueueRef.current.length === 0) {
      if (execPhaseRef.current === 'setup') {
        execPhaseRef.current = 'loop';
        execQueueRef.current = [...loopRef.current];
      } else {
        execQueueRef.current = [...loopRef.current];
      }
    }

    setPhaseLabel(execPhaseRef.current);

    if (execQueueRef.current.length === 0) {
      setActiveBlockId(null);
      return 250;
    }

    const block = execQueueRef.current.shift()!;
    setActiveBlockId(block.id);

    const nextPins = { ...pinsRef.current };
    let waitMs = 110;

    switch (block.kind) {
      case 'pin_mode': {
        nextPins[block.pin] = {
          ...(nextPins[block.pin] ?? { digital: 0, pwm: null }),
          mode: block.mode,
        };
        setPins(nextPins);
        sendFirmataPinMode(block.pin, block.mode);
        break;
      }
      case 'servo_attach': {
        nextPins[block.pin] = {
          ...(nextPins[block.pin] ?? { digital: 0, pwm: null }),
          mode: 'OUTPUT',
        };
        setPins(nextPins);
        break;
      }
      case 'serial_begin': {
        pushSerialLine(`Serial started @ ${block.baud} baud`);
        break;
      }
      case 'digital_write': {
        const bit: 0 | 1 = block.level === 'HIGH' ? 1 : 0;
        nextPins[block.pin] = {
          ...(nextPins[block.pin] ?? { mode: 'OUTPUT', digital: 0, pwm: null }),
          mode: 'OUTPUT',
          digital: bit,
          pwm: null,
        };
        setPins(nextPins);
        sendFirmataDigital(block.pin, bit, nextPins);
        break;
      }
      case 'analog_write': {
        nextPins[block.pin] = {
          ...(nextPins[block.pin] ?? { mode: 'OUTPUT', digital: 0, pwm: null }),
          mode: 'OUTPUT',
          digital: block.value > 0 ? 1 : 0,
          pwm: block.value,
        };
        setPins(nextPins);
        sendFirmataPwm(block.pin, block.value);
        break;
      }
      case 'delay': {
        waitMs = Math.max(50, Math.min(3000, block.ms));
        break;
      }
      case 'servo_write': {
        setServoAngle(Math.max(0, Math.min(180, block.angle)));
        break;
      }
      case 'dc_motor': {
        setMotorState({ dir: block.dir, speed: block.speed });
        const spd = block.dir === 'STOP' ? 0 : block.speed;
        nextPins[block.pinA] = {
          mode: 'OUTPUT',
          digital: block.dir === 'FWD' && spd > 0 ? 1 : 0,
          pwm: block.dir === 'FWD' ? spd : 0,
        };
        nextPins[block.pinB] = {
          mode: 'OUTPUT',
          digital: block.dir === 'REV' && spd > 0 ? 1 : 0,
          pwm: block.dir === 'REV' ? spd : 0,
        };
        setPins(nextPins);
        break;
      }
      case 'buzzer_tone': {
        setBuzzerState({ active: true, freq: block.freq });
        playWebBeep(block.freq, block.ms);
        window.setTimeout(() => {
          setBuzzerState({ active: false, freq: 0 });
        }, Math.min(400, block.ms));
        break;
      }
      case 'buzzer_stop': {
        setBuzzerState({ active: false, freq: 0 });
        break;
      }
      case 'serial_print': {
        const s = sensorsRef.current;
        const suffix =
          block.sensorSource === 'ultrasonic'
            ? ` ${s.ultrasonicCm} cm`
            : block.sensorSource === 'ir'
              ? ` ${s.irDetected ? 'HIGH (Detected)' : 'LOW (Clear)'}`
              : block.sensorSource === 'ldr'
                ? ` ${s.ldrValue}`
                : block.sensorSource === 'temp'
                  ? ` ${s.tempC}°C`
                  : '';
        pushSerialLine(`${block.label}${suffix}`);
        break;
      }
      case 'repeat': {
        const expanded: UnoBlock[] = [];
        for (let i = 0; i < Math.max(1, block.times); i++) {
          expanded.push(...block.children);
        }
        execQueueRef.current = [...expanded, ...execQueueRef.current];
        waitMs = 60;
        break;
      }
      case 'if_else': {
        const matched = evaluateSensorCondition(
          block.condition,
          sensorsRef.current,
          pinsRef.current
        );
        const branch = matched ? block.thenBlocks : block.elseBlocks;
        execQueueRef.current = [...branch, ...execQueueRef.current];
        waitMs = 60;
        break;
      }
    }

    return waitMs;
  }, [
    playWebBeep,
    pushSerialLine,
    sendFirmataDigital,
    sendFirmataPinMode,
    sendFirmataPwm,
  ]);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const ms = executeSingleStep();
      timerRef.current = window.setTimeout(tick, ms);
    };
    timerRef.current = window.setTimeout(tick, 40);
    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, executeSingleStep]);

  const handleResetBoard = () => {
    setIsRunning(false);
    setupSeededRef.current = false;
    execPhaseRef.current = 'setup';
    execQueueRef.current = [];
    setPhaseLabel('setup');
    setActiveBlockId(null);
    setPins(createInitialPins());
    setServoAngle(0);
    setMotorState({ dir: 'STOP', speed: 0 });
    setBuzzerState({ active: false, freq: 0 });
    setSerialLogs(['Board reset · Ready to run Setup.']);
  };

  const handleSelectPreset = (preset: UnoPreset) => {
    setIsRunning(false);
    setActivePresetId(preset.id);
    setSetupBlocks(clonePresetBlocks(preset.setup));
    setLoopBlocks(clonePresetBlocks(preset.loop));
    setupSeededRef.current = false;
    execPhaseRef.current = 'setup';
    execQueueRef.current = [];
    setPhaseLabel('setup');
    setActiveBlockId(null);
    setPins(createInitialPins());
    setServoAngle(0);
    setMotorState({ dir: 'STOP', speed: 0 });
    setBuzzerState({ active: false, freq: 0 });
    setSerialLogs([`Loaded "${preset.label}" · Click Run to test!`]);
  };

  const addBlockToSection = (
    section: 'setup' | 'loop',
    kind: UnoBlock['kind']
  ) => {
    const newBlock = createDefaultBlock(kind);
    if (section === 'setup') setSetupBlocks((p) => [...p, newBlock]);
    else setLoopBlocks((p) => [...p, newBlock]);
  };

  const handleDropIntoSection = (section: 'setup' | 'loop') => {
    setDropHighlight(null);
    if (dragKindFromPalette) {
      addBlockToSection(section, dragKindFromPalette);
      setDragKindFromPalette(null);
    }
  };

  const handleCopyIno = async () => {
    try {
      await navigator.clipboard.writeText(inoCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore
    }
  };

  const handleDownloadIno = () => {
    const blob = new Blob([inoCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skillos_uno_${activePresetId}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushSerialLine(`Downloaded skillos_uno_${activePresetId}.ino`);
  };

  const handleDisconnectUsb = async () => {
    serialAbortRef.current = true;
    try {
      serialWriterRef.current?.releaseLock();
    } catch {
      // Ignore
    }
    serialWriterRef.current = null;
    try {
      await serialPortRef.current?.close();
    } catch {
      // Ignore
    }
    serialPortRef.current = null;
    setUsbConnected(false);
    setUsbStatus('USB Serial disconnected.');
  };

  const handleConnectUsb = async () => {
    if (usbConnected) {
      await handleDisconnectUsb();
      return;
    }
    const nav = navigator as Navigator & {
      serial?: { requestPort: () => Promise<SerialPortLike> };
    };
    if (!nav.serial) {
      setUsbStatus(
        'Web Serial is unavailable in this browser. Click Download .ino to upload via Arduino IDE.'
      );
      return;
    }
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: usbMode === 'firmata' ? 57600 : 9600 });
      serialPortRef.current = port;
      serialWriterRef.current = port.writable ? port.writable.getWriter() : null;
      serialAbortRef.current = false;
      setUsbConnected(true);
      setUsbStatus(
        usbMode === 'firmata'
          ? 'Connected @ 57600 baud (Live Firmata mode).'
          : 'Connected @ 9600 baud (Listening to UNO R3 Serial).'
      );
      if (port.readable) {
        const reader = port.readable.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        (async () => {
          try {
            while (!serialAbortRef.current) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value && usbModeRef.current === 'serial') {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? '';
                for (const l of lines) {
                  if (l.trim()) pushSerialLine(`[USB] ${l}`);
                }
              }
            }
          } catch {
            // Stream closed
          } finally {
            try {
              reader.releaseLock();
            } catch {
              // Ignore
            }
          }
        })();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes('permissions policy') ||
        msg.toLowerCase().includes('access')
      ) {
        setUsbStatus(
          'Web Serial is blocked inside embedded preview iframes. Open the app URL directly in Chrome/Edge for USB, or click Download .ino to upload via Arduino IDE.'
        );
      } else {
        setUsbStatus(`USB Serial: ${msg}`);
      }
    }
  };

  const renderCanvasBlock = (
    block: UnoBlock,
    idx: number,
    section: 'setup' | 'loop',
    nestedHandlers?: {
      onMoveUp: () => void;
      onMoveDown: () => void;
      onDelete: () => void;
      canMoveUp: boolean;
      canMoveDown: boolean;
    }
  ) => {
    const isCurrent = activeBlockId === block.id;
    const isSetup = section === 'setup';
    const cardTone = isSetup
      ? 'bg-amber-50 border-amber-200 text-slate-900'
      : block.kind === 'if_else' || block.kind === 'repeat'
        ? 'bg-indigo-50 border-indigo-300 text-slate-900'
        : 'bg-sky-50 border-sky-200 text-slate-900';

    const updateThis = (patch: Partial<UnoBlock>) => {
      const fn = (b: UnoBlock) => ({ ...b, ...patch }) as UnoBlock;
      if (section === 'setup') {
        setSetupBlocks((prev) => updateBlockInTree(prev, block.id, fn));
      } else {
        setLoopBlocks((prev) => updateBlockInTree(prev, block.id, fn));
      }
    };

    const deleteThis = () => {
      if (nestedHandlers) {
        nestedHandlers.onDelete();
        return;
      }
      if (section === 'setup') {
        setSetupBlocks((prev) => removeBlockInTree(prev, block.id));
      } else {
        setLoopBlocks((prev) => removeBlockInTree(prev, block.id));
      }
    };

    const moveTopLevel = (delta: number) => {
      if (nestedHandlers) {
        if (delta < 0) nestedHandlers.onMoveUp();
        else nestedHandlers.onMoveDown();
        return;
      }
      if (section === 'setup') {
        setSetupBlocks((prev) => moveInArray(prev, idx, idx + delta));
      } else {
        setLoopBlocks((prev) => moveInArray(prev, idx, idx + delta));
      }
    };

    const topLen = section === 'setup' ? setupBlocks.length : loopBlocks.length;
    const canUp = nestedHandlers ? nestedHandlers.canMoveUp : idx > 0;
    const canDown = nestedHandlers
      ? nestedHandlers.canMoveDown
      : idx < topLen - 1;

    return (
      <div
        key={block.id}
        draggable={!nestedHandlers}
        onDragStart={() => {
          if (!nestedHandlers) {
            setDragKindFromPalette(null);
            setDragReorder({ section, index: idx });
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.stopPropagation();
          setDropHighlight(null);
          if (!nestedHandlers && dragReorder && dragReorder.section === section) {
            if (section === 'setup') {
              setSetupBlocks((prev) =>
                moveInArray(prev, dragReorder.index, idx)
              );
            } else {
              setLoopBlocks((prev) =>
                moveInArray(prev, dragReorder.index, idx)
              );
            }
            setDragReorder(null);
          } else if (dragKindFromPalette) {
            addBlockToSection(section, dragKindFromPalette);
            setDragKindFromPalette(null);
          }
        }}
        className={`rounded-xl border px-3 py-2 text-[13px] space-y-2 transition-all ${cardTone} ${
          isCurrent
            ? 'ring-2 ring-emerald-500 border-emerald-600 shadow-sm'
            : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {!nestedHandlers && (
              <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab shrink-0" />
            )}

            {isCurrent && (
              <span className="text-emerald-700 font-bold text-xs" aria-hidden="true">
                ▶
              </span>
            )}

            {block.kind === 'pin_mode' && (
              <>
                <span className="font-medium">Set pin</span>
                <select
                  aria-label="Pin number"
                  value={block.pin}
                  onChange={(e) => updateThis({ pin: Number(e.target.value) })}
                  className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-semibold text-xs"
                >
                  {DIGITAL_PINS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span>as</span>
                <select
                  aria-label="Pin mode"
                  value={block.mode}
                  onChange={(e) =>
                    updateThis({ mode: e.target.value as UnoPinMode })
                  }
                  className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-semibold text-xs"
                >
                  <option value="OUTPUT">OUTPUT</option>
                  <option value="INPUT">INPUT</option>
                  <option value="INPUT_PULLUP">INPUT_PULLUP</option>
                </select>
              </>
            )}

            {block.kind === 'servo_attach' && (
              <>
                <span className="font-medium">Attach Servo on pin</span>
                <select
                  aria-label="Servo pin"
                  value={block.pin}
                  onChange={(e) =>
                    updateThis({ pin: Number(e.target.value) as PwmPin })
                  }
                  className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-semibold text-xs"
                >
                  {PWM_PINS.map((p) => (
                    <option key={p} value={p}>
                      ~{p}
                    </option>
                  ))}
                </select>
              </>
            )}

            {block.kind === 'serial_begin' && (
              <>
                <span className="font-medium">Start Serial at</span>
                <select
                  aria-label="Baud rate"
                  value={block.baud}
                  onChange={(e) =>
                    updateThis({
                      baud: Number(e.target.value) as 9600 | 57600 | 115200,
                    })
                  }
                  className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-semibold text-xs"
                >
                  <option value={9600}>9600</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </>
            )}

            {block.kind === 'digital_write' && (
              <>
                <span className="font-medium">Set pin</span>
                <select
                  aria-label="Digital pin"
                  value={block.pin}
                  onChange={(e) => updateThis({ pin: Number(e.target.value) })}
                  className="px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs"
                >
                  {DIGITAL_PINS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Level"
                  value={block.level}
                  onChange={(e) =>
                    updateThis({ level: e.target.value as LogicLevel })
                  }
                  className="px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs"
                >
                  <option value="HIGH">HIGH</option>
                  <option value="LOW">LOW</option>
                </select>
              </>
            )}

            {block.kind === 'analog_write' && (
              <>
                <span className="font-medium">Set PWM pin</span>
                <select
                  aria-label="PWM pin"
                  value={block.pin}
                  onChange={(e) =>
                    updateThis({ pin: Number(e.target.value) as PwmPin })
                  }
                  className="px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs"
                >
                  {PWM_PINS.map((p) => (
                    <option key={p} value={p}>
                      ~{p}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <input
                  type="number"
                  aria-label="PWM brightness"
                  min={0}
                  max={255}
                  value={block.value}
                  onChange={(e) =>
                    updateThis({
                      value: Math.max(
                        0,
                        Math.min(255, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-16 px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs tabular-nums"
                />
              </>
            )}

            {block.kind === 'delay' && (
              <>
                <span className="font-medium">Wait</span>
                <input
                  type="number"
                  aria-label="Wait milliseconds"
                  min={50}
                  max={3000}
                  step={100}
                  value={block.ms}
                  onChange={(e) =>
                    updateThis({
                      ms: Math.max(
                        50,
                        Math.min(3000, Number(e.target.value) || 50)
                      ),
                    })
                  }
                  className="w-16 px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs tabular-nums"
                />
                <span>milliseconds</span>
              </>
            )}

            {block.kind === 'servo_write' && (
              <>
                <span className="font-medium">Rotate Servo to</span>
                <input
                  type="number"
                  aria-label="Servo angle"
                  min={0}
                  max={180}
                  step={15}
                  value={block.angle}
                  onChange={(e) =>
                    updateThis({
                      angle: Math.max(
                        0,
                        Math.min(180, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-14 px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs tabular-nums"
                />
                <span>°</span>
              </>
            )}

            {block.kind === 'dc_motor' && (
              <>
                <span className="font-medium">DC Motor</span>
                <select
                  aria-label="Motor direction"
                  value={block.dir}
                  onChange={(e) =>
                    updateThis({ dir: e.target.value as MotorDir })
                  }
                  className="px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs"
                >
                  <option value="FWD">FORWARD</option>
                  <option value="REV">REVERSE</option>
                  <option value="STOP">STOP</option>
                </select>
                {block.dir !== 'STOP' && (
                  <input
                    type="number"
                    aria-label="Motor speed"
                    min={0}
                    max={255}
                    value={block.speed}
                    onChange={(e) =>
                      updateThis({
                        speed: Math.max(
                          0,
                          Math.min(255, Number(e.target.value) || 0)
                        ),
                      })
                    }
                    className="w-14 px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs tabular-nums"
                  />
                )}
              </>
            )}

            {block.kind === 'buzzer_tone' && (
              <>
                <span className="font-medium">Play Buzzer D{block.pin}</span>
                <input
                  type="number"
                  aria-label="Buzzer frequency Hz"
                  min={150}
                  max={2000}
                  step={20}
                  value={block.freq}
                  onChange={(e) =>
                    updateThis({
                      freq: Math.max(
                        150,
                        Math.min(2000, Number(e.target.value) || 440)
                      ),
                    })
                  }
                  className="w-16 px-2 py-0.5 rounded-md border border-sky-300 bg-white font-semibold text-xs tabular-nums"
                />
                <span>Hz</span>
              </>
            )}

            {block.kind === 'buzzer_stop' && (
              <span className="font-medium">Stop Buzzer (D{block.pin})</span>
            )}

            {block.kind === 'serial_print' && (
              <>
                <span className="font-medium">Print</span>
                <input
                  type="text"
                  aria-label="Serial text"
                  value={block.label}
                  onChange={(e) => updateThis({ label: e.target.value })}
                  className="w-24 px-2 py-0.5 rounded-md border border-sky-300 bg-white text-xs"
                />
                <select
                  aria-label="Sensor reading"
                  value={block.sensorSource}
                  onChange={(e) =>
                    updateThis({
                      sensorSource: e.target.value as
                        | 'none'
                        | 'ultrasonic'
                        | 'ir'
                        | 'ldr'
                        | 'temp',
                    })
                  }
                  className="px-2 py-0.5 rounded-md border border-sky-300 bg-white text-xs"
                >
                  <option value="none">(Text only)</option>
                  <option value="ultrasonic">+ Ultrasonic cm</option>
                  <option value="ir">+ IR Sensor</option>
                  <option value="ldr">+ LDR Light</option>
                  <option value="temp">+ Temp °C</option>
                </select>
              </>
            )}

            {block.kind === 'repeat' && (
              <>
                <span className="font-semibold text-indigo-950">Repeat</span>
                <input
                  type="number"
                  aria-label="Repeat count"
                  min={1}
                  max={10}
                  value={block.times}
                  onChange={(e) =>
                    updateThis({
                      times: Math.max(
                        1,
                        Math.min(10, Number(e.target.value) || 1)
                      ),
                    })
                  }
                  className="w-12 px-2 py-0.5 rounded-md border border-indigo-300 bg-white font-semibold text-xs tabular-nums"
                />
                <span>times</span>
              </>
            )}

            {block.kind === 'if_else' && (
              <>
                <span className="font-semibold text-indigo-950">If</span>
                <select
                  aria-label="Sensor condition"
                  value={block.condition.kind}
                  onChange={(e) => {
                    const kind = e.target.value as SensorConditionKind;
                    const defaultThreshold =
                      kind === 'ultrasonic_lt'
                        ? 25
                        : kind === 'ldr_lt'
                          ? 450
                          : kind === 'temp_gt'
                            ? 30
                            : 1;
                    updateThis({
                      condition: {
                        ...block.condition,
                        kind,
                        threshold: defaultThreshold,
                      },
                    });
                  }}
                  className="px-2 py-0.5 rounded-md border border-indigo-300 bg-white font-semibold text-xs"
                >
                  <option value="ultrasonic_lt">Ultrasonic cm &lt;</option>
                  <option value="ir_detected">IR Sensor (D2) == DETECTED</option>
                  <option value="ldr_lt">LDR Light (A0) &lt;</option>
                  <option value="temp_gt">Temp °C (A1) &gt;</option>
                  <option value="pin_high">Pin D2 == HIGH</option>
                </select>
                {(block.condition.kind === 'ultrasonic_lt' ||
                  block.condition.kind === 'ldr_lt' ||
                  block.condition.kind === 'temp_gt') && (
                  <input
                    type="number"
                    aria-label="Condition threshold"
                    value={block.condition.threshold}
                    onChange={(e) =>
                      updateThis({
                        condition: {
                          ...block.condition,
                          threshold: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-14 px-2 py-0.5 rounded-md border border-indigo-300 bg-white font-semibold text-xs tabular-nums"
                  />
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              title="Move up"
              aria-label="Move block up"
              disabled={!canUp}
              onClick={() => moveTopLevel(-1)}
              className="p-1 rounded hover:bg-white disabled:opacity-30 text-slate-600 cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Move down"
              aria-label="Move block down"
              disabled={!canDown}
              onClick={() => moveTopLevel(1)}
              className="p-1 rounded hover:bg-white disabled:opacity-30 text-slate-600 cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Delete block"
              aria-label="Delete block"
              onClick={deleteThis}
              className="p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Nested Children for Repeat */}
        {block.kind === 'repeat' && (
          <div className="pl-3 space-y-1.5 border-l-2 border-indigo-300">
            {block.children.map((child, cIdx) =>
              renderCanvasBlock(child, cIdx, section, {
                canMoveUp: cIdx > 0,
                canMoveDown: cIdx < block.children.length - 1,
                onMoveUp: () =>
                  updateThis({
                    children: moveInArray(block.children, cIdx, cIdx - 1),
                  }),
                onMoveDown: () =>
                  updateThis({
                    children: moveInArray(block.children, cIdx, cIdx + 1),
                  }),
                onDelete: () =>
                  updateThis({
                    children: block.children.filter((x) => x.id !== child.id),
                  }),
              })
            )}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() =>
                  updateThis({
                    children: [
                      ...block.children,
                      createDefaultBlock('digital_write'),
                    ],
                  })
                }
                className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100 cursor-pointer"
              >
                + LED Pin
              </button>
              <button
                type="button"
                onClick={() =>
                  updateThis({
                    children: [...block.children, createDefaultBlock('delay')],
                  })
                }
                className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100 cursor-pointer"
              >
                + Wait
              </button>
            </div>
          </div>
        )}

        {/* Nested Then / Else for If-Else */}
        {block.kind === 'if_else' && (
          <div className="pl-3 space-y-2 border-l-2 border-indigo-300">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900">
                <span>Then do:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateThis({
                        thenBlocks: [
                          ...block.thenBlocks,
                          createDefaultBlock('digital_write'),
                        ],
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                  >
                    + LED
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateThis({
                        thenBlocks: [
                          ...block.thenBlocks,
                          createDefaultBlock('servo_write'),
                        ],
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                  >
                    + Servo
                  </button>
                </div>
              </div>
              {block.thenBlocks.map((child, cIdx) =>
                renderCanvasBlock(child, cIdx, section, {
                  canMoveUp: cIdx > 0,
                  canMoveDown: cIdx < block.thenBlocks.length - 1,
                  onMoveUp: () =>
                    updateThis({
                      thenBlocks: moveInArray(block.thenBlocks, cIdx, cIdx - 1),
                    }),
                  onMoveDown: () =>
                    updateThis({
                      thenBlocks: moveInArray(block.thenBlocks, cIdx, cIdx + 1),
                    }),
                  onDelete: () =>
                    updateThis({
                      thenBlocks: block.thenBlocks.filter(
                        (x) => x.id !== child.id
                      ),
                    }),
                })
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span>Otherwise (Else):</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateThis({
                        elseBlocks: [
                          ...block.elseBlocks,
                          createDefaultBlock('digital_write'),
                        ],
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    + LED
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateThis({
                        elseBlocks: [
                          ...block.elseBlocks,
                          createDefaultBlock('servo_write'),
                        ],
                      })
                    }
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    + Servo
                  </button>
                </div>
              </div>
              {block.elseBlocks.map((child, cIdx) =>
                renderCanvasBlock(child, cIdx, section, {
                  canMoveUp: cIdx > 0,
                  canMoveDown: cIdx < block.elseBlocks.length - 1,
                  onMoveUp: () =>
                    updateThis({
                      elseBlocks: moveInArray(block.elseBlocks, cIdx, cIdx - 1),
                    }),
                  onMoveDown: () =>
                    updateThis({
                      elseBlocks: moveInArray(block.elseBlocks, cIdx, cIdx + 1),
                    }),
                  onDelete: () =>
                    updateThis({
                      elseBlocks: block.elseBlocks.filter(
                        (x) => x.id !== child.id
                      ),
                    }),
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const d13On = pins[13]?.digital === 1;
  const d9State = pins[9];
  const d9Brightness =
    d9State?.pwm !== null && d9State?.pwm !== undefined
      ? d9State.pwm / 255
      : d9State?.digital === 1
        ? 1
        : 0;

  const categoryItems = PALETTE_ITEMS.filter(
    (item) => item.category === activeCategory
  );

  return (
    <div className="space-y-4">
      {/* Top Bar: Student Presets + Big Green Run / Step / Reset / Download */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Starter Projects:
          </span>
          {UNO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activePresetId === preset.id
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning((r) => !r)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Program</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => executeSingleStep()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Step</span>
          </button>

          <button
            type="button"
            onClick={handleResetBoard}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadIno}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ino</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Scratch / Blockly@rduino Kid-Friendly Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Pane 1 (Left): Color-Coded Categories + Visual Picture Blocks */}
        <div className="xl:col-span-3 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
            1. Pick Blocks (Drag or Click)
          </div>

          <div className="flex-1 grid grid-cols-12 min-h-[380px]">
            {/* Category Sidebar */}
            <div className="col-span-5 border-r border-slate-200 bg-slate-50/70 p-1.5 space-y-1">
              {CATEGORIES.map((cat) => {
                const active = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      active
                        ? cat.activeBg
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`w-2 h-5 rounded-sm shrink-0 ${cat.barColor}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Visual Picture Block Cards */}
            <div className="col-span-7 p-2.5 space-y-2 bg-white">
              {categoryItems.map((item, idx) => (
                <button
                  key={`${item.kind}-${idx}`}
                  type="button"
                  draggable
                  onDragStart={() => {
                    setDragReorder(null);
                    setDragKindFromPalette(item.kind);
                  }}
                  onDragEnd={() => {
                    setDragKindFromPalette(null);
                    setDropHighlight(null);
                  }}
                  onClick={() => addBlockToSection(item.target, item.kind)}
                  className={`w-full text-left rounded-xl border p-2.5 shadow-sm transition-transform active:scale-[0.98] cursor-grab ${item.blockColor}`}
                >
                  <div className="flex items-center gap-2">
                    <MiniHardwareIcon kind={item.iconKind} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight">
                        {item.title}
                      </div>
                      <div className="text-[10px] opacity-90 mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                    <Plus className="w-3.5 h-3.5 shrink-0 opacity-90" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pane 2 (Center): Dotted Scratch Canvas (Arduino Program -> Setup + Forever) */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50/70 p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            {/* Top Hat Block: Arduino Program */}
            <div className="rounded-t-2xl rounded-b-lg bg-amber-500 text-white px-4 py-2.5 shadow-sm flex items-center justify-between">
              <span className="text-sm font-bold tracking-tight">
                Arduino Program
              </span>
              <span className="text-[11px] font-mono bg-amber-600/70 px-2 py-0.5 rounded">
                Phase: {phaseLabel}()
              </span>
            </div>

            {/* Setup C-Block (Gold / Yellow matching user's diagram) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropHighlight('setup');
              }}
              onDragLeave={() => setDropHighlight(null)}
              onDrop={() => handleDropIntoSection('setup')}
              className={`rounded-xl bg-amber-400 border p-2.5 space-y-2 transition-colors ${
                dropHighlight === 'setup'
                  ? 'border-amber-700 ring-2 ring-amber-300'
                  : 'border-amber-500/70'
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-900">Setup</span>
                <span className="text-[11px] text-amber-950/80">
                  Runs 1 time
                </span>
              </div>

              <div className="rounded-lg bg-amber-50/95 p-2 space-y-1.5 min-h-[54px]">
                {setupBlocks.length === 0 ? (
                  <div className="py-3 text-center text-xs text-amber-800/70 border border-dashed border-amber-300 rounded-md">
                    Drop Setup blocks here
                  </div>
                ) : (
                  setupBlocks.map((b, i) => renderCanvasBlock(b, i, 'setup'))
                )}
              </div>
            </div>

            {/* Forever (Loop) C-Block (Bright Sky Blue matching user's diagram) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropHighlight('loop');
              }}
              onDragLeave={() => setDropHighlight(null)}
              onDrop={() => handleDropIntoSection('loop')}
              className={`rounded-xl bg-sky-500 border p-2.5 space-y-2 transition-colors ${
                dropHighlight === 'loop'
                  ? 'border-sky-800 ring-2 ring-sky-200'
                  : 'border-sky-600/60'
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-white">
                  Forever (Loop)
                </span>
                <span className="text-[11px] text-sky-100">
                  Repeats continuously
                </span>
              </div>

              <div className="rounded-lg bg-sky-50/95 p-2 space-y-1.5 min-h-[150px]">
                {loopBlocks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-sky-800/70 border border-dashed border-sky-300 rounded-md">
                    Drop LED, Sensor, Motor, or Wait blocks here
                  </div>
                ) : (
                  loopBlocks.map((b, i) => renderCanvasBlock(b, i, 'loop'))
                )}
              </div>
            </div>
          </div>

          {/* Workflow Strip at Bottom of Canvas */}
          <div className="rounded-lg bg-white/90 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-slate-900">1. Learn</strong> (Blocks)
              <span className="mx-1.5 text-slate-400">·</span>
              <strong className="text-slate-900">2. Simulate</strong> (Virtual UNO)
              <span className="mx-1.5 text-slate-400">·</span>
              <strong className="text-slate-900">3. Deploy</strong> (.ino Upload)
            </span>
          </div>
        </div>

        {/* Pane 3 (Right): Virtual Arduino UNO R3 Simulator + Generated Arduino C++ */}
        <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          {/* Sub-tabs inside Right Pane */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRightPaneTab('board')}
                className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  rightPaneTab === 'board'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Virtual UNO &amp; Sensors
              </button>
              <button
                type="button"
                onClick={() => setRightPaneTab('code')}
                className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  rightPaneTab === 'code'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Arduino Code &amp; Upload
              </button>
            </div>
          </div>

          {rightPaneTab === 'board' ? (
            <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
              {/* Virtual Arduino UNO R3 + Output Devices */}
              <div className="bg-slate-900 rounded-xl p-3 text-slate-100 space-y-2.5">
                <svg
                  viewBox="0 0 460 225"
                  className="w-full h-auto"
                  role="img"
                  aria-label="Virtual Arduino UNO R3 with LED, Servo, DC Motor, and Buzzer"
                >
                  {/* UNO PCB */}
                  <rect
                    x="10"
                    y="12"
                    width="244"
                    height="170"
                    rx="9"
                    fill="#0E7490"
                    stroke="#22D3EE"
                    strokeWidth="1.5"
                  />
                  {/* USB & Power */}
                  <rect x="2" y="32" width="22" height="30" rx="2" fill="#CBD5E1" />
                  <rect x="2" y="136" width="24" height="28" rx="2" fill="#1E293B" />

                  {/* Reset */}
                  <g onClick={handleResetBoard} className="cursor-pointer">
                    <rect x="32" y="18" width="16" height="14" rx="2" fill="#F8FAFC" />
                    <circle cx="40" cy="25" r="3.5" fill="#DC2626" />
                  </g>

                  <text
                    x="62"
                    y="70"
                    fill="#F8FAFC"
                    fontSize="12"
                    fontWeight="700"
                    fontFamily="Plus Jakarta Sans"
                  >
                    ARDUINO UNO R3
                  </text>
                  <rect
                    x="78"
                    y="90"
                    width="154"
                    height="42"
                    rx="4"
                    fill="#0F172A"
                    stroke="#475569"
                  />
                  <text
                    x="155"
                    y="115"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="9.5"
                    fontFamily="IBM Plex Mono"
                  >
                    ATMEGA328P
                  </text>

                  {/* ON / TX / L(13) LEDs */}
                  <circle cx="234" cy="56" r="3.5" fill="#10B981" />
                  <circle cx="90" cy="50" r="3.5" fill={txPulse ? '#FBBF24' : '#334155'} />
                  <circle
                    cx="134"
                    cy="50"
                    r="5"
                    fill={d13On ? '#F59E0B' : '#334155'}
                    stroke={d13On ? '#FDE68A' : '#475569'}
                    strokeWidth="1.4"
                  />
                  <text x="143" y="53" fill="#FDE68A" fontSize="7.5" fontFamily="IBM Plex Mono">
                    L (13)
                  </text>

                  {/* Digital Pins D13..D0 (Click to identify pin) */}
                  {Array.from({ length: 14 }, (_, idx) => {
                    const pin = 13 - idx;
                    const px = 62 + idx * 13.5;
                    const st = pins[pin];
                    const isPwmPin = PWM_PINS.includes(pin as PwmPin);
                    const activeColor =
                      st?.pwm !== null && st?.pwm !== undefined && st.pwm > 0
                        ? '#38BDF8'
                        : st?.digital === 1
                          ? '#34D399'
                          : '#0F172A';
                    return (
                      <g
                        key={pin}
                        onClick={() =>
                          setSelectedPinInfo(UNO_PIN_INFO[`D${pin}`] ?? `Pin D${pin}`)
                        }
                        className="cursor-pointer"
                      >
                        <rect
                          x={px}
                          y="16"
                          width="10"
                          height="10"
                          rx="1.5"
                          fill={activeColor}
                          stroke="#94A3B8"
                        />
                        <text
                          x={px + 5}
                          y="35"
                          textAnchor="middle"
                          fill="#F8FAFC"
                          fontSize="6.5"
                          fontFamily="IBM Plex Mono"
                        >
                          {isPwmPin ? `~${pin}` : pin}
                        </text>
                      </g>
                    );
                  })}

                  {/* Analog Pins A0..A5 */}
                  {Array.from({ length: 6 }, (_, idx) => {
                    const px = 160 + idx * 14;
                    return (
                      <g
                        key={idx}
                        onClick={() =>
                          setSelectedPinInfo(UNO_PIN_INFO[`A${idx}`] ?? `Pin A${idx}`)
                        }
                        className="cursor-pointer"
                      >
                        <rect
                          x={px}
                          y="166"
                          width="10"
                          height="10"
                          rx="1.5"
                          fill={idx <= 1 ? '#0284C7' : '#0F172A'}
                          stroke="#94A3B8"
                        />
                        <text
                          x={px + 5}
                          y="161"
                          textAnchor="middle"
                          fill="#F8FAFC"
                          fontSize="6.5"
                          fontFamily="IBM Plex Mono"
                        >
                          A{idx}
                        </text>
                      </g>
                    );
                  })}

                  {/* Connected Actuators Box */}
                  <rect
                    x="266"
                    y="12"
                    width="184"
                    height="170"
                    rx="9"
                    fill="#1E293B"
                    stroke="#334155"
                  />

                  {/* LED D13 */}
                  <circle
                    cx="290"
                    cy="38"
                    r="11"
                    fill={d13On ? '#F59E0B' : '#0F172A'}
                    stroke={d13On ? '#FDE68A' : '#475569'}
                    strokeWidth="2"
                  />
                  <text x="308" y="36" fill="#F8FAFC" fontSize="9.5" fontWeight="600">
                    LED (D13)
                  </text>
                  <text
                    x="308"
                    y="48"
                    fill={d13On ? '#FDE68A' : '#94A3B8'}
                    fontSize="8.5"
                    fontFamily="IBM Plex Mono"
                  >
                    {d13On ? 'ON (5V)' : 'OFF'}
                  </text>

                  {/* PWM ~D9 */}
                  <circle
                    cx="290"
                    cy="76"
                    r="11"
                    fill="#38BDF8"
                    fillOpacity={Math.max(0.12, d9Brightness)}
                    stroke={d9Brightness > 0 ? '#7DD3FC' : '#475569'}
                    strokeWidth="2"
                  />
                  <text x="308" y="74" fill="#F8FAFC" fontSize="9.5" fontWeight="600">
                    PWM (~D9)
                  </text>
                  <text
                    x="308"
                    y="86"
                    fill="#BAE6FD"
                    fontSize="8.5"
                    fontFamily="IBM Plex Mono"
                  >
                    {d9State?.pwm ?? (d9State?.digital === 1 ? 255 : 0)}/255
                  </text>

                  {/* Servo */}
                  <g transform="translate(290, 118)">
                    <circle r="12" fill="#0F172A" stroke="#8B5CF6" strokeWidth="1.5" />
                    <g transform={`rotate(${servoAngle - 90})`}>
                      <rect x="-2.5" y="-14" width="5" height="16" rx="2.5" fill="#A78BFA" />
                    </g>
                    <circle r="3" fill="#F8FAFC" />
                  </g>
                  <text x="308" y="116" fill="#F8FAFC" fontSize="9.5" fontWeight="600">
                    Servo ({servoAngle}°)
                  </text>

                  {/* DC Motor */}
                  <g transform="translate(402, 118)">
                    <circle r="12" fill="#0F172A" stroke="#34D399" strokeWidth="1.5" />
                    <g transform={`rotate(${motorSpinDeg})`}>
                      <line x1="-9" y1="0" x2="9" y2="0" stroke="#34D399" strokeWidth="2" />
                      <line x1="0" y1="-9" x2="0" y2="9" stroke="#34D399" strokeWidth="2" />
                    </g>
                  </g>
                  <text x="372" y="142" fill="#6EE7B7" fontSize="8" fontFamily="IBM Plex Mono">
                    Motor: {motorState.dir}
                  </text>

                  {/* Buzzer */}
                  <rect
                    x="278"
                    y="150"
                    width="160"
                    height="24"
                    rx="5"
                    fill={buzzerState.active ? '#4C1D95' : '#0F172A'}
                    stroke={buzzerState.active ? '#A78BFA' : '#475569'}
                  />
                  <text
                    x="358"
                    y="165"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="8.5"
                    fontFamily="IBM Plex Mono"
                  >
                    {buzzerState.active
                      ? `Buzzer: ${buzzerState.freq} Hz`
                      : 'Buzzer (D4): Idle'}
                  </text>

                  {/* Pin Identification Info */}
                  <text x="12" y="206" fill="#7DD3FC" fontSize="9.5" fontFamily="IBM Plex Mono">
                    {selectedPinInfo}
                  </text>
                </svg>

                {/* Interactive Sensors Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px]">
                  <div className="flex items-center gap-2">
                    <label htmlFor="uno-us" className="font-mono text-slate-300 w-24 shrink-0">
                      Ultrasonic:
                    </label>
                    <input
                      id="uno-us"
                      type="range"
                      min={4}
                      max={200}
                      value={sensors.ultrasonicCm}
                      onChange={(e) =>
                        setSensors((s) => ({
                          ...s,
                          ultrasonicCm: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums text-cyan-300 w-12 text-right">
                      {sensors.ultrasonicCm}cm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="uno-ldr" className="font-mono text-slate-300 w-24 shrink-0">
                      LDR Light:
                    </label>
                    <input
                      id="uno-ldr"
                      type="range"
                      min={0}
                      max={1023}
                      value={sensors.ldrValue}
                      onChange={(e) =>
                        setSensors((s) => ({ ...s, ldrValue: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums text-amber-300 w-12 text-right">
                      {sensors.ldrValue}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label htmlFor="uno-tmp" className="font-mono text-slate-300 w-24 shrink-0">
                      Temp (A1):
                    </label>
                    <input
                      id="uno-tmp"
                      type="range"
                      min={0}
                      max={60}
                      value={sensors.tempC}
                      onChange={(e) =>
                        setSensors((s) => ({ ...s, tempC: Number(e.target.value) }))
                      }
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                    <span className="font-mono tabular-nums text-rose-300 w-12 text-right">
                      {sensors.tempC}°C
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSensors((s) => ({ ...s, irDetected: !s.irDetected }))
                      }
                      className={`px-2.5 py-1 rounded font-mono cursor-pointer ${
                        sensors.irDetected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      IR D2: {sensors.irDetected ? 'DETECTED' : 'CLEAR'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setBuzzerSoundEnabled((v) => !v)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      {buzzerSoundEnabled ? (
                        <>
                          <Volume2 className="w-3 h-3 text-violet-300" />
                          <span>Sound On</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3 h-3 text-slate-400" />
                          <span>Muted</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mini Serial Monitor + Code Preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Terminal className="w-3 h-3 text-sky-400" />
                    <span>Serial Monitor</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRightPaneTab('code')}
                    className="text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    View Arduino C++ →
                  </button>
                </div>
                <div className="h-20 overflow-y-auto font-mono text-[11px] text-emerald-300 space-y-0.5">
                  {serialLogs.map((l, idx) => (
                    <div key={idx}>{l}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Auto-Generated Arduino C++
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyIno}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy C++</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="h-56 overflow-auto rounded-xl bg-slate-950 text-slate-100 p-3 font-mono text-xs leading-relaxed">
                  <code>{inoCode}</code>
                </pre>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">
                  3 Steps to Upload to Physical UNO R3:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                  <li>
                    Click <strong className="text-slate-900">Download .ino</strong> above.
                  </li>
                  <li>
                    Open the file in <strong className="text-slate-900">Arduino IDE</strong> and select <span className="font-mono">Board: Arduino Uno</span> + USB Port.
                  </li>
                  <li>
                    Click <strong className="text-slate-900">Upload</strong> to flash your UNO R3.
                  </li>
                </ol>

                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <select
                    aria-label="USB mode"
                    disabled={usbConnected}
                    value={usbMode}
                    onChange={(e) =>
                      setUsbMode(e.target.value as 'serial' | 'firmata')
                    }
                    className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px]"
                  >
                    <option value="serial">USB Serial (9600)</option>
                    <option value="firmata">Firmata Bridge (57600)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-white cursor-pointer ${
                      usbConnected ? 'bg-emerald-700' : 'bg-sky-700 hover:bg-sky-800'
                    }`}
                  >
                    <Usb className="w-3 h-3" />
                    <span>{usbConnected ? 'Disconnect USB' : 'Connect UNO USB'}</span>
                  </button>
                </div>

                {usbStatus && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <AlertCircle className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                    <span>{usbStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
