"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface DocumentItem {
  id: string;
  filename: string;
  file_path: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8085";

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all documents from Go API
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setError("Unable to connect to Go API Gateway. Make sure it is running on port 8080.");
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll for document status updates if any document is processing or pending
  useEffect(() => {
    const hasActiveTasks = documents.some(
      (doc) => doc.status === "PENDING" || doc.status === "PROCESSING"
    );

    if (hasActiveTasks) {
      const interval = setInterval(fetchDocuments, 2000);
      return () => clearInterval(interval);
    }
  }, [documents]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      await fetchDocuments();
    } catch (err) {
      console.error(err);
      setError("Failed to upload document. Please ensure the API is running.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
      {/* Overview Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 p-8 border border-slate-800/80 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">
            Pillars 5, 6, 7, 8, & 9 Target
          </span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">
            Digital Trade Regulatory Discovery
          </h2>
          <p className="text-slate-400 leading-relaxed text-sm">
            ReguLens extracts and maps domestic regulatory evidence from legal sources (HTML/PDF) 
            to specific UNESCAP RDTII sub-indicators. Driven by a deterministic Neuro-Symbolic 
            architecture, every mapping claim is grounded to a verifiable verbatim Evidence Anchor.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm font-mono flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          {error}
        </div>
      )}

      {/* Grid: Upload & Document Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Upload Zone */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">
            Ingest Document
          </h3>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-all min-h-[300px] cursor-pointer bg-slate-950/20 ${
              dragActive
                ? "border-indigo-500 bg-indigo-950/10 shadow-lg shadow-indigo-500/5"
                : "border-slate-800 hover:border-slate-700 hover:bg-slate-950/30"
            }`}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.html,.htm"
              onChange={handleFileChange}
            />
            
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4 border border-slate-700/50">
              {isUploading ? (
                <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
            </div>

            <p className="text-white font-medium text-sm mb-1">
              {isUploading ? "Uploading file..." : "Drag & drop file here"}
            </p>
            <p className="text-slate-500 text-xs mb-6">
              Supports legal PDFs or HTML documents
            </p>
            <button
              disabled={isUploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg shadow-lg shadow-indigo-600/10 transition-colors disabled:opacity-50"
            >
              Choose File
            </button>
          </div>
        </div>

        {/* Right: Document Queue */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">
            Analysis Queue & History
          </h3>
          <div className="border border-slate-800/80 rounded-2xl bg-slate-950/40 backdrop-blur-sm overflow-hidden shadow-xl">
            {documents.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <svg className="w-8 h-8 mx-auto stroke-slate-600 mb-3" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4M2 17h20" />
                </svg>
                <p className="text-sm">No documents in the system queue</p>
                <p className="text-xs text-slate-600 mt-1">Upload a legal text to begin analysis</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-xs font-mono">
                      <th className="p-4 font-semibold">Document Name</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Uploaded</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4 font-medium text-white max-w-[240px] truncate">
                          {doc.filename}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
                              doc.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : doc.status === "PROCESSING"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : doc.status === "FAILED"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                doc.status === "COMPLETED"
                                  ? "bg-emerald-400"
                                  : doc.status === "PROCESSING"
                                  ? "bg-amber-400 animate-pulse"
                                  : doc.status === "FAILED"
                                  ? "bg-rose-400"
                                  : "bg-slate-400"
                              }`}
                            ></span>
                            {doc.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 font-mono">
                          {new Date(doc.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          {doc.status === "COMPLETED" ? (
                            <Link
                              href={`/viewer/${doc.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-transparent rounded-lg font-medium text-xs transition-all"
                            >
                              Open Viewer
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-600 font-mono italic">
                              {doc.status === "PROCESSING" ? "Analyzing..." : "Awaiting processing"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
