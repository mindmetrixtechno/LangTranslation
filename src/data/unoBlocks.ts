export type UnoPinMode = 'OUTPUT' | 'INPUT' | 'INPUT_PULLUP';
export type PwmPin = 3 | 5 | 6 | 9 | 10 | 11;
export type LogicLevel = 'HIGH' | 'LOW';
export type MotorDir = 'FWD' | 'REV' | 'STOP';

export type SensorConditionKind =
  | 'ultrasonic_lt'
  | 'ir_detected'
  | 'ldr_lt'
  | 'temp_gt'
  | 'pin_high';

export interface SensorCondition {
  kind: SensorConditionKind;
  threshold: number;
  pin: number;
}

export type UnoBlock =
  | { id: string; kind: 'pin_mode'; pin: number; mode: UnoPinMode }
  | { id: string; kind: 'servo_attach'; pin: PwmPin }
  | { id: string; kind: 'serial_begin'; baud: 9600 | 57600 | 115200 }
  | { id: string; kind: 'digital_write'; pin: number; level: LogicLevel }
  | { id: string; kind: 'analog_write'; pin: PwmPin; value: number }
  | { id: string; kind: 'delay'; ms: number }
  | { id: string; kind: 'servo_write'; angle: number }
  | {
      id: string;
      kind: 'dc_motor';
      pinA: PwmPin;
      pinB: PwmPin;
      speed: number;
      dir: MotorDir;
    }
  | { id: string; kind: 'buzzer_tone'; pin: number; freq: number; ms: number }
  | { id: string; kind: 'buzzer_stop'; pin: number }
  | {
      id: string;
      kind: 'serial_print';
      label: string;
      sensorSource: 'none' | 'ultrasonic' | 'ir' | 'ldr' | 'temp';
    }
  | {
      id: string;
      kind: 'repeat';
      times: number;
      children: UnoBlock[];
    }
  | {
      id: string;
      kind: 'if_else';
      condition: SensorCondition;
      thenBlocks: UnoBlock[];
      elseBlocks: UnoBlock[];
    };

export interface UnoPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  setup: UnoBlock[];
  loop: UnoBlock[];
}

export const PWM_PINS: PwmPin[] = [3, 5, 6, 9, 10, 11];
export const DIGITAL_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function uid(): string {
  return Math.random().toString(36).slice(2, 8);
}

export const UNO_PIN_INFO: Record<string, string> = {
  D0: 'D0 (RX) · USB Serial Receive — avoid wiring sensors here during upload.',
  D1: 'D1 (TX) · USB Serial Transmit — flashes TX LED when Serial.println runs.',
  D2: 'D2 · Digital I/O & External Interrupt (INT0) — wired to IR Obstacle Sensor.',
  D3: '~D3 · Digital I/O with 8-bit PWM (~) & External Interrupt (INT1).',
  D4: 'D4 · Digital I/O — wired to Piezo Buzzer tone() output.',
  D5: '~D5 · 8-bit PWM (~) — wired to DC Motor Driver Channel A.',
  D6: '~D6 · 8-bit PWM (~) — wired to DC Motor Driver Channel B.',
  D7: 'D7 · Digital I/O — wired to Ultrasonic HC-SR04 TRIG pulse.',
  D8: 'D8 · Digital I/O — wired to Ultrasonic HC-SR04 ECHO return.',
  D9: '~D9 · 8-bit PWM (~) — wired to PWM Dimmer LED & Servo Motor signal.',
  D10: '~D10 · 8-bit PWM (~) & SPI SS.',
  D11: '~D11 · 8-bit PWM (~) & SPI MOSI.',
  D12: 'D12 · Digital I/O & SPI MISO.',
  D13: 'D13 · Built-in L LED & SPI SCK — classic Blink output pin.',
  A0: 'A0 · 10-bit Analog Input (0–1023) — wired to LDR Light Sensor.',
  A1: 'A1 · 10-bit Analog Input (0–1023) — wired to Temperature Sensor (TMP36).',
  A2: 'A2 · 10-bit Analog Input (0–5V).',
  A3: 'A3 · 10-bit Analog Input (0–5V).',
  A4: 'A4 (SDA) · Analog Input or I2C Data line.',
  A5: 'A5 (SCL) · Analog Input or I2C Clock line.',
};

