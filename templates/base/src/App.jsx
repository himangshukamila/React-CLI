import { useState } from "react";

function GridBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
        backgroundPosition: "center",
        animation: "gridPan 24s linear infinite",
      }}
    />
  );
}

function Spotlight() {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        background: "radial-gradient(circle, rgba(0, 254, 230, 0.08) 0%, rgba(124, 58, 237, 0.03) 50%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
        filter: "blur(50px)",
        animation: "spotlightPulse 10s ease-in-out infinite",
      }}
    />
  );
}

function ResourceCard({ title, description, href, delay }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="card-item"
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      <h2 className="card-title">
        {title}{" "}
        <span className="card-arrow">-&gt;</span>
      </h2>
      <p className="card-desc">{description}</p>
    </a>
  );
}

const App = () => {
  return (
    <div className="dashboard-container">
      <style>{`
        /* Global CSS reset overrides locally */
        .dashboard-container {
          height: 100vh;
          width: 100vw;
          background-color: #030303;
          color: #f4f4f5;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          alignItems: center;
          padding: 60px 24px;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }

        .dashboard-container * {
          box-sizing: border-box;
        }

        /* Keyframes */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spotlightPulse {
          0%, 100% {
            opacity: 0.7;
            transform: translate(-50%, -50%) scale(0.95);
          }
          50% {
            opacity: 1.1;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
        @keyframes gridPan {
          from { background-position: 0 0; }
          to { background-position: 24px 24px; }
        }
        @keyframes floatAndGlow {
          0%, 100% {
            transform: translateY(0px);
            filter: drop-shadow(0 0 12px rgba(0, 254, 230, 0.2)) drop-shadow(0 0 35px rgba(124, 58, 237, 0.15));
          }
          50% {
            transform: translateY(-8px);
            filter: drop-shadow(0 0 25px rgba(0, 254, 230, 0.45)) drop-shadow(0 0 50px rgba(124, 58, 237, 0.3));
          }
        }
        @keyframes spinClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCounterClockwise {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes textShine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }

        /* Top Banner */
        .top-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(255, 255, 255, 0.02);
          padding: 10px 20px;
          borderRadius: 8px;
          font-family: monospace;
          fontSize: 0.78rem;
          zIndex: 10;
          backdrop-filter: blur(8px);
          color: #d4d4d8;
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: all 0.3s ease;
        }
        .top-banner:hover {
          border-color: rgba(0, 254, 230, 0.3);
          box-shadow: 0 0 15px rgba(0, 254, 230, 0.1);
          color: #ffffff;
        }

        /* Logo and Orbit */
        .brand-orbit-wrapper {
          position: relative;
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: floatAndGlow 6s ease-in-out infinite;
        }
        .orbit-ring-outer {
          position: absolute;
          inset: 0;
          border: 1px dashed rgba(0, 254, 230, 0.2);
          border-radius: 50%;
          animation: spinClockwise 25s linear infinite;
        }
        .orbit-ring-inner {
          position: absolute;
          inset: 15px;
          border: 1px dashed rgba(124, 58, 237, 0.25);
          border-radius: 50%;
          animation: spinCounterClockwise 15s linear infinite;
        }
        .logo-container {
          position: relative;
          width: 75px;
          height: 75px;
          z-index: 2;
        }

        /* Title branding */
        .brand-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          zIndex: 10;
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
        }
        .title-text {
          font-size: clamp(3rem, 8vw, 4.2rem);
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0;
          background: linear-gradient(
            to right,
            #ffffff 20%,
            #00fee6 40%,
            #7c3aed 60%,
            #ffffff 80%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: textShine 6s linear infinite;
        }
        .brand-badge {
          font-size: 0.75rem;
          color: #00ffe7;
          font-family: monospace;
          background-color: rgba(0, 255, 231, 0.04);
          border: 1px solid rgba(0, 255, 231, 0.2);
          padding: 4px 12px;
          border-radius: 99px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }
        .brand-badge:hover {
          background-color: rgba(0, 255, 231, 0.1);
          border-color: rgba(0, 255, 231, 0.4);
          box-shadow: 0 0 10px rgba(0, 255, 231, 0.2);
        }

        /* Card grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          width: 100%;
          maxWidth: 1000px;
          zIndex: 10;
        }
        .card-item {
          display: block;
          padding: 18px 22px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          text-decoration: none;
          color: inherit;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Card hover gloss shimmer */
        .card-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.03) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          transition: 0.75s;
        }
        .card-item:hover::before {
          left: 150%;
        }
        .card-item:hover {
          background: rgba(255, 255, 255, 0.025);
          border-color: rgba(0, 254, 230, 0.25);
          box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 254, 230, 0.05);
          transform: translateY(-2px);
        }
        .card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 6px 0;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.3s ease;
        }
        .card-item:hover .card-title {
          color: #00fee6;
        }
        .card-arrow {
          display: inline-block;
          color: #00ffe7;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-item:hover .card-arrow {
          transform: translateX(4px);
        }
        .card-desc {
          font-size: 0.78rem;
          color: #a1a1aa;
          margin: 0;
          line-height: 1.5;
        }
      `}</style>

      <GridBackground />
      <Spotlight />

      {/* Top Banner (Capsule) */}
      <div className="top-banner">
        <span>Get started by editing</span>
        <code style={{ fontWeight: "700", color: "#ffffff" }}>src/App.jsx</code>
      </div>

      {/* Center Logo branding & holographic rings */}
      <div className="brand-info">
        <div className="brand-orbit-wrapper">
          <div className="orbit-ring-outer" />
          <div className="orbit-ring-inner" />
          <div className="logo-container">
            <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#7C3AED"/>
            <stop offset="50%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
    </defs>

    <rect width="128" height="128" rx="30" fill="#0F172A"/>

    <path
        d="M34 34H96L50 66H92L36 94H96"
        fill="none"
        stroke="url(#g1)"
        stroke-width="10"
        stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <h1 className="title-text">Zenith</h1>
          <span className="brand-badge">by Anshh</span>
        </div>
      </div>

      {/* Bottom Grid (4 columns) */}
      <div className="cards-grid">
        <ResourceCard
          title="Docs"
          description="Find in-depth information about react-cli configurations, modules, and utilities."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.2}
        />
        <ResourceCard
          title="Features"
          description="Check out how to use preconfigured environment variables, axios clients, and socket streams."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.28}
        />
        <ResourceCard
          title="CLI Commands"
          description="Run diagnostics, start dev servers, and maintain workspaces with custom CLI scripts."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.36}
        />
        <ResourceCard
          title="Templates"
          description="Explore our base scaffolding structures, services patterns, and UI skeletons."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.44}
        />
      </div>
    </div>
  );
};

export default App;
