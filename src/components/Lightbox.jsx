import React from "react";

export default function Lightbox({ image, onClose }) {
  if (!image) {
    return null;
  }

  return (
    <div className="lightbox-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lightbox-close" aria-label="Đóng ảnh" onClick={onClose}>
          ×
        </button>
        <img src={image.src} alt={image.alt} />
        {image.caption ? <p>{image.caption}</p> : null}
      </div>
    </div>
  );
}
