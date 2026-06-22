"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8085";

interface EvidenceAnchor {
  id: number;
  document_id: string;
  sub_indicator: string;
  verbatim_text: string;
  page: number;
  bounding_box: string;
  confidence: number;
  created_at: string;
}

interface DocumentItem {
  id: string;
  filename: string;
  file_path: string;
  status: string;
  anchors: EvidenceAnchor[];
}

export default function EvidenceViewer() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnchor, setSelectedAnchor] = useState<EvidenceAnchor | null>(null);
  const [activePage, setActivePage] = useState(1);

  // References to document paragraphs for highlighting & scrolling
  const paragraphRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const fetchDocumentData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/documents/${docId}`);
        if (!res.ok) {
          throw new Error("Document not found");
        }
        const data = await res.json();
        setDocument(data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch document analysis. Make sure the API is online.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentData();
  }, [docId]);

  // Extract unique pages from the evidence anchors
  const pagesList = document?.anchors 
    ? Array.from(new Set(document.anchors.map(a => a.page))).sort((a, b) => a - b)
    : [1];

  // Helper to handle anchor selection and scrolling
  const handleAnchorClick = (anchor: EvidenceAnchor) => {
    setSelectedAnchor(anchor);
    setActivePage(anchor.page);

    // Scroll to the highlighted text block in the left pane
    setTimeout(() => {
      const refKey = `${anchor.page}-${anchor.id}`;
      const element = paragraphRefs.current[refKey];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-sm font-mono">Loading dynamic analysis report...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
        <div className="bg-red-950/20 border border-red-500/20 text-red-400 rounded-2xl p-8 max-w-md text-center shadow-xl">
          <svg className="w-10 h-10 mx-auto stroke-red-500 mb-3" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-bold text-white mb-2">Analysis Loading Failed</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{error || "Document not found."}</p>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  // Group anchors by Pillar prefix
  const anchorsByPillar: { [key: string]: EvidenceAnchor[] } = {};
  document.anchors?.forEach((anchor) => {
    // Get Pillar from 'Pillar X: ...'
    const match = anchor.sub_indicator.match(/^(Pillar \d+:[^-\n]+)/);
    const pillarName = match ? match[1].trim() : "Other Indicators";
    if (!anchorsByPillar[pillarName]) {
      anchorsByPillar[pillarName] = [];
    }
    anchorsByPillar[pillarName].push(anchor);
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-69px)] overflow-hidden">
      {/* Document Subheader / Toolbar */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Queue
          </Link>
          <div className="h-4 w-px bg-slate-800"></div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide">{document.filename}</h2>
            <p className="text-2xs text-slate-500 font-mono">ID: {document.id}</p>
          </div>
        </div>
        
        {/* Page Selector (Mock pagination for reader) */}
        <div className="flex items-center gap-2">
          <span className="text-2xs text-slate-500 font-mono uppercase tracking-wider">Reader Page</span>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {pagesList.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setActivePage(p);
                  setSelectedAnchor(null);
                }}
                className={`px-2.5 py-1 rounded text-2xs font-bold font-mono transition-all ${
                  activePage === p
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-Side Split Screens */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Document Text Display */}
        <div className="w-1/2 h-full border-r border-slate-800/80 bg-slate-950/15 overflow-y-auto p-8 flex flex-col gap-6">
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 shadow-xl min-h-[500px]">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Legal Document Text Content</span>
                <span className="text-2xs text-slate-500 font-mono">Page {activePage} of {pagesList.length}</span>
              </div>
              
              {/* Render anchor details and highlights */}
              <div className="text-slate-300 leading-relaxed text-sm space-y-6 select-text">
                {document.anchors && document.anchors.filter((a) => a.page === activePage).length > 0 ? (
                  document.anchors
                    .filter((a) => a.page === activePage)
                    .map((anchor) => {
                      const isHighlighted = selectedAnchor?.id === anchor.id;
                      return (
                        <div
                          key={anchor.id}
                          ref={(el) => {
                            paragraphRefs.current[`${anchor.page}-${anchor.id}`] = el;
                          }}
                          className={`p-4 rounded-xl border transition-all duration-300 ${
                            isHighlighted
                              ? "bg-indigo-950/35 border-indigo-500/80 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/25 scale-[1.01]"
                              : "bg-slate-950/20 border-slate-800/40 hover:bg-slate-950/40 hover:border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                              Anchor #{anchor.id}
                            </span>
                            <span className="text-2xs text-indigo-400 font-semibold uppercase tracking-wider">
                              Verified Evidence
                            </span>
                          </div>
                          <p className="font-serif italic text-white/95">
                            "{anchor.verbatim_text}"
                          </p>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-20 text-slate-600 italic">
                    <p className="text-sm">No evidence anchors mapped on this page</p>
                    <p className="text-2xs mt-1">Select another reader page or choose an indicator from the right pane</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Regulatory Auditor View */}
        <div className="w-1/2 h-full bg-slate-950/30 overflow-y-auto p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1 border-b border-slate-800/80 pb-4 flex-shrink-0">
            <h3 className="text-base font-bold text-white">Regulatory Mapping Auditor</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Symbolic Proposer matched indicator keywords. Neural Verifier dual-validated claims.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {Object.keys(anchorsByPillar).length === 0 ? (
              <div className="text-center py-24 text-slate-500 border border-slate-800/60 border-dashed rounded-2xl bg-slate-950/20">
                <svg className="w-8 h-8 mx-auto stroke-slate-700 mb-3" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01-2-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-semibold">No Regulatory Mappings Discovered</p>
                <p className="text-2xs text-slate-600 mt-1">This document did not trigger any RDTII sub-indicator rules.</p>
              </div>
            ) : (
              Object.entries(anchorsByPillar).map(([pillar, anchors]) => (
                <div key={pillar} className="flex flex-col gap-3">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest px-1">
                    {pillar}
                  </h4>
                  <div className="flex flex-col gap-3">
                    {anchors.map((anchor) => {
                      const isSelected = selectedAnchor?.id === anchor.id;
                      const confPercentage = Math.round(anchor.confidence * 100);
                      const indicatorSubtext = anchor.sub_indicator.split(" - ")[1] || anchor.sub_indicator;
                      
                      return (
                        <div
                          key={anchor.id}
                          onClick={() => handleAnchorClick(anchor)}
                          className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer flex flex-col gap-3 ${
                            isSelected
                              ? "bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                              : "bg-slate-950/45 border-slate-850 hover:bg-slate-900 hover:border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white truncate max-w-[70%]">
                              {indicatorSubtext}
                            </span>
                            
                            {/* Validation & Confidence Indicator */}
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                                Verified
                              </span>
                              <span className={`text-2xs font-mono font-bold px-1.5 py-0.5 rounded ${
                                confPercentage >= 90 
                                  ? "bg-indigo-500/15 text-indigo-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}>
                                {confPercentage}% Conf.
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-950/20 border border-slate-900/60 rounded-lg p-3 text-xs leading-relaxed text-slate-400">
                            <div className="font-mono text-2xs text-slate-500 uppercase tracking-widest mb-1">
                              Evidence Anchor (Page {anchor.page})
                            </div>
                            <p className="line-clamp-2 italic font-serif">
                              "{anchor.verbatim_text}"
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
