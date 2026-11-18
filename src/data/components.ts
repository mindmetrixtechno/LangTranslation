export interface SystemComponentSpec {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  stageLabel: string;
  summary: string;
  mechanism: string;
  realWorld: string;
  keyTakeaway: string;
  specs: Array<{ label: string; value: string }>;
}

export const SYSTEM_COMPONENTS: SystemComponentSpec[] = [
  {
    id: 'alu',
    title: 'Arithmetic Logic Unit (ALU)',
    shortTitle: 'CPU ALU',
    category: 'Processor Core',
    stageLabel: '4-Bit Datapath Sandbox',
    summary:
      'The Arithmetic Logic Unit is the core calculator inside a CPU. It takes two binary operands and an instruction opcode, computes the result, and outputs hardware status flags within a single clock cycle.',
    mechanism:
      'Inside the ALU, parallel adder and bitwise gate circuits evaluate every candidate operation at once. Control lines from the instruction decoder steer a multiplexer to place the selected answer onto the output bus while updating the Zero and Carry flags.',
    realWorld:
      'Every loop counter, array index, audio sample mixer, and graphics shader instruction relies on ALUs running billions of operations per second.',
    keyTakeaway:
      'An ALU computes candidate logic paths in parallel and uses its multiplexer to select the requested result.',
    specs: [
      { label: 'Width', value: '4-Bit Demo (64-Bit Modern)' },
      { label: 'Latency', value: '1 Clock Cycle' },
      { label: 'Flags', value: 'Zero (Z) · Carry (C)' },
    ],
  },
  {
    id: 'ram-cell',
    title: 'DRAM Memory Cell & Array',
    shortTitle: 'DRAM Cell',
    category: 'Memory Hierarchy',
    stageLabel: '4x4 Capacitor Matrix',
    summary:
      'Dynamic Random-Access Memory stores each binary bit as a tiny electric charge inside a microscopic capacitor paired with a single access transistor.',
    mechanism:
      'Driving a horizontal Wordline voltage turns on the access transistor, connecting the cell capacitor to the vertical Bitline. A sensitive sense amplifier reads the tiny voltage bump as a 1 or 0, then writes the charge back before it leaks away.',
    realWorld:
      'Your computer system memory holds running applications, browser tabs, and OS kernels in billions of these 1T1C capacitor cells.',
    keyTakeaway:
      'Reading a DRAM cell drains its capacitor slightly, so the sense amplifier must restore and refresh charge every 64 milliseconds.',
    specs: [
      { label: 'Architecture', value: '1 Transistor + 1 Capacitor' },
      { label: 'Refresh Interval', value: '64 ms Nominal' },
      { label: 'Volatility', value: 'Volatile (Needs Power)' },
    ],
  },
  {
    id: 'mosfet',
    title: 'MOSFET Transistor Switch',
    shortTitle: 'MOSFET Gate',
    category: 'Semiconductor Physics',
    stageLabel: 'Field-Effect Cross-Section',
    summary:
      'A MOSFET is a solid-state microscopic switch that turns electrical current between Source and Drain on or off using voltage applied to an insulated Gate.',
    mechanism:
      'When Gate voltage rises past the threshold (around 1.8V), its electric field crosses the silicon-dioxide insulator and attracts electrons into a conductive inversion channel beneath the gate, letting current flow cleanly.',
    realWorld:
      'Modern microprocessors combine tens of billions of complementary MOSFETs on a silicon die to build logic gates and fast SRAM caches.',
    keyTakeaway:
      'Because the gate sits on an insulating oxide layer, it switches large drain currents with virtually zero steady gate current.',
    specs: [
      { label: 'Threshold (Vth)', value: '1.80 V' },
      { label: 'Insulator', value: 'Silicon Dioxide (SiO₂)' },
      { label: 'Mode', value: 'N-Channel Enhancement' },
    ],
  },
  {
    id: 'flash-cell',
    title: 'NAND Flash Floating-Gate Cell',
    shortTitle: 'NAND Flash',
    category: 'Non-Volatile Storage',
    stageLabel: 'Quantum Tunneling Cell',
    summary:
      'NAND Flash memory retains files even when power is completely disconnected by trapping electrons inside an electrically isolated floating gate.',
    mechanism:
      'During a Program operation, a high voltage pulse drives electrons across a thin tunnel oxide barrier into the floating gate. Those trapped charges raise the threshold voltage required to turn the cell on, allowing a Read pulse to distinguish a stored 0 from a 1.',
    realWorld:
      'Solid-state drives, smartphones, and USB memory sticks stack billions of floating-gate or charge-trap cells in 3D vertical layers.',
    keyTakeaway:
      'Insulated trapped charge endures for years without power, making flash non-volatile, though high-voltage erasing gradually wears the oxide.',
    specs: [
      { label: 'Retention', value: '10+ Years Unpowered' },
      { label: 'Program Pulse', value: '18.0 V Tunneling' },
      { label: 'Mechanism', value: 'Fowler-Nordheim Tunneling' },
    ],
  },
  {
    id: 'buck-converter',
    title: 'PWM Buck Voltage Regulator',
    shortTitle: 'Buck Regulator',
    category: 'Power Electronics',
    stageLabel: 'Switching Duty-Cycle Stage',
    summary:
      'A buck converter efficiently steps down a higher DC supply—such as 12V from an adapter—to the crisp low voltage a processor needs without wasting excess power as heat.',
    mechanism:
      'A fast MOSFET switch chops the input voltage into high-frequency pulses controlled by the duty cycle. An inductor resists abrupt current swings and teams with an output capacitor to smooth those pulses into steady DC voltage.',
    realWorld:
      'Laptop motherboards and phone power management ICs rely on multi-phase buck converters to supply high currents at over 90% efficiency.',
    keyTakeaway:
      'Output voltage tracks the switching duty cycle (Vout = Duty × Vin), transferring energy packets through magnetic storage instead of resistive heat.',
    specs: [
      { label: 'Input Supply', value: '12.0 V DC' },
      { label: 'Switching Freq', value: '500 kHz PWM' },
      { label: 'Peak Efficiency', value: '94% Nominal' },
    ],
  },
  {
    id: 'irq-controller',
    title: 'Hardware Interrupt Controller (IRQ)',
    shortTitle: 'IRQ Controller',
    category: 'System Architecture',
    stageLabel: 'Priority Vector Arbiter',
    summary:
      'An interrupt controller lets keyboards, timers, and storage drives signal the CPU immediately when data arrives, avoiding wasteful constant polling.',
    mechanism:
      'When multiple peripherals assert interrupt request lines simultaneously, the controller filters masked channels, compares hardware priorities, and dispatches the highest-priority vector number so the CPU pauses its current thread to run the matching handler.',
    realWorld:
      'Every keystroke, network packet, and system clock tick reaches your operating system kernel through prioritized hardware interrupts.',
    keyTakeaway:
      'Hardware priority arbitration guarantees time-critical timers and DMA transfers preempt slower background peripherals cleanly.',
    specs: [
      { label: 'Arbitration', value: 'Fixed Priority Masking' },
      { label: 'Response Time', value: '< 1 Microsecond' },
      { label: 'Dispatch', value: 'Vectored IVT Lookup' },
    ],
  },
  {
    id: 'uno-r3',
    title: 'Arduino UNO R3 Microcontroller',
    shortTitle: 'UNO R3 Blocks',
    category: 'Microcontroller',
    stageLabel: 'Block Studio & Pin Simulator',
    summary:
      'The Arduino UNO R3 is an ATmega328P microcontroller board that runs a one-time setup() routine followed by a continuous loop() to read sensors, decide logic, and drive LEDs, motors, or serial output.',
    mechanism:
      'Visual programming blocks map directly to Arduino C++ statements. setup() configures digital pins as OUTPUT or INPUT and starts serial communication, while loop() switches 5V digital signals (HIGH/LOW), outputs 8-bit PWM waveforms (0–255) on tilde (~) pins, and reads 10-bit analog voltages (0–1023) on pins A0–A5.',
    realWorld:
      'Students and engineers use UNO R3 boards for robotics controllers, automated plant watering, smart lighting dimmers, temperature monitors, and classroom hardware prototyping.',
    keyTakeaway:
      'Every Arduino block program compiles down to C++ setup() and loop() machine instructions that control real 5V pins and timers inside the ATmega328P chip.',
    specs: [
      { label: 'MCU Core', value: 'ATmega328P (16 MHz)' },
      { label: 'I/O Pins', value: '14 Digital (6 PWM) · 6 Analog' },
      { label: 'Flash Load', value: '.ino Sketch / STK500v1 USB' },
    ],
  },
];

export function getComponentById(id: string): SystemComponentSpec {
  return (
    SYSTEM_COMPONENTS.find((component) => component.id === id) ??
    SYSTEM_COMPONENTS[0]
  );
}
