import axios from 'axios';

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: 'http://monitdb-dev.ddns.net:3005/',
  timeout: 60000, // Longer timeout for complex database queries
  headers: {
    'Content-Type': 'application/json',
  }
});

// Handle global error logging
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const apiService = {
  /**
   * Send a natural language query to the API
   * @param requestData Database connection details and prompt
   * @returns API response with query results
   */
  async askQuery(requestData) {
    try {
      const response = await apiClient.post('/ask', requestData);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.message || 'Failed to process query');
      }
      throw new Error('Network error or server is unavailable');
    }
  },

  /**
   * Test database connection
   * @param connectionDetails Database connection details
   * @returns Success or error message
   */
  async testConnection(connectionDetails) {
    try {
      const response = await apiClient.post(`${API_HOST_URL}/ask/test-connection`, connectionDetails);
      return { 
        success: true, 
        message: 'Connection successful' 
      };
    } catch (error) {
      // Extract error details from response if available
      const errorMessage = 
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        'Failed to connect to database';
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  /**
   * Get suggested prompts from the API
   * @returns List of suggested prompts
   */
  async getSuggestedPrompts() {
    try {
      const response = await apiClient.get('/ask/suggestions');
      return response.data.suggestedPrompts || [
        'Show me all tables in this database',
        'List the columns in the employees table',
        'What is the average salary by department?',
        'Show top 10 orders by value',
        'Count of customers by country'
      ];
    } catch (error) {
      console.error('Failed to fetch suggested prompts:', error);
      // Return default prompts if API fails
      return [
        'Show me all tables in this database',
        'List the columns in the employees table',
        'What is the average salary by department?',
        'Show top 10 orders by value',
        'Count of customers by country'
      ];
    }
  }
};