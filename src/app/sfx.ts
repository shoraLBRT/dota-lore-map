// Звуки интерфейса (SPEC §7.4) синтезируются Web Audio API: файлов и лицензий нет, вес — ноль байт.
// Заменить на записанные звуки — поменять только эту функцию (ARCHITECTURE A12).

export type Sfx = 'hover' | 'click' | 'panel' | 'gallery';

export interface Synth {
  play: (name: Sfx) => void;
}

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  /** Длительность, с. */
  dur: number;
  gain: number;
  delay?: number;
}

/** Синтезатор или null, если Web Audio недоступен. Создавать по жесту пользователя (политика автовоспроизведения). */
export function createSynth(): Synth | null {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const tone = ({ type, from, to, dur, gain, delay = 0 }: Tone) => {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  /** Шорох: шум через полосовой фильтр, частота которого едет вверх. */
  const whoosh = (dur: number, gain: number) => {
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(380, t0);
    filter.frequency.exponentialRampToValueAtTime(1900, t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(env).connect(master);
    src.start(t0);
  };

  return {
    play(name) {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      switch (name) {
        case 'hover':
          tone({ type: 'sine', from: 1320, to: 1180, dur: 0.06, gain: 0.02 });
          break;
        case 'click':
          tone({ type: 'triangle', from: 540, to: 260, dur: 0.08, gain: 0.07 });
          break;
        case 'panel':
          whoosh(0.32, 0.05);
          tone({ type: 'sine', from: 196, to: 220, dur: 0.3, gain: 0.025 });
          break;
        case 'gallery':
          tone({ type: 'sine', from: 660, to: 655, dur: 0.45, gain: 0.04 });
          tone({ type: 'sine', from: 990, to: 985, dur: 0.5, gain: 0.035, delay: 0.08 });
          break;
      }
    },
  };
}
