import { describe, expect, it } from 'vitest';
import { parseEvents } from './client';

describe('parseEvents', () => {
  it('splits complete events, skips pings and keeps the partial tail', () => {
    const { events, rest } = parseEvents('data: {"a":1}\n\n: ping\n\ndata: {"b":2}\n\ndata: {"c"');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"c"');
    expect(parseEvents(rest + ':3}\n\n').events).toEqual(['{"c":3}']);
  });
});
