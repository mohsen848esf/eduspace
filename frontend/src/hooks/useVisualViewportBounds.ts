import { useEffect, useState } from "react";

export interface VisualViewportBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

function readVisualViewportBounds(): VisualViewportBounds {
  if (typeof window === "undefined") {
    return { height: 0, left: 0, top: 0, width: 0 };
  }
  const viewport = window.visualViewport;
  return {
    height: viewport?.height ?? window.innerHeight,
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
  };
}

export function useVisualViewportBounds(): VisualViewportBounds {
  const [bounds, setBounds] = useState(readVisualViewportBounds);

  useEffect(() => {
    const update = () => {
      const next = readVisualViewportBounds();
      setBounds((current) =>
        current.height === next.height &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width
          ? current
          : next,
      );
    };
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return bounds;
}
