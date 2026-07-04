"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Waves, Webcam } from "lucide-react";

type Landmark = { x: number; y: number; z?: number };
type HandPoints = Landmark[];
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
type PrayerWave = {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
};
type IncensePose = {
  x: number;
  y: number;
  size: number;
  confidence: number;
};

const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const VISION_BUNDLE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const DUST_BUILDUP_ALPHA = 0.0034;
const PALM_CLEAN_RADIUS_FACTOR = 0.42;
const PALM_CLEAN_STRENGTH = 0.32;
const PRAYER_COOLDOWN_MS = 2200;
const PRAYER_HOLD_MS = 220;
const INCENSE_FADE_OUT_MS = 900;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
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

function getPalmCenter(points: HandPoints) {
  const anchors = [0, 5, 9, 13, 17].map((index) => points[index]);
  const total = anchors.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / anchors.length,
    y: total.y / anchors.length,
  };
}

function getHandSize(points: HandPoints) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function isOpenPalm(points: HandPoints) {
  const wrist = points[0];
  const fingerPairs: Array<[number, number]> = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  const extendedCount = fingerPairs.reduce((count, [tip, mid]) => {
    return distance(points[tip], wrist) > distance(points[mid], wrist) * 1.1 ? count + 1 : count;
  }, 0);

  return extendedCount >= 3;
}

function isPrayerGesture(hands: DetectedHand[]) {
  if (hands.length < 2) {
    return null;
  }

  const sortedHands = [...hands].sort(
    (a, b) => getPalmCenter(a.points).x - getPalmCenter(b.points).x
  );
  const [leftHand, rightHand] = sortedHands;
  if (!leftHand || !rightHand) {
    return null;
  }

  const leftPalm = getPalmCenter(leftHand.points);
  const rightPalm = getPalmCenter(rightHand.points);
  const leftSize = getHandSize(leftHand.points);
  const rightSize = getHandSize(rightHand.points);
  const size = (leftSize + rightSize) / 2;

  const palmDistance = distance(leftPalm, rightPalm);
  const indexGap = distance(leftHand.points[8], rightHand.points[8]);
  const middleGap = distance(leftHand.points[12], rightHand.points[12]);
  const thumbGap = distance(leftHand.points[4], rightHand.points[4]);
  const wristGap = distance(leftHand.points[0], rightHand.points[0]);
  const ringGap = distance(leftHand.points[16], rightHand.points[16]);
  const verticalAligned = Math.abs(leftPalm.y - rightPalm.y) < size * 0.52;
  const fingersMeet =
    indexGap < size * 0.9 &&
    middleGap < size * 0.88 &&
    thumbGap < size * 1.05 &&
    ringGap < size * 1.12;
  const palmsNear = palmDistance < size * 0.72;
  const wristsNear = wristGap < size * 1.85;

  if (!verticalAligned || !fingersMeet || !palmsNear || !wristsNear) {
    return null;
  }

  return {
    x: (leftPalm.x + rightPalm.x) / 2,
    y: (leftPalm.y + rightPalm.y) / 2,
    size,
    confidence: clamp(1 - palmDistance / (size * 0.72), 0, 1),
  };
}

