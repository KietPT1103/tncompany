"use client";

import { useEffect, useRef, useState } from "react";
import { Hand, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { editGestureFrame } from "@/services/gestureStudioService";

type Point = {
  x: number;
  y: number;
};

type FrameBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  points: Point[];
};

type OverlayResult = {
  imageUrl: string;
  frame: FrameBox;
};

type HandPoints = Array<{ x: number; y: number; z?: number }>;

type DetectedHand = {
  points: HandPoints;
  handedness: string;
};

type HandLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => {
    landmarks?: HandPoints[];
    handednesses?: Array<Array<{ categoryName?: string }>>;
  };
  close?: () => void;
};

const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const VISION_BUNDLE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const AUTO_GENERATE_STABLE_MS = 500;
const PROMPT_COOLDOWN_MS = 1800;
const FRAME_STABILITY_THRESHOLD = 0.16;
const FRAME_PRESENCE_RESET_THRESHOLD = 0.28;
const PROMPTS = [
  {
    id: "clay",
    label: "Đất nặn điện ảnh",
    prompt:
      "Biến phần trong khung thành chân dung đất nặn điện ảnh, ánh sáng ấm, chi tiết khuôn mặt rõ, giữ nguyên bối cảnh bên ngoài.",
  },
  {
    id: "anime",
    label: "Anime sắc nét",
    prompt:
      "Biến phần trong khung thành chân dung anime điện ảnh, màu sắc sạch, mắt nổi bật, giữ viền hòa tự nhiên với nền gốc.",
  },
  {
    id: "pixel",
    label: "Pixel retro",
    prompt:
      "Biến phần trong khung thành chân dung pixel art retro 16-bit, màu tươi, giữ bố cục nhân vật ở giữa khung.",
  },
  {
    id: "oil",
    label: "Sơn dầu",
    prompt:
      "Biến phần trong khung thành tranh sơn dầu chân dung, cọ dày, ánh sáng gallery, vẫn giữ góc nhìn trực diện.",
  },
  {
    id: "robot",
    label: "Robot sci-fi",
    prompt:
      "Biến phần trong khung thành chân dung robot sci-fi, kim loại sáng, neon tinh tế, giữ đường nét gương mặt dễ nhận ra.",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function loadHandLandmarker() {
  const tasksVision = await import(/* @vite-ignore */ VISION_BUNDLE_URL);
  const vision = await tasksVision.FilesetResolver.forVisionTasks(
    `${VISION_BUNDLE_URL}/wasm`
  );

  return tasksVision.HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_ASSET_URL,
    },
    runningMode: "VIDEO",
    numHands: 2,
  }) as Promise<HandLandmarkerInstance>;
}

function normalizeHands(
  landmarks: HandPoints[] | undefined,
  handednesses: Array<Array<{ categoryName?: string }>> | undefined
): DetectedHand[] {
  return (landmarks || []).map((handPoints, index) => ({
    points: handPoints.map((point) => ({
      x: 1 - point.x,
      y: point.y,
      z: point.z,
    })),
    handedness: handednesses?.[index]?.[0]?.categoryName || "",
  }));
}

function isClosedFist(points: HandPoints) {
  const wrist = points[0];
  const fingerPairs: Array<[number, number]> = [
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ];

  const foldedFingers = fingerPairs.every(([tip, base]) => {
    return distance(points[tip], wrist) < distance(points[base], wrist) * 1.05;
  });

  const thumbCurled = distance(points[4], points[2]) < distance(points[4], wrist) * 0.75;
  return foldedFingers && thumbCurled;
}

function isLShapeGesture(points: HandPoints) {
  const wrist = points[0];
  const thumbTip = points[4];
  const indexTip = points[8];
  const middleTip = points[12];
  const ringTip = points[16];
  const pinkyTip = points[20];

  const thumbOpen = distance(thumbTip, indexTip) > distance(wrist, indexTip) * 0.35;
  const indexOpen = distance(indexTip, wrist) > distance(points[6], wrist) * 1.08;
  const middleCurled = distance(middleTip, wrist) < distance(points[9], wrist) * 1.18;
  const ringCurled = distance(ringTip, wrist) < distance(points[13], wrist) * 1.18;
  const pinkyCurled = distance(pinkyTip, wrist) < distance(points[17], wrist) * 1.18;

  return thumbOpen && indexOpen && middleCurled && ringCurled && pinkyCurled;
}

