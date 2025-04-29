import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DatabaseType } from "@/lib/types";
import { Sparkles, Zap, Database, Code, BarChart4 } from "lucide-react";

interface LoadingStateProps {
  selectedDatabase: DatabaseType;
}

export default function LoadingState({ selectedDatabase }: LoadingStateProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { label: "Connected to database", icon: Database },
    { label: "Analyzing schema structure", icon: Code },
    { label: "Translating natural language to SQL", icon: Sparkles },
    { label: "Executing query", icon: Zap },
    { label: "Formatting results", icon: BarChart4 }
  ];

  useEffect(() => {
    // Total animation time: 20 seconds
    const TOTAL_DURATION = 20000;
    const INTERVAL = 100; // Update every 100ms
    const STEPS_TIME = [0, 15, 40, 65, 90]; // Percentage of total time for each step
    
    const startTime = Date.now();
    
    // Simulate progress over 20 seconds
    const interval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const percentage = Math.min(100, (elapsedTime / TOTAL_DURATION) * 100);
      
      setProgress(percentage);
      
      // Update current step based on percentage
      if (percentage >= STEPS_TIME[4]) {
        setCurrentStep(4);
      } else if (percentage >= STEPS_TIME[3]) {
        setCurrentStep(3);
      } else if (percentage >= STEPS_TIME[2]) {
        setCurrentStep(2);
      } else if (percentage >= STEPS_TIME[1]) {
        setCurrentStep(1);
      } else {
        setCurrentStep(0);
      }
      
      if (percentage >= 100) {
        clearInterval(interval);
      }
    }, INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const dbTypeColor = selectedDatabase === 'oracle' 
    ? 'from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-800' 
    : selectedDatabase === 'postgres' 
    ? 'from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700' 
    : selectedDatabase === 'mysql' 
    ? 'from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-700' 
    : 'from-green-400 to-green-600 dark:from-green-500 dark:to-green-700';

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      {/* Loading Animation */}
      <div className="relative mb-12">
        {/* Animated background blobs */}
        <motion.div 
          className="absolute -z-10 opacity-20 blur-3xl w-32 h-32 rounded-full bg-primary-500"
          animate={{ 
            scale: [1, 1.5, 1],
            x: [0, 30, -30, 0],
            y: [0, -30, 30, 0],
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
        />
        <motion.div 
          className="absolute -z-10 opacity-20 blur-3xl w-40 h-40 rounded-full bg-yellow-400"
          animate={{ 
            scale: [1.2, 0.8, 1.2],
            x: [0, -40, 40, 0],
            y: [0, 40, -40, 0],
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity, 
            repeatType: "reverse" 
          }}
        />
        
        {/* Inner spinning element */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${dbTypeColor} flex items-center justify-center shadow-lg`}
            animate={{ 
              rotate: 360,
              borderRadius: ["16%", "40%", "50%", "40%", "16%"],
            }}
            transition={{ 
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
              borderRadius: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <div className="text-white flex items-center justify-center h-full w-full">
              <Sparkles className="h-10 w-10 drop-shadow-md" />
            </div>
          </motion.div>
        </div>

        {/* Outer rings */}
        <motion.div
          className="h-40 w-40 rounded-full border-4 border-primary-200 dark:border-primary-800 border-dashed"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 h-40 w-40 rounded-full border-4 border-primary-100 dark:border-primary-900 border-dashed"
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Loading Status */}
      <div className="text-center space-y-4 mb-8">
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          Processing Your Query
        </h3>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5B51F9] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round(progress)}% complete
          </div>
        </div>
      </div>

      {/* Processing Steps */}
      <div className="w-full max-w-md">
        <ul className="space-y-4">
          {steps.map((step, index) => (
            <motion.li
              key={index}
              className="flex items-center space-x-3 px-4 py-2 rounded-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                backgroundColor: index === currentStep ? 'rgba(var(--primary-50), 0.5)' : 'transparent',
              }}
              transition={{ 
                delay: index * 0.15,
                backgroundColor: { duration: 0.3 }
              }}
            >
              <motion.div
                className={`flex-shrink-0 h-8 w-8 rounded-lg ${
                  index < currentStep
                    ? "bg-primary-600 dark:bg-primary-500 text-white"
                    : index === currentStep
                    ? "bg-primary-500 dark:bg-primary-400 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                } flex items-center justify-center`}
                animate={
                  index === currentStep 
                    ? { 
                        scale: [1, 1.1, 1],
                        boxShadow: [
                          "0 0 0 0 rgba(var(--primary-500), 0.7)",
                          "0 0 0 10px rgba(var(--primary-500), 0)",
                          "0 0 0 0 rgba(var(--primary-500), 0)"
                        ]
                      } 
                    : {}
                }
                transition={
                  index === currentStep 
                    ? { 
                        repeat: Infinity, 
                        duration: 2
                      } 
                    : {}
                }
              >
                {index < currentStep ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </motion.div>
              <span
                className={`text-sm font-medium ${
                  index < currentStep
                    ? "text-gray-800 dark:text-gray-200"
                    : index === currentStep
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
              {index === currentStep && (
                <motion.span
                  className="ml-auto text-xs font-medium text-primary-600 dark:text-primary-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  In progress...
                </motion.span>
              )}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
