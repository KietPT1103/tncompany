"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealDirection = "up" | "down" | "left" | "right" | "fade";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

const getHiddenTransform = (
  direction: RevealDirection,
  distance: number,
) => {
  switch (direction) {
    case "up":
      return `translate3d(0, ${distance}px, 0)`;

    case "down":
      return `translate3d(0, -${distance}px, 0)`;

    case "left":
      return `translate3d(${distance}px, 0, 0)`;

    case "right":
      return `translate3d(-${distance}px, 0, 0)`;

    case "fade":
    default:
      return "translate3d(0, 0, 0)";
  }
};

export default function RevealOnScroll({
  children,
  className = "",
  direction = "up",
  delay = 0,
  duration = 700,
  distance = 48,
  threshold = 0.18,
  rootMargin = "0px 0px -60px 0px",
  once = true,
}: RevealOnScrollProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(entry.target);
          }

          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [once, prefersReducedMotion, rootMargin, threshold]);

  const style: CSSProperties = prefersReducedMotion
    ? {}
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "translate3d(0, 0, 0)"
          : getHiddenTransform(direction, distance),
        transitionProperty: "opacity, transform",
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: isVisible ? "auto" : "opacity, transform",
      };

  return (
    <div
      ref={elementRef}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}