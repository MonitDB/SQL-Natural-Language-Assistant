import { Database } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-gray-900 shadow-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              {/* MONITX Logo with Database Icon replacing the O */}
              <div className="flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-white">M</span>
                <div className="relative mx-0.5 inline-flex items-center justify-center">
                  <Database className="h-7 w-7 text-[#5B51F9]" strokeWidth={2} />
                </div>
                <span className="text-3xl font-extrabold tracking-tight text-white">NIT</span>
                <span className="text-3xl font-extrabold tracking-tight text-[#5B51F9]">X</span>
              </div>
              <div className="ml-2 flex flex-col -mt-1">
                <span className="text-xs text-gray-400 font-medium tracking-wide">
                  AI Assistant
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <p className="text-sm text-gray-400">
              AI-powered database querying assistant
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
