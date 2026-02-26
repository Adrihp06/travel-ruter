/**
 * Convert markdown content (via marked.lexer) to react-pdf elements.
 */
import React from 'react';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { marked } from 'marked';
import PDFStyles from '../components/PDF/PDFStyles';

/**
 * Render inline text — strips inline marks for simplicity (bold/italic not supported in basic react-pdf Text).
 */
function renderInlineText(raw) {
  // Strip markdown bold/italic markers for plain text
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Convert a list of marked tokens into react-pdf elements.
 */
function tokensToElements(tokens, styles) {
  const elements = [];

  tokens.forEach((token, idx) => {
    switch (token.type) {
      case 'heading': {
        const styleKey = token.depth === 1 ? 'h1' : token.depth === 2 ? 'h2' : 'h3';
        elements.push(
          <Text key={idx} style={styles[styleKey]}>
            {renderInlineText(token.text)}
          </Text>
        );
        break;
      }

      case 'paragraph': {
        elements.push(
          <Text key={idx} style={styles.body}>
            {renderInlineText(token.text)}
          </Text>
        );
        break;
      }

      case 'list': {
        const listItems = (token.items || []).map((item, itemIdx) => (
          <View key={itemIdx} style={styles.bulletRow}>
            <Text style={styles.bulletPoint}>{token.ordered ? `${itemIdx + 1}.` : '•'}</Text>
            <Text style={styles.bulletText}>{renderInlineText(item.text)}</Text>
          </View>
        ));
        elements.push(
          <View key={idx} style={styles.section}>
            {listItems}
          </View>
        );
        break;
      }

      case 'blockquote': {
        const innerText = token.tokens
          ? token.tokens.map((t) => t.text || '').join(' ')
          : token.text || '';
        elements.push(
          <View key={idx} style={styles.blockquote}>
            <Text style={styles.blockquoteText}>{renderInlineText(innerText)}</Text>
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
export function markdownToPDFDocument(markdownContent, mapImageDataUri, title, tripName = '') {
  const styles = PDFStyles;
  const tokens = marked.lexer(markdownContent || '');
  const contentElements = tokensToElements(tokens, styles);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Map image at top if available */}
        {mapImageDataUri && (
          <Image src={mapImageDataUri} style={styles.mapImage} />
        )}

        {/* Title */}
        <Text style={styles.h1}>{title}</Text>
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
          <Text style={styles.footerText}>{tripName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
