import { useState, useEffect } from 'react';

interface AssetListProps {
  refreshTrigger: number;
}

const ProjectList = ({ refreshTrigger, onSuccess }: AssetListProps) => {
  // Store as an array of [filename, timestamp] pairs
  const [projects, setProjects] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/projects');
      const data = await res.json();
      
      // Convert the Python dictionary into a sorted array of entries
      // This ensures the newest files appear at the top
      const projectsEntries = Object.entries(data.projects || {}) as [string, string][];
      
      setProjects(projectsEntries);
    } catch (error) {
      console.error("Failed to fetch projects from farm:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (name: string) => {
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      const res = await fetch(`http://localhost:8000/projects/${name}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error("Delete failed: ", error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [refreshTrigger]);

  return (
    <div className="bg-gray-800 p-5 rounded-sm border border-gray-700 h-fit sticky top-4 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Project Library
        </h3>
        {loading && (
          <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        )}
      </div>
      
      <div className="flex flex-col gap-2 max-h-[75vh] overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
        {projects.length > 0 ? (
          projects.map(([name, mod]) => {
            // Create a display-friendly version of the name
            const displayName = name.replace('.zip', '');

            return (
              <div 
                key={name} 
                className="flex flex-col w-full p-3 bg-gray-900/40 hover:bg-gray-700/60 rounded-lg border border-transparent hover:border-blue-500/30 group transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Display the cleaned name, but keep full name in title for hover */}
                  <span className="text-sm text-gray-200 truncate font-mono font-medium" title={name}>
                    {displayName}
                  </span>

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(displayName); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity p-1" 
                    title="Delete Project"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:bg-blue-400 group-hover:scale-125 transition-all shadow-[0_0_6px_rgba(59,130,246,0.4)]"></div>
                </div>
                
                <span className="text-[10px] text-gray-500 mt-1 font-medium">
                  {new Date(mod).toLocaleString([], { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-xs italic">No projects found</p>
            <p className="text-gray-600 text-[10px] mt-1">Upload an project to start</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProjectList;
