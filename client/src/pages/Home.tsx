/**
 * 聲波玻璃光場：非對稱的指令欄與右側光球形成懸浮聲場；動畫由本機麥克風音量驅動。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { AudioLines, Mic, MicOff, ShieldCheck, Square, Volume2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

type ListeningStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";

const heroAtmosphere = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030673421/yrpelpjQTlpUICVx.jpg";
const signalDetail = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030673421/JbNUJcGRrFrmjHzY.jpg";
const listeningDetail = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030673421/LCmlnVevhPJAyifC.jpg";
const logo = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030673421/McmWvVAwuqqwqMsa.png";

const statusContent: Record<ListeningStatus, { label: string; helper: string }> = {
  idle: { label: "準備聆聽", helper: "按下按鈕後，允許麥克風存取。" },
  requesting: { label: "正在請求權限", helper: "請在瀏覽器視窗中允許麥克風。" },
  listening: { label: "正在聆聽", helper: "聲音只在此裝置上即時分析。" },
  denied: { label: "未取得麥克風權限", helper: "請在瀏覽器設定中允許麥克風後再試一次。" },
  unsupported: { label: "此瀏覽器不支援", helper: "請改用最新版 Chrome、Safari 或 Edge。" },
  error: { label: "無法啟動音訊", helper: "請檢查裝置麥克風與網站安全連線。" },
};

function getAudioErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "麥克風權限未開啟，請允許後再試一次。";
    }
    if (error.name === "NotFoundError") {
      return "找不到可使用的麥克風。";
    }
    if (error.name === "NotReadableError") {
      return "麥克風目前可能正被其他應用程式使用。";
    }
  }

  return "無法啟動麥克風，請確認裝置與瀏覽器設定。";
}

export default function Home() {
  const [status, setStatus] = useState<ListeningStatus>("idle");
  const [message, setMessage] = useState(statusContent.idle.helper);
  const [inputLevel, setInputLevel] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleBufferRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef(0);
  const lastUiUpdateRef = useRef(0);

  const setStageLevel = useCallback((level: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.style.setProperty("--level", level.toFixed(3));
    stage.style.setProperty("--glow", (0.24 + level * 0.76).toFixed(3));
  }, []);

  const stopListening = useCallback(() => {
    if (animationRef.current !== null) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close();
    }

    smoothedLevelRef.current = 0;
    setStageLevel(0);
    setInputLevel(0);
    setStatus("idle");
    setMessage(statusContent.idle.helper);
  }, [setStageLevel]);

  const animateAudio = useCallback(() => {
    const analyser = analyserRef.current;
    const sampleBuffer = sampleBufferRef.current;
    if (!analyser || !sampleBuffer) return;

    analyser.getByteTimeDomainData(sampleBuffer);
    let sum = 0;
    for (let index = 0; index < sampleBuffer.length; index += 1) {
      const normalized = (sampleBuffer[index] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / sampleBuffer.length);
    const targetLevel = Math.min(1, rms * 5.2);
    const smoothedLevel = smoothedLevelRef.current * 0.8 + targetLevel * 0.2;
    smoothedLevelRef.current = smoothedLevel;
    setStageLevel(smoothedLevel);

    const now = performance.now();
    if (now - lastUiUpdateRef.current > 110) {
      setInputLevel(Math.round(smoothedLevel * 100));
      lastUiUpdateRef.current = now;
    }

    animationRef.current = window.requestAnimationFrame(animateAudio);
  }, [setStageLevel]);

  const startListening = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setMessage("麥克風需要 HTTPS 安全連線與支援 Web Audio API 的瀏覽器。");
      return;
    }

    setStatus("requesting");
    setMessage(statusContent.requesting.helper);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const AudioContextConstructor = window.AudioContext || (
        window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      if (!AudioContextConstructor) {
        setStatus("unsupported");
        setMessage("此瀏覽器不支援 Web Audio API。請改用最新版 Chrome、Safari 或 Edge。");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const context = new AudioContextConstructor();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      sampleBufferRef.current = new Uint8Array(analyser.fftSize);
      smoothedLevelRef.current = 0;
      lastUiUpdateRef.current = performance.now();
      setStatus("listening");
      setMessage(statusContent.listening.helper);
      animateAudio();
    } catch (error) {
      const nextStatus = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
        ? "denied"
        : "error";
      setStatus(nextStatus);
      setMessage(getAudioErrorMessage(error));
      stopListening();
      setStatus(nextStatus);
      setMessage(getAudioErrorMessage(error));
    }
  }, [animateAudio, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    stage.style.setProperty("--pointer-x", x.toFixed(3));
    stage.style.setProperty("--pointer-y", y.toFixed(3));
  };

  const resetPointer = () => {
    stageRef.current?.style.setProperty("--pointer-x", "0");
    stageRef.current?.style.setProperty("--pointer-y", "0");
  };

  const isListening = status === "listening";
  const isRequesting = status === "requesting";
  const actionLabel = isListening ? "停止聆聽" : isRequesting ? "正在連線" : "開始聆聽";
  const ActionIcon = isListening ? Square : Mic;

  return (
    <div className="orb-page">
      <div className="ambient-grain" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#voice-orb" aria-label="AI Voice Orb 首頁">
          <img className="brand-mark" src={logo} alt="AI Voice Orb 聲波圓環標誌" />
          <span className="brand-type" aria-label="AI Voice Orb">
            <span>AI VOICE</span>
            <strong>ORB</strong>
          </span>
        </a>
        <div className="topbar-meta" aria-label="產品版本資訊">
          <span>LOCAL SIGNAL</span>
          <span className="meta-dot" />
          <span>BETA 01</span>
        </div>
      </header>

      <main className="hero-shell" id="voice-orb">
        <section className="command-column" aria-labelledby="page-title">
          <p className="eyebrow"><Waves size={15} strokeWidth={1.8} /> VOICE-RESPONSIVE INTERFACE</p>
          <h1 id="page-title">讓聲音，<br /><em>成為一道</em><br />可見的光。</h1>
          <p className="intro-copy">一個即時回應你聲音的環境式介面。啟動後，僅以裝置端音量資料驅動光場，不會錄音或傳送內容。</p>

          <div className="control-panel" data-status={status}>
            <div className="control-head">
              <span className="pulse-indicator" aria-hidden="true" />
              <div>
                <p className="control-label">{statusContent[status].label}</p>
                <p className="control-message" aria-live="polite">{message}</p>
              </div>
            </div>
            <div className="control-actions">
              <Button
                className="listen-button"
                onClick={isListening ? stopListening : startListening}
                disabled={isRequesting}
              >
                <ActionIcon size={17} strokeWidth={2} />
                {actionLabel}
              </Button>
              {isListening && (
                <Button className="quiet-button" variant="ghost" onClick={stopListening} aria-label="停止並釋放麥克風">
                  <MicOff size={17} strokeWidth={1.8} />
                </Button>
              )}
            </div>
          </div>

          <div className="privacy-row">
            <ShieldCheck size={18} strokeWidth={1.6} />
            <p><strong>本機即時分析</strong><span>聲音不會被錄製、上傳或儲存。</span></p>
          </div>
        </section>

        <section
          ref={stageRef}
          className="visual-stage"
          data-listening={isListening}
          onPointerMove={handlePointerMove}
          onPointerLeave={resetPointer}
          aria-label="會隨麥克風音量變化的 AI 光球視覺"
        >
          <img className="hero-atmosphere" src={heroAtmosphere} alt="" aria-hidden="true" />
          <div className="stage-wash" aria-hidden="true" />
          <div className="stage-grid" aria-hidden="true" />
          <div className="orb-scene" aria-hidden="true">
            <div className="orb-shadow" />
            <div className="orb-halo halo-one" />
            <div className="orb-halo halo-two" />
            <div className="orb-orbit orbit-a" />
            <div className="orb-orbit orbit-b" />
            <div className="orb-orbit orbit-c" />
            <div className="field-disturbance disturbance-a" />
            <div className="field-disturbance disturbance-b" />
            <div className="orb-body">
              <div className="orb-lobe lobe-a" />
              <div className="orb-lobe lobe-b" />
              <div className="orb-lobe lobe-c" />
              <div className="orb-lobe lobe-d" />
              <div className="orb-veil veil-a" />
              <div className="orb-veil veil-b" />
              <div className="orb-sheen" />
              <div className="orb-core" />
            </div>
          </div>
          <div className="audio-bars" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => <span key={index} style={{ "--i": index } as React.CSSProperties} />)}
          </div>
          <div className="stage-note">
            <AudioLines size={16} strokeWidth={1.5} />
            <span>{isListening ? "LIVE INPUT" : "STANDBY"}</span>
          </div>
          <div className="level-rail" aria-hidden="true">
            <span className="rail-label">INPUT</span>
            <div className="rail-track"><i /></div>
            <output>{String(inputLevel).padStart(2, "0")}</output>
          </div>
        </section>
      </main>

      <section className="signal-journal" aria-label="互動特性說明">
        <article className="journal-copy">
          <span className="journal-number">01 / EXPERIENCE</span>
          <h2>不是錄音指示燈。<br />是一段看得見的回應。</h2>
          <p>平滑處理後的輸入音量同時影響光球的體積、發光和環線幅度，在保留安靜節奏的前提下，即時回應每一次發聲。</p>
        </article>
        <article className="journal-visual signal-detail-card">
          <img src={signalDetail} alt="極光青聲音訊號抽象視覺" />
          <div><span>INPUT PATH</span><strong>ONLY HERE</strong></div>
        </article>
        <article className="journal-visual listening-detail-card">
          <img src={listeningDetail} alt="液態玻璃聲波環線抽象視覺" />
          <div><Volume2 size={18} /><span>EVERY SOUND / ONE LIGHT</span></div>
        </article>
      </section>
    </div>
  );
}
