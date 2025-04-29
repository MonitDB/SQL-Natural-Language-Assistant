import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ConnectionForm from "@/components/ConnectionForm";
import ResultsPanel from "@/components/ResultsPanel";
import { DatabaseType } from "@/lib/types";

export default function Home() {
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType>("oracle");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  
  // Handler for when a suggested follow-up question is clicked
  const handleSuggestedPromptClick = (prompt: string) => {
    setCurrentPrompt(prompt);
  };
  
  // Handler for the "Try Again" button in error state
  const handleRetry = () => {
    setHasError(false);
    setErrorMessage("");
    setQueryResults(null);
  };
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow flex flex-col lg:flex-row">
        <ConnectionForm 
          selectedDatabase={selectedDatabase}
          setSelectedDatabase={setSelectedDatabase}
          isConnected={isConnected}
          setIsConnected={setIsConnected}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          setHasError={setHasError}
          setErrorMessage={setErrorMessage}
          setQueryResults={setQueryResults}
          currentPrompt={currentPrompt}
        />
        
        <ResultsPanel 
          isLoading={isLoading}
          hasError={hasError}
          errorMessage={errorMessage}
          queryResults={queryResults}
          selectedDatabase={selectedDatabase}
          onSuggestedPromptClick={handleSuggestedPromptClick}
          onRetry={handleRetry}
        />
      </main>
      
      <Footer />
    </div>
  );
}
