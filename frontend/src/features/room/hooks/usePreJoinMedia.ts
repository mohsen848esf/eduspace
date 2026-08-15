import { useState, useEffect, useRef, useCallback } from "react";

export interface MediaDevicesState {
  microphones: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  selectedMic: string;
  selectedCam: string;
  selectedSpeaker: string;
  setSelectedMic: (id: string) => void;
  setSelectedCam: (id: string) => void;
  setSelectedSpeaker: (id: string) => void;
  isLoadingDevices: boolean;
}

export function usePreJoinMedia(micEnabled: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [audioBars, setAudioBars] = useState<number[]>(Array(16).fill(4));
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  // 1. Enumerate devices
  const loadDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all);

      const mic = all.find((d) => d.kind === "audioinput");
      const cam = all.find((d) => d.kind === "videoinput");
      const speaker = all.find((d) => d.kind === "audiooutput");

      setSelectedMic((prev) => prev || (mic ? mic.deviceId : ""));
      setSelectedCam((prev) => prev || (cam ? cam.deviceId : ""));
      setSelectedSpeaker((prev) => prev || (speaker ? speaker.deviceId : ""));
    } catch (e) {
      console.warn("Could not enumerate devices:", e);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
    };
  }, [loadDevices]);

  // 2. Audio Level Analyzer via Web Audio API
  useEffect(() => {
    let active = true;

    if (!micEnabled) {
      setAudioLevel(0);
      setAudioBars(Array(16).fill(4));
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    const startAudioMeter = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
          video: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = stream;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!active) return;
          analyser.getByteFrequencyData(dataArray);

          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setAudioLevel(normalized);

          // Calculate bars for visualizer (16 bars)
          const bars = Array.from(dataArray.slice(0, 16)).map((v) =>
            Math.max(4, Math.round((v / 255) * 100))
          );
          setAudioBars(bars);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (err) {
        console.warn("Audio meter setup error:", err);
      }
    };

    startAudioMeter();

    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [micEnabled, selectedMic]);

  // 3. Synthesizer Speaker Test Tone (C5 -> E5 -> G5 chime)
  const playSpeakerTestSound = useCallback(async () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });

      setTimeout(() => {
        setIsPlayingTestSound(false);
        ctx.close().catch(() => {});
      }, 900);
    } catch (e) {
      console.warn("Could not play test sound:", e);
      setIsPlayingTestSound(false);
    }
  }, [isPlayingTestSound]);

  const microphones = devices.filter((d) => d.kind === "audioinput");
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  return {
    microphones,
    cameras,
    speakers,
    selectedMic,
    selectedCam,
    selectedSpeaker,
    setSelectedMic,
    setSelectedCam,
    setSelectedSpeaker,
    isLoadingDevices,
    audioLevel,
    audioBars,
    playSpeakerTestSound,
    isPlayingTestSound,
  };
}
