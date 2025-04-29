import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import SuccessState from "@/components/SuccessState";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { DatabaseType } from "@/lib/types";

interface ResultsPanelProps {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  queryResults: any;
  selectedDatabase: DatabaseType;
  onSuggestedPromptClick?: (prompt: string) => void;
  onRetry?: () => void;
}

export default function ResultsPanel({
  isLoading,
  hasError,
  errorMessage,
  queryResults,
  selectedDatabase,
  onSuggestedPromptClick,
  onRetry,
}: ResultsPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("results");

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The SQL query has been copied to your clipboard",
    });
  };
  
  // Force the Results tab when loading
  useEffect(() => {
    if (isLoading) {
      setActiveTab("results");
    }
  }, [isLoading]);

  return (
    <div className="lg:w-2/3 flex flex-col bg-gray-50 dark:bg-[#151521]">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full"
      >
        <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <TabsList className="bg-transparent p-0 h-auto border-b">
            <TabsTrigger
              value="results"
              className="px-1 py-4 border-b-2 data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 font-medium text-sm rounded-none"
            >
              Results
            </TabsTrigger>
            <TabsTrigger
              value="sql"
              disabled={isLoading}
              className={`px-1 py-4 border-b-2 data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 font-medium text-sm rounded-none ${isLoading ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              SQL Query
            </TabsTrigger>
            <TabsTrigger
              value="raw"
              disabled={isLoading}
              className={`px-1 py-4 border-b-2 data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400 data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-500 dark:data-[state=inactive]:text-gray-400 font-medium text-sm rounded-none ${isLoading ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              Raw Data
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-grow p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <TabsContent
              value="results"
              className="mt-0 border-none p-0 outline-none h-full"
            >
              {isLoading ? (
                <LoadingState selectedDatabase={selectedDatabase} />
              ) : hasError ? (
                <ErrorState message={errorMessage} onRetry={onRetry} />
              ) : queryResults ? (
                <SuccessState 
                  results={queryResults} 
                  onSuggestedPromptClick={onSuggestedPromptClick} 
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center space-y-4 max-w-md"
                  >
                    <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">
                      Ready to query your database
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Connect to your database and enter a natural language query to get started.
                    </p>
                  </motion.div>
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="sql"
              className="mt-0 border-none p-0 outline-none h-full"
            >
              {queryResults?.executedQueries ? (
                <div className="h-full bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden flex flex-col">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated SQL Query</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyToClipboard(queryResults.executedQueries.join(";\n\n"))}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  
                  <div className="flex-grow p-0 overflow-auto">
                    <div className="code-editor h-full p-4 font-mono text-sm text-gray-800 dark:text-gray-300">
                      <pre className="whitespace-pre-wrap">
                        {queryResults.executedQueries.join(";\n\n")}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center space-y-4 max-w-md"
                  >
                    <p className="text-gray-500 dark:text-gray-400">
                      Execute a query to see the generated SQL.
                    </p>
                  </motion.div>
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="raw"
              className="mt-0 border-none p-0 outline-none h-full"
            >
              {queryResults?.rawResults ? (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Raw Query Results</h3>
                  </div>
                  <div className="p-4 overflow-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-300 font-mono bg-gray-50 dark:bg-gray-900/30 p-4 rounded">
                      {JSON.stringify(queryResults.rawResults, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center space-y-4 max-w-md"
                  >
                    <p className="text-gray-500 dark:text-gray-400">
                      Execute a query to see the raw data results.
                    </p>
                  </motion.div>
                </div>
              )}
            </TabsContent>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}
