"use client";

import { useRef, useState, type Ref } from "react";
import { MARKS, type MarkId } from "@/components/logo/house-marks";

export default function LogoDemoPage() {
  const [selected, setSelected] = useState<MarkId>("pair");
  const current = MARKS.find((m) => m.id === selected)!;

  return (
    <div className="ld">
      <div className="ld-wrap">
        <div className="ld-tag">Demo, branding</div>
        <h1>HOUSE identity</h1>
        <p className="ld-lede">
          Four directions for the mark, all in the night pit language: copper for Up, steel for Down, tape on ink.
          Each is drawn once as a single colour so it works as a favicon, and gets its two tones from context. Pick one
          and export the 1024 by 1024 submission asset. The nav, the desk and the favicon then follow.
        </p>

        <div className="ld-grid">
          {MARKS.map((opt) => {
            const Mark = opt.Mark;
            const active = opt.id === selected;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={`ld-card ${active ? "is-on" : ""}`}
              >
                <div className="ld-card-head">
                  <h3>{opt.label}</h3>
                  <span className="ld-pill">{active ? "selected" : "select"}</span>
                </div>
                <p>{opt.sub}</p>
                <div className="ld-pair">
                  <div className="ld-tile dark">
                    <Mark size={64} />
                  </div>
                  <div className="ld-tile light">
                    <Mark size={64} />
                  </div>
                </div>
                <div className="ld-lockup">
                  <Mark size={22} />
                  <b>HOUSE</b>
                  <span className="sizes">
                    {[16, 20, 28].map((s) => (
                      <Mark key={s} size={s} />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <Submission id={selected} label={current.label} />
      </div>
    </div>
  );
}

function Submission({ id, label }: { id: MarkId; label: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const serialize = () => {
    if (!svgRef.current) return null;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
  };

  const exportPng = async () => {
    const svg = serialize();
    if (!svg || busy) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg load failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(img, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `house-logo-${id}-1024.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.alert("PNG export failed. Download the SVG and convert it in any browser.");
    } finally {
      setBusy(false);
    }
  };

  const downloadSvg = () => {
    const svg = serialize();
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `house-logo-${id}-1024.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ld-sub">
      <div className="ld-tag">Submission asset</div>
      <h2>
        {label}, 1024 by 1024
      </h2>
      <p className="ld-lede">
        Ink base with a copper glow top left, a steel glow bottom right, a faint grid, a thin copper ring, and the mark
        struck in tape at the centre. Mark only, the submission form renders the name underneath.
      </p>
      <div className="ld-sub-grid">
        <div className="ld-frame">
          <SubmissionSvg ref={svgRef} id={id} display={320} />
        </div>
        <div>
          <p className="ld-lede">
            The export renders this exact composition to a 1024 canvas. PNG for the DoraHacks form, SVG for everything
            else.
          </p>
          <div className="ld-actions">
            <button type="button" className="solid" onClick={exportPng} disabled={busy}>
              {busy ? "Rendering…" : "Download 1024 PNG"}
            </button>
            <button type="button" className="ghost" onClick={downloadSvg}>
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmissionSvg({ ref, id, display }: { ref: Ref<SVGSVGElement>; id: MarkId; display: number }) {
  const Mark = MARKS.find((m) => m.id === id)!.Mark;
  return (
    <svg ref={ref} width={display} height={display} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hsCopper" cx="0.22" cy="0.18" r="0.55">
          <stop offset="0%" stopColor="#e8a060" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#e8a060" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hsSteel" cx="0.82" cy="0.84" r="0.55">
          <stop offset="0%" stopColor="#6fa0bf" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#6fa0bf" stopOpacity="0" />
        </radialGradient>
        <pattern id="hsGrid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M64 0 H0 V64" fill="none" stroke="#efe6d6" strokeOpacity="0.045" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1024" height="1024" rx="180" fill="#0c0a1a" />
      <rect width="1024" height="1024" rx="180" fill="url(#hsGrid)" />
      <rect width="1024" height="1024" rx="180" fill="url(#hsCopper)" />
      <rect width="1024" height="1024" rx="180" fill="url(#hsSteel)" />
      <rect x="2" y="2" width="1020" height="1020" rx="178" fill="none" stroke="#c9843a" strokeOpacity="0.3" strokeWidth="2" />
      <Mark x={172} y={172} width={680} height={680} color="#efe6d6" />
    </svg>
  );
}
