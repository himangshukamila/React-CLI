import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fsPromises from 'node:fs/promises'
import fs from 'node:fs'
import { execa } from 'execa'
import chalk from 'chalk'

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

export const getBasePackageName = (name) => {
  if (typeof name !== 'string') return ''
  if (name.startsWith('@')) {
    const parts = name.slice(1).split('@')
    return `@${parts[0]}`
  }
  return name.split('@')[0]
}

export const resolvePackageName = (packageName) => {
  const baseName = getBasePackageName(packageName)
  const tagOrVersion = packageName.slice(baseName.length)
  const resolvedBase = aliasMap[baseName] || baseName
  return `${resolvedBase}${tagOrVersion}`
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
  },
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

// export const cliIconContent = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
//   <defs>
//     <!-- Fluid flow gradient -->
//     <linearGradient id="bioFlow" x1="0%" y1="0%" x2="100%" y2="0%">
//       <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.2"/>
//       <stop offset="50%" stop-color="#67e8f9"/>
//       <stop offset="100%" stop-color="#0891b2" stop-opacity="0.3"/>
//     </linearGradient>

//     <!-- Subtle radial glow for high-res display -->
//     <radialGradient id="waveGlow" cx="50%" cy="50%" r="50%">
//       <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.12" />
//       <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
//     </radialGradient>
//   </defs>

//   <!-- Container -->
//   <rect width="256" height="256" rx="64" fill="#030712" />

//   <!-- Background Ambient Glow -->
//   <circle cx="128" cy="128" r="112" fill="url(#waveGlow)" />

//   <!-- Outer Kinetic Boundary Ring -->
//   <circle cx="128" cy="128" r="112" stroke="#1e293b" stroke-width="4" fill="none" />

//   <!-- Fluid, Continuous Wave Mark (4x Scaled) -->
//   <g fill="none" stroke-linecap="round" stroke-linejoin="round">
//     <!-- Secondary shadow line for depth -->
//     <path d="M 48 128 C 48 128, 72 96, 96 96 C 120 96, 136 160, 160 160 C 184 160, 208 128, 208 128" 
//           stroke="#155e75" 
//           stroke-width="6" 
//           stroke-dasharray="8 12"/>
    
//     <!-- Main Biomorphic Ribbon -->
//     <path d="M 48 128 C 48 128, 72 64, 96 64 C 120 64, 136 192, 160 192 C 184 192, 208 128, 208 128" 
//           stroke="url(#bioFlow)" 
//           stroke-width="16"/>
//   </g>

//   <!-- Final Pulse Node -->
//   <circle cx="160" cy="192" r="8" fill="#ffffff"/>
// </svg>


// `
export const cliIconContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="monoTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22d3ee" />
      <stop offset="100%" stop-color="#0891b2" />
    </linearGradient>
    <linearGradient id="monoSide" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#155e75" />
      <stop offset="100%" stop-color="#0e7490" />
    </linearGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Dark Background Container -->
  <rect width="512" height="512" rx="128" fill="#030712" />

  <!-- Outer Ambient Glow -->
  <circle cx="256" cy="256" r="180" fill="#22d3ee" opacity="0.1" filter="blur(30px)" />

  <!-- Maximized Monolithic Pillars -->
  <g stroke="#030712" stroke-width="12" stroke-linejoin="round">
    <!-- Left Pillar -->
    <polygon points="91,168 201,102 201,366 91,432" fill="url(#monoTop)" />
    <!-- Middle Higher Pillar -->
    <polygon points="201,102 311,36 311,300 201,366" fill="#67e8f9" />
    <!-- Right Lower Pillar -->
    <polygon points="311,212 421,146 421,410 311,476" fill="url(#monoSide)" />
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

