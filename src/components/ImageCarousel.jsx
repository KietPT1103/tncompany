import React, { useEffect, useState } from "react";
import ClickableImage from "./ClickableImage";

export default function ImageCarousel({ slides, onOpenImage }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages({});
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4800);

    return () => window.clearInterval(timer);
  }, [slides]);

  const moveTo = (nextIndex) => {
    if (!slides.length) {
      return;
    }

    const normalized = (nextIndex + slides.length) % slides.length;
    setActiveIndex(normalized);
  };

  const onImageError = (index) => {
    setFailedImages((previous) => {
      if (previous[index]) {
        return previous;
      }

      return { ...previous, [index]: true };
    });
  };

  return (
    <div className="carousel-card">
      <div className="carousel-window">
        <div className="carousel-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {slides.map((slide, index) => (
            <article className="carousel-slide" key={slide.image}>
              <ClickableImage
                alt={slide.alt}
                ariaLabel={`Phóng to ảnh: ${slide.title}`}
                blurBackdrop
                caption={slide.title}
                className={`slide-media ${slide.tone}`}
                loading="lazy"
                onError={() => onImageError(index)}
                onOpenImage={onOpenImage}
                showImage={!failedImages[index]}
                src={slide.image}
              />
            </article>
          ))}
        </div>
      </div>

      <div className="carousel-controls">
        <button type="button" className="arrow-btn" onClick={() => moveTo(activeIndex - 1)} aria-label="Ảnh trước">
          ←
        </button>

        <div className="dot-list" role="tablist" aria-label="Chọn ảnh">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              type="button"
              role="tab"
              aria-label={`Xem ảnh ${index + 1}`}
              aria-selected={index === activeIndex}
              className={`dot ${index === activeIndex ? "is-active" : ""}`}
              onClick={() => moveTo(index)}
            />
          ))}
        </div>

        <button type="button" className="arrow-btn" onClick={() => moveTo(activeIndex + 1)} aria-label="Ảnh tiếp theo">
          →
        </button>
      </div>
    </div>
  );
}
