// The owner's checklist: per section, exactly these tools and nothing else (Phase 9 prompt, step 8b).
// TestRoom.test.tsx checks the same lists against what the screen renders.

import { describe, expect, it } from 'vitest';
import { TOOL_INVENTORY, toolsFor } from './testRoomConfig';

const RW = ['highlights', 'eliminator', 'markForReview', 'questionMenu', 'timerHide', 'directions', 'lineReader', 'zoom', 'more'];
const MATH = ['calculator', 'reference', 'eliminator', 'markForReview', 'questionMenu', 'timerHide', 'directions', 'zoom', 'more'];

describe('tool inventory', () => {
  it('Reading and Writing has exactly its list', () => {
    expect([...TOOL_INVENTORY.rw].sort()).toEqual([...RW].sort());
    expect(TOOL_INVENTORY.rw).not.toContain('calculator');
    expect(TOOL_INVENTORY.rw).not.toContain('reference');
  });

  it('Math has exactly its list', () => {
    expect([...TOOL_INVENTORY.math].sort()).toEqual([...MATH].sort());
    expect(TOOL_INVENTORY.math).not.toContain('highlights');
    expect(TOOL_INVENTORY.math).not.toContain('lineReader');
  });

  it('the eliminator is on multiple-choice questions only', () => {
    expect(toolsFor('math', 'mcq')).toContain('eliminator');
    expect(toolsFor('math', 'spr')).not.toContain('eliminator');
    expect(toolsFor('rw', 'mcq')).toContain('eliminator');
    expect(toolsFor('math', 'spr')).toEqual(MATH.filter((t) => t !== 'eliminator'));
  });
});