export const UNO_PRESETS: UnoPreset[] = [
  {
    id: 'blink',
    label: 'Blink LED',
    badge: 'Basics',
    description:
      'Set pin 13 as OUTPUT, then turn LED HIGH and LOW every 1000 ms.',
    setup: [{ id: 's1', kind: 'pin_mode', pin: 13, mode: 'OUTPUT' }],
    loop: [
      { id: 'l1', kind: 'digital_write', pin: 13, level: 'HIGH' },
      { id: 'l2', kind: 'delay', ms: 1000 },
      { id: 'l3', kind: 'digital_write', pin: 13, level: 'LOW' },
      { id: 'l4', kind: 'delay', ms: 1000 },
    ],
  },
  {
    id: 'smart-light',
    label: 'Smart Light (LDR)',
    badge: 'Sensor',
    description:
      'Reads LDR light sensor (A0) and turns on LED D13 automatically when dark.',
    setup: [
      { id: 's1', kind: 'pin_mode', pin: 13, mode: 'OUTPUT' },
      { id: 's2', kind: 'serial_begin', baud: 9600 },
    ],
    loop: [
      {
        id: 'l1',
        kind: 'if_else',
        condition: { kind: 'ldr_lt', threshold: 450, pin: 0 },
        thenBlocks: [
          { id: 't1', kind: 'digital_write', pin: 13, level: 'HIGH' },
          {
            id: 't2',
            kind: 'serial_print',
            label: 'Dark detected · Light:',
            sensorSource: 'ldr',
          },
        ],
        elseBlocks: [
          { id: 'e1', kind: 'digital_write', pin: 13, level: 'LOW' },
        ],
      },
      { id: 'l2', kind: 'delay', ms: 250 },
    ],
  },
  {
    id: 'obstacle-gate',
    label: 'Ultrasonic Gate',
    badge: 'Robotics',
    description:
      'Measures distance with Ultrasonic (D7/D8); opens Servo gate & sounds buzzer if < 25 cm.',
    setup: [
      { id: 's1', kind: 'pin_mode', pin: 13, mode: 'OUTPUT' },
      { id: 's2', kind: 'servo_attach', pin: 9 },
      { id: 's3', kind: 'serial_begin', baud: 9600 },
    ],
    loop: [
      {
        id: 'l1',
        kind: 'if_else',
        condition: { kind: 'ultrasonic_lt', threshold: 25, pin: 7 },
        thenBlocks: [
          { id: 't1', kind: 'digital_write', pin: 13, level: 'HIGH' },
          { id: 't2', kind: 'servo_write', angle: 90 },
          { id: 't3', kind: 'buzzer_tone', pin: 4, freq: 660, ms: 200 },
          {
            id: 't4',
            kind: 'serial_print',
            label: 'Object cm:',
            sensorSource: 'ultrasonic',
          },
        ],
        elseBlocks: [
          { id: 'e1', kind: 'digital_write', pin: 13, level: 'LOW' },
          { id: 'e2', kind: 'servo_write', angle: 0 },
        ],
      },
      { id: 'l2', kind: 'delay', ms: 300 },
    ],
  },
  {
    id: 'temp-fan',
    label: 'Temp Cooling Fan',
    badge: 'AI / IoT',
    description:
      'Monitors Temperature (A1); spins DC motor forward when > 30°C.',
    setup: [
      { id: 's1', kind: 'pin_mode', pin: 5, mode: 'OUTPUT' },
      { id: 's2', kind: 'pin_mode', pin: 6, mode: 'OUTPUT' },
      { id: 's3', kind: 'serial_begin', baud: 9600 },
    ],
    loop: [
      {
        id: 'l1',
        kind: 'if_else',
        condition: { kind: 'temp_gt', threshold: 30, pin: 1 },
        thenBlocks: [
          {
            id: 't1',
            kind: 'dc_motor',
            pinA: 5,
            pinB: 6,
            speed: 220,
            dir: 'FWD',
          },
          {
            id: 't2',
            kind: 'serial_print',
            label: 'Hot! Temp C:',
            sensorSource: 'temp',
          },
        ],
        elseBlocks: [
          {
            id: 'e1',
            kind: 'dc_motor',
            pinA: 5,
            pinB: 6,
            speed: 0,
            dir: 'STOP',
          },
        ],
      },
      { id: 'l2', kind: 'delay', ms: 300 },
    ],
  },
  {
    id: 'ir-alert',
    label: 'IR Repeat Alert',
    badge: 'Logic',
    description:
      'Uses IR Sensor (D2) with a Repeat 3x buzzer/LED flash sequence.',
    setup: [
      { id: 's1', kind: 'pin_mode', pin: 2, mode: 'INPUT' },
      { id: 's2', kind: 'pin_mode', pin: 13, mode: 'OUTPUT' },
    ],
    loop: [
      {
        id: 'l1',
        kind: 'if_else',
        condition: { kind: 'ir_detected', threshold: 1, pin: 2 },
        thenBlocks: [
          {
            id: 'r1',
            kind: 'repeat',
            times: 3,
            children: [
              { id: 'c1', kind: 'digital_write', pin: 13, level: 'HIGH' },
              { id: 'c2', kind: 'buzzer_tone', pin: 4, freq: 880, ms: 150 },
              { id: 'c3', kind: 'delay', ms: 180 },
              { id: 'c4', kind: 'digital_write', pin: 13, level: 'LOW' },
              { id: 'c5', kind: 'delay', ms: 180 },
            ],
          },
        ],
        elseBlocks: [
          { id: 'e1', kind: 'digital_write', pin: 13, level: 'LOW' },
        ],
      },
      { id: 'l2', kind: 'delay', ms: 200 },
    ],
  },
];

