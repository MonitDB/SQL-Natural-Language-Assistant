import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { DatabaseType } from "@/lib/types";
import DatabaseIcon from "@/components/DatabaseIcon";
import { EXAMPLE_QUERIES } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Lightbulb,
  LucideProps,
  Plug,
  Sparkles,
  Eye,
  EyeOff,
  Save,
  Database,
  Trash2,
} from "lucide-react";

interface ConnectionFormProps {
  selectedDatabase: DatabaseType;
  setSelectedDatabase: (type: DatabaseType) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setHasError: (hasError: boolean) => void;
  setErrorMessage: (message: string) => void;
  setQueryResults: (results: any) => void;
  currentPrompt?: string;
}

export default function ConnectionForm({
  selectedDatabase,
  setSelectedDatabase,
  isConnected,
  setIsConnected,
  isLoading,
  setIsLoading,
  setHasError,
  setErrorMessage,
  setQueryResults,
  currentPrompt,
}: ConnectionFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    connectionString: "",
    schema: "",
    port: "",
    database: "",
    prompt: "",
    connectionName: "", // For saving connections
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savedConnections, setSavedConnections] = useState<any[]>([]);
  const [showSavedConnections, setShowSavedConnections] = useState(false);

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        username: formData.username,
        password: formData.password,
        connectionString: formData.connectionString,
        type: selectedDatabase,
        ...(selectedDatabase !== "oracle" && { database: formData.database }),
        ...(formData.schema && { schema: formData.schema }),
        ...(formData.port && { port: Number(formData.port) }),
      };

      const res = await apiRequest(
        "POST",
        "https://a24f-2804-29b8-50a6-6376-e858-1937-dc8a-4f6b.ngrok-free.app/ask/test-connection",
        payload,
      );
      const data = await res.json();

      // Check if the response indicates an error
      if (data.success === false) {
        throw new Error(data.message || "Connection failed");
      }

      return data;
    },
    onSuccess: () => {
      setIsConnected(true);
      toast({
        title: "Connection successful",
        description: "Successfully connected to the database",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      setIsConnected(false);
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const executeQueryMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        username: formData.username,
        password: formData.password,
        connectionString: formData.connectionString,
        type: selectedDatabase,
        ...(selectedDatabase !== "oracle" && { database: formData.database }),
        ...(formData.schema && { schema: formData.schema }),
        ...(formData.port && { port: Number(formData.port) }),
        prompt: formData.prompt,
      };

      const res = await apiRequest(
        "POST",
        "https://a24f-2804-29b8-50a6-6376-e858-1937-dc8a-4f6b.ngrok-free.app/ask",
        payload,
      );
      const data = await res.json();

      // Check for errorInfo in the response
      if (data.errorInfo && data.errorInfo.error) {
        // Create an error with the error message from the response
        throw new Error(data.errorInfo.message || "Query execution failed");
      }

      return data;
    },
    onMutate: () => {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage("");
    },
    onSuccess: (data) => {
      setIsLoading(false);
      setQueryResults(data);
    },
    onError: (error: Error) => {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage(error.message);
      setQueryResults(null);
    },
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDatabaseTypeChange = (type: DatabaseType) => {
    setSelectedDatabase(type);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const handleExecuteQuery = () => {
    if (!formData.prompt) {
      toast({
        title: "Query required",
        description: "Please enter a query prompt",
        variant: "destructive",
      });
      return;
    }

    executeQueryMutation.mutate();
  };

  const handleExampleClick = (example: string) => {
    setFormData((prev) => ({ ...prev, prompt: example }));
  };

  // Load saved connections from localStorage
  const loadSavedConnections = () => {
    try {
      const saved = localStorage.getItem("monixDBConnections");
      if (saved) {
        const connections = JSON.parse(saved);
        setSavedConnections(connections);
      }
    } catch (error) {
      console.error("Error loading saved connections:", error);
      toast({
        title: "Error loading saved connections",
        description: "There was an error loading your saved connections.",
        variant: "destructive",
      });
    }
  };

  // Save current connection to localStorage
  const saveCurrentConnection = () => {
    if (!formData.connectionName) {
      toast({
        title: "Connection name required",
        description: "Please enter a name for this connection to save it.",
        variant: "destructive",
      });
      return;
    }

    try {
      const connectionToSave = {
        id: Date.now().toString(),
        name: formData.connectionName,
        type: selectedDatabase,
        username: formData.username,
        password: formData.password, // Note: In a real production app, you might want to handle this differently
        connectionString: formData.connectionString,
        port: formData.port,
        database: formData.database,
        schema: formData.schema,
      };

      const updatedConnections = [...savedConnections, connectionToSave];
      localStorage.setItem(
        "monixDBConnections",
        JSON.stringify(updatedConnections),
      );
      setSavedConnections(updatedConnections);

      setFormData((prev) => ({ ...prev, connectionName: "" }));

      toast({
        title: "Connection saved",
        description: `Connection "${connectionToSave.name}" has been saved.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error saving connection:", error);
      toast({
        title: "Error saving connection",
        description: "There was an error saving your connection.",
        variant: "destructive",
      });
    }
  };

  // Load a saved connection
  const loadConnection = (connection: any) => {
    setSelectedDatabase(connection.type as DatabaseType);
    setFormData({
      ...formData,
      username: connection.username,
      password: connection.password,
      connectionString: connection.connectionString,
      port: connection.port || "",
      database: connection.database || "",
      schema: connection.schema || "",
    });
    setShowSavedConnections(false);
  };

  // Delete a saved connection
  const deleteConnection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler

    try {
      const updatedConnections = savedConnections.filter(
        (conn) => conn.id !== id,
      );
      localStorage.setItem(
        "monixDBConnections",
        JSON.stringify(updatedConnections),
      );
      setSavedConnections(updatedConnections);

      toast({
        title: "Connection deleted",
        description: "The connection has been deleted.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting connection:", error);
      toast({
        title: "Error deleting connection",
        description: "There was an error deleting your connection.",
        variant: "destructive",
      });
    }
  };

  // Load saved connections on component mount
  useEffect(() => {
    loadSavedConnections();
  }, []);

  // Update form data when currentPrompt changes (from follow-up questions)
  useEffect(() => {
    if (currentPrompt && currentPrompt !== formData.prompt) {
      setFormData((prev) => ({ ...prev, prompt: currentPrompt }));
    }
  }, [currentPrompt]);

  return (
    <div className="lg:w-1/3 bg-white dark:bg-[#1e1e2d] p-6 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Database Connection
        </h2>

        {/* Database Type Selection */}
        <div>
          <Label className="block mb-2">Database Type</Label>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { type: "oracle", label: "Oracle" },
              { type: "postgres", label: "PostgreSQL" },
              { type: "mssql", label: "SQL Server" },
              { type: "mysql", label: "MySQL" },
            ].map((db) => (
              <Button
                key={db.type}
                type="button"
                variant={selectedDatabase === db.type ? "default" : "outline"}
                className={`relative flex flex-col items-center justify-center p-4 h-auto ${
                  selectedDatabase === db.type
                    ? "shadow-md"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() =>
                  handleDatabaseTypeChange(db.type as DatabaseType)
                }
              >
                {selectedDatabase === db.type && (
                  <div className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-primary-200 dark:bg-primary-300 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-600 dark:bg-primary-400"></div>
                  </div>
                )}
                <DatabaseIcon
                  type={db.type as DatabaseType}
                  className={`mb-2 h-6 w-6 ${
                    selectedDatabase === db.type
                      ? "text-white dark:text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    selectedDatabase === db.type
                      ? "text-white dark:text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {db.label}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Connection Form */}
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter username"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter password"
                className="mt-1 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 mt-1 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="connectionString">Connection String</Label>
            <Input
              id="connectionString"
              name="connectionString"
              value={formData.connectionString}
              onChange={handleInputChange}
              placeholder={
                selectedDatabase === "oracle"
                  ? "host:port/service_name"
                  : "host"
              }
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {selectedDatabase === "oracle"
                ? "Format: host:port/service_name"
                : "Enter the hostname or IP address"}
            </p>
          </div>

          {selectedDatabase !== "oracle" && (
            <div>
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                name="port"
                value={formData.port}
                onChange={handleInputChange}
                placeholder={
                  selectedDatabase === "postgres"
                    ? "5432"
                    : selectedDatabase === "mysql"
                      ? "3306"
                      : "1433"
                }
                className="mt-1"
              />
            </div>
          )}

          {selectedDatabase !== "oracle" && (
            <div>
              <Label htmlFor="database">Database Name</Label>
              <Input
                id="database"
                name="database"
                value={formData.database}
                onChange={handleInputChange}
                placeholder="Enter database name"
                className="mt-1"
              />
            </div>
          )}

          <div>
            <Label htmlFor="schema">Schema (Optional)</Label>
            <Input
              id="schema"
              name="schema"
              value={formData.schema}
              onChange={handleInputChange}
              placeholder="Focus on specific schema"
              className="mt-1"
            />
          </div>
        </form>

        {/* Connection Management */}
        <div className="space-y-4">
          {/* Connection Name for saving */}
          <div>
            <Label htmlFor="connectionName">Connection Name</Label>
            <div className="flex mt-1 space-x-2">
              <Input
                id="connectionName"
                name="connectionName"
                value={formData.connectionName}
                onChange={handleInputChange}
                placeholder="Enter name to save this connection"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={saveCurrentConnection}
                className="shrink-0"
                disabled={!formData.connectionName}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          {/* Saved Connections List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Saved Connections</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSavedConnections(!showSavedConnections)}
                className="text-xs"
              >
                {showSavedConnections ? "Hide" : "Show"}
              </Button>
            </div>

            {showSavedConnections && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-2 mb-4 max-h-40 overflow-y-auto">
                {savedConnections.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                    No saved connections yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {savedConnections.map((conn) => (
                      <li
                        key={conn.id}
                        className="flex items-center justify-between p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                        onClick={() => loadConnection(conn)}
                      >
                        <div className="flex items-center space-x-2">
                          <DatabaseIcon
                            type={conn.type as DatabaseType}
                            className="h-4 w-4"
                          />
                          <span>{conn.name}</span>
                        </div>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          onClick={(e) => deleteConnection(conn.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Test Connection */}
          <div>
            <Button
              type="button"
              className="w-full"
              onClick={handleTestConnection}
              disabled={testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Testing connection...
                </>
              ) : (
                <>
                  <Plug className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Natural Language Query
          </h2>

          <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
            <Textarea
              id="prompt"
              name="prompt"
              value={formData.prompt}
              onChange={handleInputChange}
              placeholder="Ask a question about your database in plain English...
Example: 'Show me all employees in the IT department and their managers'"
              className="block w-full px-3 py-2 resize-none border-0 bg-transparent placeholder-gray-400 focus:outline-none dark:text-white sm:text-sm"
              rows={4}
            />

            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Lightbulb className="h-4 w-4" />
                        <span className="sr-only">Examples</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      className="w-80 p-0"
                    >
                      <div className="flex flex-col p-2">
                        <p className="text-sm font-medium p-2">
                          Example Queries
                        </p>
                        <div className="flex flex-col space-y-1">
                          {EXAMPLE_QUERIES.map((example, i) => (
                            <Button
                              key={i}
                              variant="ghost"
                              className="justify-start text-left h-auto py-2"
                              onClick={() => handleExampleClick(example)}
                            >
                              {example}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span>Examples</span>
              </div>

              <div>
                <Button
                  type="button"
                  onClick={handleExecuteQuery}
                  disabled={executeQueryMutation.isPending || isLoading}
                  className="min-w-[120px] relative overflow-hidden flex items-center justify-center"
                >
                  {executeQueryMutation.isPending || isLoading ? (
                    <>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-primary-600/0 via-primary-600/30 to-primary-600/0"
                        animate={{ x: ["100%", "-100%"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          ease: "linear",
                        }}
                      />
                      <svg
                        className="animate-spin mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Run Query
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
