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
 */
export async function exportTripAsPDFs(selectedDocuments, trip, destinations, mapboxToken) {
  if (!selectedDocuments || selectedDocuments.length === 0) return;

  const tripName = trip?.name || 'Trip';
  const tripSlug = slugify(tripName);

  // Step 1: Pre-fetch all map images in parallel
  const mapImagePromises = selectedDocuments.map(async (doc) => {
    if (!mapboxToken) return [doc.id, undefined];

    let url;
    if (!doc.destinationId) {
      // Overview: show all destinations
      url = buildTripOverviewMapUrl(destinations, mapboxToken);
    } else {
      const dest = destinations.find((d) => d.id === doc.destinationId);
      if (dest?.longitude && dest?.latitude) {
        url = buildDestinationMapUrl(dest.longitude, dest.latitude, mapboxToken);
      }
    }
    const dataUri = await fetchMapAsBase64(url);
    return [doc.id, dataUri];
  });

  const mapImageEntries = await Promise.all(mapImagePromises);
  const mapImages = Object.fromEntries(mapImageEntries);

  // Step 2: Generate PDF blobs for each document
  const zip = new JSZip();

  for (let i = 0; i < selectedDocuments.length; i++) {
    const doc = selectedDocuments[i];
    const mapImage = mapImages[doc.id];

    const docElement = markdownToPDFDocument(
      doc.content || '',
      mapImage,
      doc.title,
      tripName
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
    } catch (error) {
      console.error(`Failed to generate PDF for "${doc.title}":`, error);
    }
  }

  // Step 3: Generate ZIP and trigger download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${tripSlug}_export.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
