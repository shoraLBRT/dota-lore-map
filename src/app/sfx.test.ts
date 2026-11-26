import { afterEach, describe, expect, it, vi } from 'vitest';
import { AMBIENCE_GAIN, MASTER_GAIN, createSynth } from './sfx';

// Заглушка Web Audio: считает запущенные и остановленные источники и громкость (#169).
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  started = 0;
  stopped = 0;
  connect<T>(next: T) {
    return next;
  }
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
}

const nodes: FakeNode[] = [];
let resumed = 0;

class FakeContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  resume() {
    resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  private node() {
    const n = new FakeNode();
    nodes.push(n);
    return n;
  }
  createGain() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

describe('синтезатор (SPEC §7.4, #169)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nodes.length = 0;
    resumed = 0;
  });

  const make = () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const synth = createSynth();
    if (!synth) throw new Error('нет синтезатора');
    return synth;
  };

  it('общая громкость тихая, атмосфера — не громче общей', () => {
    make();
    expect(nodes[0]!.gain.value).toBe(MASTER_GAIN);
    expect(MASTER_GAIN).toBeLessThan(0.8);
    expect(AMBIENCE_GAIN).toBeGreaterThan(0);
    expect(AMBIENCE_GAIN).toBeLessThan(1);
  });

  it('атмосфера: петли ветра и прибоя запускаются один раз, будят контекст и гаснут по выключению', () => {
    const synth = make();
    synth.ambience?.(true);
    expect(resumed).toBe(1);
    const loops = nodes.filter((n) => n.loop);
    expect(loops).toHaveLength(2);
    const started = nodes.filter((n) => n.started > 0).length;
    synth.ambience?.(true);
    expect(nodes.filter((n) => n.started > 0)).toHaveLength(started);
    synth.ambience?.(false);
    expect(loops.every((n) => n.stopped === 1)).toBe(true);
    synth.ambience?.(false);
    expect(loops.every((n) => n.stopped === 1)).toBe(true);
  });

  it('wake будит только спящий контекст', () => {
    const synth = make();
    synth.wake?.();
    synth.wake?.();
    expect(resumed).toBe(1);
  });
});
