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
          linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px)
        `,
        backgroundSize: "32px 32px",
        backgroundPosition: "center",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 90%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 40%, transparent 90%)",
      }}
    />
  );
}

function Spotlight() {
  return (
    <div
      style={{
        position: "absolute",
        top: "38%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "700px",
        height: "700px",
        background: "radial-gradient(circle, rgba(232, 147, 90, 0.10) 0%, rgba(232, 147, 90, 0.03) 45%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
        filter: "blur(40px)",
        animation: "spotlightPulse 12s ease-in-out infinite",
      }}
    />
  );
}

function ResourceCard({ index, title, description, href, delay }) {
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
      <div className="card-index">{index}</div>
      <div className="card-body">
        <h2 className="card-title">
          {title}
          <span className="card-arrow">
           <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
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
          </span>
        </h2>
        <p className="card-desc">{description}</p>
      </div>
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
          background-color: #08080a;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 56px 24px 40px;
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
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spotlightPulse {
          0%, 100% {
            opacity: 0.75;
            transform: translate(-50%, -50%) scale(0.96);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }
        @keyframes cursorBlink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes scanSweep {
          0% { transform: translateY(-100%); opacity: 0; }
          8% { opacity: 0.9; }
          45% { opacity: 0.9; }
          55% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes markFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }

        /* Top Banner */
        .top-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background-color: rgba(255, 255, 255, 0.025);
          padding: 9px 18px 9px 14px;
          border-radius: 7px;
          font-family: "SF Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;
          font-size: 0.76rem;
          letter-spacing: 0.01em;
          z-index: 10;
          backdrop-filter: blur(10px);
          color: #b4b4bb;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: border-color 0.25s ease, background-color 0.25s ease;
        }
        .top-banner:hover {
          border-color: rgba(232, 147, 90, 0.35);
          background-color: rgba(232, 147, 90, 0.04);
          color: #e5e5e8;
        }
        .banner-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #e8935a;
          flex-shrink: 0;
          animation: dotPulse 2.4s ease-in-out infinite;
        }

        /* Logo mark */
        .brand-mark-wrapper {
          position: relative;
          width: 88px;
          height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: markFloat 7s ease-in-out infinite;
        }
        .mark-frame {
          position: relative;
          width: 88px;
          height: 88px;
          border-radius: 22px;
          border: 1px solid rgba(232, 147, 90, 0.28);
          background: linear-gradient(155deg, rgba(232, 147, 90, 0.07) 0%, rgba(255, 255, 255, 0.015) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .mark-scan {
          position: absolute;
          left: 0;
          right: 0;
          height: 40%;
          background: linear-gradient(180deg, transparent 0%, rgba(232, 147, 90, 0.16) 50%, transparent 100%);
          animation: scanSweep 5s ease-in-out infinite;
          pointer-events: none;
        }
        .mark-glyph {
          position: relative;
          z-index: 2;
          font-family: "SF Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;
          font-size: 2.1rem;
          font-weight: 600;
          color: #f4f4f5;
          letter-spacing: -0.02em;
          display: flex;
          align-items: baseline;
          gap: 1px;
        }
        .mark-glyph .accent-char {
          color: #e8935a;
        }
        .mark-glyph .cursor-char {
          display: inline-block;
          width: 3px;
          height: 26px;
          background: #e8935a;
          margin-left: 3px;
          animation: cursorBlink 1.3s step-end infinite;
          border-radius: 1px;
        }

        /* Title branding */
        .brand-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          z-index: 10;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        .title-text {
          font-family: "SF Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;
          font-size: clamp(2.4rem, 6.4vw, 3.4rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          margin: 0;
          color: #f7f7f8;
          line-height: 1;
        }
        .title-text .title-dim {
          color: #4c4c52;
        }
        .brand-tagline {
          font-size: 0.86rem;
          color: #6f6f78;
          text-align: center;
          margin: 0;
          max-width: 380px;
          line-height: 1.5;
        }
        .brand-badge {
          font-size: 0.7rem;
          color: #e8935a;
          font-family: "SF Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;
          background-color: rgba(232, 147, 90, 0.06);
          border: 1px solid rgba(232, 147, 90, 0.22);
          padding: 4px 13px;
          border-radius: 99px;
          font-weight: 500;
          letter-spacing: 0.04em;
          transition: all 0.25s ease;
        }
        .brand-badge:hover {
          background-color: rgba(232, 147, 90, 0.12);
          border-color: rgba(232, 147, 90, 0.4);
        }

        /* Card grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 1px;
          width: 100%;
          max-width: 980px;
          z-index: 10;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          overflow: hidden;
        }
        .card-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 20px 20px;
          background: rgba(12, 12, 14, 0.92);
          text-decoration: none;
          color: inherit;
          position: relative;
          transition: background-color 0.3s ease;
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .card-item:hover {
          background: rgba(232, 147, 90, 0.045);
        }
        .card-index {
          font-family: "SF Mono", "Berkeley Mono", ui-monospace, Menlo, monospace;
          font-size: 0.7rem;
          color: #4c4c52;
          font-weight: 500;
          flex-shrink: 0;
          padding-top: 2px;
          transition: color 0.3s ease;
        }
        .card-item:hover .card-index {
          color: #e8935a;
        }
        .card-body {
          min-width: 0;
        }
        .card-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: #eeeeef;
          margin: 0 0 6px 0;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.25s ease;
        }
        .card-item:hover .card-title {
          color: #f2a874;
        }
        .card-arrow {
          display: inline-flex;
          color: #e8935a;
          opacity: 0;
          transform: translate(-3px, 3px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-item:hover .card-arrow {
          opacity: 1;
          transform: translate(0, 0);
        }
        .card-desc {
          font-size: 0.78rem;
          color: #838389;
          margin: 0;
          line-height: 1.55;
        }

        @media (max-width: 640px) {
          .dashboard-container {
            padding: 40px 18px 32px;
          }
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <GridBackground />
      <Spotlight />

      {/* Top Banner (Capsule) */}
      <div className="top-banner">
        <span className="banner-dot" />
        <span>Get started by editing</span>
        <code style={{ fontWeight: "700", color: "#f2a874" }}>src/App.jsx</code>
      </div>

      {/* Center Logo branding */}
      <div className="brand-info">
        <div className="brand-mark-wrapper">
          <div className="mark-frame">
            <div className="mark-scan" />
            <div className="mark-glyph">
              <span className="accent-char">&gt;</span>
              <span>_</span>
              <span className="cursor-char" />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <h1 className="title-text">
            zenith<span className="title-dim">.cli</span>
          </h1>
          <p className="brand-tagline">
            Scaffold, configure, and ship React projects from a single command.
          </p>
          <span className="brand-badge">by Anshh</span>
        </div>
      </div>

      {/* Bottom Grid (4 columns) */}
      <div className="cards-grid">
        <ResourceCard
          index="01"
          title="Docs"
          description="Find in-depth information about react-cli configurations, modules, and utilities."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.16}
        />
        <ResourceCard
          index="02"
          title="Features"
          description="Check out how to use preconfigured environment variables, axios clients, and socket streams."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.22}
        />
        <ResourceCard
          index="03"
          title="CLI Commands"
          description="Run diagnostics, start dev servers, and maintain workspaces with custom CLI scripts."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.28}
        />
        <ResourceCard
          index="04"
          title="Templates"
          description="Explore our base scaffolding structures, services patterns, and UI skeletons."
          href="https://zenith-cli-1ae6.onrender.com"
          delay={0.34}
        />
      </div>
    </div>
  );
};

export default App;