function buildFrameBox(hands: DetectedHand[]): FrameBox | null {
  if (hands.length < 2) {
    return null;
  }

  const leftHand =
    hands.find((hand) => hand.handedness === "Left") ||
    [...hands].sort((a, b) => a.points[0].x - b.points[0].x)[0];
  const rightHand =
    hands.find((hand) => hand.handedness === "Right") ||
    [...hands].sort((a, b) => b.points[0].x - a.points[0].x)[0];

  if (!leftHand || !rightHand || leftHand === rightHand) {
    return null;
  }

  if (!isLShapeGesture(leftHand.points) || !isLShapeGesture(rightHand.points)) {
    return null;
  }

  const points = [leftHand.points[8], rightHand.points[8], rightHand.points[4], leftHand.points[4]];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = 0.035;
  const x = clamp(Math.min(...xs) - padding, 0, 1);
  const y = clamp(Math.min(...ys) - padding, 0, 1);
  const right = clamp(Math.max(...xs) + padding, 0, 1);
  const bottom = clamp(Math.max(...ys) + padding, 0, 1);
  const width = right - x;
  const height = bottom - y;

  if (width < 0.08 || height < 0.08) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
    points: points.map((point) => ({ x: point.x, y: point.y })),
  };
}

function frameSimilarity(a: FrameBox | null, b: FrameBox | null) {
  if (!a || !b) return 0;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const dw = Math.abs(a.width - b.width);
  const dh = Math.abs(a.height - b.height);
  return dx + dy + dw + dh;
}

function createMaskDataUrl(width: number, height: number, frame: FrameBox) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Khong tao duoc mask canvas.");
  }

  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, width, height);
  ctx.clearRect(
    Math.round(frame.x * width),
    Math.round(frame.y * height),
    Math.round(frame.width * width),
    Math.round(frame.height * height)
  );

  return canvas.toDataURL("image/png");
}

function captureFrameData(video: HTMLVideoElement, frame: FrameBox) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Khong tao duoc frame canvas.");
  }

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -width, 0, width, height);
  ctx.restore();

  return {
    imageDataUrl: canvas.toDataURL("image/png"),
    maskDataUrl: createMaskDataUrl(width, height, frame),
    box: {
      x: Math.round(frame.x * width),
      y: Math.round(frame.y * height),
      width: Math.round(frame.width * width),
      height: Math.round(frame.height * height),
    },
    landmarks: frame.points.map((point) => ({
      x: Math.round(point.x * width),
      y: Math.round(point.y * height),
    })),
  };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: FrameBox | null,
  status: string,
  activePromptLabel: string,
  isBusy: boolean,
  showClosedHint: boolean,
  debugLines: string[]
) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(3, 7, 18, 0.22)";
  ctx.fillRect(0, 0, width, height);

  if (frame) {
    const boxX = frame.x * width;
    const boxY = frame.y * height;
    const boxWidth = frame.width * width;
    const boxHeight = frame.height * height;

    ctx.clearRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = isBusy ? "#f59e0b" : "#10b981";
    ctx.lineWidth = 6;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  }

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = "600 22px sans-serif";
  ctx.fillText(status, 28, 42);
  ctx.font = "500 18px sans-serif";
  ctx.fillText(`Style: ${activePromptLabel}`, 28, 72);

  if (showClosedHint) {
    ctx.fillStyle = "rgba(250, 204, 21, 0.98)";
    ctx.font = "700 24px sans-serif";
    ctx.fillText("Nam tay xong mo ra de doi style va tao anh", 28, height - 32);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "500 18px sans-serif";
    ctx.fillText("Giu 2 tay thanh khung L. Nam tay roi mo ra de chuyen style.", 28, height - 28);
  }

  if (debugLines.length > 0) {
    const boxWidth = 360;
    const lineHeight = 22;
    const boxHeight = 18 + debugLines.length * lineHeight;
    const x = width - boxWidth - 24;
    const y = 110;

    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "500 15px monospace";

    debugLines.forEach((line, index) => {
      ctx.fillText(line, x + 16, y + 26 + index * lineHeight);
    });
  }
}

