/**
 * Voice Audio Utilities
 *
 * Provides microphone capture (16 kHz mono PCM → base64 chunks) and
 * playback (24 kHz PCM base64 → Web Audio API) for the Gemini Live
 * voice agent.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

export function int16ToFloat32(int16Array) {
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

// ---------------------------------------------------------------------------
// Audio Capture (Microphone → base64 PCM chunks)
// Uses ScriptProcessorNode for maximum browser compatibility.
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 4096; // ~256ms at 16kHz

/**
 * Initialise microphone capture.
 *
 * @param {(base64Chunk: string) => void} onChunk
 * @returns {Promise<{ start: () => Promise<void>, stop: () => void, cleanup: () => void }>}
 */
export async function initAudioCapture(onChunk) {
  console.log('[voiceAudio] Requesting microphone access...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  console.log('[voiceAudio] Microphone access granted');

  // Create AudioContext — browser may give us a different sample rate than 16kHz
  const audioCtx = new AudioContext();
  const nativeSampleRate = audioCtx.sampleRate;
  console.log('[voiceAudio] AudioContext sampleRate:', nativeSampleRate);

  const source = audioCtx.createMediaStreamSource(stream);

  // ScriptProcessorNode: deprecated but universally supported and reliable
  const processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);

  // Accumulate and downsample to 16kHz Int16 PCM
  const downsampleRatio = nativeSampleRate / 16000;

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);

    // Downsample from native rate to 16kHz
    const outputLength = Math.floor(inputData.length / downsampleRatio);
    const int16 = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.floor(i * downsampleRatio);
      const s = Math.max(-1, Math.min(1, inputData[srcIndex]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const base64 = arrayBufferToBase64(int16.buffer);
    onChunk(base64);
  };

  source.connect(processor);
  // Must connect to destination for onaudioprocess to fire
  processor.connect(audioCtx.destination);

  // Start suspended — start() will resume
  await audioCtx.suspend();
  console.log('[voiceAudio] Audio capture pipeline ready (suspended)');

  return {
    async start() {
      await audioCtx.resume();
      console.log('[voiceAudio] AudioContext resumed — capturing audio');
    },

    stop() {
      audioCtx.suspend();
      console.log('[voiceAudio] AudioContext suspended — capture paused');
    },

    cleanup() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close().catch(() => {});
      console.log('[voiceAudio] Audio capture cleaned up');
    },
  };
}

// ---------------------------------------------------------------------------
// Playback Engine (base64 PCM chunks → speaker)
// ---------------------------------------------------------------------------

export function createPlaybackEngine() {
  const SAMPLE_RATE = 24000;
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });

  let scheduledSources = [];
  let nextStartTime = 0;
  let playing = false;

  function playChunk(base64) {
    const arrayBuf = base64ToArrayBuffer(base64);
    const int16 = new Int16Array(arrayBuf);
    const float32 = int16ToFloat32(int16);

    const audioBuffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (nextStartTime < now) nextStartTime = now;

    sourceNode.start(nextStartTime);
    nextStartTime += audioBuffer.duration;
    playing = true;
    scheduledSources.push(sourceNode);

    sourceNode.onended = () => {
      scheduledSources = scheduledSources.filter((s) => s !== sourceNode);
      if (scheduledSources.length === 0) playing = false;
    };

    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function stop() {
    for (const src of scheduledSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    scheduledSources = [];
    nextStartTime = 0;
    playing = false;
  }

  function isPlaying() { return playing; }

  function cleanup() {
    stop();
    audioCtx.close().catch(() => {});
  }

  return { playChunk, stop, isPlaying, cleanup };
}
