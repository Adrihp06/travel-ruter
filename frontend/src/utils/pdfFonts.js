/**
 * PDF font registration for react-pdf.
 *
 * Registers Noto Sans JP (full glyph set: Latin + Japanese + symbols) so that
 * CJK characters and special Unicode render correctly instead of crashing.
 * Uses Google Fonts TTF (full coverage) — downloaded on demand at export time.
 */
import { Font } from '@react-pdf/renderer';

const REGULAR = 'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf';
const BOLD = 'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75s.ttf';

Font.register({
  family: 'Noto Sans JP',
  fonts: [
    { src: REGULAR, fontWeight: 400 },
    { src: REGULAR, fontWeight: 400, fontStyle: 'italic' },
    { src: BOLD, fontWeight: 700 },
    { src: BOLD, fontWeight: 700, fontStyle: 'italic' },
  ],
});

// Disable hyphenation — CJK text has no word boundaries and the
// default hyphenation callback can break layout for multi-script text.
Font.registerHyphenationCallback((word) => [word]);
