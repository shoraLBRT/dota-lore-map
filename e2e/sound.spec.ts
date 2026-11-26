import { test, expect, expectHash } from './fixtures';

// Звук в настоящем браузере (#169): включён по умолчанию, после «Начать» контекст Web Audio просыпается
// и играет петля фоновой атмосферы (ветер и прибой); кнопка звука её гасит. Сам звук на слух — ручная проверка #117.

test('после «Начать» играет фоновая атмосфера, выключенный звук её гасит', async ({ page, consoleErrors }, info) => {
  const mobile = info.project.name === 'mobile';
  void consoleErrors;
  await page.addInitScript(() => {
    const w = window as unknown as { __audio: { contexts: AudioContext[]; loops: number; stopped: number } };
    w.__audio = { contexts: [], loops: 0, stopped: 0 };
    const Native = window.AudioContext as typeof AudioContext | undefined;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__audio.contexts.push(this);
      }
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<typeof start>) {
      if (this.loop) w.__audio.loops += 1;
      return start.apply(this, args);
    };
    const stop = AudioScheduledSourceNode.prototype.stop;
    AudioScheduledSourceNode.prototype.stop = function (this: AudioScheduledSourceNode, ...args: Parameters<typeof stop>) {
      if (this instanceof AudioBufferSourceNode && this.loop) w.__audio.stopped += 1;
      return stop.apply(this, args);
    };
  });
  const audio = () =>
    page.evaluate(() => {
      const a = (window as unknown as { __audio: { contexts: AudioContext[]; loops: number; stopped: number } }).__audio;
      return { states: a.contexts.map((c) => c.state), loops: a.loops, stopped: a.stopped };
    });

  await page.goto('./#/');
  // В сборке WebKit для Playwright на Windows нет Web Audio — там приложение молчит без ошибок, проверять нечего.
  test.skip(!(await page.evaluate(() => 'AudioContext' in window)), 'в этом браузере нет Web Audio');
  const start = page.getByRole('button', { name: 'Начать' });
  if (mobile) await start.tap();
  else await start.click();
  await expectHash(page, '#/world');

  await expect.poll(async () => (await audio()).states).toEqual(['running']);
  await expect.poll(async () => (await audio()).loops).toBe(2);

  const toggle = page.getByRole('button', { name: 'Звук', exact: true });
  if (mobile) await toggle.tap();
  else await toggle.click();
  await expect.poll(async () => (await audio()).stopped).toBe(2);
});
