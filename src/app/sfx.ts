// Звуки интерфейса и фоновая атмосфера (SPEC §7.4) синтезируются Web Audio API: файлов и лицензий нет,
// вес — ноль байт. Заменить на записанные звуки — поменять только эту функцию (ARCHITECTURE A12).

export type Sfx = 'hover' | 'click' | 'panel' | 'gallery';

export interface Synth {
  play: (name: Sfx) => void;
  /** Фоновая атмосфера — ветер и прибой (#169): включить с плавным нарастанием или погасить. */
  ambience?: (on: boolean) => void;
  /** Разбудить спящий контекст; вызывается в жесте пользователя (Safari на iPhone будит звук только так). */
  wake?: () => void;
}

/** Общая громкость: тихо, звуки интерфейса — лишь ощущение отклика (#169). */
export const MASTER_GAIN = 0.45;
/** Громкость фоновой атмосферы до общей громкости: слышна, но не громче звуков интерфейса. */
export const AMBIENCE_GAIN = 0.32;
/** Нарастание и затухание атмосферы, с. */
const AMBIENCE_FADE_IN = 3;
const AMBIENCE_FADE_OUT = 0.6;
/** Длина петли шума, с: петля длинная, чтобы шов не слышался ритмом. */
const LOOP_SECONDS = 7;

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  /** Длительность, с. */
  dur: number;
  gain: number;
  delay?: number;
}

/** Синтезатор или null, если Web Audio недоступен. Созданный до жеста контекст спит; `play` будит его (политика автовоспроизведения). */
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
  master.gain.value = MASTER_GAIN;
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

  const wake = () => {
    // В Safari бывает состояние «interrupted» (звонок, другое приложение) — будим из любого, кроме «running».
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  };

  /** Петля шума: белый — для ветра, «коричневый» (проинтегрированный) — для прибоя; конец сведён к началу без щелчка. */
  const noiseLoop = (brown: boolean) => {
    const length = Math.ceil(ctx.sampleRate * LOOP_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else data[i] = white;
    }
    const seam = Math.min(length, Math.ceil(ctx.sampleRate * 0.05));
    for (let i = 0; i < seam; i++) {
      const k = i / seam;
      data[length - seam + i] = data[length - seam + i]! * (1 - k) + data[i]! * k;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  };

  /** Медленное колебание параметра: `base ± depth` с частотой `hz`. */
  const lfo = (param: AudioParam, base: number, depth: number, hz: number, t0: number) => {
    param.setValueAtTime(base, t0);
    const osc = ctx.createOscillator();
    osc.frequency.value = hz;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(param);
    osc.start(t0);
    return osc;
  };

  let bed: { out: GainNode; sources: AudioScheduledSourceNode[] } | null = null;

  const startAmbience = () => {
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(AMBIENCE_GAIN, t0 + AMBIENCE_FADE_IN);
    out.connect(master);

    // Ветер: белый шум через полосовой фильтр, частота которого медленно гуляет, — порывы.
    const wind = noiseLoop(false);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.8;
    const windGain = ctx.createGain();
    wind.connect(windFilter).connect(windGain).connect(out);
    const windSweep = lfo(windFilter.frequency, 520, 260, 0.07, t0);
    const windGust = lfo(windGain.gain, 0.22, 0.12, 0.045, t0);

    // Прибой: «коричневый» шум через фильтр низких частот, громкость накатывает волнами.
    const sea = noiseLoop(true);
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 650;
    const seaGain = ctx.createGain();
    sea.connect(seaFilter).connect(seaGain).connect(out);
    const waves = lfo(seaGain.gain, 0.55, 0.4, 0.11, t0);

    wind.start(t0);
    sea.start(t0);
    bed = { out, sources: [wind, sea, windSweep, windGust, waves] };
  };

  const stopAmbience = () => {
    if (!bed) return;
    const { out, sources } = bed;
    bed = null;
    const t0 = ctx.currentTime;
    out.gain.cancelScheduledValues(t0);
    out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t0);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + AMBIENCE_FADE_OUT);
    for (const src of sources) src.stop(t0 + AMBIENCE_FADE_OUT + 0.05);
  };

  return {
    wake,
    ambience(on) {
      if (on) {
        wake();
        if (!bed) startAmbience();
      } else stopAmbience();
    },
    play(name) {
      wake();
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
