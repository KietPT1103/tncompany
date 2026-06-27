import base64
import io
import os
from dataclasses import dataclass
from typing import Optional

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, ImageFilter

try:
    from diffusers import Flux2KleinPipeline
except ImportError:  # pragma: no cover - fallback for older snippets
    from diffusers import DiffusionPipeline as Flux2KleinPipeline


DEFAULT_MODEL_ID = os.getenv("FLUX_LOCAL_MODEL_ID", "black-forest-labs/FLUX.2-klein-4B")
DEFAULT_OUTPUT_SIZE = os.getenv("FLUX_LOCAL_OUTPUT_SIZE", "1024x1024")
SERVICE_TOKEN = os.getenv("FLUX_LOCAL_TOKEN", "")
DEVICE = os.getenv("FLUX_LOCAL_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
DTYPE_NAME = os.getenv("FLUX_LOCAL_DTYPE", "bfloat16" if DEVICE == "cuda" else "float32")
USE_CPU_OFFLOAD = os.getenv("FLUX_LOCAL_CPU_OFFLOAD", "1").lower() not in {"0", "false", "no"}
GUIDANCE_SCALE = float(os.getenv("FLUX_LOCAL_GUIDANCE_SCALE", "1.0"))
INFERENCE_STEPS = int(os.getenv("FLUX_LOCAL_INFERENCE_STEPS", "4"))
CROP_PADDING_RATIO = float(os.getenv("FLUX_LOCAL_CROP_PADDING_RATIO", "0.18"))
HOST = os.getenv("FLUX_LOCAL_HOST", "127.0.0.1")
PORT = int(os.getenv("FLUX_LOCAL_PORT", "8754"))

DTYPE = getattr(torch, DTYPE_NAME, torch.bfloat16 if DEVICE == "cuda" else torch.float32)
app = FastAPI(title="FLUX Local Edit Service", version="1.0.0")


class EditBox(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class EditRequest(BaseModel):
    prompt: str
    image_data_url: str
    mask_data_url: str
    box: EditBox
    landmarks: list[dict[str, int]] = Field(default_factory=list)
    model_id: str = DEFAULT_MODEL_ID
    output_size: str = DEFAULT_OUTPUT_SIZE


@dataclass
class LoadedPipeline:
    model_id: str
    pipe: object


_PIPELINE: Optional[LoadedPipeline] = None


def require_token(authorization: Optional[str]) -> None:
    if not SERVICE_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing local FLUX token.")
    if authorization.removeprefix("Bearer ").strip() != SERVICE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid local FLUX token.")


def parse_data_url(value: str) -> Image.Image:
    prefix = "base64,"
    marker = value.find(prefix)
    if marker < 0:
        raise HTTPException(status_code=422, detail="Invalid data URL.")
    try:
        binary = base64.b64decode(value[marker + len(prefix) :], validate=True)
    except Exception as exc:  # pragma: no cover - validation path
        raise HTTPException(status_code=422, detail=f"Invalid base64 image payload: {exc}") from exc
    return Image.open(io.BytesIO(binary)).convert("RGBA")


def encode_png_base64(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def parse_output_size(value: str) -> tuple[int, int]:
    parts = value.lower().split("x", 1)
    if len(parts) != 2:
        return (1024, 1024)
    try:
        width = max(256, min(2048, int(parts[0])))
        height = max(256, min(2048, int(parts[1])))
    except ValueError:
        return (1024, 1024)
    return (width, height)


def compute_crop_box(image_size: tuple[int, int], box: EditBox) -> tuple[int, int, int, int]:
    width, height = image_size
    pad_x = int(box.width * CROP_PADDING_RATIO)
    pad_y = int(box.height * CROP_PADDING_RATIO)
    left = max(0, box.x - pad_x)
    top = max(0, box.y - pad_y)
    right = min(width, box.x + box.width + pad_x)
    bottom = min(height, box.y + box.height + pad_y)
    return (left, top, right, bottom)


def get_pipeline(model_id: str):
    global _PIPELINE

    if _PIPELINE and _PIPELINE.model_id == model_id:
        return _PIPELINE.pipe

    pipe = Flux2KleinPipeline.from_pretrained(model_id, torch_dtype=DTYPE)
    if DEVICE == "cuda":
        if USE_CPU_OFFLOAD and hasattr(pipe, "enable_model_cpu_offload"):
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(DEVICE)
    else:
        pipe.to(DEVICE)

    _PIPELINE = LoadedPipeline(model_id=model_id, pipe=pipe)
    return pipe


def prepare_mask(mask: Image.Image, crop_box: tuple[int, int, int, int], output_size: tuple[int, int]) -> Image.Image:
    crop_mask = mask.crop(crop_box).convert("L").resize(output_size, Image.Resampling.LANCZOS)
    # Original frontend sends white outside / transparent inside. We need active region as white.
    active_mask = Image.eval(crop_mask, lambda value: 255 - value)
    return active_mask.filter(ImageFilter.GaussianBlur(radius=10))


def composite_images(
    original: Image.Image,
    edited_crop: Image.Image,
    mask: Image.Image,
    crop_box: tuple[int, int, int, int],
) -> Image.Image:
    left, top, right, bottom = crop_box
    destination_size = (right - left, bottom - top)
    resized_edit = edited_crop.convert("RGBA").resize(destination_size, Image.Resampling.LANCZOS)
    resized_mask = mask.resize(destination_size, Image.Resampling.LANCZOS)
    canvas = original.copy()
    canvas.paste(resized_edit, (left, top), resized_mask)
    return canvas


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": DEVICE,
        "dtype": DTYPE_NAME,
        "model_id": _PIPELINE.model_id if _PIPELINE else DEFAULT_MODEL_ID,
    }


@app.post("/edit")
def edit_image(request: EditRequest, authorization: Optional[str] = Header(default=None)):
    require_token(authorization)

    if not request.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt is required.")

    source_image = parse_data_url(request.image_data_url)
    mask_image = parse_data_url(request.mask_data_url)
    if source_image.size != mask_image.size:
        raise HTTPException(status_code=422, detail="Image and mask sizes do not match.")

    crop_box = compute_crop_box(source_image.size, request.box)
    source_crop = source_image.crop(crop_box).convert("RGB")
    output_size = parse_output_size(request.output_size)
    reference_image = source_crop.resize(output_size, Image.Resampling.LANCZOS)
    active_mask = prepare_mask(mask_image, crop_box, output_size)

    pipe = get_pipeline(request.model_id)
    generator = torch.Generator(device=DEVICE).manual_seed(torch.seed())
    with torch.inference_mode():
        result = pipe(
            prompt=request.prompt.strip(),
            image=reference_image,
            height=output_size[1],
            width=output_size[0],
            guidance_scale=GUIDANCE_SCALE,
            num_inference_steps=INFERENCE_STEPS,
            generator=generator,
        ).images[0]

    final_image = composite_images(source_image, result, active_mask, crop_box)
    return {
        "ok": True,
        "model": request.model_id,
        "provider": "local_flux",
        "image_base64": encode_png_base64(final_image),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=HOST, port=PORT, reload=False)
