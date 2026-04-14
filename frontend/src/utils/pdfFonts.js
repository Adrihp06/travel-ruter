/**
 * PDF font registration for react-pdf.
 *
 * Registers Noto Sans JP (with Latin + Japanese coverage) so that
 * CJK characters render correctly instead of crashing the PDF writer.
 * Fonts are loaded on demand — only downloaded when a PDF is generated.
 */
import { Font } from '@react-pdf/renderer';

const NOTO_SANS_JP_BASE =
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp/files';

Font.register({
  family: 'Noto Sans JP',
  fonts: [
    {
      src: `${NOTO_SANS_JP_BASE}/noto-sans-jp-japanese-400-normal.woff2`,
      fontWeight: 400,
    },
    {
      src: `${NOTO_SANS_JP_BASE}/noto-sans-jp-japanese-700-normal.woff2`,
      fontWeight: 700,
    },
  ],
});

// Disable hyphenation — CJK text has no word boundaries and the
// default hyphenation callback can break layout for multi-script text.
Font.registerHyphenationCallback((word) => [word]);