function paintSoftErase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  strength: number
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  gradient.addColorStop(0.6, `rgba(0, 0, 0, ${strength * 0.42})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function ensureCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawIncenseSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  now: number,
  opacity: number,
  size: number,
  offsetSeed: number
) {
  const wave = now * 0.0018 + offsetSeed;
  const drift = Math.sin(wave) * size * 0.16;
  const curl = Math.cos(wave * 1.4) * size * 0.12;

  ctx.save();
  ctx.lineWidth = Math.max(1.2, size * 0.018);
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(235, 241, 245, ${opacity * 0.34})`;
  ctx.shadowBlur = 14;
  ctx.shadowColor = `rgba(255,255,255,${opacity * 0.14})`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(
    x + drift,
    y - size * 0.35,
    x - curl,
    y - size * 0.75,
    x + drift * 0.7,
    y - size * 1.15
  );
  ctx.stroke();

  ctx.fillStyle = `rgba(240, 246, 250, ${opacity * 0.14})`;
  ctx.beginPath();
  ctx.arc(x + drift * 0.7, y - size * 1.12, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIncenseCluster(
  ctx: CanvasRenderingContext2D,
  pose: IncensePose,
  width: number,
  height: number,
  now: number,
  opacity: number
) {
  const centerX = pose.x * width;
  const centerY = pose.y * height;
  const size = clamp(pose.size * width * 0.95, 70, 170);
  const baseY = centerY + size * 0.64;
  const stickHeight = size * 1.02;
  const stickSpacing = size * 0.12;
  const emberRadius = Math.max(2.2, size * 0.026);
  const stickWidth = Math.max(3, size * 0.026);
  const incenseXs = [centerX - stickSpacing, centerX, centerX + stickSpacing];

  ctx.save();
  ctx.globalAlpha = opacity;

  incenseXs.forEach((x, index) => {
    const lean = (index - 1) * size * 0.016;
    const topY = baseY - stickHeight;

    ctx.strokeStyle = "rgba(123, 51, 28, 0.95)";
    ctx.lineWidth = stickWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + lean, topY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(244, 203, 144, 0.92)";
    ctx.lineWidth = Math.max(1.2, stickWidth * 0.4);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + lean, topY);
    ctx.stroke();

    ctx.fillStyle = "rgba(46, 35, 28, 0.96)";
    ctx.beginPath();
    ctx.arc(x + lean, topY, emberRadius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 18;
    ctx.shadowColor = `rgba(255, 151, 53, ${opacity * 0.85})`;
    ctx.fillStyle = `rgba(255, 173, 74, ${opacity * 0.95})`;
    ctx.beginPath();
    ctx.arc(x + lean, topY, emberRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    drawIncenseSmoke(ctx, x + lean, topY - emberRadius * 0.7, now, opacity, size, index * 0.9 + 0.2);
  });

  ctx.restore();
}

export default function DustRitualPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const prayerCandidateSinceRef = useRef(0);
  const prayerCooldownUntilRef = useRef(0);
  const waveIdRef = useRef(1);
  const wavesRef = useRef<PrayerWave[]>([]);
  const incensePoseRef = useRef<IncensePose | null>(null);
  const incenseVisibleUntilRef = useRef(0);
  const statusRef = useRef("Dang mo camera va hand tracking...");
  const debugInfoRef = useRef({
    hands: 0,
    prayer: false,
    waveCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Dang mo camera va hand tracking...");
  const [debugInfo, setDebugInfo] = useState({
    hands: 0,
    prayer: false,
    waveCount: 0,
  });

  function updateStatus(nextStatus: string) {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }

  function updateDebugInfo(nextDebugInfo: typeof debugInfoRef.current) {
    debugInfoRef.current = nextDebugInfo;
    setDebugInfo(nextDebugInfo);
  }

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
        if (!video) {
          return;
        }

        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
        updateStatus("Dua ban tay vao camera de lau bui. Chap hai tay de kich hoat hao quang.");
      } catch (setupError) {
        console.error(setupError);
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Khong the khoi dong camera hoac hand tracking."
        );
      } finally {
        if (mounted) {
          setLoading(false);
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
    function render() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handLandmarker = handLandmarkerRef.current;
      const now = performance.now();

      if (video && canvas && handLandmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        ensureCanvasSize(canvas, width, height);

        if (!dustCanvasRef.current) {
          dustCanvasRef.current = document.createElement("canvas");
        }
        if (!blurCanvasRef.current) {
          blurCanvasRef.current = document.createElement("canvas");
        }

        const dustCanvas = dustCanvasRef.current;
        const blurCanvas = blurCanvasRef.current;
        ensureCanvasSize(dustCanvas, width, height);
        ensureCanvasSize(blurCanvas, width, height);

        const ctx = canvas.getContext("2d");
        const dustCtx = dustCanvas.getContext("2d");
        const blurCtx = blurCanvas.getContext("2d");

        if (ctx && dustCtx && blurCtx) {
          const videoTime = video.currentTime;
          let hands: DetectedHand[] = [];
          let prayerCenter: IncensePose | null = null;

          if (videoTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = videoTime;
            const detection = handLandmarker.detectForVideo(video, now);
            hands = normalizeHands(detection.landmarks, detection.handednesses);
            prayerCenter = isPrayerGesture(hands);
            if (prayerCenter) {
              incensePoseRef.current = prayerCenter;
              incenseVisibleUntilRef.current = now + INCENSE_FADE_OUT_MS;
            }

            if (dustCtx.canvas.dataset.seeded !== "yes") {
              dustCtx.fillStyle = "rgba(255,255,255,0.74)";
              dustCtx.fillRect(0, 0, width, height);
              dustCtx.canvas.dataset.seeded = "yes";
            }

            dustCtx.save();
            dustCtx.globalCompositeOperation = "source-over";
            dustCtx.fillStyle = `rgba(255,255,255,${DUST_BUILDUP_ALPHA})`;
            dustCtx.fillRect(0, 0, width, height);
            dustCtx.restore();

            dustCtx.save();
            dustCtx.globalCompositeOperation = "destination-out";
            hands.forEach((hand) => {
              if (!isOpenPalm(hand.points)) {
                return;
              }

              const palm = getPalmCenter(hand.points);
              const radius = Math.max(44, getHandSize(hand.points) * width * PALM_CLEAN_RADIUS_FACTOR);
              paintSoftErase(
                dustCtx,
                palm.x * width,
                palm.y * height,
                radius,
                PALM_CLEAN_STRENGTH
              );
            });
            dustCtx.restore();

            if (prayerCenter) {
              if (prayerCandidateSinceRef.current === 0) {
                prayerCandidateSinceRef.current = now;
              }
            } else {
              prayerCandidateSinceRef.current = 0;
            }

            if (
              prayerCenter &&
              prayerCandidateSinceRef.current > 0 &&
              now - prayerCandidateSinceRef.current >= PRAYER_HOLD_MS &&
              now >= prayerCooldownUntilRef.current
            ) {
              const centerX = prayerCenter.x * width;
              const centerY = prayerCenter.y * height;
              const maxRadius = Math.hypot(
                Math.max(centerX, width - centerX),
                Math.max(centerY, height - centerY)
              );

              wavesRef.current = [
                ...wavesRef.current,
                {
                  id: waveIdRef.current++,
                  x: centerX,
                  y: centerY,
                  radius: 24,
                  maxRadius,
                  speed: Math.max(width, height) * 0.02,
                  opacity: 0.9,
                },
              ];
              prayerCooldownUntilRef.current = now + PRAYER_COOLDOWN_MS;
              prayerCandidateSinceRef.current = 0;
              updateStatus("Hao quang dang lan ra va quet sach lop bui.");
            } else if (prayerCenter) {
              updateStatus("Chum tay da nhan. 3 cay nhang da hien ra.");
            } else if (hands.length > 0 && now >= prayerCooldownUntilRef.current) {
              updateStatus("Dang lau bui bang ban tay. Chap hai tay de bung song quet sach.");
            } else if (hands.length === 0 && now >= prayerCooldownUntilRef.current) {
              updateStatus("Dua ban tay vao khung hinh de bat dau lau bui.");
            }

            updateDebugInfo({
              hands: hands.length,
              prayer: !!prayerCenter,
              waveCount: wavesRef.current.length,
            });
          }

          const activeWaves = wavesRef.current
            .map((wave) => ({
              ...wave,
              radius: wave.radius + wave.speed,
              opacity: Math.max(0, wave.opacity - 0.009),
            }))
            .filter((wave) => wave.radius < wave.maxRadius + 60 && wave.opacity > 0.02);
          wavesRef.current = activeWaves;

          if (activeWaves.length > 0) {
            dustCtx.save();
            dustCtx.globalCompositeOperation = "destination-out";
            activeWaves.forEach((wave) => {
              paintSoftErase(dustCtx, wave.x, wave.y, wave.radius, 0.22);
            });
            dustCtx.restore();
          }

          ctx.clearRect(0, 0, width, height);

          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -width, 0, width, height);
          ctx.restore();

          blurCtx.clearRect(0, 0, width, height);
          blurCtx.save();
          blurCtx.filter = "blur(18px) saturate(0.85) brightness(1.1)";
          blurCtx.scale(-1, 1);
          blurCtx.drawImage(video, -width, 0, width, height);
          blurCtx.restore();
          blurCtx.globalCompositeOperation = "multiply";
          blurCtx.fillStyle = "rgba(236, 224, 205, 0.32)";
          blurCtx.fillRect(0, 0, width, height);
          blurCtx.globalCompositeOperation = "destination-in";
          blurCtx.drawImage(dustCanvas, 0, 0, width, height);
          blurCtx.globalCompositeOperation = "source-over";

          ctx.drawImage(blurCanvas, 0, 0, width, height);

          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(dustCanvas, 0, 0, width, height);
          ctx.fillStyle = "rgba(245, 234, 217, 0.08)";
          ctx.fillRect(0, 0, width, height);
          ctx.restore();

          if (incensePoseRef.current && now <= incenseVisibleUntilRef.current) {
            const fadeProgress = clamp(
              (incenseVisibleUntilRef.current - now) / INCENSE_FADE_OUT_MS,
              0,
              1
            );
            drawIncenseCluster(
              ctx,
              incensePoseRef.current,
              width,
              height,
              now,
              Math.max(0.22, fadeProgress)
            );
          }

          activeWaves.forEach((wave) => {
            const ring = ctx.createRadialGradient(
              wave.x,
              wave.y,
              Math.max(0, wave.radius - 48),
              wave.x,
              wave.y,
              wave.radius
            );
            ring.addColorStop(0, "rgba(255, 195, 92, 0)");
            ring.addColorStop(0.7, `rgba(255, 196, 108, ${wave.opacity * 0.2})`);
            ring.addColorStop(0.88, `rgba(255, 181, 66, ${wave.opacity})`);
            ring.addColorStop(1, "rgba(255, 219, 159, 0)");

            ctx.save();
            ctx.strokeStyle = `rgba(255, 193, 94, ${wave.opacity})`;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 26;
            ctx.shadowColor = `rgba(255, 193, 94, ${wave.opacity})`;
            ctx.fillStyle = ring;
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius - 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          });

        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    }

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <main className="relative h-screen overflow-hidden bg-[#100d0c] text-white">
      <video ref={videoRef} className="hidden" muted playsInline autoPlay />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,210,137,0.16),transparent_34%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.08),transparent_28%)]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 md:p-6">
        <div className="flex w-full max-w-3xl flex-col gap-2 rounded-[26px] border border-white/10 bg-black/26 px-4 py-3 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/80">
              <Sparkles className="h-4 w-4" />
              Dust Ritual Demo
            </div>
            <div className="mt-1 text-sm text-white/78 md:text-[15px]">{status}</div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/75">
              <Webcam className="mr-2 inline h-4 w-4" />
              {loading ? "Dang nap model" : cameraReady ? "Camera san sang" : "Dang cho camera"}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/75">
              <Waves className="mr-2 inline h-4 w-4" />
              {debugInfo.waveCount} wave
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="absolute left-4 right-4 top-4 mx-auto max-w-xl rounded-[24px] border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100 backdrop-blur-xl">
          {error}
        </div>
      ) : null}
    </main>
  );
}
