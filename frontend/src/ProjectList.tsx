import { useState, useEffect } from 'react';

interface AssetListProps {
  refreshTrigger: number;
  onSuccess: () => void;
}

// Interface for the new shot data structure
interface Shot {
  name: string;
  lastMod: string;
  renderCount: number;
}

const ProjectList = ({ refreshTrigger, onSuccess }: AssetListProps) => {
  const [projects, setProjects] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(false);
  
  // Track which projects are expanded and store their fetched shots
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [projectShots, setProjectShots] = useState<Record<string, Shot[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/projects');
      const data = await res.json();
      const projectsEntries = Object.entries(data.projects || {}) as [string, string][];
      setProjects(projectsEntries);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Logic to toggle and lazy-load shots
  const toggleProject = async (name: string) => {
    const displayName = name.replace('.zip', '');
    const isExpanding = !expandedProjects[name];
    
    setExpandedProjects(prev => ({ ...prev, [name]: isExpanding }));

    // Only fetch if expanding and data isn't already cached
    if (isExpanding && !projectShots[name]) {
      try {
        const res = await fetch(`http://localhost:8000/projects/${displayName}/shots`);
        const data = await res.json();
        // Mapping your [filename, date, count] API response
        const shots = data.map(([filename, date, count, frames]: any) => ({
          name: filename,
          lastMod: date,
          renderCount: count,
          renderFrames: frames
        }));
        setProjectShots(prev => ({ ...prev, [name]: shots }));
      } catch (err) {
        console.error("Failed to fetch shots:", err);
      }
    }
  };

  const submitQuickRender = async (projectName: string, shotName: string, renderFrames: map) => {
    const shotId = `${projectName}-${shotName}`;
    setIsSubmitting(shotId);
      const res = await fetch('http://localhost:8000/jobs/submit', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectName.replace('.zip', ''),
          scene_file: shotName,
          start_frame: renderFrames.start,
          end_frame: renderFrames.end,
        }),
      });
    try {
    } catch (error) {
      console.error("Quick submission failed: ", error);
    } finally {
      setIsSubmitting(null);
    }
  };

  const deleteProject = async (name: string) => {
    const displayName = name.replace('.zip', '');
    if (!window.confirm(`Delete ${displayName}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/projects/${displayName}`, { method: 'DELETE' });
      if (res.ok) onSuccess();
    } catch (error) {
      console.error("Delete failed: ", error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [refreshTrigger]);

  return (
    <div className="bg-gray-800 p-5 rounded-sm border border-gray-700 w-full h-fit sticky top-4 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Project Library</h3>
        {loading && <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>}
      </div>
      
      <div className="flex flex-col gap-2 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {projects.length > 0 ? (
          projects.map(([name, mod]) => (
            <div key={name} className="flex flex-col w-full bg-gray-900/40 rounded-lg border border-gray-700/50 overflow-hidden">
              
              {/* Project Header */}
              <div 
                onClick={() => toggleProject(name)}
                className="flex items-center justify-between p-3 hover:bg-gray-700/40 cursor-pointer group transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] text-blue-500 transition-transform duration-200 ${expandedProjects[name] ? 'rotate-90' : ''}`}>▶</span>
                  <span className="text-sm text-gray-200 font-mono font-medium truncate max-w-[120px]">{name.replace('.zip', '')}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); deleteProject(name); }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]"></div>
                </div>
              </div>

              {/* Shot List with Quick Render Button */}
              {expandedProjects[name] && (
                <div className="bg-black/20 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-200">
                  {projectShots[name] ? (
                    <div className="py-1">
                      {projectShots[name].map((shot) => {
                        const shotId = `${name}-${shot.name}`;
                        return (
                          <div key={shot.name} className="flex items-center justify-between px-8 py-2 hover:bg-gray-700/20 border-b border-gray-800/30 last:border-0 group/shot">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-gray-400 font-mono">{shot.name.replace('.blend', '')}</span>
                              <span className="text-[9px] text-gray-600">{new Date(shot.lastMod).toLocaleDateString()}</span>
                              <span className="text-[9px] text-yellow-500">Frames: {shot.renderFrames.start}-{shot.renderFrames.end}</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded border border-gray-700">{shot.renderCount}R</span>
                              
                              <button
                                onClick={(e) => { e.stopPropagation(); submitQuickRender(name, shot.name, shot.renderFrames); }}
                                disabled={isSubmitting === shotId}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter transition-all
                                  ${isSubmitting === shotId 
                                    ? 'bg-gray-700 text-gray-500' 
                                    : 'bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-400 hover:text-white'}`}
                              >
                                {isSubmitting === shotId ? '...' : 'Render'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-8 py-3 text-[10px] text-gray-600 italic">Scanning project...</div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-xs italic">No projects found</p>
          </div>
        )}
      </div>
    </div>
  );

};

export default ProjectList;
