import React, { useRef, useEffect } from "react";
import Hls from "hls.js";

const CameraFeedCard = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && src) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        return () => hls.destroy();
      } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = src;
      }
    }
  }, [src]);

  return (
    <div>
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        width={600}
        style={{
          background: "#000",
          borderRadius: 12,
          border: "1px solid #ccc"
        }}
      />
    </div>
  );
};


export default CameraFeedCard;
