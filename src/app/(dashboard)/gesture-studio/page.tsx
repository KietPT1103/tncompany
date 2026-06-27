"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Hand, Loader2, ScanSearch, Sparkles, Wand2 } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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

type HandLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => {
    landmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    handednesses?: Array<Array<{ categoryName?: string }>>;
  };
  close?: () => void;
};

const MODEL_ASSET_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const VISION_BUNDLE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
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

function isLShapeGesture(landmarks: Array<{ x: number; y: number }>) {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const thumbOpen = distance(thumbTip, indexTip) > distance(wrist, indexTip) * 0.35;
  const indexOpen = distance(indexTip, wrist) > distance(landmarks[6], wrist) * 1.08;
  const middleCurled = distance(middleTip, wrist) < distance(landmarks[9], wrist) * 1.18;
  const ringCurled = distance(ringTip, wrist) < distance(landmarks[13], wrist) * 1.18;
  const pinkyCurled = distance(pinkyTip, wrist) < distance(landmarks[17], wrist) * 1.18;

  return thumbOpen && indexOpen && middleCurled && ringCurled && pinkyCurled;
}

function buildFrameBox(
  hands: Array<{
    points: Array<{ x: number; y: number }>;
    handedness: string;
  }>
): FrameBox | null {
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
  const padding = 0.03;
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
    points,
  };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  frame: FrameBox | null,
  active: boolean
) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
  ctx.fillRect(0, 0, width, height);

  if (!frame) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "600 28px sans-serif";
    ctx.fillText("Giữ 2 tay thành khung L để chọn vùng", 32, 52);
    return;
  }

  const boxX = frame.x * width;
  const boxY = frame.y * height;
  const boxWidth = frame.width * width;
  const boxHeight = frame.height * height;

  ctx.clearRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = active ? "#10b981" : "#f59e0b";
  ctx.lineWidth = 6;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText(
    active ? "Đã nhận khung, có thể tạo ảnh" : "Đang khóa khung",
    boxX,
    Math.max(28, boxY - 12)
  );
}

function createMaskDataUrl(width: number, height: number, frame: FrameBox) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không tạo được mask canvas.");
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
    throw new Error("Không tạo được frame canvas.");
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

export default function GestureStudioPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const [prompt, setPrompt] = useState(
    "Biến phần trong khung thành chân dung đất nặn điện ảnh, ánh sáng ấm, chi tiết khuôn mặt rõ."
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState(true);
  const [frame, setFrame] = useState<FrameBox | null>(null);
  const [lockedFrame, setLockedFrame] = useState<FrameBox | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultImageUrl, setResultImageUrl] = useState("");
  const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);

  const activeFrame = lockedFrame || frame;
  const canGenerate = cameraReady && !!lockedFrame && prompt.trim().length > 0 && !busy;

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
        }
      } catch (setupError) {
        console.error(setupError);
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Không thể khởi động camera hoặc MediaPipe."
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

      if (video && overlay && handLandmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const videoTime = video.currentTime;
        if (videoTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = videoTime;
          const detection = handLandmarker.detectForVideo(video, performance.now());
          const hands = (detection.landmarks || []).map((landmarks, index) => ({
            points: landmarks.map((point) => ({ x: 1 - point.x, y: point.y })),
            handedness: detection.handednesses?.[index]?.[0]?.categoryName || "",
          }));

          const nextFrame = buildFrameBox(hands);
          setFrame(nextFrame);
          drawOverlay(overlay, video, lockedFrame || nextFrame, !!lockedFrame);
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
  }, [lockedFrame]);

  const frameMetrics = useMemo(() => {
    if (!activeFrame || !videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      return null;
    }

    return {
      width: Math.round(activeFrame.width * videoRef.current.videoWidth),
      height: Math.round(activeFrame.height * videoRef.current.videoHeight),
    };
  }, [activeFrame]);

  async function handleGenerate() {
    const video = videoRef.current;
    if (!video || !lockedFrame) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = captureFrameData(video, lockedFrame);
      const response = await editGestureFrame({
        prompt: prompt.trim(),
        ...payload,
      });

      setResultImageUrl(response.imageUrl);
      setProviderInfo({
        provider: response.provider,
        model: response.model,
      });
    } catch (generationError) {
      console.error(generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Không thể tạo ảnh từ vùng đã chọn."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]} permission="gesture_studio.access">
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[32px] bg-[linear-gradient(135deg,#111827_0%,#134e4a_50%,#f59e0b_100%)] p-6 text-white shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-semibold">
                  <Hand className="h-4 w-4" />
                  MediaPipe hand landmarks + AI image edit
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  Gesture Studio cho khung 4 ngón tay
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-100/90">
                  Người dùng dựng hai bàn tay thành khung chữ L, hệ thống lấy 4 đầu ngón làm vùng chọn,
                  khóa khung và gửi ảnh cùng mask sang model chỉnh sửa ảnh theo prompt.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-200">Camera</div>
                  <div className="mt-2 text-sm font-semibold">{cameraReady ? "Sẵn sàng" : "Chưa sẵn sàng"}</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-200">Hand tracking</div>
                  <div className="mt-2 text-sm font-semibold">
                    {loadingModel ? "Đang nạp model" : frame ? "Đã thấy khung tay" : "Đợi gesture"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-200">Khung hiện tại</div>
                  <div className="mt-2 text-sm font-semibold">
                    {frameMetrics ? `${frameMetrics.width} x ${frameMetrics.height}` : "Chưa có"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
            <Card className="overflow-hidden rounded-[28px] border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-slate-900">Camera và vùng chọn</CardTitle>
                  <p className="mt-2 text-sm text-slate-500">
                    Giơ hai bàn tay thành khung chữ L. Khi khung ổn, bấm khóa để tạo ảnh.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setLockedFrame(frame)}
                    disabled={!frame || busy}
                  >
                    <ScanSearch className="mr-2 h-4 w-4" />
                    Khóa khung
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setLockedFrame(null)}
                    disabled={!lockedFrame || busy}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Mở khóa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-hidden rounded-[24px] bg-slate-950">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full scale-x-[-1] object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                  <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[28px] border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900">Prompt và tạo ảnh</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    label="Prompt chỉnh ảnh"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ví dụ: Biến phần trong khung thành tranh màu nước..."
                  />

                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    Vùng cần sửa là phần trong khung 4 ngón tay. Bên ngoài khung được giữ nguyên nhờ mask.
                  </div>

                  <Button className="w-full rounded-2xl" onClick={() => void handleGenerate()} disabled={!canGenerate}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    {busy ? "Đang tạo ảnh..." : "Tạo ảnh trong khung"}
                  </Button>

                  {providerInfo ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Provider: <strong>{providerInfo.provider}</strong>
                      <br />
                      Model: <strong>{providerInfo.model}</strong>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900">Ảnh kết quả</CardTitle>
                </CardHeader>
                <CardContent>
                  {resultImageUrl ? (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                        <img src={resultImageUrl} alt="Gesture studio result" className="w-full object-cover" />
                      </div>
                      <a
                        href={resultImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        <Sparkles className="h-4 w-4" />
                        Mở ảnh kết quả
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      Ảnh sau khi edit sẽ xuất hiện ở đây.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </RoleGuard>
  );
}
