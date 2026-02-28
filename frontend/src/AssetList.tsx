import { useState, useEffect } from 'react';

interface AssetListProps {
  refreshTrigger: number;
}

const AssetList = ({ refreshTrigger }: AssetListProps) => {
  // Store as an array of [filename, timestamp] pairs
  const [assets, setAssets] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/assets');
      const data = await res.json();
      
      // Convert the Python dictionary into a sorted array of entries
      // This ensures the newest files appear at the top
      const assetEntries = Object.entries(data.assets || {}) as [string, string][];
      
      setAssets(assetEntries);
    } catch (error) {
      console.error("Failed to fetch assets from Glendale farm:", error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [refreshTrigger]);

  return (
    <div className="bg-gray-800 p-5 rounded-sm border border-gray-700 h-fit sticky top-4 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Asset Library
        </h3>
        {loading && (
          <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        )}
      </div>
      
      <div className="flex flex-col gap-2 max-h-[75vh] overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
        {assets.length > 0 ? (
          assets.map(([name, mod]) => {
            // Create a display-friendly version of the name
            const displayName = name.replace('.blend', '');

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
            <p className="text-gray-500 text-xs italic">No .blend files found</p>
            <p className="text-gray-600 text-[10px] mt-1">Upload an asset to start</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default AssetList;