export const createViteApp = async (commandTarget, projectPath) => {
  const target = commandTarget || projectPath
  await runCommand(
    'npm',
    ['create', 'vite@latest', target, '--', '--template', 'react'],
    { stdio: 'pipe' },
    'Failed to scaffold Vite project',
  )
  if (projectPath) {
    await ensureViteScriptsInPackageJson(projectPath)
  }
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

export const methodTemplates = {
  get: `  get: (url, config = {}) => unwrap(axiosInstance.get(url, config)),`,
  post: `  post: (url, body, config = {}) => unwrap(axiosInstance.post(url, body, config)),`,
  put: `  put: (url, body, config = {}) => unwrap(axiosInstance.put(url, body, config)),`,
  patch: `  patch: (url, body, config = {}) => unwrap(axiosInstance.patch(url, body, config)),`,
  delete: `  delete: (url, config = {}) => unwrap(axiosInstance.delete(url, config)),`,
}

export const generateApiFileContent = (methods = ['get', 'post'], options = {}) => {
  const requestedLower = methods.map((m) => m.toLowerCase())
  const selectedTemplates = []

  for (const m of requestedLower) {
    if (methodTemplates[m]) {
      selectedTemplates.push(methodTemplates[m])
    }
  }

  const methodCodes = selectedTemplates.join('\n')
  const isAuthEnabled = Boolean(options.auth)

  const tokenHelpers = isAuthEnabled
    ? `const getToken = () => {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('token') || sessionStorage.getItem('token')
}

const clearToken = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
}
`
    : ''

  const requestInterceptorCode = isAuthEnabled
    ? `axiosInstance.interceptors.request.use((config) => {
  console.log('API Sent:', (config.method || 'GET').toUpperCase(), config.url, config.data || '')
  const token = getToken()
  if (token) config.headers.Authorization = \`Bearer \${token}\`
  return config
})`
    : `axiosInstance.interceptors.request.use((config) => {
  console.log('API Sent:', (config.method || 'GET').toUpperCase(), config.url, config.data || '')
  return config
})`

  const error401Logic = isAuthEnabled
    ? `if (status === 401) {
    return getToken()
      ? 'Your session has expired. Please log in again to continue.'
      : serverMsg || 'Incorrect email or password.'
  }`
    : `if (status === 401) return serverMsg || 'Your session has expired or unauthorized access.'`

  const unauthorizedHandlerCode = isAuthEnabled
    ? `let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }
`
    : ''

  const responseInterceptor401SideEffect = isAuthEnabled
    ? `    if (error.status === 401 && getToken()) {
      clearToken()
      onUnauthorized?.()
    }`
    : ''

  return `import axios from 'axios'
import { toast } from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
const DEFAULT_TIMEOUT = 15000

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: DEFAULT_TIMEOUT,
})

${tokenHelpers}${requestInterceptorCode}

// Pure translator — no side effects, safe to call anywhere.
export const getHumanReadableError = (error) => {
  if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return null

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'The request took too long. Please try again.'
  }
  if (error.code === 'ERR_NETWORK' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return "We couldn't reach the server. Check your internet connection."
  }

  const status = error.response?.status
  const data = typeof error.response?.data === 'object' ? error.response.data : null
  const serverMsg = data?.message

  if (status === 400 || status === 422) return serverMsg || 'Please check the input fields and try again.'
  ${error401Logic}
  if (status === 403) return "You don't have access to do this. Contact your administrator."
  if (status === 404) return serverMsg || 'The requested item was not found or may have been deleted.'
  if (status === 405) return 'This action is not supported for this resource.'
  if (status === 407) return 'Proxy authentication required. Please authenticate with your proxy server.'
  if (status === 408) return 'Request timed out. The server took too long to respond.'
  if (status === 409) return serverMsg || 'A record already exists with this information.'
  if (status === 413) return 'The uploaded file or request data is too large.'
  if (status === 415) return 'File format or media type is not supported.'
  if (status === 429) {
    const retryAfter = Number(error.response?.headers?.['retry-after'])
    return retryAfter
      ? \`Too many attempts. Try again in \${retryAfter} seconds.\`
      : 'Too many attempts. Please wait a moment and try again.'
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again shortly.'
  }
  if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.'

  return error.message || 'An unexpected error occurred.'
}

// Extracts { fieldName: "message" } for inline form errors.
const getFieldErrors = (error) => {
  const data = error.response?.data
  if (!data || typeof data !== 'object') return null
  if (data.errors && typeof data.errors === 'object') return data.errors
  if (Array.isArray(data.details)) {
    return data.details.reduce((acc, d) => {
      if (!d || typeof d !== 'object') return acc
      const key = d.field ?? d.path ?? 'general'
      return { ...acc, [key]: d.message }
    }, {})
  }
  return null
}

${unauthorizedHandlerCode}

axiosInstance.interceptors.response.use(
  (response) => {
    console.log('API Received:', (response.config?.method || 'GET').toUpperCase(), response.config?.url, response.data)
    return response
  },
  (error) => {
    const isCanceled = axios.isCancel?.(error) || error.code === 'ERR_CANCELED'
    if (isCanceled) return Promise.reject(Object.assign(error, { isCanceled: true }))

    const message = getHumanReadableError(error)
    error.friendlyMessage = message
    error.status = error.response?.status
    error.fieldErrors = getFieldErrors(error)

${responseInterceptor401SideEffect}

    if (!error.config?.silent && message) {
      toast.error(message, { id: \`api-error-\${error.status ?? error.code ?? 'unknown'}\` })
    }

    return Promise.reject(error)
  }
)

const unwrap = (promise) => promise.then((res) => res.data)

export const api = {
${methodCodes}

  // Direct reference to the underlying Axios instance
  axios: axiosInstance,
}

export default api
`
}

export const apiContent = generateApiFileContent(['get', 'post'])

export const configureAxios = async (projectPath = process.cwd(), options = {}) => {
  const pkgJsonPath = path.join(projectPath, 'package.json')
  if (await pathExists(pkgJsonPath)) {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
    const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) }
    if (!allDeps['react-hot-toast']) {
      await runPackageInstall(['react-hot-toast'], { cwd: projectPath }, 'Failed to install react-hot-toast')
    }
  }
  await ensureDir(path.join(projectPath, 'src', 'services'))
  await writeFile(path.join(projectPath, 'src', 'services', 'api.js'), generateApiFileContent(['get', 'post'], options))
}

