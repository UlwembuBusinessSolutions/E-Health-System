const SPEAKER_STORAGE_KEY = "queue.speakerEnabled";

export function isQueueSpeakerEnabled(): boolean {
  try {
    return localStorage.getItem(SPEAKER_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function playChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    let t = ctx.currentTime;
    for (const freq of [880, 1108.73]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
      t += 0.22;
    }
  } catch {
    // The spoken announcement remains useful if Web Audio is unavailable.
  }
}

export function announceQueueToken(tokenNumber: number): void {
  playChime();
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Token ${tokenNumber}. Please proceed to reception.`);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
