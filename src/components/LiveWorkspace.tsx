import React, { useState, useEffect, useRef } from "react";
import {
  Mic, MicOff, Play, Pause, RefreshCw, LifeBuoy, AlertTriangle, Sparkles,
  BookMarked, HelpCircle, ArrowRight, Shield, Volume2, CheckCircle, Clock, Search
} from "lucide-react";
import {
  CoursePreset,
  GlossaryTerm,
  TranscriptChunk,
  ProgressiveSummary,
  RescueRecord
} from "../types";
import { RescueModal } from "./RescueModal";
import { cachedPost } from "../lib/cachedApi";
import type { ClientConfig } from "../types";

interface LiveWorkspaceProps {
  selectedCourse: CoursePreset;
  glossary: GlossaryTerm[];
  transcripts: TranscriptChunk[];
  setTranscripts: React.Dispatch<React.SetStateAction<TranscriptChunk[]>>;
  progressiveSummaries: ProgressiveSummary[];
  setProgressiveSummaries: React.Dispatch<React.SetStateAction<ProgressiveSummary[]>>;
  rescueRecords: RescueRecord[];
  setRescueRecords: React.Dispatch<React.SetStateAction<RescueRecord[]>>;
  isRecording: boolean;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
}

export const LiveWorkspace: React.FC<LiveWorkspaceProps> = ({
  selectedCourse,
  glossary,
  transcripts,
  setTranscripts,
  progressiveSummaries,
  setProgressiveSummaries,
  rescueRecords,
  setRescueRecords,
  isRecording,
  setIsRecording,
}) => {
  const [activeRightTab, setActiveRightTab] = useState<"realtime" | "summary" | "rescues">("realtime");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [isRescueModalOpen, setIsRescueModalOpen] = useState(false);
  const [rescueSnippet, setRescueSnippet] = useState("");
  const [rescueTimestamp, setRescueTimestamp] = useState("");
  const [activeHoverTerm, setActiveHoverTerm] = useState<GlossaryTerm | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveAudioStatus, setLiveAudioStatus] = useState("待机");
  const [liveAudioError, setLiveAudioError] = useState("");
  const [clientConfig, setClientConfig] = useState<ClientConfig>({
    audioGatewayUrl: "",
    liveAudioMode: "gateway-first",
    httpAudioFallback: true,
    gatewayTokenEndpoint: "/api/live-audio-token",
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const liveAudioWsRef = useRef<WebSocket | null>(null);
  const liveAudioModeRef = useRef<"ws" | "http" | null>(null);
  const pcmQueueRef = useRef<Int16Array[]>([]);
  const queuedSampleCountRef = useRef(0);
  const audioSeqRef = useRef(0);
  const sessionIdRef = useRef(`live-${Date.now()}`);
  const lastTranscriptRef = useRef("");
  const pendingAudioRef = useRef<Int16Array[]>([]);
  const recordingIntentRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const elapsedSecondsRef = useRef(0);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // Live timer
  useEffect(() => {
    fetch("/api/client-config")
      .then((response) => response.json())
      .then((data) => setClientConfig(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording || isSimulating) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording, isSimulating]);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    return () => {
      stopRealtimeMicSession();
    };
  }, []);

  // Auto scroll transcript to bottom
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Handle Simulated Lecture Stream
  useEffect(() => {
    let simInterval: NodeJS.Timeout;
    if (isSimulating) {
      simInterval = setInterval(async () => {
        if (simulationIndex < selectedCourse.simulatedAudioScript.length) {
          const item = selectedCourse.simulatedAudioScript[simulationIndex];
          
          // Call API to get real-time AI chunk analysis
          try {
            const data = await cachedPost<any>("/api/analyze-chunk", {
                transcriptChunk: item.textEn,
                courseTitle: selectedCourse.title,
                activeGlossary: glossary,
            });
            
            const newChunk: TranscriptChunk = {
              id: `chunk-${Date.now()}`,
              timestamp: item.timestamp,
              seconds: item.seconds,
              textEn: item.textEn,
              chineseSummary: data.success ? data.analysis.chineseSummary : item.chineseSummary,
              difficulty: data.success ? data.analysis.difficulty : item.difficulty,
              contextBridge: data.success ? data.analysis.contextBridge : "",
              detectedTerms: data.success ? data.analysis.detectedTerms : item.detectedTerms,
            };

            setTranscripts((prev) => [...prev, newChunk]);
            setSimulationIndex((idx) => idx + 1);

            // Auto trigger 5-minute summary if chunk count reaches multiples
            if ((transcripts.length + 1) % 4 === 0) {
              triggerProgressiveSummary();
            }
          } catch (e) {
            console.error("Analysis failed:", e);
          }
        } else {
          setIsSimulating(false);
        }
      }, 5000); // Send chunk every 5 seconds
    }
    return () => clearInterval(simInterval);
  }, [isSimulating, simulationIndex, selectedCourse, glossary, transcripts]);

  const downsampleTo16BitPCM = (input: Float32Array, inputSampleRate: number, outputSampleRate = 16000) => {
    if (inputSampleRate === outputSampleRate) {
      return floatTo16BitPCM(input);
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), input.length);
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += input[j];
      output[i] = sum / Math.max(1, end - start);
    }

    return floatTo16BitPCM(output);
  };

  const floatTo16BitPCM = (input: Float32Array) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  };

  const mergePcmChunks = (chunks: Int16Array[], sampleCount: number) => {
    const merged = new Int16Array(sampleCount);
    let offset = 0;
    chunks.forEach((chunk) => {
      merged.set(chunk, offset);
      offset += chunk.length;
    });
    return merged;
  };

  const int16ToBase64 = (pcm: Int16Array) => {
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  const wavBase64FromPcm = (pcm: Int16Array, sampleRate = 16000) => {
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + pcm.byteLength);
    const view = new DataView(buffer);
    const writeAscii = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeAscii(0, "RIFF");
    view.setUint32(4, 36 + pcm.byteLength, true);
    writeAscii(8, "WAVE");
    writeAscii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, "data");
    view.setUint32(40, pcm.byteLength, true);
    new Uint8Array(buffer, headerSize).set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));

    return int16ToBase64(new Int16Array(buffer));
  };

  const transcribePcmChunk = async (pcm: Int16Array) => {
    if (pcm.length === 0) return;
    audioSeqRef.current += 1;

    try {
      const res = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          seq: audioSeqRef.current,
          mimeType: "audio/wav",
          format: "wav",
          base64Audio: wavBase64FromPcm(pcm),
          sourceLang: "en",
          targetLang: "en",
          courseTitle: selectedCourse.title,
        }),
      });
      const data = await res.json();
      if (data.success && (data.textEn || data.text || data.translatedText)) {
        analyzeAndAppendTranscript(data.textEn || data.text || data.translatedText);
        setLiveAudioStatus("HTTP 分片转写中");
      } else {
        setLiveAudioError(data.error || "HTTP audio transcription failed.");
      }
    } catch (err) {
      setLiveAudioError(err instanceof Error ? err.message : "HTTP audio transcription failed.");
    }
  };

  const sendPcmChunk = (pcm: Int16Array) => {
    if (pcm.length === 0) return;

    if (liveAudioModeRef.current === "http") {
      void transcribePcmChunk(pcm);
      return;
    }

    const socket = liveAudioWsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingAudioRef.current = [...pendingAudioRef.current.slice(-4), pcm];
      return;
    }

    audioSeqRef.current += 1;
    socket.send(JSON.stringify({
      type: "audio_chunk",
      sessionId: sessionIdRef.current,
      seq: audioSeqRef.current,
      mimeType: "audio/pcm;rate=16000",
      base64Audio: int16ToBase64(pcm),
      courseTitle: selectedCourse.title,
    }));
  };

  const enqueuePcmChunk = (pcm: Int16Array) => {
    pcmQueueRef.current.push(pcm);
    queuedSampleCountRef.current += pcm.length;

    const threshold = liveAudioModeRef.current === "http" ? 48000 : 16000;
    if (queuedSampleCountRef.current >= threshold) {
      const merged = mergePcmChunks(pcmQueueRef.current, queuedSampleCountRef.current);
      pcmQueueRef.current = [];
      queuedSampleCountRef.current = 0;
      sendPcmChunk(merged);
    }
  };

  const flushQueuedAudio = () => {
    if (queuedSampleCountRef.current === 0) return;
    const merged = mergePcmChunks(pcmQueueRef.current, queuedSampleCountRef.current);
    pcmQueueRef.current = [];
    queuedSampleCountRef.current = 0;
    sendPcmChunk(merged);
  };

  const analyzeAndAppendTranscript = async (text: string) => {
    const transcriptText = text.trim();
    if (!transcriptText || transcriptText === lastTranscriptRef.current) return;
    lastTranscriptRef.current = transcriptText;

    try {
      const analyzeData = await cachedPost<any>("/api/analyze-chunk", {
          transcriptChunk: transcriptText,
          courseTitle: selectedCourse.title,
          activeGlossary: glossary,
      });
      const seconds = elapsedSecondsRef.current;

      const newChunk: TranscriptChunk = {
        id: `mic-${Date.now()}`,
        timestamp: formatTimer(seconds),
        seconds,
        textEn: transcriptText,
        chineseSummary: analyzeData.success ? analyzeData.analysis.chineseSummary : "语音转录精炼",
        difficulty: analyzeData.success ? analyzeData.analysis.difficulty : 3,
        contextBridge: analyzeData.success ? analyzeData.analysis.contextBridge : "",
        detectedTerms: analyzeData.success ? analyzeData.analysis.detectedTerms : [],
      };
      setTranscripts((prev) => [...prev, newChunk]);
    } catch (err) {
      console.error("Analyze transcript failed:", err);
    }
  };

  const connectLiveAudioSocket = async () => {
    if (clientConfig.liveAudioMode === "disabled" || clientConfig.liveAudioMode === "http-only") {
      throw new Error("Realtime gateway is disabled.");
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const gatewayBase = clientConfig.audioGatewayUrl.trim() || `${protocol}://${window.location.host}`;
    const tokenResponse = await fetch(clientConfig.gatewayTokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.success === false) {
      throw new Error(tokenData.error || "Unable to authorize realtime audio.");
    }
    const socketUrl = new URL("/api/live-audio", gatewayBase);
    if (tokenData.token) socketUrl.searchParams.set("token", tokenData.token);
    const socket = new WebSocket(socketUrl);
    let settled = false;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && (data.punctuatedText || data.textEn)) {
          analyzeAndAppendTranscript(data.punctuatedText || data.textEn);
        }
        if (data.type === "ready") {
          reconnectAttemptsRef.current = 0;
          setLiveAudioStatus(clientConfig.audioGatewayUrl ? "外置网关实时转写中" : "WebSocket 实时转写中");
          const pending = pendingAudioRef.current;
          pendingAudioRef.current = [];
          pending.forEach(sendPcmChunk);
        }
        if (data.type === "error") {
          setLiveAudioError(data.message || "Live audio error.");
          console.error("Live audio error:", data.message);
        }
      } catch (err) {
        console.error("Invalid live audio message:", err);
      }
    };

    socket.onclose = () => {
      if (!recordingIntentRef.current) return;
      if (reconnectAttemptsRef.current < 2) {
        reconnectAttemptsRef.current += 1;
        setLiveAudioStatus(`实时通道重连中 (${reconnectAttemptsRef.current}/2)`);
        window.setTimeout(async () => {
          try {
            const nextSocket = await connectLiveAudioSocket();
            liveAudioWsRef.current = nextSocket;
          } catch {
            if (reconnectAttemptsRef.current >= 2 && clientConfig.httpAudioFallback) {
              liveAudioModeRef.current = "http";
              setLiveAudioStatus("HTTP 分片转写中");
              setLiveAudioError("实时网关暂不可用，已自动切换为 HTTP 分片转写。");
            }
          }
        }, 800 * reconnectAttemptsRef.current);
      } else if (clientConfig.httpAudioFallback) {
        liveAudioModeRef.current = "http";
        setLiveAudioStatus("HTTP 分片转写中");
      }
    };

    return new Promise<WebSocket>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error("WebSocket audio channel timed out."));
      }, 4000);

      socket.onopen = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(socket);
      };
      socket.onerror = (event) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(event);
      };
    });
  };

  const stopRealtimeMicSession = () => {
    recordingIntentRef.current = false;
    flushQueuedAudio();

    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioGainRef.current?.disconnect();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    if (liveAudioWsRef.current && liveAudioWsRef.current.readyState === WebSocket.OPEN) {
      liveAudioWsRef.current.close();
    }

    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioGainRef.current = null;
    audioStreamRef.current = null;
    audioContextRef.current = null;
    liveAudioWsRef.current = null;
    liveAudioModeRef.current = null;
    pcmQueueRef.current = [];
    queuedSampleCountRef.current = 0;
    pendingAudioRef.current = [];
    reconnectAttemptsRef.current = 0;
    setLiveAudioStatus("待机");
  };

  // Real Browser Microphone Recording via Web Audio + Qwen LiveTranslate WebSocket
  const toggleRealMic = async () => {
    if (isRecording) {
      stopRealtimeMicSession();
      setIsRecording(false);
    } else {
      try {
        setLiveAudioError("");
        recordingIntentRef.current = true;
        setLiveAudioStatus(clientConfig.audioGatewayUrl ? "连接实时音频网关中" : "连接千问实时通道中");

        const socket = await connectLiveAudioSocket().catch((err) => {
          if (!clientConfig.httpAudioFallback) throw err;
          console.warn("Live WebSocket unavailable, using HTTP fallback:", err);
          setLiveAudioError("实时 WebSocket 不可用，已切换为 HTTP 分片转写。");
          setLiveAudioStatus("HTTP 分片转写准备中");
          return null;
        });
        liveAudioWsRef.current = socket;
        liveAudioModeRef.current = socket ? "ws" : "http";

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const silentGain = audioContext.createGain();
        silentGain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const pcm = downsampleTo16BitPCM(input, audioContext.sampleRate);
          enqueuePcmChunk(pcm);
        };

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioContext.destination);

        audioStreamRef.current = stream;
        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        audioProcessorRef.current = processor;
        audioGainRef.current = silentGain;
        setIsRecording(true);
        if (!socket) setLiveAudioStatus("HTTP 分片转写中");
      } catch (err) {
        stopRealtimeMicSession();
        alert("无法访问麦克风，请确保浏览器已允许麦克风权限。");
        console.error("Mic access error:", err);
      }
    }
  };

  // Trigger 5-Minute Progressive Chinese Summary
  const triggerProgressiveSummary = async () => {
    if (transcripts.length === 0) return;
    try {
      const recentText = transcripts.slice(-5).map((t) => t.textEn);
      const data = await cachedPost<any>("/api/progressive-summary", {
          transcripts: recentText,
          courseTitle: selectedCourse.title,
          minuteBlock: progressiveSummaries.length + 1,
      });
      if (data.success && data.summary) {
        const newSummary: ProgressiveSummary = {
          id: `summary-${Date.now()}`,
          minuteBlock: progressiveSummaries.length + 1,
          timeRange: `Block ${progressiveSummaries.length + 1}`,
          title: data.summary.title,
          bulletPoints: data.summary.bulletPoints || [],
          keyConcepts: data.summary.keyConcepts || [],
          quickCatchUp: data.summary.quickCatchUp || "",
        };
        setProgressiveSummaries((prev) => [...prev, newSummary]);
      }
    } catch (e) {
      console.error("Summary error:", e);
    }
  };

  // Trigger Rescue Modal for specific or recent snippet
  const handleTriggerRescue = (snippet?: string, time?: string) => {
    const textToRescue = snippet || (transcripts.length > 0 ? transcripts[transcripts.length - 1].textEn : "The professor explained the macroeconomic volatility model.");
    const timeToRescue = time || formatTimer(elapsedSeconds);
    setRescueSnippet(textToRescue);
    setRescueTimestamp(timeToRescue);
    setIsRescueModalOpen(true);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Highlight terms in English text
  const renderHighlightedText = (text: string) => {
    if (!glossary || glossary.length === 0) return text;

    let elements: (string | React.ReactNode)[] = [text];

    glossary.forEach((termItem) => {
      const regex = new RegExp(`\\b(${termItem.term})\\b`, "gi");
      const nextElements: (string | React.ReactNode)[] = [];

      elements.forEach((el) => {
        if (typeof el !== "string") {
          nextElements.push(el);
          return;
        }

        const parts = el.split(regex);
        parts.forEach((part, i) => {
          if (part.toLowerCase() === termItem.term.toLowerCase()) {
            nextElements.push(
              <span
                key={`${termItem.id}-${i}`}
                onMouseEnter={() => setActiveHoverTerm(termItem)}
                onMouseLeave={() => setActiveHoverTerm(null)}
                className="bg-indigo-900/60 text-cyan-300 font-semibold px-1 rounded border-b border-cyan-400 cursor-help transition-all relative group"
              >
                {part}
                {/* Tooltip */}
                <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 text-slate-100 text-xs rounded-xl border border-indigo-500/50 shadow-2xl z-50 pointer-events-none">
                  <span className="font-bold text-cyan-300 block">{termItem.term}</span>
                  <span className="text-emerald-400 font-semibold block">{termItem.chinese}</span>
                  <span className="text-[11px] text-slate-300 block mt-1">{termItem.definitionZh}</span>
                </span>
              </span>
            );
          } else {
            nextElements.push(part);
          }
        });
      });

      elements = nextElements;
    });

    return elements;
  };

  const latestChunk = transcripts.length > 0 ? transcripts[transcripts.length - 1] : null;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Top Controls Banner */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl border border-white/10">
        
        {/* Left: Course Info & Live Status */}
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/30 rounded-xl shadow-inner">
            <Clock className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-100">{selectedCourse.code} Live Class</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-white/10 text-slate-200 font-mono border border-white/10">
                ⏱ {formatTimer(elapsedSeconds)}
              </span>
              {(isRecording || isSimulating) && (
                <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 font-semibold active-glow animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>实时监听与AI降负中</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              教授: {selectedCourse.professor} · 已识别术语: {glossary.length} 词
            </p>
          </div>
        </div>

        {/* Right: Audio Input Controls */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          
          {/* Audio Source Notice */}
          <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-black/30 border border-white/10 text-[11px] text-slate-300">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>输入源: 本机麦克风 · {liveAudioStatus}</span>
          </div>

          {/* Simulated Speech Toggle */}
          <button
            onClick={() => {
              if (isSimulating) {
                setIsSimulating(false);
              } else {
                setIsSimulating(true);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all border ${
              isSimulating
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg"
                : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/15 backdrop-blur-md"
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            <span>{isSimulating ? "暂停演示原音" : "模拟讲课原音"}</span>
          </button>

          {/* Real Mic Toggle */}
          <button
            onClick={toggleRealMic}
            className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
              isRecording
                ? "bg-rose-600 hover:bg-rose-500 text-white rescue-glow animate-pulse border border-rose-400/30"
                : "bg-indigo-600 hover:bg-indigo-500 text-white indigo-glow border border-indigo-400/30"
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isRecording ? "停止本机麦克风" : "开启本机麦克风听课"}</span>
          </button>

        </div>

      </div>

      {liveAudioError && (
        <div className="glass-card rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" />
          <span>{liveAudioError}</span>
        </div>
      )}

      {/* Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        
        {/* Left Column: Real-time Transcript Stream (7 Cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-5 flex flex-col shadow-2xl border border-white/12">
          
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-slate-100 text-sm">
                教授英文原音实时转录 (Live Transcript)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              鼠标悬停高亮单词可查看中文释义
            </span>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 max-h-[500px] overflow-y-auto space-y-4 pr-2">
            {transcripts.length === 0 ? (
              <div className="text-center py-20 text-slate-500 space-y-3">
                <Mic className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">
                  暂无原音输入。点击上方“开启麦克风听课”或“播放模拟原音讲课”开始实况听课！
                </p>
              </div>
            ) : (
              transcripts.map((chunk, idx) => (
                <div
                  key={chunk.id}
                  className="p-4 bg-black/30 border border-white/10 hover:border-indigo-400/40 rounded-xl transition-all space-y-2 group relative backdrop-blur-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300 border border-white/10">
                        [{chunk.timestamp}]
                      </span>
                      {chunk.difficulty && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            chunk.difficulty >= 4
                              ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                              : chunk.difficulty === 3
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                              : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                          }`}
                        >
                          {chunk.difficulty >= 4 ? "高难密集中" : chunk.difficulty === 3 ? "适中" : "清晰平缓"}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleTriggerRescue(chunk.textEn, chunk.timestamp)}
                      className="opacity-90 group-hover:opacity-100 px-2.5 py-1 bg-rose-950/90 hover:bg-rose-900 text-rose-300 rounded-lg text-[11px] font-medium border border-rose-700/60 flex items-center space-x-1 transition-all rescue-glow"
                    >
                      <LifeBuoy className="w-3 h-3 text-rose-400" />
                      <span>拆解这句</span>
                    </button>
                  </div>

                  {/* English verbatim text with term highlighting */}
                  <p className="text-sm font-sans text-slate-100 leading-relaxed tracking-wide">
                    {renderHighlightedText(chunk.textEn)}
                  </p>

                  {/* Quick Chinese core takeaway */}
                  {chunk.chineseSummary && (
                    <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 font-medium flex items-start space-x-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{chunk.chineseSummary}</span>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={scrollEndRef} />
          </div>

        </div>

        {/* Right Column: AI Understanding & Scaffolding Layer (5 Cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-5 flex flex-col shadow-2xl border border-white/12">
          
          {/* Sub-Tabs */}
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/10 mb-4 backdrop-blur-md">
            <button
              onClick={() => setActiveRightTab("realtime")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeRightTab === "realtime"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              实时理解层
            </button>

            <button
              onClick={() => setActiveRightTab("summary")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                activeRightTab === "summary"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              5分钟小结
              {progressiveSummaries.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-indigo-900 text-indigo-200 rounded-full text-[10px]">
                  {progressiveSummaries.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveRightTab("rescues")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                activeRightTab === "rescues"
                  ? "bg-indigo-600/90 text-white shadow-md border border-white/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              救生圈历史
              {rescueRecords.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-900 text-rose-200 rounded-full text-[10px]">
                  {rescueRecords.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Realtime Understanding Layer */}
          {activeRightTab === "realtime" && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {latestChunk ? (
                <div className="space-y-4">
                  
                  {/* Current 1-sentence Chinese logic */}
                  <div className="p-4 bg-gradient-to-br from-indigo-950/80 to-black/60 border border-indigo-500/30 rounded-xl space-y-2 backdrop-blur-md">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                      一句话精炼理解 (Real-time Chinese Takeaway):
                    </span>
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      {latestChunk.chineseSummary}
                    </p>
                  </div>

                  {/* Context Bridge */}
                  {latestChunk.contextBridge && (
                    <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-300 backdrop-blur-md">
                      <span className="font-bold text-cyan-400 block mb-1">🔗 上下文逻辑搭桥:</span>
                      <p>{latestChunk.contextBridge}</p>
                    </div>
                  )}

                  {/* Detected Jargon */}
                  {latestChunk.detectedTerms && latestChunk.detectedTerms.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-300 block">
                        当前说辞包含的高频术语:
                      </span>
                      {latestChunk.detectedTerms.map((term, i) => (
                        <div key={i} className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1 backdrop-blur-md">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-300 text-xs font-mono">{term.term}</span>
                            <span className="text-emerald-400 font-semibold text-xs">{term.chinese}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{term.definitionZh}</p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-16 text-slate-500">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs">开启听课后，此处将实时更新教授讲话的中文精炼解释与核心术语。</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 5-Minute Progressive Summaries */}
          {activeRightTab === "summary" && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">系统每 5 分钟自动归纳中文逻辑小结</span>
                <button
                  onClick={triggerProgressiveSummary}
                  className="text-xs px-2.5 py-1 bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 rounded-lg border border-indigo-700/50 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>手动生成小结</span>
                </button>
              </div>

              {progressiveSummaries.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs">暂无 5 分钟分段小结。持续听课 5 分钟后将自动生成。</p>
                </div>
              ) : (
                progressiveSummaries.map((s) => (
                  <div key={s.id} className="p-4 bg-black/40 border border-white/10 rounded-xl space-y-3 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-cyan-300">{s.title}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-white/10 text-slate-300 rounded-full font-mono border border-white/10">
                        {s.timeRange}
                      </span>
                    </div>

                    <ul className="space-y-1.5 text-xs text-slate-200">
                      {s.bulletPoints.map((bp, i) => (
                        <li key={i} className="flex items-start space-x-2">
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Quick Catch up */}
                    {s.quickCatchUp && (
                      <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs text-amber-200">
                        <span className="font-bold block text-[11px] text-amber-400">⚡ 跟丢快查 (Quick Catch-up):</span>
                        <p className="mt-0.5">{s.quickCatchUp}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Rescue Records */}
          {activeRightTab === "rescues" && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {rescueRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <LifeBuoy className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs">暂无救生圈记录。听到卡壳部分随时点击下方“听力救生圈”进行拆解。</p>
                </div>
              ) : (
                rescueRecords.map((r) => (
                  <div key={r.id} className="p-4 bg-black/40 border border-rose-500/30 rounded-xl space-y-2 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-400">救生圈分析 [{r.timestamp}]</span>
                    </div>
                    <p className="text-xs text-slate-300 italic font-mono">"{r.snippetText.slice(0, 80)}..."</p>
                    <p className="text-xs font-semibold text-indigo-200">{r.plainChineseExplanation}</p>
                    {r.suggestedQuestion && (
                      <div className="p-2 bg-black/50 rounded text-[11px] font-mono text-emerald-300 border border-emerald-500/20">
                        Q: "{r.suggestedQuestion}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        </div>

      </div>

      {/* Floating Action Button: Prominent "听力救生圈" (Rescue Button) */}
      <div className="fixed bottom-8 right-8 z-30">
        <button
          onClick={() => handleTriggerRescue()}
          className="group px-6 py-4 bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-full rescue-glow border border-white/30 flex items-center space-x-3 transition-all hover:scale-105 active:scale-95"
        >
          <div className="p-1.5 bg-white/20 rounded-full animate-pulse">
            <LifeBuoy className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-extrabold tracking-wide">听力救生圈 · 没听懂</span>
            <span className="block text-[10px] font-normal text-rose-100/90">一键捕捉过去30秒 + 深度拆解</span>
          </div>
        </button>
      </div>

      {/* Rescue Modal */}
      <RescueModal
        isOpen={isRescueModalOpen}
        onClose={() => setIsRescueModalOpen(false)}
        snippetText={rescueSnippet}
        timestamp={rescueTimestamp}
        courseTitle={selectedCourse.title}
        onSaveRescueRecord={(record) => setRescueRecords((prev) => [record, ...prev])}
      />

    </div>
  );
};
