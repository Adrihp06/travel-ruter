/**
 * PDF Export orchestrator: markdown → PDFs → ZIP → download
 */
import { pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
import { markdownToPDFDocument } from './markdownToPDF.jsx';
import {
  buildTripOverviewMapUrl,
  buildDestinationMapUrl,
  fetchMapAsBase64,
} from './mapboxStaticImage';
import { resolveRouteBlocksForExport } from './routeBlockRenderer';

/** Slugify a string for use in filenames */
function slugify(str) {
  return (str || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Export selected documents as PDFs bundled in a ZIP file.
 *
 * @param {Array<{id, title, content, destinationId}>} selectedDocuments
 * @param {Object} trip - Trip object with name, destinations, etc.
 * @param {Array} destinations - Array of destination objects
 * @param {string} mapboxToken - Mapbox access token (may be undefined)
 * @param {Object} [options] - Optional settings
 * @param {Function} [options.onProgress] - Progress callback ({ phase, current, total })
 * @returns {Promise<{succeeded: string[], failed: Array<{title: string, error: string}>, warnings: string[]}>}
 */
export async function exportTripAsPDFs(selectedDocuments, trip, destinations, mapboxToken, options = {}) {
  const { onProgress } = options;

  if (!selectedDocuments || selectedDocuments.length === 0) return {
    succeeded: [],
    failed: [],
    warnings: [],
  };

  const tripName = trip?.name || 'Trip';
  const tripSlug = slugify(tripName);
  const total = selectedDocuments.length;
  const succeeded = [];
  const failed = [];
  const allWarnings = [];

  // Step 1: Pre-fetch all map images in parallel
  onProgress?.({ phase: 'maps', current: 0, total });

  const mapImagePromises = selectedDocuments.map(async (doc, i) => {
    if (!mapboxToken) return [doc.id, undefined];

    let url;
    if (!doc.destinationId) {
      // Overview: show all destinations
      url = buildTripOverviewMapUrl(destinations, mapboxToken);
    } else {
      const dest = destinations.find((d) => d.id === doc.destinationId);
      if (Number.isFinite(dest?.longitude) && Number.isFinite(dest?.latitude)) {
        url = buildDestinationMapUrl(dest.longitude, dest.latitude, mapboxToken);
      }
    }
    const dataUri = await fetchMapAsBase64(url);
    onProgress?.({ phase: 'maps', current: i + 1, total });
    return [doc.id, dataUri];
  });

  const mapImageEntries = await Promise.all(mapImagePromises);
  const mapImages = Object.fromEntries(mapImageEntries);

  // Step 2: Generate PDF blobs for each document
  const zip = new JSZip();
  const routeContext = {
    trip,
    destinations,
    mapboxToken,
    cache: {
      tripSegments: new Map(),
      dayRoutes: new Map(),
      destinationPois: new Map(),
      destinationRoutes: new Map(),
    },
  };

  for (let i = 0; i < selectedDocuments.length; i++) {
    const doc = selectedDocuments[i];
    const mapImage = mapImages[doc.id];

    onProgress?.({ phase: 'pdf', current: i, total });

    // Resolve route blocks (:::route ... :::) into renderable cards
    const { processedMarkdown, routeCards, warnings } = await resolveRouteBlocksForExport(
      doc.content || '',
      routeContext
    );

    if (warnings?.length) {
      allWarnings.push(...warnings);
    }

    const docElement = markdownToPDFDocument(
      processedMarkdown,
      mapImage,
      doc.title,
      tripName,
      routeCards
    );

    try {
      const blob = await pdf(docElement).toBlob();

      let filename;
      if (!doc.destinationId) {
        filename = `${tripSlug}_overview.pdf`;
      } else {
        const idx = String(i).padStart(2, '0');
        filename = `${idx}_${slugify(doc.title)}.pdf`;
      }

      zip.file(filename, blob);
      succeeded.push(filename);
    } catch (error) {
      console.error(`Failed to generate PDF for "${doc.title}":`, error);
      failed.push({ title: doc.title, error: error.message || String(error) });
    }
  }

  // Step 3: Generate ZIP and trigger download
  onProgress?.({ phase: 'zip' });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${tripSlug}_export.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { succeeded, failed, warnings: allWarnings };
}
