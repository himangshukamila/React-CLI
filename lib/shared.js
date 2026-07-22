import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import { execa } from 'execa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const rootDir = path.resolve(__dirname, '..')

export const aliasMap = {
  tailwind: 'tailwindcss',
  axios: 'axios',
  socket: 'socket.io-client',
  toast: 'react-hot-toast',
  icon: 'react-icons',
  lucide: 'lucide-react',
  router: 'react-router-dom',
  qr: 'react-qr-code',
  webcam: 'react-webcam',
  printer: 'react-to-print',
}

export const reverseAliasMap = {
  tailwindcss: 'tailwind',
  axios: 'axios',
  'socket.io-client': 'socket',
  'react-hot-toast': 'toast',
  'react-icons': 'icon',
  'lucide-react': 'lucide',
  'react-router-dom': 'router',
  'react-qr-code': 'qr',
  'react-webcam': 'webcam',
  'react-to-print': 'printer',
}

export const viteConfigContent = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
`

export const socketContent = `import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export const socket = io(URL, {
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("reconnect", (attempt) => {
  console.log(\`Reconnected after \${attempt} attempts\`);
});

socket.on("reconnect_attempt", (attempt) => {
  console.log(\`Reconnect attempt \${attempt}\`);
});
`


export const cameraContent = `import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

// ── Error Messages ──────────────────────────────────────────────
const getCameraErrorMessage = (error) => {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera permission is blocked. Allow camera access in browser settings.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera found. Connect an external camera and reload.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Camera is in use by another app. Close it and retry.";
  if (name === "SecurityError")
    return "Camera requires localhost or HTTPS.";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError")
    return "Camera does not support the requested video mode.";
  return "Camera failed to start. Check connection and permissions.";
};

// ── Device Helpers ──────────────────────────────────────────────
const getVideoDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
};

const stopStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

// ── Camera Angle Settings ───────────────────────────────────────
const cameraAngleFrameSettings = {
  horizontal: {
    videoClassName: "fixed inset-0 h-full w-full object-cover",
    videoStyle: {
      height: "100vh",
      width: "100vw",
      objectFit: "cover",
      transform: "scaleX(-1)",
      transformOrigin: "center",
    },
  },
  vertical: {
    videoClassName: "fixed left-1/2 top-1/2 max-w-none object-cover",
    videoStyle: {
      height: "100vw",
      width: "100vh",
      objectFit: "cover",
      transform: "translate(-50%, -50%) rotate(-90deg) scaleX(-1)",
      transformOrigin: "center",
    },
  },
};

const getCameraFrameSetting = (angle) =>
  cameraAngleFrameSettings[angle] || cameraAngleFrameSettings.horizontal;

const ANGLE_KEY = "cameraAngle";
const getStoredAngle = () => {
  const stored = localStorage.getItem(ANGLE_KEY);
  return cameraAngleFrameSettings[stored] ? stored : "horizontal";
};

// ── Image Processing ────────────────────────────────────────────
const loadImage = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

const drawCoverFrame = (source, srcW, srcH, targetRatio, mirror) => {
  const srcRatio = srcW / srcH;
  let cropW = srcW, cropH = srcH;
  if (srcRatio > targetRatio) cropW = srcH * targetRatio;
  else cropH = srcW / targetRatio;

  const cropX = Math.max(0, (srcW - cropW) / 2);
  const cropY = Math.max(0, (srcH - cropH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropW);
  canvas.height = Math.round(cropH);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  if (mirror) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 1);
};

const rotateCounterClockwise = (image) => {
  const canvas = document.createElement("canvas");
  canvas.width = image.height;
  canvas.height = image.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(0, canvas.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(image, 0, 0, image.width, image.height);
  return canvas;
};

const processScreenshot = async (rawDataUrl, angle) => {
  if (!rawDataUrl) return "";
  const image = await loadImage(rawDataUrl);
  const targetRatio = window.innerWidth / window.innerHeight;

  if (angle === "vertical") {
    const mirrorCanvas = document.createElement("canvas");
    mirrorCanvas.width = image.width;
    mirrorCanvas.height = image.height;
    const mCtx = mirrorCanvas.getContext("2d");
    if (!mCtx) return "";
    mCtx.translate(mirrorCanvas.width, 0);
    mCtx.scale(-1, 1);
    mCtx.drawImage(image, 0, 0);
    const rotated = rotateCounterClockwise(mirrorCanvas);
    if (!rotated) return "";
    return drawCoverFrame(rotated, rotated.width, rotated.height, targetRatio, false);
  }

  return drawCoverFrame(image, image.width, image.height, targetRatio, true);
};

// ── Camera Component ────────────────────────────────────────────
const Camera = () => {
  const webcamRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasCheckedDevices, setHasCheckedDevices] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [cameraAngle, setCameraAngle] = useState(getStoredAngle);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState("");
  const [flowStep, setFlowStep] = useState("camera"); // "camera" | "preview"

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stopStream(webcamStreamRef.current);
      webcamStreamRef.current = null;
    };
  }, []);

  // Prepare camera devices
  useEffect(() => {
    let mounted = true;
    const prepare = async () => {
      setIsCameraReady(false);
      setHasCheckedDevices(false);
      setSelectedDeviceId("");
      setErrorMessage("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage("Camera is not available in this browser.");
        setHasCheckedDevices(true);
        return;
      }
      if (!navigator.mediaDevices?.enumerateDevices) {
        setHasCheckedDevices(true);
        return;
      }

      try {
        let devices = await getVideoDevices();
        if (!mounted) return;
        if (!devices.length) {
          setErrorMessage("No camera found. Connect a camera and reload.");
          setHasCheckedDevices(true);
          return;
        }
        if (!devices.some((d) => d.deviceId)) {
          try {
            const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            stopStream(probe);
            devices = await getVideoDevices();
            if (!mounted) return;
          } catch {
            setHasCheckedDevices(true);
            return;
          }
        }
        const selected = devices.find((d) => d.deviceId);
        if (selected) setSelectedDeviceId(selected.deviceId);
        setHasCheckedDevices(true);
      } catch (err) {
        setErrorMessage(getCameraErrorMessage(err));
        setHasCheckedDevices(true);
      }
    };
    prepare();
    return () => { mounted = false; };
  }, [checkAttempt]);

  // Countdown and capture
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const webcam = webcamRef.current;
      if (!webcam) { setCountdown(null); setErrorMessage("Unable to capture."); return; }
      const raw = webcam.getScreenshot();
      if (!raw) { setCountdown(null); setErrorMessage("Unable to capture."); return; }

      processScreenshot(raw, cameraAngle)
        .then((processed) => {
          if (!processed) { setErrorMessage("Unable to capture."); return; }
          stopStream(webcamStreamRef.current);
          webcamStreamRef.current = null;
          setCapturedImage(processed);
          setIsCameraReady(false);
          setFlowStep("preview");
        })
        .catch(() => setErrorMessage("Unable to capture."));
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cameraAngle, countdown]);

  const handleCameraReady = (stream) => {
    if (webcamStreamRef.current && webcamStreamRef.current !== stream) stopStream(webcamStreamRef.current);
    webcamStreamRef.current = stream;
    setIsCameraReady(true);
    setErrorMessage("");
  };

  const handleCameraError = (err) => {
    setIsCameraReady(false);
    setErrorMessage(getCameraErrorMessage(err));
  };

  const handleCapture = () => {
    if (!isCameraReady) { setErrorMessage("Camera still loading."); return; }
    if (countdown !== null) return;
    setCountdown(3);
  };

  const handleRetake = () => {
    setCapturedImage("");
    setCountdown(null);
    setErrorMessage("");
    setIsCameraReady(false);
    setFlowStep("camera");
    setCheckAttempt((n) => n + 1);
  };

  const handleDownload = () => {
    if (!capturedImage) return;
    const link = document.createElement("a");
    link.href = capturedImage;
    link.download = \\\`capture-\\\${Date.now()}.jpg\\\`;
    link.click();
  };

  const handleAngleSelect = (angle) => {
    setCountdown(null);
    localStorage.setItem(ANGLE_KEY, angle);
    setCameraAngle(angle);
    setIsSettingsOpen(false);
  };

  const videoConstraints = selectedDeviceId
    ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 3840 }, height: { ideal: 2160 } }
    : { width: { ideal: 3840 }, height: { ideal: 2160 } };

  const shouldRender = hasCheckedDevices && !errorMessage;
  const frameSetting = getCameraFrameSetting(cameraAngle);

  // ── Preview Screen ────────────────────────────────────────────
  if (flowStep === "preview") {
    return (
      <main style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden", background: "#000" }}>
        <img
          src={capturedImage}
          alt="Captured"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "fixed", bottom: "6vh", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "1rem", zIndex: 20 }}>
          <button
            onClick={handleRetake}
            style={{ padding: "0.8rem 2rem", borderRadius: "999px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.3)", fontSize: "1rem", cursor: "pointer", backdropFilter: "blur(8px)" }}
          >
            Retake
          </button>
          <button
            onClick={handleDownload}
            style={{ padding: "0.8rem 2rem", borderRadius: "999px", background: "#FFD500", color: "#000", border: "none", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}
          >
            Download
          </button>
        </div>
      </main>
    );
  }

  // ── Camera Screen ─────────────────────────────────────────────
  return (
    <main style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden", background: "#000" }}>
      {shouldRender && (
        <Webcam
          ref={webcamRef}
          aria-label="Camera preview"
          audio={false}
          muted
          mirrored={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          forceScreenshotSourceSize
          videoConstraints={videoConstraints}
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          className={frameSetting.videoClassName}
          style={frameSetting.videoStyle}
        />
      )}

      {!isCameraReady && !errorMessage && (
        <p style={{ position: "fixed", top: "50%", left: 0, width: "100%", textAlign: "center", transform: "translateY(-50%)", color: "#fff", fontSize: "1.5rem", fontWeight: 700, zIndex: 20 }}>
          Loading camera...
        </p>
      )}

      {errorMessage && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", zIndex: 20, maxWidth: "80vw" }}>
          <p style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem" }}>{errorMessage}</p>
          <button
            onClick={() => setCheckAttempt((n) => n + 1)}
            style={{ padding: "0.7rem 2rem", borderRadius: "999px", background: "#FFD500", color: "#000", border: "none", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}
          >
            Retry Camera
          </button>
        </div>
      )}

      {countdown !== null && countdown > 0 && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", zIndex: 20 }}>
          <p style={{ fontSize: "20vw", fontWeight: 700, color: "#fff", textShadow: "0 0.8vh 2vh rgba(0,0,0,0.75)" }}>{countdown}</p>
        </div>
      )}

      <button
        onClick={handleCapture}
        disabled={!isCameraReady || countdown !== null}
        aria-label="Capture image"
        style={{
          position: "fixed", left: "50%", bottom: "8vh", transform: "translateX(-50%)", zIndex: 20,
          width: "70px", height: "70px", borderRadius: "50%",
          border: "5px solid #e5e5e5", background: "#FFD500",
          cursor: isCameraReady && countdown === null ? "pointer" : "not-allowed",
          opacity: isCameraReady && countdown === null ? 1 : 0.6,
        }}
      />

      <button
        onClick={() => setIsSettingsOpen((o) => !o)}
        style={{ position: "fixed", bottom: "2vh", right: "3vw", zIndex: 30, background: "rgba(0,0,0,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "0.5rem 1rem", fontSize: "0.8rem", cursor: "pointer", backdropFilter: "blur(6px)" }}
      >
        ⚙ Angle
      </button>

      {isSettingsOpen && (
        <div style={{ position: "fixed", bottom: "8vh", right: "3vw", zIndex: 30, display: "flex", flexDirection: "column", gap: "0.5rem", background: "rgba(0,0,0,0.85)", padding: "0.6rem", borderRadius: "10px", backdropFilter: "blur(8px)" }}>
          {["horizontal", "vertical"].map((angle) => (
            <button
              key={angle}
              onClick={() => handleAngleSelect(angle)}
              style={{
                padding: "0.5rem 1.2rem", borderRadius: "6px", border: "2px solid #FFD500", textTransform: "uppercase", fontSize: "0.75rem", cursor: "pointer",
                background: cameraAngle === angle ? "#FFD500" : "transparent",
                color: cameraAngle === angle ? "#000" : "#fff",
              }}
            >
              {angle}
            </button>
          ))}
        </div>
      )}
    </main>
  );
};

export default Camera;
`

export const envContent = `VITE_SERVER_URL=http://localhost:3000
`

export const cliIconContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   id="Layer_1"
   version="1.1"
   viewBox="0 0 500 500"
   sodipodi:docname="favicon.svg"
   inkscape:version="1.4.2 (ebf0e940, 2025-05-08)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview22"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:zoom="0.30259227"
     inkscape:cx="-51.224046"
     inkscape:cy="-158.6293"
     inkscape:window-width="1512"
     inkscape:window-height="949"
     inkscape:window-x="0"
     inkscape:window-y="33"
     inkscape:window-maximized="0"
     inkscape:current-layer="Layer_1" />
  <!-- Generator: Adobe Illustrator 30.1.0, SVG Export Plug-In . SVG Version: 2.1.1 Build 136)  -->
  <defs
     id="defs12">
    <style
       id="style1">
      .st0 {
        mask: url(#mask);
      }

      .st1 {
        fill: url(#linear-gradient2);
      }

      .st2 {
        fill: url(#linear-gradient1);
      }

      .st3 {
        fill: #00c68f;
      }

      .st4 {
        fill: url(#linear-gradient);
      }

      .st5 {
        fill: #0a64bc;
      }

      .st6 {
        fill: #f72d37;
      }

      .st7 {
        fill: #11a876;
      }
    </style>
    <filter
       id="luminosity-noclip"
       x="58.6"
       y="-8442"
       width="378.7"
       height="32766"
       color-interpolation-filters="sRGB"
       filterUnits="userSpaceOnUse">
      <feFlood
         flood-color="#fff"
         result="bg"
         id="feFlood1" />
      <feBlend
         in="SourceGraphic"
         in2="bg"
         id="feBlend1" />
    </filter>
    <mask
       id="mask"
       x="58.6"
       y="-8442"
       width="378.7"
       height="32766"
       maskUnits="userSpaceOnUse" />
    <linearGradient
       id="linear-gradient"
       x1="110.2"
       y1="209.7"
       x2="238.9"
       y2="116"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#00ced1"
         id="stop1" />
      <stop
         offset=".3"
         stop-color="#02b1cb"
         id="stop2" />
      <stop
         offset="1"
         stop-color="#0969bd"
         id="stop3" />
      <stop
         offset="1"
         stop-color="#0a64bc"
         id="stop4" />
    </linearGradient>
    <linearGradient
       id="linear-gradient1"
       x1="140.6"
       y1="241.8"
       x2="357.1"
       y2="241.8"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#0a64bc"
         id="stop5" />
      <stop
         offset="0"
         stop-color="#0969bd"
         id="stop6" />
      <stop
         offset=".7"
         stop-color="#02b1cb"
         id="stop7" />
      <stop
         offset="1"
         stop-color="#00ced1"
         id="stop8" />
    </linearGradient>
    <linearGradient
       id="linear-gradient2"
       x1="267.8"
       y1="218.8"
       x2="277.8"
       y2="305.8"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#00ced1"
         id="stop9" />
      <stop
         offset=".3"
         stop-color="#03a9c9"
         id="stop10" />
      <stop
         offset=".8"
         stop-color="#0877bf"
         id="stop11" />
      <stop
         offset="1"
         stop-color="#0a64bc"
         id="stop12" />
    </linearGradient>
    <linearGradient
       id="linear-gradient-2"
       x1="110.2"
       y1="209.7"
       x2="238.89999"
       y2="116"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#00ced1"
         id="stop1-2" />
      <stop
         offset=".3"
         stop-color="#02b1cb"
         id="stop2-7" />
      <stop
         offset="1"
         stop-color="#0969bd"
         id="stop3-3" />
      <stop
         offset="1"
         stop-color="#0a64bc"
         id="stop4-7" />
    </linearGradient>
    <linearGradient
       id="linear-gradient1-9"
       x1="140.60001"
       y1="241.8"
       x2="357.10001"
       y2="241.8"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#0a64bc"
         id="stop5-0" />
      <stop
         offset="0"
         stop-color="#0969bd"
         id="stop6-2" />
      <stop
         offset=".7"
         stop-color="#02b1cb"
         id="stop7-3" />
      <stop
         offset="1"
         stop-color="#00ced1"
         id="stop8-9" />
    </linearGradient>
    <linearGradient
       id="linear-gradient2-9"
       x1="267.79999"
       y1="218.8"
       x2="267.79999"
       y2="305.79999"
       gradientUnits="userSpaceOnUse">
      <stop
         offset="0"
         stop-color="#00ced1"
         id="stop9-7" />
      <stop
         offset=".3"
         stop-color="#03a9c9"
         id="stop10-0" />
      <stop
         offset=".8"
         stop-color="#0877bf"
         id="stop11-3" />
      <stop
         offset="1"
         stop-color="#0a64bc"
         id="stop12-9" />
    </linearGradient>
  </defs>
  <g
     id="g23"
     transform="translate(578.336,832.80383)">
    <rect
       style="fill:#ffffff;stroke-width:0.808181"
       id="rect22"
       width="500"
       height="500"
       x="-578.336"
       y="-832.80383"
       ry="250" />
    <g
       id="g22"
       transform="matrix(1.564053,0,0,1.564053,-710.99228,-892.17352)">
      <path
         class="st4"
         d="m 140.6,214.1 c -13.9,0 -24.3,-8.9 -23.7,-20.6 0.3,-5.6 3.4,-10.2 8,-14 13.7,-11.4 109.9,-87.3 109.9,-87.3 v 48.1 l -52.2,40.1 -42.1,33.7 z"
         id="path20"
         style="fill:url(#linear-gradient-2)" />
      <path
         class="st2"
         d="m 286.4,271.1 c 0,0 8,0.1 12.6,-1.3 8.4,-2.6 15.9,-6.6 19,-16.9 0.3,-1 0.6,-2 0.7,-3 1.9,-10.2 -0.7,-23.4 -9.9,-29.4 -8.3,-5.4 -18.7,-6.2 -28.3,-6.4 -11.1,-0.3 -22.3,-0.3 -33.4,-0.4 -21.9,-0.1 -43.8,0 -65.6,0.2 -13.7,0 -27.3,0.2 -41,0.2 l 42.1,-33.7 c 0,0 61.7,-0.3 90.7,0 75.3,0.5 102.8,62.6 70.4,99 -8.1,9.1 -20.8,16.7 -38.7,21.4 -6.9,1.8 -14,2.6 -21.2,2.6 -11.8,-0.1 -34.8,0 -34.8,0 l 37.4,-32.1 z"
         id="path21"
         style="fill:url(#linear-gradient1-9)" />
      <polygon
         class="st1"
         points="286.4,271.1 249,303.2 249,227.9 286.6,227.9 "
         id="polygon21"
         style="fill:url(#linear-gradient2-9)" />
      <polygon
         class="st6"
         points="234.9,227.9 234.9,303.3 192.8,271.3 192.9,227.9"
         id="polygon22"
         style="fill:#f72d37" />
      <path
         class="st3"
         d="m 249.1,92.3 c 0,0 26.6,-0.1 17.4,0 23.1,0.3 46.2,13 56.1,34.3 7.7,16.5 4.8,33.8 -2.6,49.8 0,0.1 -2.2,5.9 -2.3,5.8 0,0 -28.7,-11.3 -28.7,-11.3 0.4,0.2 2.9,-3.5 3.1,-3.8 9.6,-13.7 7.2,-34.1 -7.8,-42.9 -5.3,-3.1 -11.2,-5 -17.2,-6.4 0,0 -0.7,-0.1 -0.7,-0.2"
         id="path22"
         style="fill:#00c68f" />
      <polyline
         class="st8"
         points="286.4 117.6 286.5 166.1 249 166.1 249.1 92.3"
         id="polyline22"
         style="fill:#11a876" />
    </g>
  </g>
</svg>
`


const toastContainerImport = "import { Toaster, toast } from 'react-hot-toast'"
const toastContainerImportRegex = /import\s*{\s*(?:Toaster|toast|Toaster\s*,\s*toast|toast\s*,\s*Toaster)\s*}\s*from\s*['"]react-hot-toast['"]/

export const runCommand = async (command, args, options = {}, message = 'Command failed') => {
  try {
    return await execa(command, args, options)
  } catch (error) {
    throw new Error(`${message}: ${error.shortMessage || error.message}`)
  }
}

let cachedPM = null
export const detectPackageManager = async () => {
  if (cachedPM) return cachedPM
  try { await execa('bun', ['--version']); cachedPM = 'bun'; return 'bun' } catch {}
  try { await execa('pnpm', ['--version']); cachedPM = 'pnpm'; return 'pnpm' } catch {}
  try { await execa('yarn', ['--version']); cachedPM = 'yarn'; return 'yarn' } catch {}
  cachedPM = 'npm'
  return 'npm'
}

export const ensureViteScriptsInPackageJson = async (projectPath) => {
  await ensureDir(projectPath)
  const pkgPath = path.join(projectPath, 'package.json')
  let pkg = {}
  if (await pathExists(pkgPath)) {
    try {
      pkg = JSON.parse(await readFile(pkgPath))
    } catch {}
  }
  pkg.name = pkg.name || path.basename(projectPath)
  pkg.private = pkg.private ?? true
  pkg.type = pkg.type || 'module'
  pkg.scripts = pkg.scripts || {}
  pkg.scripts.dev = pkg.scripts.dev || 'vite'
  pkg.scripts.build = pkg.scripts.build || 'vite build'
  pkg.scripts.lint = pkg.scripts.lint || 'eslint .'
  pkg.scripts.preview = pkg.scripts.preview || 'vite preview'
  pkg.dependencies = pkg.dependencies || {}
  if (!pkg.dependencies.react) pkg.dependencies.react = '^18.3.1'
  if (!pkg.dependencies['react-dom']) pkg.dependencies['react-dom'] = '^18.3.1'

  pkg.devDependencies = pkg.devDependencies || {}
  if (!pkg.devDependencies.vite) pkg.devDependencies.vite = '^5.4.1'
  if (!pkg.devDependencies['@vitejs/plugin-react']) pkg.devDependencies['@vitejs/plugin-react'] = '^4.3.1'

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

export const createViteApp = async (projectPath) => {
  const pm = await detectPackageManager()
  let args
  if (pm === 'bun' || pm === 'pnpm' || pm === 'yarn') {
    args = ['create', 'vite', projectPath, '--template', 'react']
  } else {
    args = ['exec', '-y', 'create-vite@latest', projectPath, '--', '--template', 'react']
  }
  await runCommand(pm, args, {}, 'Failed to create Vite project')
  await ensureViteScriptsInPackageJson(projectPath)
}

export const runPackageInstall = async (packages, options = {}, message = 'Failed to install packages') => {
  const pm = await detectPackageManager()
  let args = ['install', ...packages]
  if (pm === 'bun' || pm === 'yarn' || pm === 'pnpm') {
    args = ['add', ...packages]
  } else {
    args = ['install', '--prefer-offline', ...packages]
  }
  return runCommand(pm, args, options, message)
}

export const pathExists = async (targetPath) => {
  try {
    await fsPromises.access(targetPath)
    return true
  } catch {
    return false
  }
}

export const ensureDir = async (targetPath) => {
  try {
    await fsPromises.mkdir(targetPath, { recursive: true })
  } catch (error) {
    throw new Error(`Could not create directory: ${targetPath}. ${error.message}`)
  }
}

export const readDir = async (targetPath) => {
  try {
    return await fsPromises.readdir(targetPath)
  } catch (error) {
    throw new Error(`Could not read directory: ${targetPath}. ${error.message}`)
  }
}

export const removePath = async (targetPath) => {
  try {
    await fsPromises.rm(targetPath, { recursive: true, force: true })
  } catch (error) {
    throw new Error(`Could not remove path: ${targetPath}. ${error.message}`)
  }
}

export const readFile = async (targetPath) => {
  try {
    return await fsPromises.readFile(targetPath, 'utf8')
  } catch (error) {
    throw new Error(`Could not read file: ${targetPath}. ${error.message}`)
  }
}

export const writeFile = async (targetPath, content) => {
  try {
    await fsPromises.writeFile(targetPath, content, 'utf8')
  } catch (error) {
    throw new Error(`Could not write file: ${targetPath}. ${error.message}`)
  }
}

export const copyFile = async (sourcePath, targetPath) => {
  try {
    await fsPromises.cp(sourcePath, targetPath, { recursive: true })
  } catch (error) {
    throw new Error(`Could not copy ${sourcePath} to ${targetPath}. ${error.message}`)
  }
}

export const readTemplate = async (...segments) => {
  return readFile(path.join(rootDir, 'templates', ...segments))
}

export const ensureImportLine = async (filePath, importLine) => {
  const content = await readFile(filePath)
  if (content.includes(importLine)) return
  await writeFile(filePath, `${importLine}\n${content}`)
}

export const applyToastToApp = async (projectPath) => {
  const appPath = path.join(projectPath, 'src', 'App.jsx')
  let content = await readFile(appPath)

  if (!toastContainerImportRegex.test(content)) {
    content = `${toastContainerImport}\n${content}`
  }

  if (content.includes('<Toaster position="top-right" />') || content.includes('<Toaster />')) {
    await writeFile(appPath, content)
    return
  }

  const sentinel = '      {/* react-cli:toast */}'
  if (content.includes(sentinel)) {
    await writeFile(appPath, content.replace(sentinel, '      <Toaster position="top-right" />'))
    return
  }

  const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*(?:;)?\s*\n\s*}/)
  if (returnMatch) {
    const returnedJsx = returnMatch[1]
    const replacement = `return (
    <>
${returnedJsx}
      <Toaster position="top-right" />
    </>
  )
}`
    await writeFile(appPath, content.replace(returnMatch[0], replacement))
    return
  }

  throw new Error('Could not safely update App.jsx for react-hot-toast')
}

export const installTailwind = async (projectPath) => {
  await runPackageInstall(
    ['tailwindcss', '@tailwindcss/vite'],
    { cwd: projectPath },
    'Failed to install Tailwind CSS',
  )
}

export const configureTailwind = async (projectPath) => {
  const tailwindCssContent = await readTemplate('tailwind', 'src', 'index.css')
  await Promise.all([
    writeFile(path.join(projectPath, 'vite.config.js'), viteConfigContent),
    writeFile(path.join(projectPath, 'src', 'index.css'), tailwindCssContent),
    ensureImportLine(path.join(projectPath, 'src', 'main.jsx'), "import './index.css'"),
  ])
}

export const configureSocket = async (projectPath) => {
  await ensureDir(path.join(projectPath, 'src', 'services'))
  await writeFile(path.join(projectPath, 'src', 'services', 'socket.js'), socketContent)
}

export const printerContent = `import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../services/socket.js";
import { useReactToPrint } from "react-to-print";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const Printer = () => {
  const [currentImage, setCurrentImage] = useState(null);
  const queueRef = useRef([]);
  const isPrintingRef = useRef(false);
  const printRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  const processNext = useCallback(() => {
    if (isPrintingRef.current || queueRef.current.length === 0) return;

    isPrintingRef.current = true;
    const nextImage = queueRef.current.shift();
    console.log(
      \`Queuing preview: \${nextImage} | remaining: \${queueRef.current.length}\`,
    );

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    setCurrentImage(null);
    previewTimeoutRef.current = setTimeout(() => {
      console.log(\`Preview ready: \${nextImage}\`);
      setCurrentImage(nextImage);
      previewTimeoutRef.current = null;
    }, 50);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef,

    onAfterPrint: () => {
      console.log("Print complete");
      isPrintingRef.current = false;

      processNext();
    },
  });

  const handleImageLoaded = useCallback(() => {
    if (printRef.current) {
      handlePrint();
    }
  }, [handlePrint]);

  const handleImageError = useCallback(() => {
    console.error("Failed to load print image:", currentImage);
    isPrintingRef.current = false;
    setCurrentImage(null);
    processNext();
  }, [currentImage, processNext]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleServerImage = (data) => {
      console.log("Raw socket data:", data);
      const imagePath = data?.generatedImageName;

      if (!imagePath) {
        console.error("Invalid payload:", data);
        return;
      }
      const fullUrl = \`\${SERVER_URL}/\${imagePath}\`;
      console.log(
        \`Image queued: \${fullUrl} | queue size: \${queueRef.current.length + 1}\`,
      );

      queueRef.current.push(fullUrl);
      processNext();
    };

    socket.on("print-image", handleServerImage);
    return () => socket.off("print-image", handleServerImage);
  }, [processNext]);

  return (
    <div className="h-screen bg-black flex justify-center items-center">
      {currentImage && (
        <div className="flex">
          <img
            onClick={() => handlePrint()}
            src={currentImage}
            alt="preview-1"
            onLoad={handleImageLoaded}
            onError={handleImageError}
            className="object-cover"
            style={{ height: "11.69in", width: "8.27in" }}
          />
        </div>
      )}

      <div className="absolute left-[-200vw] top-0">
        <div
          ref={printRef}
          onClick={() => handlePrint()}
          style={{
            width: "210mm",
            height: "297mm",
            overflow: "hidden",
          }}
        >
          {currentImage && (
            <img
              onClick={() => handlePrint()}
              src={currentImage}
              alt="print-1"
              onError={handleImageError}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: "cover",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Printer;
`

export const configureWebcam = async (projectPath) => {
  await ensureDir(path.join(projectPath, 'src', 'pages'))
  await writeFile(path.join(projectPath, 'src', 'pages', 'Camera.jsx'), cameraContent)
}

export const configurePrinter = async (projectPath) => {
  await ensureDir(path.join(projectPath, 'src', 'pages'))
  await writeFile(path.join(projectPath, 'src', 'pages', 'Printer.jsx'), printerContent)
}

export const configureToast = async (projectPath) => {
  await applyToastToApp(projectPath)
}


export const defaultGitignoreContent = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Environment variables
.env
.env.local
.env.*.local
!.env.example

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`

export const ensureGitignoreWithEnv = async (projectPath) => {
  const gitignorePath = path.join(projectPath, '.gitignore')

  if (await pathExists(gitignorePath)) {
    let content = await readFile(gitignorePath)
    const lines = content.split('\n').map((l) => l.trim())
    if (!lines.includes('.env')) {
      content = `${content.trim()}\n\n# Environment variables\n.env\n.env.local\n.env.*.local\n`
      await writeFile(gitignorePath, content)
    }
  } else {
    await writeFile(gitignorePath, defaultGitignoreContent)
  }
}

export const configureEnv = async (projectPath) => {
  await Promise.all([
    writeFile(path.join(projectPath, '.env'), envContent),
    ensureGitignoreWithEnv(projectPath),
  ])
}

export const createPackageHandlers = ({ installPackages }) => ({
  tailwind: async (projectPath) => {
    if (installPackages) await installTailwind(projectPath)
    await configureTailwind(projectPath)
  },
  axios: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['axios'], { cwd: projectPath }, 'Failed to install axios')
    }
  },
  socket: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['socket.io-client'], { cwd: projectPath }, 'Failed to install socket.io-client')
    }
    await configureSocket(projectPath)
  },
  toast: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-hot-toast'], { cwd: projectPath }, 'Failed to install react-hot-toast')
    }
    await configureToast(projectPath)
  },
  icon: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-icons'], { cwd: projectPath }, 'Failed to install react-icons')
    }
  },
  lucide: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['lucide-react'], { cwd: projectPath }, 'Failed to install lucide-react')
    }
  },
  router: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-router-dom'], { cwd: projectPath }, 'Failed to install react-router-dom')
    }
  },
  qr: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-qr-code'], { cwd: projectPath }, 'Failed to install react-qr-code')
    }
  },
  webcam: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-webcam'], { cwd: projectPath }, 'Failed to install react-webcam')
    }
    await configureWebcam(projectPath)
  },
  printer: async (projectPath) => {
    if (installPackages) {
      await runPackageInstall(['react-to-print', 'socket.io-client'], { cwd: projectPath }, 'Failed to install react-to-print')
    }
    await configureSocket(projectPath)
    await configurePrinter(projectPath)
  },
})

