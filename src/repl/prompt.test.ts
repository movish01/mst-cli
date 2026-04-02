import { describe, it, expect } from 'vitest';
import { mainPrompt, chatPrompt } from './prompt.js';

describe('mainPrompt', () => {
  it('contains "mst"', () => {
    const prompt = mainPrompt();
    expect(prompt).toContain('mst');
  });

  it('contains ">"', () => {
    const prompt = mainPrompt();
    expect(prompt).toContain('>');
  });
});

describe('chatPrompt', () => {
  it('contains the chat name', () => {
    const prompt = chatPrompt('John');
    expect(prompt).toContain('John');
  });

  it('truncates long names to 15 chars', () => {
    const longName = 'Very Long Chat Name Here';
    const prompt = chatPrompt(longName);
    // Should not contain the full name
    expect(prompt).not.toContain(longName);
    // Should contain the truncated portion
    expect(prompt).toContain(longName.slice(0, 15));
  });

  it('contains "mst" and ">"', () => {
    const prompt = chatPrompt('Test');
    expect(prompt).toContain('mst');
    expect(prompt).toContain('>');
  });
});
