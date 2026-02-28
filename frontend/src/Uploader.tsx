import { useState } from 'react';

const Uploader = () => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setMessage(`Successfully uploaded: ${file.name}`);
      } else {
        setMessage('Upload failed.');
      }
    } catch (error) {
      setMessage('Error connecting to server.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
      <h2 className="text-xl font-semibold text-blue-300 mb-4">1. Upload Asset</h2>
      <div className="flex items-center gap-4">
        <input 
          type="file" 
          accept=".blend"
          onChange={handleUpload}
          className="block w-full text-xs text-gray-400 file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:font-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        />
        {uploading && <span className="animate-pulse text-blue-400">Uploading...</span>}
      </div>
      {message && <p className="mt-2 text-sm text-gray-400">{message}</p>}
    </div>
  );
};

export default Uploader;
