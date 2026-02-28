import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import JobQueue from './JobQueue';
import JobSubmitter from './JobSubmitter.tsx';
import FileUploader from './Uploader.tsx';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-baseline justify-between mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-blue-400">
            Render Farm Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-sm text-xs font-sm transition-colors"
            >
            + Upload Asset
            </button>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <p className="text-gray-400 text-sm font-medium">System Online</p>
          </div>
        </div>

        <FileUploader isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        
        {/* The Control Center */}
        <JobSubmitter />
        
        {/* The Live Data Table */}
        <JobQueue />
        
      </div>
    </div>
  )
}

export default App
