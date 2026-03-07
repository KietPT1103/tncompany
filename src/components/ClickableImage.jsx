import React from "react";
import { activateWithKeyboard } from "../utils/navigation";

export default function ClickableImage({
  alt,
  ariaLabel,
  blurBackdrop = false,
  caption,
  className,
  imageClassName,
  loading = "lazy",
  onError,
  onOpenImage,
  showImage = true,
  src,
}) {
  const openImage = () => onOpenImage({ src, alt, caption });

  return (
    <div
      className={`${className} media-clickable`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={openImage}
      onKeyDown={(event) => activateWithKeyboard(event, openImage)}
    >
      {showImage && blurBackdrop ? (
        <div
          className="media-blur-backdrop"
          aria-hidden="true"
          style={{ backgroundImage: `url("${src}")` }}
        />
      ) : null}
      {showImage ? (
        <div className="media-image-frame">
          <img className={imageClassName} src={src} alt={alt} loading={loading} onError={onError} />
        </div>
      ) : null}
    </div>
  );
}
