import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, BarChart3, ExternalLink, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface SuccessStateProps {
  results: {
    result: string;
    executedQueries: string[];
    rawResults: any[];
    suggestedPrompts: string[];
  };
  onSuggestedPromptClick?: (prompt: string) => void;
}

export default function SuccessState({ results, onSuggestedPromptClick }: SuccessStateProps) {
  const { toast } = useToast();
  const [selectedValue, setSelectedValue] = useState<any>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
  // Check if raw results exist
  const hasRawData = results?.rawResults && results.rawResults.length > 0;
  
  // Process the raw results and find all JSON object arrays
  const dataArrays = useMemo(() => {
    if (!hasRawData) return [] as any[][];
    
    // Array to hold all the valid data arrays found
    const validArrays: any[][] = [];
    
    // Function to process an array and extract JSON object arrays
    const processArray = (arr: any[]): void => {
      // Skip empty arrays
      if (!arr || arr.length === 0) return;
      
      // Check if array contains objects (this would be a valid data array)
      if (arr.length > 0 && typeof arr[0] === 'object' && !Array.isArray(arr[0])) {
        validArrays.push(arr);
        return;
      }
      
      // Otherwise, recursively process nested arrays
      if (Array.isArray(arr)) {
        arr.forEach(item => {
          if (Array.isArray(item)) {
            processArray(item);
          }
        });
      }
    };
    
    // Start processing from the raw results
    processArray(results.rawResults);
    
    // Return all valid arrays found
    return validArrays;
  }, [hasRawData, results.rawResults]);
  
  // For backwards compatibility, use the first array found
  const processedData = useMemo(() => {
    return dataArrays.length > 0 ? dataArrays[0] : [];
  }, [dataArrays]);
  
  // Extract column names from the data
  const columns = useMemo(() => {
    if (processedData.length === 0) return [];
    
    // Get all unique keys from the first object to identify columns
    const firstItem = processedData[0];
    const columnKeys = Object.keys(firstItem || {});
    
    // Return them as formatted column headers
    return columnKeys.map(key => ({
      id: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
    }));
  }, [processedData]);
  
  const handleSuggestedPromptClick = (prompt: string) => {
    // Use the callback if provided, otherwise just log
    if (onSuggestedPromptClick) {
      onSuggestedPromptClick(prompt);
    } else {
      console.log("Selected prompt:", prompt);
    }
  };

  // Helper function to generate CSV for a specific data array
  const generateCSV = (dataArray: any[], tableColumns: any[], tableIndex: number = 0) => {
    if (!dataArray || dataArray.length === 0 || !tableColumns || tableColumns.length === 0) return;
    
    const headers = tableColumns.map(col => col.id).join(',');
    const rows = dataArray.map(row => 
      tableColumns.map(col => {
        const value = row[col.id];
        let csvValue = '';
        
        if (value === null || value === undefined) {
          csvValue = '';
        } else if (typeof value === 'object') {
          try {
            csvValue = JSON.stringify(value);
          } catch (e) {
            csvValue = String(value);
          }
        } else {
          csvValue = String(value);
        }
        
        // Properly escape CSV values
        return csvValue.includes(',') || csvValue.includes('"') 
          ? `"${csvValue.replace(/"/g, '""')}"`
          : csvValue;
      }).join(',')
    ).join('\n');
    
    const csvContent = `${headers}\n${rows}`;
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `query-results-table-${tableIndex + 1}-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "CSV Exported",
      description: `Data Table ${tableIndex + 1} has been exported as CSV`,
    });
  };
  
  // Legacy export function that exports the first table
  const handleExportCSV = () => {
    if (!hasRawData || dataArrays.length === 0) return;
    generateCSV(processedData, columns, 0);
  };
  
  // Format cell value for simple text display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (typeof value === 'number') {
      return String(value);
    }
    
    if (typeof value === 'object') {
      // For objects, just show the actual value without any click action
      try {
        if (Array.isArray(value)) {
          return value.join(', ');
        } else {
          // Extract the direct value from the object if it only contains a single property
          // This is common in SQL results where each column value is wrapped in an object
          const keys = Object.keys(value);
          if (keys.length === 1) {
            return String(value[keys[0]]);
          }
          return JSON.stringify(value);
        }
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  };
  
  // Handle clicking on a complex object cell
  const handleViewObject = (value: any, type: string) => {
    setSelectedValue(value);
    setSelectedLabel(type);
    setDialogOpen(true);
  };
  
  // Format JSON for display in dialog with highlighting
  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };
  
  // Copy JSON data to clipboard
  const copyJson = (data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(jsonString).then(() => {
        setHasCopied(true);
        toast({
          title: "Copied to clipboard",
          description: "JSON data copied to clipboard",
        });
        
        // Reset copy state after 2 seconds
        setTimeout(() => {
          setHasCopied(false);
        }, 2000);
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy JSON data to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Main Results Section */}
        <div className="bg-gray-900 rounded-lg shadow overflow-hidden border border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-100">Query Results</h3>
          </div>
          
          <div className="p-6">
            <div className="prose prose-invert max-w-none">
              <div className="summary-block">
                {results.result.split('\n').map((paragraph, i) => (
                  <p key={i} className="text-gray-300 my-2">{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
          
          {results.suggestedPrompts && results.suggestedPrompts.length > 0 && (
            <div className="bg-gray-800 px-6 py-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Follow-up questions:</h4>
              <div className="flex flex-wrap gap-2">
                {results.suggestedPrompts.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className={`text-xs px-3 py-1.5 h-auto rounded-full ${
                      i === 0 
                        ? "bg-[#5B51F9]/20 text-[#5B51F9] border-[#5B51F9]/30 hover:bg-[#5B51F9]/30" 
                        : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                    }`}
                    onClick={() => handleSuggestedPromptClick(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Raw Data Tables Section */}
        {hasRawData && dataArrays.length > 0 && (
          <>
            {dataArrays.map((dataArray, tableIndex) => {
              // Generate columns for this specific data array
              const tableColumns = (() => {
                if (!dataArray || dataArray.length === 0) return [];
                const firstItem = dataArray[0];
                const columnKeys = Object.keys(firstItem || {});
                return columnKeys.map(key => ({
                  id: key,
                  label: key.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
                }));
              })();
              
              if (tableColumns.length === 0) return null;
              
              return (
                <div key={`table-${tableIndex}`} className="bg-gray-900 rounded-lg shadow overflow-hidden border border-gray-800 mb-6">
                  <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-100">
                      {dataArrays.length > 1 
                        ? `Data Table ${tableIndex + 1}` 
                        : 'Raw Data'}
                    </h3>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
                        onClick={() => copyJson(dataArray)}
                      >
                        {hasCopied ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
                        onClick={() => generateCSV(dataArray, tableColumns, tableIndex)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        <span>Export CSV</span>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="relative h-[400px] overflow-hidden border-b border-gray-700">
                    {/* Table header (fixed position) */}
                    <div className="sticky top-0 z-10 overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-700 border-b border-gray-600">
                            {tableColumns.map(column => (
                              <th
                                key={column.id}
                                scope="col"
                                className="px-3 py-2 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      </table>
                    </div>
                    
                    {/* Table body (scrollable) */}
                    <div className="absolute inset-0 overflow-auto pt-[33px]"> {/* Height of the header */}
                      <table className="w-full">
                        <thead className="invisible">
                          <tr>
                            {tableColumns.map(column => (
                              <th
                                key={column.id}
                                scope="col"
                                className="px-3 py-2 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataArray.map((row: any, rowIndex: number) => (
                            <tr 
                              key={rowIndex}
                              className={rowIndex % 2 === 0 ? "bg-gray-700" : "bg-gray-600"}
                            >
                              {tableColumns.map(column => {
                                return (
                                  <td
                                    key={`${rowIndex}-${column.id}`}
                                    className="px-3 py-2 text-sm text-gray-200 border-b border-gray-700"
                                  >
                                    {formatCellValue(row[column.id])}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex justify-between items-center">
                    <span>Showing {dataArray.length} rows</span>
                    <Badge variant="outline" className="text-xs font-normal bg-gray-700 text-gray-300 border-gray-600">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {dataArray.length} records
                    </Badge>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </motion.div>
      
      {/* Object Viewer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 max-w-2xl mx-auto p-0">
          <DialogHeader className="px-6 py-4 border-b border-gray-800">
            <DialogTitle>Cell Value Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedLabel === 'object' 
                ? "Complete structure of this object" 
                : selectedLabel === 'array' 
                  ? "All array items" 
                  : "Value data"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-0">
            <div className="bg-gray-800 border-b border-gray-700 px-6 py-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyJson(selectedValue)}
                className="text-xs text-gray-300 hover:text-white"
              >
                {hasCopied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    <span>Copy JSON</span>
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[360px] p-6">
              <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto">
                {selectedValue !== null ? formatJson(selectedValue) : ''}
              </pre>
            </ScrollArea>
          </div>
          
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
