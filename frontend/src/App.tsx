import { useState } from 'react'

import './App.css'

import JobQueue from './JobQueue';
import FileUploader from './Uploader.tsx';
import ProjectList from './ProjectList.tsx';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshCounter(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header stays full width */}
        <header className="flex items-baseline justify-between mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">Render-Blender</h1>
        </header>

        {/* Main Layout Grid */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Content: Now on the Left (takes 3/4 width) */}
          <main className="lg:w-3/4 w-full flex flex-col gap-8 order-1">
            <JobQueue />
          </main>

          {/* Sidebar: Now on the Right (takes 1/4 width) */}
          <aside className="lg:w-1/4 w-full order-2">
            <div className="flex flex-col items-center space-y-6 w-full">
              <div className="w-full">
                <ProjectList refreshTrigger={refreshCounter} onSuccess={handleUploadSuccess} />
              </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-rose-400 hover:bg-blue-500 px-4 py-1 rounded-lg font-xs transition-colors w-full"
              >
                Upload Project
              </button>
            </div>
          </aside>

        </div>

        <FileUploader 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleUploadSuccess} 
        />
      </div>
    </div>
  );
}

export default App
