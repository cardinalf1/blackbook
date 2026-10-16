import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JSDOM } from './jsdomShim';

describe('jsdomShim', () => {
  it('instantiates JSDOM without crashing on default stylesheet read', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="test">Hello World</div></body></html>');
    expect(dom.window.document.getElementById('test')?.textContent).toBe('Hello World');
  });

  it('intercepts non-existent default-stylesheet.css paths and returns stylesheet content', () => {
    const fakePath = 'D:\\a\\non-existent-build-runner\\node_modules\\jsdom\\lib\\jsdom\\browser\\default-stylesheet.css';
    const content = fs.readFileSync(fakePath, { encoding: 'utf-8' });
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain('display: block');
  });
});
