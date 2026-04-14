/**
 * Convert markdown content (via marked.lexer) to react-pdf elements.
 */
import React from 'react';
import { Document, Page, View, Text, Image, Link } from '@react-pdf/renderer';
import { marked } from 'marked';
import PDFStyles from '../components/PDF/PDFStyles';
import { ROUTE_CARD_SENTINEL_RE } from './routeBlockRenderer';
import './pdfFonts'; // side-effect: registers CJK-compatible fonts

/**
 * Strip emoji and replace problematic Unicode characters that react-pdf
 * cannot measure (causes "unsupported number" overflow errors).
 * - Removes emoticons, symbols, pictographs, flags, dingbats, variation selectors
 * - Replaces Unicode arrows/dashes with ASCII equivalents
 */
const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

const UNICODE_REPLACEMENTS = [
  [/\u2192/g, '->'],   // → RIGHTWARDS ARROW
  [/\u2190/g, '<-'],   // ← LEFTWARDS ARROW
  [/\u2194/g, '<->'],  // ↔ LEFT RIGHT ARROW
  [/\u21D2/g, '=>'],   // ⇒ RIGHTWARDS DOUBLE ARROW
  [/\u2014/g, '--'],   // — EM DASH
  [/\u2013/g, '-'],    // – EN DASH
  [/\u2026/g, '...'],  // … HORIZONTAL ELLIPSIS
  [/\u2018/g, "'"],    // ' LEFT SINGLE QUOTE
  [/\u2019/g, "'"],    // ' RIGHT SINGLE QUOTE
  [/\u201C/g, '"'],    // " LEFT DOUBLE QUOTE
  [/\u201D/g, '"'],    // " RIGHT DOUBLE QUOTE
  [/\u2022/g, '*'],    // • BULLET
  [/\u00B7/g, '*'],    // · MIDDLE DOT
  [/\u2032/g, "'"],    // ′ PRIME
  [/\u2033/g, '"'],    // ″ DOUBLE PRIME
  [/\u00A0/g, ' '],    // NO-BREAK SPACE
];

function stripEmojis(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const [pattern, replacement] of UNICODE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Legacy fallback — strips inline marks when tokens are not available.
 */
function renderInlineText(raw) {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Resolve font style based on accumulated bold/italic marks.
 * Returns a style object for use with react-pdf Text components.
 */
function resolveFontStyle(marks) {
  const style = {};
  if (marks.bold) style.fontWeight = 700;
  if (marks.italic) style.fontStyle = 'italic';
  return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Render an array of marked inline tokens into react-pdf elements.
 * Carries formatting state (marks) to handle nested bold+italic.
 */
function renderInlineTokens(tokens, styles, marks = { bold: false, italic: false }) {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return null;

  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong': {
        const next = { ...marks, bold: true };
        const fontStyle = resolveFontStyle(next);
        return (
          <Text key={i} style={fontStyle}>
            {renderInlineTokens(token.tokens, styles, next)}
          </Text>
        );
      }
      case 'em': {
        const next = { ...marks, italic: true };
        const fontStyle = resolveFontStyle(next);
        return (
          <Text key={i} style={fontStyle}>
            {renderInlineTokens(token.tokens, styles, next)}
          </Text>
        );
      }
      case 'codespan':
        return <Text key={i} style={styles.inlineCode}>{token.text}</Text>;
      case 'link':
        return (
          <Link key={i} src={token.href}>
            <Text style={styles.link}>
              {renderInlineTokens(token.tokens, styles, marks)}
            </Text>
          </Link>
        );
      case 'br':
        return <Text key={i}>{'\n'}</Text>;
      case 'del':
        return <Text key={i}>{token.text}</Text>;
      case 'html':
        return null;
      case 'text':
      case 'escape':
        return <Text key={i}>{token.text}</Text>;
      default:
        return <Text key={i}>{token.text || ''}</Text>;
    }
  });
}

/**
 * Extract inline tokens from a block token, falling back to renderInlineText.
 */
function renderInlineContent(token, styles) {
  if (token.tokens && token.tokens.length > 0) {
    return renderInlineTokens(token.tokens, styles);
  }
  return renderInlineText(token.text || token.raw || '');
}

/**
 * Render a route card as react-pdf elements for inline display in the PDF.
 */
function renderRouteCard(card, key, styles) {
  return (
    <View key={key} style={styles.routeCard} wrap={false}>
      {card.mapImageDataUri && (
        <Image src={card.mapImageDataUri} style={styles.routeCardImage} />
      )}
      <View style={styles.routeCardBody}>
        <Text style={styles.routeCardLabel}>{stripEmojis(card.label)}</Text>
        {card.stats && card.stats.length > 0 && (
          <View style={styles.routeCardStatsRow}>
            {card.stats.map((stat, i) => (
              <Text key={i} style={styles.routeCardStat}>
                {stripEmojis(stat.label)}
              </Text>
            ))}
          </View>
        )}
        {card.googleMapsUrl && (
          <Link src={card.googleMapsUrl}>
            <Text style={styles.routeCardLink}>Open in Google Maps</Text>
          </Link>
        )}
      </View>
    </View>
  );
}

/**
 * Convert a list of marked tokens into react-pdf elements.
 */
