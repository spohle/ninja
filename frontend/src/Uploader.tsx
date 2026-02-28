import { useState } from 'react';

interface FileUploaderProps {
  isOpen: boolean;
  onClose: () => void;
}

const FileUploader = ({ isOpen, onClose }: FileUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  // The missing function logic
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus('Uploading to farm...');

    const formData = new FormData();
    formData.append('file', file); // 'file' must match the Python arg name

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatus(`Success! ${file.name} is ready for rendering.`);
        // Optional: Close modal automatically after 2 seconds
        setTimeout(onClose, 2000);
      } else {
        setStatus('Upload failed. Check API logs.');
      }
    } catch (error) {
      setStatus('Network error: Is the API pod running?');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />

      <div className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-blue-400">Upload Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="space-y-4">
          <input 
            type="file" 
            accept=".blend"
            onChange={handleUpload} // Now properly connected
            disabled={uploading}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
          />
          
          {status && (
            <p className={`text-sm font-medium ${status.includes('Success') ? 'text-green-400' : 'text-blue-300'}`}>
              {status}
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