function collectBlockTree(blocks: UnoBlock[]): UnoBlock[] {
  const all: UnoBlock[] = [];
  for (const b of blocks) {
    all.push(b);
    if (b.kind === 'repeat') {
      all.push(...collectBlockTree(b.children));
    } else if (b.kind === 'if_else') {
      all.push(...collectBlockTree(b.thenBlocks));
      all.push(...collectBlockTree(b.elseBlocks));
    }
  }
  return all;
}

function conditionToCpp(cond: SensorCondition): string {
  switch (cond.kind) {
    case 'ultrasonic_lt':
      return `readUltrasonicCm(7, 8) < ${cond.threshold}`;
    case 'ir_detected':
      return `digitalRead(${cond.pin}) == HIGH`;
    case 'ldr_lt':
      return `analogRead(A0) < ${cond.threshold}`;
    case 'temp_gt':
      return `readTempC(A1) > ${cond.threshold}`;
    case 'pin_high':
      return `digitalRead(${cond.pin}) == HIGH`;
  }
}

function blockToCppLines(block: UnoBlock, indent: string): string[] {
  switch (block.kind) {
    case 'pin_mode':
      return [`${indent}pinMode(${block.pin}, ${block.mode});`];
    case 'servo_attach':
      return [`${indent}myServo.attach(${block.pin});`];
    case 'serial_begin':
      return [`${indent}Serial.begin(${block.baud});`];
    case 'digital_write':
      return [`${indent}digitalWrite(${block.pin}, ${block.level});`];
    case 'analog_write':
      return [`${indent}analogWrite(${block.pin}, ${block.value});`];
    case 'delay':
      return [`${indent}delay(${block.ms});`];
    case 'servo_write':
      return [`${indent}myServo.write(${block.angle});`];
    case 'dc_motor': {
      if (block.dir === 'STOP' || block.speed === 0) {
        return [
          `${indent}analogWrite(${block.pinA}, 0);`,
          `${indent}analogWrite(${block.pinB}, 0);`,
        ];
      }
      if (block.dir === 'FWD') {
        return [
          `${indent}analogWrite(${block.pinA}, ${block.speed});`,
          `${indent}analogWrite(${block.pinB}, 0);`,
        ];
      }
      return [
        `${indent}analogWrite(${block.pinA}, 0);`,
        `${indent}analogWrite(${block.pinB}, ${block.speed});`,
      ];
    }
    case 'buzzer_tone':
      return [`${indent}tone(${block.pin}, ${block.freq}, ${block.ms});`];
    case 'buzzer_stop':
      return [`${indent}noTone(${block.pin});`];
    case 'serial_print': {
      const safe = block.label.replace(/"/g, '\\"');
      if (block.sensorSource === 'none') {
        return [`${indent}Serial.println("${safe}");`];
      }
      const expr =
        block.sensorSource === 'ultrasonic'
          ? 'readUltrasonicCm(7, 8)'
          : block.sensorSource === 'ir'
            ? 'digitalRead(2)'
            : block.sensorSource === 'ldr'
              ? 'analogRead(A0)'
              : 'readTempC(A1)';
      return [
        `${indent}Serial.print("${safe} ");`,
        `${indent}Serial.println(${expr});`,
      ];
    }
    case 'repeat': {
      const inner = block.children.flatMap((c) =>
        blockToCppLines(c, `${indent}  `)
      );
      return [
        `${indent}for (int i = 0; i < ${block.times}; i++) {`,
        ...(inner.length > 0 ? inner : [`${indent}  // empty`]),
        `${indent}}`,
      ];
    }
    case 'if_else': {
      const thenLines = block.thenBlocks.flatMap((c) =>
        blockToCppLines(c, `${indent}  `)
      );
      const elseLines = block.elseBlocks.flatMap((c) =>
        blockToCppLines(c, `${indent}  `)
      );
      const lines = [
        `${indent}if (${conditionToCpp(block.condition)}) {`,
        ...(thenLines.length > 0 ? thenLines : [`${indent}  // do nothing`]),
      ];
      if (elseLines.length > 0) {
        lines.push(`${indent}} else {`);
        lines.push(...elseLines);
      }
      lines.push(`${indent}}`);
      return lines;
    }
  }
}

export function generateArduinoIno(
  setup: UnoBlock[],
  loop: UnoBlock[]
): string {
  const all = [...collectBlockTree(setup), ...collectBlockTree(loop)];
  const usesServo = all.some(
    (b) => b.kind === 'servo_attach' || b.kind === 'servo_write'
  );
  const usesUltrasonic = all.some(
    (b) =>
      (b.kind === 'serial_print' && b.sensorSource === 'ultrasonic') ||
      (b.kind === 'if_else' && b.condition.kind === 'ultrasonic_lt')
  );
  const usesTemp = all.some(
    (b) =>
      (b.kind === 'serial_print' && b.sensorSource === 'temp') ||
      (b.kind === 'if_else' && b.condition.kind === 'temp_gt')
  );

  const headerLines: string[] = [];
  if (usesServo) {
    headerLines.push('#include <Servo.h>', 'Servo myServo;', '');
  }
  if (usesUltrasonic) {
    headerLines.push(
      'long readUltrasonicCm(int trigPin, int echoPin) {',
      '  pinMode(trigPin, OUTPUT);',
      '  digitalWrite(trigPin, LOW);',
      '  delayMicroseconds(2);',
      '  digitalWrite(trigPin, HIGH);',
      '  delayMicroseconds(10);',
      '  digitalWrite(trigPin, LOW);',
      '  pinMode(echoPin, INPUT);',
      '  long duration = pulseIn(echoPin, HIGH, 30000);',
      '  return duration > 0 ? (duration * 0.034) / 2 : 400;',
      '}',
      ''
    );
  }
  if (usesTemp) {
    headerLines.push(
      'float readTempC(int analogPin) {',
      '  float voltage = analogRead(analogPin) * (5.0 / 1023.0);',
      '  return (voltage - 0.5) * 100.0;',
      '}',
      ''
    );
  }

  const setupLines =
    setup.length > 0
      ? setup.flatMap((b) => blockToCppLines(b, '  '))
      : ['  // Setup blocks'];
  const loopLines =
    loop.length > 0
      ? loop.flatMap((b) => blockToCppLines(b, '  '))
      : ['  // Forever loop blocks'];

  return [
    ...headerLines,
    'void setup() {',
    ...setupLines,
    '}',
    '',
    'void loop() {',
    ...loopLines,
    '}',
    '',
  ].join('\n');
}

export function createDefaultBlock(kind: UnoBlock['kind']): UnoBlock {
  switch (kind) {
    case 'pin_mode':
      return { id: uid(), kind: 'pin_mode', pin: 13, mode: 'OUTPUT' };
    case 'servo_attach':
      return { id: uid(), kind: 'servo_attach', pin: 9 };
    case 'serial_begin':
      return { id: uid(), kind: 'serial_begin', baud: 9600 };
    case 'digital_write':
      return { id: uid(), kind: 'digital_write', pin: 13, level: 'HIGH' };
    case 'analog_write':
      return { id: uid(), kind: 'analog_write', pin: 9, value: 180 };
    case 'delay':
      return { id: uid(), kind: 'delay', ms: 1000 };
    case 'servo_write':
      return { id: uid(), kind: 'servo_write', angle: 90 };
    case 'dc_motor':
      return {
        id: uid(),
        kind: 'dc_motor',
        pinA: 5,
        pinB: 6,
        speed: 200,
        dir: 'FWD',
      };
    case 'buzzer_tone':
      return { id: uid(), kind: 'buzzer_tone', pin: 4, freq: 523, ms: 250 };
    case 'buzzer_stop':
      return { id: uid(), kind: 'buzzer_stop', pin: 4 };
    case 'serial_print':
      return {
        id: uid(),
        kind: 'serial_print',
        label: 'Sensor:',
        sensorSource: 'ultrasonic',
      };
    case 'repeat':
      return {
        id: uid(),
        kind: 'repeat',
        times: 3,
        children: [
          { id: uid(), kind: 'digital_write', pin: 13, level: 'HIGH' },
          { id: uid(), kind: 'delay', ms: 250 },
          { id: uid(), kind: 'digital_write', pin: 13, level: 'LOW' },
          { id: uid(), kind: 'delay', ms: 250 },
        ],
      };
    case 'if_else':
      return {
        id: uid(),
        kind: 'if_else',
        condition: { kind: 'ultrasonic_lt', threshold: 25, pin: 7 },
        thenBlocks: [
          { id: uid(), kind: 'digital_write', pin: 13, level: 'HIGH' },
        ],
        elseBlocks: [
          { id: uid(), kind: 'digital_write', pin: 13, level: 'LOW' },
        ],
      };
  }
}

export interface FlattenedStep {
  phase: 'setup' | 'loop';
  block: UnoBlock;
  evaluateIf?: SensorCondition;
  branchTarget?: 'then' | 'else';
}

export interface SensorSnapshot {
  ultrasonicCm: number;
  irDetected: boolean;
  ldrValue: number;
  tempC: number;
}

export function evaluateSensorCondition(
  cond: SensorCondition,
  sensors: SensorSnapshot,
  pins: Record<number, { digital: 0 | 1 }>
): boolean {
  switch (cond.kind) {
    case 'ultrasonic_lt':
      return sensors.ultrasonicCm < cond.threshold;
    case 'ir_detected':
      return sensors.irDetected;
    case 'ldr_lt':
      return sensors.ldrValue < cond.threshold;
    case 'temp_gt':
      return sensors.tempC > cond.threshold;
    case 'pin_high':
      return (pins[cond.pin]?.digital ?? 0) === 1;
  }
}

export function clonePresetBlocks(blocks: UnoBlock[]): UnoBlock[] {
  return blocks.map((b) => {
    if (b.kind === 'repeat') {
      return { ...b, id: uid(), children: clonePresetBlocks(b.children) };
    }
    if (b.kind === 'if_else') {
      return {
        ...b,
        id: uid(),
        condition: { ...b.condition },
        thenBlocks: clonePresetBlocks(b.thenBlocks),
        elseBlocks: clonePresetBlocks(b.elseBlocks),
      };
    }
    return { ...b, id: uid() };
  });
}
