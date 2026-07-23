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

export const cliIconContent = `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="favFill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e8935a" stop-opacity="0.14" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02" />
    </linearGradient>
    <linearGradient id="zStrokeFav" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f2a874" />
      <stop offset="100%" stop-color="#e8935a" />
    </linearGradient>
  </defs>

  <rect width="64" height="64" rx="15" fill="#08080a" />
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#favFill)" stroke="#e8935a" stroke-opacity="0.35" stroke-width="1.5" />

  <path d="M 18 20 L 46 20 L 22 44 L 46 44" fill="none" stroke="url(#zStrokeFav)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="46" cy="20" r="4" fill="#f4f4f5" />
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

