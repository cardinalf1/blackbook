import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDesmosEngine } from './desmos';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function host() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const frameOf = (el: HTMLElement) => el.querySelector('iframe') as HTMLIFrameElement;
const send = (from: Window | null, data: unknown) => window.dispatchEvent(new MessageEvent('message', { source: from, data }));

describe('Desmos engine', () => {
  it('loads the calculator page in a frame that may run scripts but is not same-origin', async () => {
    const el = host();
    const p = createDesmosEngine().mount(el, 'scientific', null);
    const f = frameOf(el);
    expect(f.getAttribute('sandbox')).toBe('allow-scripts');
    expect(f.getAttribute('src')).toBe('/api/calculator/frame?mode=scientific');
    send(f.contentWindow, { bb: 'calc', type: 'ready' });
    await expect(p).resolves.toBeDefined();
  });

  it('restores a saved state, keeps the latest state, and ignores other windows', async () => {
    const el = host();
    const p = createDesmosEngine().mount(el, 'graphing', { v: 1 });
    const f = frameOf(el);
    const posted = vi.spyOn(f.contentWindow as Window, 'postMessage');
    send(window, { bb: 'calc', type: 'ready' }); // not the frame: ignored
    send(f.contentWindow, { bb: 'calc', type: 'ready' });
    const handle = await p;
    expect(posted).toHaveBeenCalledWith({ bb: 'calc', type: 'setState', state: { v: 1 } }, '*');
    expect(handle.getState()).toEqual({ v: 1 });
    send(f.contentWindow, { bb: 'calc', type: 'state', state: { v: 2 } });
    send(window, { bb: 'calc', type: 'state', state: { evil: true } });
    expect(handle.getState()).toEqual({ v: 2 });
    handle.destroy();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('fails cleanly when the script cannot load, and when nothing answers', async () => {
    const el = host();
    const p = createDesmosEngine().mount(el, 'graphing', null);
    send(frameOf(el).contentWindow, { bb: 'calc', type: 'error', reason: 'load' });
    await expect(p).rejects.toThrow('could not load');
    expect(el.querySelector('iframe')).toBeNull();

    vi.useFakeTimers();
    const q = createDesmosEngine({ timeoutMs: 1000 }).mount(host(), 'graphing', null);
    vi.advanceTimersByTime(1001);
    await expect(q).rejects.toThrow('did not load in time');
  });
});