export const configureApiMethods = async (methods = ['get', 'post'], options = {}, projectPath = process.cwd()) => {
  let opts = options
  let projPath = projectPath
  if (typeof options === 'string') {
    projPath = options
    opts = {}
  }

  const pkgJsonPath = path.join(projPath, 'package.json')
  if (await pathExists(pkgJsonPath)) {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
    const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) }
    if (!allDeps['react-hot-toast']) {
      await runPackageInstall(['react-hot-toast'], { cwd: projPath }, 'Failed to install react-hot-toast')
    }
  }

  const apiPath = path.join(projPath, 'src', 'services', 'api.js')
  const requestedMethods = methods.length > 0 ? methods : ['get', 'post']

  if (!(await pathExists(apiPath))) {
    await ensureDir(path.join(projPath, 'src', 'services'))
    const initialContent = generateApiFileContent(requestedMethods, opts)
    await writeFile(apiPath, initialContent)
    console.log(chalk.green(`\n✅ Created src/services/api.js with method(s): ${requestedMethods.map((m) => m.toUpperCase()).join(', ')}${opts.auth ? ' (+Auth token interceptor)' : ''}!`))
    return
  }

  let content = await readFile(apiPath)
  const addedMethods = []

  for (const method of requestedMethods) {
    const lowerMethod = method.toLowerCase()
    if (methodTemplates[lowerMethod]) {
      const regex = new RegExp(`\\b${lowerMethod}\\s*:\\s*(?:async|\\()`)
      if (!regex.test(content)) {
        const methodCode = methodTemplates[lowerMethod]
        if (content.includes('// Direct reference to the underlying Axios instance')) {
          content = content.replace(
            '// Direct reference to the underlying Axios instance',
            `${methodCode}\n\n  // Direct reference to the underlying Axios instance`
          )
        } else if (content.includes('axios: axiosInstance,')) {
          content = content.replace('axios: axiosInstance,', `${methodCode}\n\n  axios: axiosInstance,`)
        } else if (content.includes('export default api')) {
          content = content.replace('export default api', `${methodCode}\n\nexport default api`)
        }
        addedMethods.push(lowerMethod.toUpperCase())
      }
    }
  }

  if (addedMethods.length > 0) {
    await writeFile(apiPath, content)
    console.log(chalk.green(`\n✅ Added ${addedMethods.join(', ')} method(s) to src/services/api.js`))
  } else {
    console.log(chalk.yellow('\nℹ️ Requested method(s) are already present in src/services/api.js'))
  }
}

