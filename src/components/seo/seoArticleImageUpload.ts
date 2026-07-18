export const SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES = 1_500_000;

const SEO_ARTICLE_OPTIMIZED_TARGET_BYTES = 1_200_000;
const SEO_ARTICLE_IMAGE_MAX_SIDE = 2400;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type SeoArticleImageMetadata = Pick<File, "size" | "type">;

type LoadedImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

export function getSeoArticleImageValidationError(
  file: SeoArticleImageMetadata,
): string | null {
  if (file.size <= 0) {
    return "File ảnh không có dữ liệu.";
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return "Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.";
  }

  if (
    file.type.toLowerCase() === "image/gif" &&
    file.size > SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES
  ) {
    return "Ảnh GIF quá lớn. Vui lòng chọn file GIF nhỏ hơn 1,5 MB.";
  }

  return null;
}

export function shouldOptimizeSeoArticleImage(
  file: SeoArticleImageMetadata,
): boolean {
  return (
    getSeoArticleImageValidationError(file) === null &&
    file.type.toLowerCase() !== "image/gif" &&
    file.size > SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES
  );
}

async function loadImageSource(file: File): Promise<LoadedImageSource> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") {
    throw new Error("Trình duyệt không hỗ trợ tối ưu ảnh trước khi tải lên.");
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Không thể đọc file ảnh."));
      });
    }
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Không thể đọc file ảnh đã chọn.");
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Không thể tạo file ảnh tối ưu."));
      },
      "image/webp",
      quality,
    );
  });
}

function buildOptimizedFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "seo-image";
  return `${baseName}.webp`;
}

async function optimizeSeoArticleImage(file: File): Promise<File> {
  if (typeof document === "undefined") {
    throw new Error("Không thể tối ưu ảnh ngoài trình duyệt.");
  }

  const loaded = await loadImageSource(file);

  try {
    if (loaded.width <= 0 || loaded.height <= 0) {
      throw new Error("Kích thước ảnh không hợp lệ.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    }

    const initialScale = Math.min(
      1,
      SEO_ARTICLE_IMAGE_MAX_SIDE / Math.max(loaded.width, loaded.height),
    );
    const qualitySteps = [0.84, 0.74, 0.64];
    let smallestBlob: Blob | null = null;

    for (let scalePass = 0; scalePass < 3; scalePass += 1) {
      const scale = initialScale * Math.pow(0.82, scalePass);
      canvas.width = Math.max(1, Math.round(loaded.width * scale));
      canvas.height = Math.max(1, Math.round(loaded.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(loaded.source, 0, 0, canvas.width, canvas.height);

      for (const quality of qualitySteps) {
        const blob = await canvasToBlob(canvas, quality);
        if (!smallestBlob || blob.size < smallestBlob.size) {
          smallestBlob = blob;
        }

        if (blob.size <= SEO_ARTICLE_OPTIMIZED_TARGET_BYTES) {
          return new File([blob], buildOptimizedFileName(file.name), {
            type: "image/webp",
            lastModified: file.lastModified,
          });
        }
      }
    }

    if (
      smallestBlob &&
      smallestBlob.size <= SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES
    ) {
      return new File([smallestBlob], buildOptimizedFileName(file.name), {
        type: "image/webp",
        lastModified: file.lastModified,
      });
    }

    throw new Error(
      "Ảnh vẫn quá lớn sau khi tối ưu. Vui lòng chọn ảnh có kích thước nhỏ hơn.",
    );
  } finally {
    loaded.cleanup();
  }
}

export async function prepareSeoArticleImageForUpload(
  file: File,
): Promise<File> {
  const validationError = getSeoArticleImageValidationError(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!shouldOptimizeSeoArticleImage(file)) {
    return file;
  }

  return optimizeSeoArticleImage(file);
}