function tokensToElements(tokens, styles, routeCards = []) {
  const elements = [];

  tokens.forEach((token, idx) => {
    switch (token.type) {
      case 'heading': {
        const styleKey = token.depth === 1 ? 'h1' : token.depth === 2 ? 'h2' : 'h3';
        elements.push(
          <Text key={idx} style={styles[styleKey]}>
            {renderInlineContent(token, styles)}
          </Text>
        );
        break;
      }

      case 'paragraph': {
        elements.push(
          <Text key={idx} style={styles.body}>
            {renderInlineContent(token, styles)}
          </Text>
        );
        break;
      }

      case 'list': {
        const listItems = (token.items || []).map((item, itemIdx) => {
          // list_item.tokens can be: [text, ...] (tight) or [paragraph, ...] (loose)
          const firstChild = item.tokens && item.tokens[0];
          const inlineTokens =
            firstChild && firstChild.tokens ? firstChild.tokens : null;

          return (
            <View key={itemIdx} style={styles.bulletRow}>
              <Text style={styles.bulletPoint}>{token.ordered ? `${itemIdx + 1}.` : '•'}</Text>
              <Text style={styles.bulletText}>
                {inlineTokens
                  ? renderInlineTokens(inlineTokens, styles)
                  : renderInlineText(item.text)}
              </Text>
            </View>
          );
        });
        elements.push(
          <View key={idx} style={styles.section}>
            {listItems}
          </View>
        );
        break;
      }

      case 'blockquote': {
        // Recursively render blockquote's child block tokens
        const innerElements = token.tokens
          ? tokensToElements(token.tokens, styles, routeCards)
          : [<Text key={0} style={styles.blockquoteText}>{renderInlineText(token.text || '')}</Text>];
        elements.push(
          <View key={idx} style={styles.blockquote}>
            {innerElements}
          </View>
        );
        break;
      }

      case 'hr': {
        elements.push(<View key={idx} style={styles.divider} />);
        break;
      }

      case 'code': {
        elements.push(
          <Text key={idx} style={styles.code}>
            {token.text}
          </Text>
        );
        break;
      }

      case 'image': {
        if (token.href && (token.href.startsWith('http') || token.href.startsWith('data:'))) {
          elements.push(
            <Image key={idx} src={token.href} style={styles.mapImage} />
          );
        }
        break;
      }

      case 'space': {
        elements.push(<View key={idx} style={styles.spacer} />);
        break;
      }

      case 'table': {
        const headers = token.header || [];
        const rows = token.rows || [];
        const aligns = token.align || [];

        elements.push(
          <View key={idx} style={styles.table}>
            {/* Header row */}
            <View style={styles.tableHeaderRow}>
              {headers.map((cell, ci) => (
                <View key={ci} style={styles.tableHeaderCell}>
                  <Text style={[styles.tableHeaderText, aligns[ci] ? { textAlign: aligns[ci] } : null]}>
                    {cell.tokens
                      ? renderInlineTokens(cell.tokens, styles)
                      : renderInlineText(cell.text)}
                  </Text>
                </View>
              ))}
            </View>
            {/* Data rows */}
            {rows.map((row, ri) => (
              <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
                {row.map((cell, ci) => (
                  <View key={ci} style={styles.tableCell}>
                    <Text style={[styles.tableCellText, aligns[ci] ? { textAlign: aligns[ci] } : null]}>
                      {cell.tokens
                        ? renderInlineTokens(cell.tokens, styles)
                        : renderInlineText(cell.text)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
        break;
      }

      case 'html': {
        const sentinelMatch = (token.text || token.raw || '').match(ROUTE_CARD_SENTINEL_RE);
        if (sentinelMatch && routeCards.length > 0) {
          const cardIndex = parseInt(sentinelMatch[1], 10);
          const card = routeCards[cardIndex];
          if (card) {
            elements.push(renderRouteCard(card, idx, styles));
          }
        }
        break;
      }

      default:
        break;
    }
  });

  return elements;
}

/**
 * Convert markdown content to a react-pdf Document element.
 *
 * @param {string} markdownContent - The markdown text to render
 * @param {string|undefined} mapImageDataUri - Optional base64 map image to display at top
 * @param {string} title - Document title (shown in PDF header)
 * @param {string} tripName - Trip name for footer
 */
export function markdownToPDFDocument(markdownContent, mapImageDataUri, title, tripName = '', routeCards = []) {
  const styles = PDFStyles;
  const sanitized = stripEmojis(markdownContent || '');
  const tokens = marked.lexer(sanitized);
  const contentElements = tokensToElements(tokens, styles, routeCards);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Map image at top if available */}
        {mapImageDataUri && (
          <Image src={mapImageDataUri} style={styles.mapImage} />
        )}

        {/* Title */}
        <Text style={styles.h1}>{stripEmojis(title)}</Text>
        <View style={styles.divider} />
        <View style={styles.spacer} />

        {/* Content */}
        {contentElements.length > 0 ? (
          contentElements
        ) : (
          <Text style={styles.body}>No content yet.</Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{stripEmojis(tripName)}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Convert markdown content to react-pdf Page elements (without a wrapping Document).
 * Used for combining multiple documents into a single PDF.
 */
export function markdownToPDFPages(markdownContent, mapImageDataUri, title, tripName = '', routeCards = []) {
  const styles = PDFStyles;
  const sanitized = stripEmojis(markdownContent || '');
  const tokens = marked.lexer(sanitized);
  const contentElements = tokensToElements(tokens, styles, routeCards);

  return [
    <Page key={title} size="A4" style={styles.page}>
      {mapImageDataUri && (
        <Image src={mapImageDataUri} style={styles.mapImage} />
      )}

      <Text style={styles.h1}>{stripEmojis(title)}</Text>
      <View style={styles.divider} />
      <View style={styles.spacer} />

      {contentElements.length > 0 ? (
        contentElements
      ) : (
        <Text style={styles.body}>No content yet.</Text>
      )}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{stripEmojis(tripName)}</Text>
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  ];
}

/**
 * Wrap an array of Page elements in a Document.
 */
export function createDocumentFromPages(pages) {
  return <Document>{pages}</Document>;
}
