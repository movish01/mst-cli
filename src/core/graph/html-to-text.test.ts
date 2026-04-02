import { describe, it, expect } from 'vitest';
import { htmlToText } from './html-to-text.js';

describe('htmlToText', () => {
  it('strips basic HTML tags', () => {
    expect(htmlToText('<p>hello</p>')).toBe('hello');
  });

  it('converts <br> to newlines', () => {
    expect(htmlToText('hello<br>world')).toBe('hello\nworld');
    expect(htmlToText('hello<br/>world')).toBe('hello\nworld');
    expect(htmlToText('hello<br />world')).toBe('hello\nworld');
  });

  it('converts closing </p> and </div> to newlines', () => {
    expect(htmlToText('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(htmlToText('<div>one</div><div>two</div>')).toBe('one\ntwo');
  });

  it('replaces <img> with alt text or placeholder', () => {
    expect(htmlToText('<img alt="smile" />')).toBe('[smile]');
    expect(htmlToText('<img src="x.png" />')).toBe('[image]');
  });

  it('replaces <attachment> tags with placeholder', () => {
    expect(htmlToText('<attachment id="123">file.pdf</attachment>')).toBe('[attachment]');
  });

  it('decodes HTML entities', () => {
    expect(htmlToText('&amp; &lt; &gt; &quot; &#39; &nbsp;')).toBe('& < > " \'');
  });

  it('collapses multiple newlines', () => {
    expect(htmlToText('a<br><br><br><br>b')).toBe('a\n\nb');
  });

  it('trims whitespace', () => {
    expect(htmlToText('  <p>hello</p>  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(htmlToText('')).toBe('');
  });

  it('handles plain text (no HTML)', () => {
    expect(htmlToText('just text')).toBe('just text');
  });
});
