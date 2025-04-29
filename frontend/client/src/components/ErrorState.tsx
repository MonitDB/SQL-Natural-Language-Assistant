import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  // Extract error type from message for more specific troubleshooting tips
  const isConnectionError = message.toLowerCase().includes("connect");
  const isCredentialError = message.toLowerCase().includes("credential") || 
                           message.toLowerCase().includes("auth") || 
                           message.toLowerCase().includes("password");
  const isTimeoutError = message.toLowerCase().includes("timeout");
  const isPermissionError = message.toLowerCase().includes("permission") || 
                           message.toLowerCase().includes("privilege");
  
  // Parse error details from message
  const errorDetails = message.match(/ORA-\d+:|Error:|Connection error:|SQL Error:/i);
  const errorCode = errorDetails ? errorDetails[0] : null;
  const errorMessage = errorCode ? message.replace(errorCode, "").trim() : message;
  
  // Generate appropriate troubleshooting tips based on error type
  const troubleshootingTips = () => {
    if (isConnectionError) {
      return [
        "Verify that the database server is running",
        "Check if the connection string format is correct",
        "Ensure firewalls aren't blocking the connection"
      ];
    } else if (isCredentialError) {
      return [
        "Double-check your username and password",
        "Ensure the user account is not locked",
        "Verify the user has database access privileges"
      ];
    } else if (isTimeoutError) {
      return [
        "The query might be too complex or returning too much data",
        "Check for network connectivity issues",
        "Try again with a more specific query"
      ];
    } else if (isPermissionError) {
      return [
        "The user may lack necessary permissions",
        "Request elevated privileges from your database administrator",
        "Try specifying a schema you have access to"
      ];
    } else {
      return [
        "Verify database connection parameters",
        "Check if the query is correctly formatted",
        "Ensure the database schema contains the requested information"
      ];
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <motion.div 
        className="max-w-md w-full bg-white dark:bg-[#1e1e2d] shadow-lg rounded-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                {isConnectionError ? "Connection Error" : "Query Error"}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            {isConnectionError 
              ? "Unable to connect to the database server. Please check your connection settings and try again."
              : "An error occurred while executing your query."
            }
          </p>
          
          <div className="rounded-md bg-gray-50 dark:bg-gray-900/30 p-4 font-mono text-xs overflow-auto max-h-48 text-gray-800 dark:text-gray-300">
            <pre>
              {errorCode && <span className="text-red-500 font-bold">{errorCode}</span>}
              {errorMessage}
            </pre>
          </div>
          
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/10 p-4 border border-yellow-100 dark:border-yellow-900/20">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Troubleshooting Tips</h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-200">
                  <ul className="list-disc pl-5 space-y-1">
                    {troubleshootingTips().map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          {onRetry && (
            <Button onClick={onRetry}>
              Try Again
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
