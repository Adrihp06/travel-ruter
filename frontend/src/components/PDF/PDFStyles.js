import { StyleSheet } from '@react-pdf/renderer';

const BRAND_AMBER = '#D97706';
const BRAND_AMBER_LIGHT = '#FEF3C7';
const GRAY_700 = '#374151';
const GRAY_500 = '#6B7280';
const GRAY_200 = '#E5E7EB';
const GRAY_100 = '#F3F4F6';

const PDFStyles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 56,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: GRAY_700,
    lineHeight: 1.6,
  },
  section: {
    marginBottom: 12,
  },
  h1: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_AMBER,
    marginBottom: 8,
    marginTop: 4,
  },
  h2: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_700,
    marginBottom: 6,
    marginTop: 12,
  },
  h3: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_700,
    marginBottom: 4,
    marginTop: 8,
  },
  body: {
    fontSize: 11,
    color: GRAY_700,
    marginBottom: 6,
    lineHeight: 1.6,
  },
  code: {
    fontSize: 10,
    fontFamily: 'Courier',
    backgroundColor: GRAY_100,
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  blockquote: {
    borderLeft: `3pt solid ${BRAND_AMBER}`,
    paddingLeft: 10,
    marginLeft: 0,
    marginBottom: 6,
    backgroundColor: BRAND_AMBER_LIGHT,
    padding: 8,
    borderRadius: 2,
  },
  blockquoteText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Oblique',
    color: GRAY_700,
  },
  divider: {
    borderBottom: `1pt solid ${GRAY_200}`,
    marginTop: 8,
    marginBottom: 8,
  },
  spacer: {
    height: 6,
  },
  bullet: {
    fontSize: 11,
    color: GRAY_700,
    marginBottom: 3,
    paddingLeft: 8,
    lineHeight: 1.5,
  },
  bulletPoint: {
    width: 8,
    fontSize: 11,
    color: BRAND_AMBER,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: GRAY_700,
    lineHeight: 1.5,
  },
  mapImage: {
    width: '100%',
    height: 160,
    objectFit: 'cover',
    marginBottom: 12,
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1pt solid ${GRAY_200}`,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 9,
    color: GRAY_500,
  },
});

export default PDFStyles;
