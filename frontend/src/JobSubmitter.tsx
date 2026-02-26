import { useState } from 'react';

// 1. Updated Interface to allow empty strings while typing
interface JobFormRow {
  id: string;
  sceneFile: string;
  startFrame: number | '';
  endFrame: number | '';
}

export default function JobSubmitter() {
  const [rows, setRows] = useState<JobFormRow[]>([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        sceneFile: '',
        startFrame: 1,
        endFrame: 12,
      }
    ]);
  };

  const removeRow = (idToRemove: string) => {
    setRows(rows.filter((row) => row.id !== idToRemove));
  };

  const updateRow = (idToUpdate: string, field: keyof JobFormRow, value: string | number) => {
    setRows(
      rows.map((row) => 
        row.id === idToUpdate ? { ...row, [field]: value } : row
      )
    );
  };

  // 2. The Real-Time Validation Engine
  const isFormValid = rows.length > 0 && rows.every(row => {
    // Check 1: Scene name is not empty
    if (!row.sceneFile.trim()) return false;
    // Check 2: Frames are not empty
    if (row.startFrame === '' || row.endFrame === '') return false;
    // Check 3: End frame is not less than start frame
    if (row.endFrame < row.startFrame) return false;
    
    return true; // Row passes all tests
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return; // Extra safety catch
    
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const fetchPromises = rows.map((row) => 
        fetch('http://localhost:8000/jobs/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scene_file: `${row.sceneFile}.blend`,
            start_frame: row.startFrame,
            end_frame: row.endFrame,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
      );

      await Promise.all(fetchPromises);

      setStatus({ type: 'success', message: `${rows.length} job(s) successfully submitted to the farm!` });
      setRows([]); 
    } catch (error) {
      console.error("failed to submit jobs: ", error);
      setStatus({ type: 'error', message: 'Failed to submit one or more jobs. Is the API container up and running?' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-300">Dispatch Render Jobs</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {rows.map((row, index) => (
          <div key={row.id} className="flex flex-wrap items-end gap-2 p-3 bg-gray-900/50 rounded-md border border-gray-700/50">
            
            <div className="flex-1 min-w-[200px]">
              {index === 0 && (
                <label className="block text-sm font-medium text-gray-400 mb-1">Scene File Name</label>
              )}
              
              <div 
                className={`flex items-center w-full bg-gray-900 border rounded px-4 py-1 transition-colors cursor-text overflow-hidden h-[34px]
                  ${!row.sceneFile.trim() ? 'border-red-500/50 focus-within:border-red-500' : 'border-gray-600 focus-within:border-blue-500'}`}
                onClick={() => document.getElementById(`scene-input-${row.id}`)?.focus()}
              >
                <div className="relative flex items-center">
                  <span className="invisible whitespace-pre text-sm" aria-hidden="true">
                    {row.sceneFile || ''}
                  </span>
                  <input
                    id={`scene-input-${row.id}`}
                    type="text"
                    value={row.sceneFile}
                    onChange={(e) => {
                      const cleanName = e.target.value.replace(/\.blend$/i, '');
                      updateRow(row.id, 'sceneFile', cleanName);
                    }}
                    required
                    className="text-sm absolute inset-y-0 left-0 w-full bg-transparent text-white focus:outline-none placeholder-gray-500"
                    placeholder="sequence_01"
                  />
                </div>
                <span className="text-gray-500 select-none pointer-events-none text-sm">
                  .blend
                </span>
              </div>
            </div>

            <div className="w-24">
              {index === 0 && (
                <label className="block text-sm font-medium text-gray-400 mb-1">Start Frame</label>
              )}
              <input
                type="number"
                value={row.startFrame}
                onChange={(e) => updateRow(row.id, 'startFrame', e.target.value === '' ? '' : parseInt(e.target.value))}
                required
                min="1"
                className={`text-sm h-[34px] w-full bg-gray-900 border rounded px-2 py-1 text-white focus:outline-none
                  ${(row.startFrame === '' || (typeof row.startFrame === 'number' && typeof row.endFrame === 'number' && row.endFrame < row.startFrame)) 
                    ? 'border-red-500/50 focus:border-red-500' 
                    : 'border-gray-600 focus:border-blue-500'}`}
              />
            </div>

            <div className="w-24">
              {index === 0 && (
                <label className="block text-sm font-medium text-gray-400 mb-1">End Frame</label>
              )}
              <input
                type="number"
                value={row.endFrame}
                onChange={(e) => updateRow(row.id, 'endFrame', e.target.value === '' ? '' : parseInt(e.target.value))}
                required
                min="1"
                className={`text-sm h-[34px] w-full bg-gray-900 border rounded px-2 py-1 text-white focus:outline-none
                  ${(row.endFrame === '' || (typeof row.startFrame === 'number' && typeof row.endFrame === 'number' && row.endFrame < row.startFrame)) 
                    ? 'border-red-500/50 focus:border-red-500' 
                    : 'border-gray-600 focus:border-blue-500'}`}
              />
            </div>

            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="h-[34px] px-3 bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-800/50 rounded flex items-center justify-center transition-colors"
              title="Remove row"
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex justify-between items-center mt-2 border-t border-gray-700/50 pt-4">
          <button
            type="button"
            onClick={addRow}
            className="px-4 py-1.5 rounded text-sm font-semibold text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800/50 transition-colors flex items-center gap-2"
          >
            <span>+</span> Add Job
          </button>

          {/* 3. Button Disabled Logic Updated */}
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className={`px-8 py-1 rounded font-semibold text-white transition-colors duration-200 h-[30px]
              ${(isSubmitting || !isFormValid)
                ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                : 'bg-slate-600 hover:bg-sky-500'}`}
          >
            {isSubmitting ? 'Sending...' : `Submit ${rows.length > 0 ? rows.length : ''} to Queue`}
          </button>
        </div>
      </form>

      {status.message && (
        <div className={`mt-4 p-3 rounded text-sm font-medium
          ${status.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' : ''}
          ${status.type === 'error' ? 'bg-red-900/50 text-red-300 border border-red-800' : ''}
        `}>
          {status.message}
        </div>
      )}
    </div>
  );
}
