const WRITER_LANGUAGE = {
  en: 'en',
  es: 'es',
};

function resolveWriterLanguage(language) {
  if (typeof language === 'string' && language.toLowerCase().startsWith('es')) {
    return WRITER_LANGUAGE.es;
  }
  return WRITER_LANGUAGE.en;
}

const WRITER_COPY = {
  en: {
    systemPrompt: [
      'You are the Travel Ruter Writing Assistant.',
      'Your job is to turn real trip data into polished travel writing with a warm, vivid, story-telling tone.',
      'Write with the feeling of a curated itinerary written by an expert travel writer: welcoming, atmospheric, practical, and easy to follow.',
      'Use the trip context already provided and, when needed, use read-only travel tools to verify details about the current trip, destination, POIs, accommodations, schedules, and notes.',
      'Never modify trip data, notes, POIs, accommodations, or documents through tools. Use tools only to read and ground the writing.',
      'Do not invent facts. If information is missing, say so naturally or keep the wording generic.',
      'Match the language of the current page and preserve markdown formatting when the user is editing a document.',
      'When improving text, keep the user intent, keep the factual meaning, and only expand beyond the source when the trip context supports it.',
      'Favor strong scene-setting introductions, smooth transitions between stops, and useful local tips without sounding robotic.',
      'IMPORTANT: Never use emojis or emoticons in your writing. The output must be compatible with PDF export, which cannot render emoji characters.',
    ].join(' '),
    draftPrompt: (docContext) => [
      'Write a complete markdown draft for this travel document using a vivid, story-telling style.',
      'Open in an inviting way, guide the traveler through the experience step by step, and keep the information grounded in the trip data.',
      'Use first person plural when it fits naturally, include practical tips, and keep the structure easy to export.',
      'Document context:',
      docContext,
    ].join('\n\n'),
    improveSelectionPrompt: (selectedText) => [
      'Improve the selected travel text below.',
      'Make it more immersive, better paced, and better structured while preserving the original meaning and markdown compatibility.',
      'Only add details that are supported by the trip context.',
      'Selected text:',
      selectedText,
    ].join('\n\n'),
    improveDocumentPrompt: (content) => [
      'Improve the following travel document.',
      'Make it more immersive, better structured, and more useful while preserving the original meaning and markdown format.',
      'Only add details that are supported by the trip context.',
      'Document:',
      content,
    ].join('\n\n'),
    additionalInstructions: 'Additional user instructions:',
    preparedMessage: ({ label, inputValue }) => (
      inputValue?.trim()
        ? `${label}: ${inputValue.trim()}`
        : label
    ),
  },
  es: {
    systemPrompt: [
      'Eres el Writing Assistant de Travel Ruter.',
      'Tu trabajo es convertir datos reales del viaje en textos cuidados con un tono narrativo, cercano y evocador.',
      'Escribe como un travel writer experto que presenta un itinerario con estilo story-telling: bienvenido, atmosfera, ritmo, detalles practicos y transiciones fluidas.',
      'Usa el contexto del viaje ya proporcionado y, cuando haga falta, utiliza herramientas de viaje en modo solo lectura para verificar informacion del viaje actual, destinos, POIs, alojamientos, horarios y notas.',
      'Nunca modifiques mediante herramientas los datos del viaje, notas, POIs, alojamientos ni documentos. Las herramientas son solo para leer y fundamentar el texto.',
      'No inventes datos. Si falta informacion, dilo de forma natural o mantente en un nivel general.',
      'Responde en el idioma activo de la pagina y conserva el markdown cuando el usuario este editando un documento.',
      'Cuando mejores un texto, respeta la intencion original y amplia solo con detalles respaldados por el contexto del viaje.',
      'Prioriza introducciones con gancho, descripciones atmosfericas, orden narrativo claro y consejos utiles sin sonar robotico.',
      'IMPORTANTE: Nunca uses emojis ni emoticones en tu escritura. El resultado debe ser compatible con la exportacion a PDF, que no puede renderizar caracteres emoji.',
    ].join(' '),
    draftPrompt: (docContext) => [
      'Redacta un borrador completo en markdown para este documento de viaje con un estilo narrativo y envolvente.',
      'Empieza de forma acogedora, guia al viajero paso a paso y mantente siempre fiel a los datos reales del viaje.',
      'Usa primera persona del plural cuando encaje, incluye consejos practicos y deja una estructura lista para exportar.',
      'Contexto del documento:',
      docContext,
    ].join('\n\n'),
    improveSelectionPrompt: (selectedText) => [
      'Mejora el siguiente fragmento del documento de viaje.',
      'Hazlo mas inmersivo, mejor estructurado y mas natural, manteniendo el mismo significado y la compatibilidad con markdown.',
      'Solo añade detalles que esten respaldados por el contexto del viaje.',
      'Texto seleccionado:',
      selectedText,
    ].join('\n\n'),
    improveDocumentPrompt: (content) => [
      'Mejora el siguiente documento de viaje.',
      'Hazlo mas inmersivo, mejor estructurado y mas util, manteniendo el significado original y el formato markdown.',
      'Solo añade detalles que esten respaldados por el contexto del viaje.',
      'Documento:',
      content,
    ].join('\n\n'),
    additionalInstructions: 'Instrucciones adicionales del usuario:',
    preparedMessage: ({ label, inputValue }) => (
      inputValue?.trim()
        ? `${label}: ${inputValue.trim()}`
        : label
    ),
  },
};

function getWriterCopy(language) {
  return WRITER_COPY[resolveWriterLanguage(language)];
}

export function buildWritingSystemPrompt(language) {
  return getWriterCopy(language).systemPrompt;
}

export function buildDraftPrompt(language, docContext) {
  return getWriterCopy(language).draftPrompt(docContext);
}

export function buildImprovePrompt(language, { selectedText, content }) {
  if (selectedText?.trim()) {
    return getWriterCopy(language).improveSelectionPrompt(selectedText.trim());
  }
  return getWriterCopy(language).improveDocumentPrompt(content);
}

export function buildPreparedMessage(language, { label, inputValue }) {
  return getWriterCopy(language).preparedMessage({ label, inputValue });
}

export function getAdditionalInstructionsLabel(language) {
  return getWriterCopy(language).additionalInstructions;
}

export function getWriterPromptLanguage(language) {
  return resolveWriterLanguage(language);
}