export const projectNameRegex = /^[a-zA-Z0-9_-]+$|^\.$/
export const fileNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/
export const envKeyRegex = /^VITE_[A-Z0-9_]+$/
export const maxWatchBodyBytes = 128 * 1024
export const setupUiPortStart = 4317
export const watchPortStart = 4570

export const readTextIfExists = async (targetPath) => {
  if (!(await pathExists(targetPath))) return ''
  return readFile(targetPath)
}

export const readCurrentPackageJson = async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!(await pathExists(packageJsonPath))) {
    throw new Error('Not inside a React project. Run this from your app folder.')
  }

  try {
    return JSON.parse(await readFile(packageJsonPath))
  } catch {
    throw new Error('Could not read package.json. Make sure it is valid JSON.')
  }
}

export const getDependencies = (packageJson) => ({
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
})

export const assertDevScript = async (packageJson) => {
  if (!packageJson.scripts || !packageJson.scripts.dev) {
    const pkgPath = path.join(process.cwd(), 'package.json')
    packageJson.scripts = packageJson.scripts || {}
    packageJson.scripts.dev = 'vite'
    packageJson.scripts.build = packageJson.scripts.build || 'vite build'
    packageJson.scripts.preview = packageJson.scripts.preview || 'vite preview'
    await writeFile(pkgPath, JSON.stringify(packageJson, null, 2) + '\n')
  }
}

export const validatePort = (port) => {
  if (port === undefined) return undefined

  const parsed = Number(port)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('Port must be a number between 1 and 65535')
  }

  return String(parsed)
}

