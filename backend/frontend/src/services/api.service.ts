import axios from 'axios';
import { AskRequestDto, AskResponseDto } from '../types/api.types';

const API_BASE_URL = 'http://backend:3005';

export const apiService = {
  /**
   * Send a natural language query to the API
   * @param requestData Database connection details and prompt
   * @returns API response with query results
   */
  async askQuery(requestData: AskRequestDto): Promise<AskResponseDto> {
    try {
      const response = await axios.post<AskResponseDto>(`${API_BASE_URL}/ask`, requestData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Return the error response from the API
        return error.response.data as AskResponseDto;
      }
      
      // Generic error handler
      return {
        result: 'Error processing query',
        executedQueries: [],
        rawResults: [],
        errorInfo: {
          message: axios.isAxiosError(error) ? error.message : 'Unknown error',
          details: 'Please check your connection details and try again.'
        }
      };
    }
  },

  /**
   * Test database connection
   * @param connectionDetails Database connection details
   * @returns Success or error message
   */
  async testConnection(connectionDetails: Omit<AskRequestDto, 'prompt'>): Promise<{ success: boolean; message: string }> {
    try {
      // Using a placeholder prompt for connection testing
      await axios.post<AskResponseDto>(`${API_BASE_URL}/ask/test-connection`, connectionDetails);
      
      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          message: error.response.data?.errorInfo?.message || 'Connection failed'
        };
      }
      
      return {
        success: false,
        message: axios.isAxiosError(error) ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Get suggested prompts from the API
   * @returns List of suggested prompts
   */
  async getSuggestedPrompts(): Promise<string[]> {
    try {
      const response = await axios.get<AskResponseDto>(`${API_BASE_URL}/ask/suggestions`);
      return response.data.suggestedPrompts || [];
    } catch (error) {
      console.error('Failed to fetch suggested prompts:', error);
      return [];
    }
  }
};