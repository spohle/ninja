import { useEffect, useState, useCallback, useRef } from 'react';

interface RenderGalleryModalProps {
  sceneName: string;
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function RenderGalleryModal({ sceneName, jobId, isOpen, onClose }: RenderGalleryModalProps) {
  const [frames, setFrames] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>(''); 
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // --- Log Viewer State ---
  const [viewMode, setViewMode] = useState<'gallery' | 'log'>('gallery');
  const [logText, setLogText] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null); 

  const fetchFrames = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    
    try {
      const response = await fetch(`http://localhost:8000/renders/${sceneName}/${jobId}`);
      const data = await response.json();
      setFrames(data.frames || []);
      setFolderName(data.folder || ''); 
      setMessage(data.message || '');
    } catch (error) {
      console.error("Failed to fetch frames:", error);
      setMessage("Failed to connect to the Render Farm.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLog = async () => {
    try {
      const response = await fetch(`http://localhost:8000/renders/${sceneName}/${jobId}/log`);
      const data = await response.json();
      setLogText(data.log || '');
    } catch (error) {
      console.error("Failed to fetch log:", error);
    }
  };

  useEffect(() => {
    if (!isOpen || !sceneName || !jobId) return;

    fetchFrames(false);
    fetchLog(); // Fetch immediately on open
    
    const interval = setInterval(() => {
      fetchFrames(true);
      fetchLog(); // Fetch every 1 second
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, sceneName, jobId]);

  // Auto-scroll the terminal to the bottom when new text arrives
  useEffect(() => {
    if (viewMode === 'log' && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [logText, viewMode]);

  // Reset to gallery view when modal closes/opens
  useEffect(() => {
    if (isOpen) setViewMode('gallery');
  }, [isOpen]);

  const goToNext = useCallback(() => {
    if (frames.length > 0 && selectedIndex !== null) {
      setSelectedIndex((prev) => (prev! + 1) % frames.length);
    }
  }, [frames.length, selectedIndex]);

  const goToPrev = useCallback(() => {
    if (frames.length > 0 && selectedIndex !== null) {
      setSelectedIndex((prev) => (prev! - 1 + frames.length) % frames.length);
    }
  }, [frames.length, selectedIndex]);

  const closeLightbox = () => setSelectedIndex(null);

  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'Escape') closeLightbox();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, goToNext, goToPrev]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGalleryKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIndex === null) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleGalleryKeyDown);
    return () => window.removeEventListener('keydown', handleGalleryKeyDown);
  }, [isOpen, selectedIndex, onClose]);

  useEffect(() => {
    if (!isOpen) setSelectedIndex(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* --- Main Gallery Modal --- */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900">
            <div>
              <h3 className="text-xl font-bold text-gray-200 flex items-baseline gap-3">
                Render Job: <span className="text-blue-400">{sceneName.replace('.blend', '')}</span>
                {folderName && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-1 rounded border border-gray-700 select-all transition-colors hover:text-gray-300">
                    /{folderName}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {viewMode === 'gallery' ? `${frames.length} frames completed` : 'Live Console Output'}
                <span className="inline-block ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live Syncing"></span>
              </p>
            </div>
            
            <div className="flex gap-4 items-center">
              {/* --- View Mode Toggle --- */}
              <div className="flex bg-gray-950 p-1 rounded border border-gray-800">
                <button
                  onClick={() => setViewMode('gallery')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === 'gallery' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Gallery
                </button>
                <button
                  onClick={() => setViewMode('log')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === 'log' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Console Log
                </button>
              </div>

              <div className="h-6 w-px bg-gray-700"></div>

              <button 
                onClick={onClose}
                className="px-4 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm font-medium transition-colors border border-red-800/50"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-950 flex flex-col">
            {/* --- Conditional Rendering: Gallery OR Terminal --- */}
            {viewMode === 'gallery' ? (
              isLoading ? (
                <div className="flex flex-1 items-center justify-center text-gray-500">Loading frames...</div>
              ) : frames.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-gray-500">{message || "No frames rendered yet."}</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {frames.map((url, index) => {
                    const filename = url.split('/').pop();
                    return (
                      <div 
                        key={index} 
                        className="flex flex-col gap-2 group animate-in fade-in duration-300 cursor-pointer"
                        onClick={() => setSelectedIndex(index)}
                      >
                        <div className="relative aspect-video bg-gray-800 rounded overflow-hidden border border-gray-700 group-hover:border-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all">
                          <img 
                            src={url} 
                            alt={filename} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-xs text-center text-gray-500 font-mono group-hover:text-blue-400 transition-colors">
                          {filename}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* --- Hacker Terminal UI --- */
              <div className="flex-1 w-full bg-black rounded border border-gray-800 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-sky-400 shadow-inner">
                <pre className="whitespace-pre-wrap break-all m-0 font-mono">
                  {logText || "Waiting for log data..."}
                </pre>
                {/* This empty div is our anchor for auto-scrolling! */}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Fullscreen Lightbox Overlay --- */}
      {selectedIndex !== null && frames[selectedIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          
          <div className="absolute top-0 inset-x-0 p-4 flex justify-end items-center bg-gradient-to-b from-black/80 to-transparent z-20">
            <button 
              onClick={closeLightbox}
              className="text-gray-400 hover:text-white p-2 rounded transition-colors bg-black/20 hover:bg-black/40 border border-transparent hover:border-gray-700"
              title="Close (Escape)"
            >
              ✕ Close
            </button>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            className="absolute left-0 inset-y-0 w-1/6 flex items-center justify-start pl-8 group z-20 focus:outline-none"
            title="Previous Frame (Left Arrow)"
          >
            <div className="p-3 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700 backdrop-blur-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </div>
          </button>

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8 pointer-events-none">
            <img 
              key={frames[selectedIndex]} 
              src={frames[selectedIndex]} 
              alt="Full size render" 
              className="max-w-full max-h-[85vh] object-contain drop-shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()} 
            />
            <div className="mt-6 bg-gray-900/80 backdrop-blur-md border border-gray-700 px-5 py-2 rounded shadow-lg pointer-events-auto flex items-center gap-3">
               <span className="text-gray-200 font-mono text-xs tracking-wide">
                 {frames[selectedIndex].split('/').pop()}
               </span>
               <span className="text-gray-500 text-xs font-mono">
                 ({selectedIndex + 1} / {frames.length})
               </span>
            </div>
          </div>

          <button 
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-0 inset-y-0 w-1/6 flex items-center justify-end pr-8 group z-20 focus:outline-none"
            title="Next Frame (Right Arrow)"
          >
            <div className="p-3 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity border border-gray-700 backdrop-blur-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </button>
          
        </div>
      )}
    </>
  );
}
