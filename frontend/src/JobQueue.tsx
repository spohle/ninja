import { useEffect, useState } from 'react';
import RenderGalleryModal from './RenderGalleryModal';

interface Job {
  job_id: string;
  status: string;
  scene: string;
  frames: string;
  started_at: string | null;
  ended_at: string | null;
  rendered_frames: number; // <-- New field
}

export default function JobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScene, setSelectedScene] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [jobToLog, setJobToLog] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost:8000/jobs/');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch jobs: ", err);
      setError("Failed to connect to the RenderFarm API");
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getDuration = (start: string | null, end: string | null, status: string) => {
    if (!start) return null;
    let endTimeMs = end ? new Date(end).getTime() : null;
    if (status === 'started' && !endTimeMs) endTimeMs = currentTime;
    if (!endTimeMs) return null;

    const diff = Math.max(0, endTimeMs - new Date(start).getTime());
    const seconds = Math.floor(diff / 1000);
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // NEW: Calculate the total number of frames requested based on "start-end"
  const getTotalFrames = (framesStr: string) => {
    if (!framesStr || !framesStr.includes('-')) return 0;
    const [start, end] = framesStr.split('-').map(Number);
    return Math.max(0, (end - start) + 1);
  };

  const openGallery = (sceneName: string, jobId: string) => {
    setSelectedScene(sceneName);
    setSelectedJobId(jobId);
    setIsModalOpen(true);
  };

  const deleteJob = async(jobId: string) => {
    try{
      const response = await fetch(`http://localhost:8000/jobs/${jobId}`, {method: 'DELETE'});
      if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        fetchJobs();
      } catch (err) {
        console.error("Failed to delete job: ", err);
      }
    };

  const handleUpload = async(file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("http://localhost:8000/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("File uploaded to cluster: ", data.path);
  };

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-300 mb-4">Active Queue</h2>
      
      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="bg-gray-800 rounded-sm overflow-hidden border border-gray-700 shadow-lg">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="px-4 py-3">Scene File</th>
              <th className="px-4 py-3 w-40">Frames</th> {/* Gave Frames a fixed width so the progress bar looks good */}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Finished</th>
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No jobs in the queue.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const totalFrames = getTotalFrames(job.frames);
                // Calculate percentage (cap at 100 just in case)
                const percentDone = totalFrames > 0 
                  ? Math.min(100, Math.round((job.rendered_frames / totalFrames) * 100)) 
                  : 0;

                return (
                  <tr key={job.job_id} className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => openGallery(job.scene, job.job_id)}
                        className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-400/30 hover:decoration-blue-300 transition-all text-left"
                        title="Click to view rendered frames"
                      >
                        {job.scene}
                      </button>
                    </td>
                    
                    {/* NEW: Progress Bar Integration */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-gray-300">{job.frames}</span>
                        
                        {/* Only show progress if started or finished */}
                        {(job.status === 'started' || job.status === 'finished') && totalFrames > 0 && (
                          <div className="w-full">
                            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden border border-gray-700">
                              <div 
                                className={`h-full transition-all duration-500 ease-out rounded-full 
                                  ${job.status === 'finished' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${percentDone}%` }}
                              ></div>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                              <span>{job.rendered_frames} / {totalFrames} frames</span>
                              <span>{percentDone}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider
                        ${job.status === 'finished' ? 'bg-green-900/50 text-green-400 border border-green-800' : ''}
                        ${job.status === 'failed' ? 'bg-red-900/50 text-red-400 border border-red-800' : ''}
                        ${job.status === 'started' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' : ''}
                        ${job.status === 'queued' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : ''}
                      `}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatTime(job.started_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {job.status === 'finished' ? (
                        <div className="flex flex-col">
                          <span className="text-gray-300">{formatTime(job.ended_at)}</span>
                          <span className="text-gray-500 text-[10px]">
                            Took: {getDuration(job.started_at, job.ended_at, job.status)}
                          </span>
                        </div>
                      ) : job.status === 'started' ? (
                        <div className="flex flex-col">
                          <span className="text-blue-400/80 animate-pulse">Rendering...</span>
                          <span className="text-blue-400 text-[10px]">
                            Elapsed: {getDuration(job.started_at, null, job.status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500">
                      {job.job_id.split('-')[0]}...
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setJobToLog(job.job_id)}
                        className="px-2 py-1 text-xs text-sky-400 bg-sky-900/30 hover:bg-sky-900/50 rounded border border-sky-800/50 transition-colors"
                      >
                      Logs
                      </button>
                      <button
                        onClick={() => setJobToDelete(job.job_id)}
                        className="px-2 py-1 text-xs text-red-400 bg-red-900/30 hover:bg-red-900/50 rounded border border-red-800/50 transition-colors"
                      >
                      Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RenderGalleryModal 
        sceneName={selectedScene} 
        jobId={selectedJobId}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* --- Delete Confirmation Modal --- */}
      {jobToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-red-900/50 rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
            
            <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Confirm Deletion
            </h3>
            
            <p className="text-gray-300 text-sm">
              Are you sure you want to delete this job? This will permanently wipe all rendered frames from the hard drive.
              <br/><br/>
              <span className="font-mono text-xs text-gray-500 break-all">{jobToDelete}</span>
            </p>
            
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm font-medium transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  deleteJob(jobToDelete);
                  setJobToDelete(null); // Close the modal after firing the delete!
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
              >
                Yes, Delete It
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