export const webSocketContent = `class WebSocketClient {
  constructor(options = {}) {
    this.url = options.url || this.getWsUrl()
    this.socket = null

    this.baseInterval = options.baseInterval ?? 1000
    this.maxInterval = options.maxInterval ?? 30000
    this.attempt = 0
    this.reconnectTimer = null

    this.heartbeatInterval = options.heartbeatInterval ?? 25000
    this.pongTimeout = options.pongTimeout ?? 10000
    this.heartbeatTimer = null
    this.pongTimer = null

    this.maxQueueSize = options.maxQueueSize ?? 100
    this.sendQueue = []

    this.listeners = new Set()
    this.stateListeners = new Set()
    this.state = 'closed'
    this.shouldReconnect = true

    this.debug = options.debug ?? true
    this.connect()
  }

  getWsUrl() {
    const env = import.meta.env ?? {}
    const raw = env.VITE_WS_URL || env.VITE_SERVER_URL || 'ws://localhost:3000'
    if (/^wss?:\\/\\//.test(raw)) return raw
    if (/^https:\\/\\//.test(raw)) return raw.replace(/^https:\\/\\//, 'wss://')
    if (/^http:\\/\\//.test(raw)) return raw.replace(/^http:\\/\\//, 'ws://')
    if (raw.startsWith('//')) {
      const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:'
      return proto + raw
    }
    return \`ws://\${raw}\`
  }

  // ---- lifecycle ----

  connect() {
    if (typeof WebSocket === 'undefined') return
    this.shouldReconnect = true
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)
    ) {
      return
    }
    if (this.reconnectTimer) return
    this.open()
  }

  open() {
    this.clearTimer('reconnectTimer')
    this.teardown(1000, 'reopen')
    this.setState('connecting')

    let socket
    try {
      socket = new WebSocket(this.url)
    } catch (err) {
      console.error('WS construct failed:', err)
      this.setState('closed')
      this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      if (this.socket !== socket) return
      this.attempt = 0
      console.log('WS Connected:', this.url)
      this.setState('open')
      this.startHeartbeat()
      this.flush()
    }

    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      let data = event.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (_) {
          /* keep raw string */
        }
      }
      if (data && data.type === 'pong') {
        this.clearTimer('pongTimer')
        return
      }
      console.log('WS Received:', data)
      this.emit(this.listeners, data)
    }

    socket.onerror = (err) => {
      console.error('WS Error:', err)
    }

    socket.onclose = (event) => {
      if (this.socket !== socket) return
      this.socket = null
      this.stopHeartbeat()
      this.setState('closed')
      console.log('WS Closed:', event.code, event.reason || '')
      if (this.shouldReconnect) this.scheduleReconnect()
    }
  }

  disconnect() {
    this.shouldReconnect = false
    this.sendQueue = []
    this.clearTimer('reconnectTimer')
    this.teardown(1000, 'client disconnect')
    this.setState('closed')
  }

  teardown(code, reason) {
    this.stopHeartbeat()
    const socket = this.socket
    if (!socket) return
    this.socket = null
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      try {
        socket.close(code, reason)
      } catch (_) {
        /* already gone */
      }
    }
  }

  // ---- reconnect with jittered exponential backoff ----

  scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect) return
    const expo = Math.min(this.baseInterval * 2 ** this.attempt, this.maxInterval)
    const delay = expo / 2 + Math.random() * (expo / 2)
    this.attempt++
    this.setState('reconnecting')
    console.log(\`WS Reconnecting in \${Math.round(delay)}ms...\`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  // ---- heartbeat ----

  startHeartbeat() {
    this.stopHeartbeat()
    if (!this.heartbeatInterval) return
    this.heartbeatTimer = setInterval(() => {
      if (!this.isOpen()) return
      try {
        this.socket.send(JSON.stringify({ type: 'ping' }))
      } catch (_) {
        return
      }
      this.clearTimer('pongTimer')
      this.pongTimer = setTimeout(() => {
        console.warn('WS pong timeout — forcing reconnect')
        const socket = this.socket
        this.teardown(4000, 'pong timeout')
        if (socket) this.setState('closed')
        if (this.shouldReconnect) this.scheduleReconnect()
      }, this.pongTimeout)
    }, this.heartbeatInterval)
  }

  stopHeartbeat() {
    this.clearTimer('heartbeatTimer', clearInterval)
    this.clearTimer('pongTimer')
  }

  clearTimer(key, clear = clearTimeout) {
    if (this[key]) {
      clear(this[key])
      this[key] = null
    }
  }

  // ---- send ----

  isOpen() {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN
  }

  encode(data) {
    if (typeof data === 'string') return data
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return data
    if (typeof Blob !== 'undefined' && data instanceof Blob) return data
    return JSON.stringify(data)
  }

  send(data) {
    const payload = this.encode(data)

    if (this.isOpen()) {
      try {
        console.log('WS Sent:', data)
        this.socket.send(payload)
        return true
      } catch (err) {
        console.error('WS send failed, queueing:', err)
      }
    }

    if (!this.shouldReconnect) {
      console.warn('WS send on a disconnected client — dropped')
      return false
    }

    if (this.sendQueue.length >= this.maxQueueSize) this.sendQueue.shift()
    this.sendQueue.push(payload)
    this.connect()
    return false
  }

  flush() {
    while (this.sendQueue.length && this.isOpen()) {
      const payload = this.sendQueue[0]
      try {
        console.log('WS Sent (flushed):', payload)
        this.socket.send(payload)
      } catch (_) {
        break
      }
      this.sendQueue.shift()
    }
  }

  // ---- subscriptions ----

  emit(set, value) {
    for (const cb of Array.from(set)) {
      try {
        cb(value)
      } catch (err) {
        console.error('WS listener error:', err)
      }
    }
  }

  setState(state) {
    if (this.state === state) return
    this.state = state
    this.emit(this.stateListeners, state)
  }

  onMessage(callback) {
    if (typeof callback !== 'function') return () => {}
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  message(callback) {
    return this.onMessage(callback)
  }

  onState(callback) {
    if (typeof callback !== 'function') return () => {}
    this.stateListeners.add(callback)
    callback(this.state)
    return () => this.stateListeners.delete(callback)
  }
}

export const ws = new WebSocketClient()

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => ws.shouldReconnect && ws.connect())
}

export default ws
`

