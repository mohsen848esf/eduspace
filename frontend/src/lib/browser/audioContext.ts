type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function createAudioContext(): AudioContext {
  const AudioContextConstructor =
    window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Web Audio API is not supported in this browser");
  }
  return new AudioContextConstructor();
}