export default function GestureStudioPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const stableFrameRef = useRef<FrameBox | null>(null);
  const stableSinceRef = useRef(0);
  const frameVisibleSinceRef = useRef(0);
  const autoGenerateArmedRef = useRef(true);
  const lastGeneratedKeyRef = useRef("");
  const gestureClosedRef = useRef(false);
  const promptCooldownUntilRef = useRef(0);

  const [loadingModel, setLoadingModel] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultImageUrl, setResultImageUrl] = useState("");
  const [overlayResult, setOverlayResult] = useState<OverlayResult | null>(null);
  const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [activeFrame, setActiveFrame] = useState<FrameBox | null>(null);
  const [statusText, setStatusText] = useState("Dang khoi dong camera va hand tracking...");
  const [closedHint, setClosedHint] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    hands: 0,
    frameValid: false,
    bothClosed: false,
    stableMs: 0,
    armed: true,
    requestCount: 0,
    lastRequestAt: "",
  });

  const activePrompt = PROMPTS[activePromptIndex];

  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        const [stream, handLandmarker] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          }),
          loadHandLandmarker(),
        ]);

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          handLandmarker.close?.();
          return;
        }

        streamRef.current = stream;
        handLandmarkerRef.current = handLandmarker;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setCameraReady(true);
          setStatusText("Giu 2 tay thanh khung L de bat dau.");
        }
      } catch (setupError) {
        console.error(setupError);
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Khong the khoi dong camera hoac MediaPipe."
        );
      } finally {
        if (mounted) {
          setLoadingModel(false);
        }
      }
    }

    void setup();

    return () => {
      mounted = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      handLandmarkerRef.current?.close?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    function detectLoop() {
      const video = videoRef.current;
      const overlay = canvasRef.current;
      const handLandmarker = handLandmarkerRef.current;
      const now = performance.now();

      if (video && overlay && handLandmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const videoTime = video.currentTime;
        if (videoTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = videoTime;
          const detection = handLandmarker.detectForVideo(video, now);
          const hands = normalizeHands(detection.landmarks, detection.handednesses);
          const nextFrame = buildFrameBox(hands);
          const bothClosed = hands.length >= 2 && hands.every((hand) => isClosedFist(hand.points));

          if (nextFrame) {
            if (frameSimilarity(nextFrame, stableFrameRef.current) > FRAME_STABILITY_THRESHOLD) {
              stableFrameRef.current = nextFrame;
              stableSinceRef.current = now;
            }

            if (!stableFrameRef.current) {
              stableFrameRef.current = nextFrame;
            }

            if (frameVisibleSinceRef.current === 0) {
              frameVisibleSinceRef.current = now;
            } else if (frameSimilarity(nextFrame, stableFrameRef.current) > FRAME_PRESENCE_RESET_THRESHOLD) {
              frameVisibleSinceRef.current = now;
            }

            setActiveFrame(nextFrame);
          } else {
            stableFrameRef.current = null;
            stableSinceRef.current = 0;
            frameVisibleSinceRef.current = 0;
            setActiveFrame(null);
          }

          if (bothClosed) {
            gestureClosedRef.current = true;
            setClosedHint(true);
            setStatusText("Da nhan dong tac nam tay. Mo ra de doi style va tao anh.");
          } else if (
            gestureClosedRef.current &&
            nextFrame &&
            now >= promptCooldownUntilRef.current
          ) {
            gestureClosedRef.current = false;
            setClosedHint(false);
            setActivePromptIndex((current) => (current + 1) % PROMPTS.length);
            autoGenerateArmedRef.current = true;
            promptCooldownUntilRef.current = now + PROMPT_COOLDOWN_MS;
            setStatusText("Da doi style. Dang canh khung on dinh de tao anh moi.");
          } else if (!bothClosed) {
            setClosedHint(false);
            if (!nextFrame && !busy) {
              setStatusText("Giu 2 tay thanh khung L de bat dau.");
            } else if (nextFrame && !busy) {
              setStatusText("Khung da nhan. Giu on dinh de he thong tu tao anh.");
            }
          }

          const stableMs = frameVisibleSinceRef.current > 0 ? Math.max(0, Math.round(now - frameVisibleSinceRef.current)) : 0;
          const nextDebug = {
            hands: hands.length,
            frameValid: !!nextFrame,
            bothClosed,
            stableMs,
            armed: autoGenerateArmedRef.current,
            requestCount: debugInfo.requestCount,
            lastRequestAt: debugInfo.lastRequestAt,
          };
          setDebugInfo((current) => ({
            ...current,
            ...nextDebug,
          }));

          drawOverlay(
            overlay,
            video,
            nextFrame,
            statusText,
            activePrompt.label,
            busy,
            bothClosed,
            [
              `hands=${hands.length}`,
              `frame=${nextFrame ? "yes" : "no"}`,
              `closed=${bothClosed ? "yes" : "no"}`,
              `stableMs=${stableMs}`,
              `armed=${autoGenerateArmedRef.current ? "yes" : "no"}`,
              `requests=${debugInfo.requestCount}`,
            ]
          );
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectLoop);
    }

    animationFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activePrompt.label, busy, statusText]);

  useEffect(() => {
    if (!cameraReady || !activeFrame || busy) {
      return;
    }

    const now = performance.now();
    const stableFor = frameVisibleSinceRef.current > 0 ? now - frameVisibleSinceRef.current : 0;
    if (stableFor < AUTO_GENERATE_STABLE_MS) {
      return;
    }

    const frameKey = [
      activePrompt.id,
      Math.round(activeFrame.x * 100),
      Math.round(activeFrame.y * 100),
      Math.round(activeFrame.width * 100),
      Math.round(activeFrame.height * 100),
    ].join(":");

    if (!autoGenerateArmedRef.current && lastGeneratedKeyRef.current === frameKey) {
      return;
    }

    autoGenerateArmedRef.current = false;
    lastGeneratedKeyRef.current = frameKey;

    const video = videoRef.current;
    if (!video) {
      return;
    }

    async function run() {
      setBusy(true);
      setError("");
      setStatusText("Dang tao anh tu dong, vui long giu khung on dinh...");
      setDebugInfo((current) => ({
        ...current,
        requestCount: current.requestCount + 1,
        lastRequestAt: new Date().toLocaleTimeString(),
      }));

      try {
        const frameSnapshot = {
          x: activeFrame.x,
          y: activeFrame.y,
          width: activeFrame.width,
          height: activeFrame.height,
          points: activeFrame.points.map((point) => ({ x: point.x, y: point.y })),
        };
        const payload = captureFrameData(video, activeFrame);
        const response = await editGestureFrame({
          prompt: activePrompt.prompt,
          ...payload,
        });

        setResultImageUrl(response.imageUrl);
        setOverlayResult({
          imageUrl: response.imageUrl,
          frame: frameSnapshot,
        });
        setProviderInfo({
          provider: response.provider,
          model: response.model,
        });
        setStatusText("Da tao anh xong. Nam tay roi mo ra de doi style tiep.");
      } catch (generationError) {
        console.error(generationError);
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Khong the tao anh tu vung da chon."
        );
        setStatusText("Tao anh that bai. Giu khung on dinh de thu lai.");
        autoGenerateArmedRef.current = true;
      } finally {
        setBusy(false);
      }
    }

    void run();
  }, [activeFrame, activePrompt, cameraReady, busy]);

  return (
      <main className="h-screen overflow-hidden bg-black text-white">
        <div className="relative h-full w-full">
          <video
            ref={videoRef}
            className="h-full w-full scale-x-[-1] object-cover"
            muted
            playsInline
            autoPlay
          />
          {overlayResult ? (
            <img
              src={overlayResult.imageUrl}
              alt="Gesture overlay result"
              className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover"
              style={{
                clipPath: `inset(${overlayResult.frame.y * 100}% ${100 - (overlayResult.frame.x + overlayResult.frame.width) * 100}% ${
                  100 - (overlayResult.frame.y + overlayResult.frame.height) * 100
                }% ${overlayResult.frame.x * 100}%)`,
              }}
            />
          ) : null}
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-6">
            <div className="max-w-2xl rounded-[28px] border border-white/15 bg-black/40 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <Hand className="h-4 w-4" />
                Gesture Studio
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Full-screen AI frame
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Giu 2 tay thanh khung L de tao vung edit. Nam tay va mo ra de chuyen style.
                He thong se tu dong tao anh khi khung on dinh, khong can bam nut.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-black/40 px-5 py-4 text-right backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Trang thai</div>
              <div className="mt-2 text-sm font-semibold">
                {loadingModel ? "Dang nap model" : cameraReady ? "San sang" : "Dang cho camera"}
              </div>
              <div className="mt-3 text-xs text-white/70">
                {providerInfo ? `${providerInfo.provider} / ${providerInfo.model}` : "Chua tao anh"}
              </div>
              <div className="mt-3 space-y-1 text-left text-[11px] text-white/70">
                <div>hands: {debugInfo.hands}</div>
                <div>frame: {debugInfo.frameValid ? "yes" : "no"}</div>
                <div>closed: {debugInfo.bothClosed ? "yes" : "no"}</div>
                <div>stableMs: {debugInfo.stableMs}</div>
                <div>armed: {debugInfo.armed ? "yes" : "no"}</div>
                <div>requests: {debugInfo.requestCount}</div>
                <div>last: {debugInfo.lastRequestAt || "--:--:--"}</div>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6">
            <div className="mx-auto max-w-6xl rounded-[32px] border border-white/15 bg-black/40 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-3">
                {PROMPTS.map((item, index) => {
                  const active = index === activePromptIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActivePromptIndex(index);
                        autoGenerateArmedRef.current = true;
                        setStatusText("Da doi style. Giu khung on dinh de tao anh.");
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "border-emerald-300 bg-emerald-300 text-slate-950"
                          : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <div className="ml-auto flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
                  <RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin text-amber-300" : ""}`} />
                  <span>{statusText}</span>
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-[22px] border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
  );
}
