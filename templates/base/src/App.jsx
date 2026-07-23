import { useState } from "react";

function GridBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{
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
      className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none z-0 blur-[40px] animate-spotlight-pulse"
      style={{
        background:
          "radial-gradient(circle, rgba(232, 147, 90, 0.10) 0%, rgba(232, 147, 90, 0.03) 45%, transparent 70%)",
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
      className="group flex items-start gap-3.5 px-5 py-5 bg-[rgba(12,12,14,0.92)] no-underline text-inherit relative transition-colors duration-300 ease-in-out hover:bg-[rgba(232,147,90,0.045)] animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="font-mono text-[0.7rem] text-[#4c4c52] font-medium shrink-0 pt-0.5 transition-colors duration-300 group-hover:text-[#e8935a]">
        {index}
      </div>

      <div className="min-w-0">
        <h2 className="text-[0.92rem] font-semibold text-[#eeeeef] m-0 mb-1.5 flex items-center gap-1.5 transition-colors duration-[250ms] group-hover:text-[#f2a874]">
          {title}

          <span className="inline-flex text-[#e8935a] opacity-0 -translate-x-[3px] translate-y-[3px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="19" x2="19" y2="5" />
              <polyline points="8 5 19 5 19 16" />
            </svg>
          </span>
        </h2>

        <p className="text-[0.78rem] text-[#838389] m-0 leading-[1.55]">
          {description}
        </p>
      </div>
    </a>
  );
}

const App = () => {
  return (
    <div className="h-screen w-screen bg-[#08080a] text-[#f4f4f5] font-sans flex flex-col justify-between items-center px-6 pt-14 pb-10 relative overflow-hidden box-border [&_*]:box-border">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spotlightPulse {
          0%, 100% { opacity: 0.75; transform: translate(-50%, -50%) scale(0.96); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes shineSweep {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 0.95; }
          50% { transform: translateY(100%); opacity: 0.95; }
          60%, 100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes markFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-spotlight-pulse {
          animation: spotlightPulse 12s ease-in-out infinite;
        }
        .animate-shine-sweep {
          animation: shineSweep 3.5s ease-in-out infinite;
        }
        .animate-mark-float {
          animation: markFloat 7s ease-in-out infinite;
        }
        .animate-dot-pulse {
          animation: dotPulse 2.4s ease-in-out infinite;
        }
      `}</style>

      <GridBackground />
      <Spotlight />

      {/* Top Banner (Capsule) */}
      <div className="flex items-center justify-center gap-2.5 border border-white/[0.09] bg-white/[0.025] py-2.5 pr-4.5 pl-3.5 rounded-[7px] font-mono text-[0.76rem] tracking-[0.01em] z-10 backdrop-blur-[10px] text-[#b4b4bb] animate-fade-in-up transition-colors duration-[250ms] ease-in-out hover:border-[rgba(232,147,90,0.35)] hover:bg-[rgba(232,147,90,0.04)] hover:text-[#e5e5e8]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#e8935a] shrink-0 animate-dot-pulse" />
        <span>Get started by editing</span>
        <code className="font-bold text-[#f2a874]">src/App.jsx</code>
      </div>

      {/* Center Logo branding */}
      <div className="flex flex-col items-center gap-[22px] z-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="relative w-[88px] h-[88px] flex items-center justify-center animate-mark-float">
          <div className="relative w-[88px] h-[88px] rounded-[22px] border border-[rgba(232,147,90,0.35)] bg-[#08080a] flex items-center justify-center overflow-hidden shadow-[0_0_25px_rgba(232,147,90,0.12),inset_0_0_15px_rgba(232,147,90,0.05)]">
            <div
              className="absolute left-0 right-0 top-0 h-[60%] pointer-events-none z-[3] animate-shine-sweep"
              style={{
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.22) 35%, rgba(242, 168, 116, 0.45) 50%, rgba(255, 255, 255, 0.22) 65%, transparent 100%)",
              }}
            />
            <div className="relative z-[2] w-16 h-16 flex items-center justify-center">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                className="block"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="appFavFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#e8935a" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="appZStrokeFav" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f2a874" />
                    <stop offset="100%" stopColor="#e8935a" />
                  </linearGradient>
                </defs>

                <rect width="64" height="64" rx="15" fill="#08080a" />
                <rect
                  x="2"
                  y="2"
                  width="60"
                  height="60"
                  rx="14"
                  fill="url(#appFavFill)"
                  stroke="#e8935a"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />

                <path
                  d="M 18 20 L 46 20 L 22 44 L 46 44"
                  fill="none"
                  stroke="url(#appZStrokeFav)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="46" cy="20" r="4" fill="#f4f4f5" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <h1 className="font-mono text-[clamp(2.4rem,6.4vw,3.4rem)] font-bold tracking-[-0.03em] m-0 text-[#f7f7f8] leading-none">
            zenith<span className="text-[#4c4c52]">.cli</span>
          </h1>
          <p className="text-[0.86rem] text-[#6f6f78] text-center m-0 max-w-[380px] leading-[1.5]">
            Scaffold, configure, and ship React projects from a single command.
          </p>
          <span className="text-[0.7rem] text-[#e8935a] font-mono bg-[rgba(232,147,90,0.06)] border border-[rgba(232,147,90,0.22)] py-1 px-3.5 rounded-full font-medium tracking-[0.04em] transition-all duration-[250ms] ease-in-out hover:bg-[rgba(232,147,90,0.12)] hover:border-[rgba(232,147,90,0.4)]">
            by Anshh
          </span>
        </div>
      </div>

      {/* Bottom Grid (4 columns) */}
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))] gap-px w-full max-w-[980px] z-10 bg-white/[0.06] border border-white/[0.06] rounded-[14px] overflow-hidden">
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