export const configureWebSocket = async (projectPath = process.cwd()) => {
  await ensureDir(path.join(projectPath, 'src', 'services'))
  await writeFile(path.join(projectPath, 'src', 'services', 'webSocket.js'), webSocketContent)
  console.log(chalk.green('\n✅ Created src/services/webSocket.js with auto-reconnect, JSON parsing & message logging!'))
}

export const buttonContent = `import { Loader2 } from 'lucide-react'

const formatUnit = (val, defaultUnit) => {
  if (val === undefined || val === null || val === '') return undefined
  if (typeof val === 'number' || (!isNaN(val) && !String(val).trim().endsWith('%') && !String(val).trim().endsWith('px') && !String(val).trim().endsWith('rem') && !String(val).trim().endsWith('em') && !String(val).trim().endsWith('vw') && !String(val).trim().endsWith('vh'))) {
    return \`\${val}\${defaultUnit}\`
  }
  return val
}

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  width,
  height,
  textSize,
  bgColor = '',
  hoverEffect = true,
  loading = false,
  disabled = false,
  icon: IconComponent,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  style = {},
  type = 'button',
  ...props
}) => {
  const baseClasses = 'relative inline-flex items-center justify-center font-semibold transition-all duration-200 outline-none select-none'

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5',
  }

  const variantClasses = {
    primary: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 border border-cyan-400/30',
    secondary: 'bg-zinc-900/90 text-zinc-100 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 shadow-sm',
    outline: 'bg-transparent border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/60',
    danger: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35 border border-rose-400/30',
  }

  const hoverClasses = hoverEffect && !disabled && !loading ? 'hover:scale-[1.02] active:scale-[0.98]' : ''
  const widthClass = fullWidth ? 'w-full' : (typeof width === 'string' && width.startsWith('w-') ? width : '')
  const heightClass = typeof height === 'string' && height.startsWith('h-') ? height : ''
  const disabledClasses = (disabled || loading) ? 'opacity-50 cursor-not-allowed pointer-events-none hover:scale-100 shadow-none' : 'cursor-pointer'

  const parsedWidth = formatUnit(width, 'vw')
  const parsedHeight = formatUnit(height, 'vh')
  const parsedTextSize = formatUnit(textSize, 'rem')

  const customStyle = {
    ...(parsedWidth && !widthClass ? { width: parsedWidth } : {}),
    ...(parsedHeight && !heightClass ? { height: parsedHeight } : {}),
    ...(parsedTextSize ? { fontSize: parsedTextSize } : {}),
    ...style,
  }

  const selectedSizeClass = (typeof textSize === 'string' && textSize.startsWith('text-') ? textSize : '') || sizeClasses[size] || sizeClasses.md
  const selectedVariantClass = bgColor || variantClasses[variant] || variantClasses.primary

  return (
    <button
      type={type}
      disabled={disabled || loading}
      style={customStyle}
      className={\`\${baseClasses} \${selectedSizeClass} \${selectedVariantClass} \${widthClass} \${heightClass} \${hoverClasses} \${disabledClasses} \${className}\`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {IconComponent && iconPosition === 'left' && (
            <span className="shrink-0">{IconComponent}</span>
          )}
          <span>{children}</span>
          {IconComponent && iconPosition === 'right' && (
            <span className="shrink-0">{IconComponent}</span>
          )}
        </>
      )}
    </button>
  )
}

export default Button
`

export const configureButton = async (projectPath = process.cwd()) => {
  const pkgJsonPath = path.join(projectPath, 'package.json')
  if (await pathExists(pkgJsonPath)) {
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
    const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) }
    if (!allDeps['lucide-react']) {
      await runPackageInstall(['lucide-react'], { cwd: projectPath }, 'Failed to install lucide-react')
    }
  }
  await ensureDir(path.join(projectPath, 'src', 'components'))
  await writeFile(path.join(projectPath, 'src', 'components', 'Button.jsx'), buttonContent)
  console.log(chalk.green('\n✅ Created src/components/Button.jsx with variants, props customization & loading state!'))
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
    await configureAxios(projectPath)
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

