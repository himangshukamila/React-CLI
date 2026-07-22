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

export const App = () => {
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
            <svg
              viewBox="0 0 500 500"
              width="100%"
              height="100%"
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id="app-lg-2" x1="110.2" y1="209.7" x2="238.89999" y2="116" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#00ced1" />
                  <stop offset=".3" stop-color="#02b1cb" />
                  <stop offset="1" stop-color="#0969bd" />
                  <stop offset="1" stop-color="#0a64bc" />
                </linearGradient>
                <linearGradient id="app-lg1-9" x1="140.60001" y1="241.8" x2="357.10001" y2="241.8" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#0a64bc" />
                  <stop offset="0" stop-color="#0969bd" />
                  <stop offset=".7" stop-color="#02b1cb" />
                  <stop offset="1" stop-color="#00ced1" />
                </linearGradient>
                <linearGradient id="app-lg2-9" x1="267.79999" y1="218.8" x2="267.79999" y2="305.79999" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stop-color="#00ced1" />
                  <stop offset=".3" stop-color="#03a9c9" />
                  <stop offset=".8" stop-color="#0877bf" />
                  <stop offset="1" stop-color="#0a64bc" />
                </linearGradient>
              </defs>
              <g transform="translate(578.336,832.80383)">
                <rect style={{ fill: "#ffffff" }} width="500" height="500" x="-578.336" y="-832.80383" ry="250" />
                <g transform="matrix(1.564053,0,0,1.564053,-710.99228,-892.17352)">
                  <path d="m 140.6,214.1 c -13.9,0 -24.3,-8.9 -23.7,-20.6 0.3,-5.6 3.4,-10.2 8,-14 13.7,-11.4 109.9,-87.3 109.9,-87.3 v 48.1 l -52.2,40.1 -42.1,33.7 z" style={{ fill: "url(#app-lg-2)" }} />
                  <path d="m 286.4,271.1 c 0,0 8,0.1 12.6,-1.3 8.4,-2.6 15.9,-6.6 19,-16.9 0.3,-1 0.6,-2 0.7,-3 1.9,-10.2 -0.7,-23.4 -9.9,-29.4 -8.3,-5.4 -18.7,-6.2 -28.3,-6.4 -11.1,-0.3 -22.3,-0.3 -33.4,-0.4 -21.9,-0.1 -43.8,0 -65.6,0.2 -13.7,0 -27.3,0.2 -41,0.2 l 42.1,-33.7 c 0,0 61.7,-0.3 90.7,0 75.3,0.5 102.8,62.6 70.4,99 -8.1,9.1 -20.8,16.7 -38.7,21.4 -6.9,1.8 -14,2.6 -21.2,2.6 -11.8,-0.1 -34.8,0 -34.8,0 l 37.4,-32.1 z" style={{ fill: "url(#app-lg1-9)" }} />
                  <polygon points="286.4,271.1 249,303.2 249,227.9 286.6,227.9" style={{ fill: "url(#app-lg2-9)" }} />
                  <polygon points="234.9,227.9 234.9,303.3 192.8,271.3 192.9,227.9" style={{ fill: "#f72d37" }} />
                  <path d="m 249.1,92.3 c 0,0 26.6,-0.1 17.4,0 23.1,0.3 46.2,13 56.1,34.3 7.7,16.5 4.8,33.8 -2.6,49.8 0,0.1 -2.2,5.9 -2.3,5.8 0,0 -28.7,-11.3 -28.7,-11.3 0.4,0.2 2.9,-3.5 3.1,-3.8 9.6,-13.7 7.2,-34.1 -7.8,-42.9 -5.3,-3.1 -11.2,-5 -17.2,-6.4 0,0 -0.7,-0.1 -0.7,-0.2" style={{ fill: "#00c68f" }} />
                  <polyline points="286.4 117.6 286.5 166.1 249 166.1 249.1 92.3" style={{ fill: "#11a876" }} />
                </g>
              </g>
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <h1 className="title-text">4B React</h1>
          <span className="brand-badge">by 4brains</span>
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
