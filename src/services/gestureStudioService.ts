import { apiRequest } from "@/lib/api";

export type GestureStudioEditRequest = {
  prompt: string;
  imageDataUrl: string;
  maskDataUrl: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: Array<{
    x: number;
    y: number;
  }>;
};

export type GestureStudioEditResponse = {
  provider: string;
  model: string;
  imageUrl: string;
  revisedPrompt?: string | null;
};

export async function editGestureFrame(request: GestureStudioEditRequest) {
  return apiRequest<GestureStudioEditResponse>("/gesture-frame-edit.php", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
