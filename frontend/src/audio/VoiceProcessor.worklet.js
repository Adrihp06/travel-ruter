/**
 * VoiceProcessor AudioWorklet
 *
 * Captures PCM 16-bit 16 kHz mono audio from the microphone and posts
 * fixed-size chunks to the main thread for streaming over WebSocket.
 *
 * Runs on the audio rendering thread so it must be lightweight and
 * allocation-free in the hot path where possible.
 */
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 4096; // ~256 ms at 16 kHz
  }

  /**
   * Called by the audio rendering thread with 128-sample frames.
   * Accumulates samples, converts Float32 -> Int16 PCM, and posts
   * chunks when the buffer is full.
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Float32 samples from mic

    // Convert Float32 to Int16 PCM and accumulate
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }

    // When buffer is full, send chunk(s) to main thread
    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize);
      const int16Array = new Int16Array(chunk);
      this.port.postMessage(
        {
          type: 'audio',
          data: int16Array.buffer,
        },
        [int16Array.buffer],
      );
    }

    return true; // Keep processor alive
  }
}

registerProcessor('voice-processor', VoiceProcessor);
