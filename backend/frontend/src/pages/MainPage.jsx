import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Alert, notification } from 'antd';
import Header from '../components/Header';
import DatabaseConnectionForm from '../components/DatabaseConnectionForm';
import QueryForm from '../components/QueryForm';
import QueryResults from '../components/QueryResults';
import { apiService } from '../services/api.service';

const { Content, Footer } = Layout;

const MainPage = () => {
  const [connectionDetails, setConnectionDetails] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectionLoading, setIsConnectionLoading] = useState(false);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [queryResults, setQueryResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch suggested prompts when the component mounts
  useEffect(() => {
    const fetchSuggestedPrompts = async () => {
      try {
        const prompts = await apiService.getSuggestedPrompts();
        setSuggestedPrompts(prompts);
      } catch (error) {
        console.error('Failed to fetch suggested prompts:', error);
      }
    };

    fetchSuggestedPrompts();
  }, []);

  const handleConnect = async (details) => {
    setIsConnectionLoading(true);
    setErrorMessage(null);
    
    try {
      const result = await apiService.testConnection(details);
      
      if (result.success) {
        setConnectionDetails(details);
        setIsConnected(true);
        notification.success({
          message: 'Connection Successful',
          description: 'Successfully connected to the database',
        });
      } else {
        setErrorMessage(result.message);
        notification.error({
          message: 'Connection Failed',
          description: result.message,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errorMsg);
      notification.error({
        message: 'Connection Error',
        description: errorMsg,
      });
    } finally {
      setIsConnectionLoading(false);
    }
  };

  const handleQuerySubmit = async (prompt) => {
    if (!connectionDetails) {
      setErrorMessage('Please connect to a database first');
      return;
    }

    setIsQueryLoading(true);
    setErrorMessage(null);
    
    try {
      const requestData = {
        ...connectionDetails,
        prompt,
      };
      
      const results = await apiService.askQuery(requestData);
      setQueryResults(results);
      
      // Update suggested prompts if they were returned in the response
      if (results.suggestedPrompts && results.suggestedPrompts.length > 0) {
        setSuggestedPrompts(results.suggestedPrompts);
      }
      
      // Show error notification if there's an error in the response
      if (results.errorInfo) {
        notification.error({
          message: 'Query Error',
          description: results.errorInfo.message || 'Error executing query',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(errorMsg);
      notification.error({
        message: 'Query Error',
        description: errorMsg,
      });
    } finally {
      setIsQueryLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header />
      
      <Content style={{ padding: '24px' }}>
        {errorMessage && (
          <Alert
            message="Error"
            description={errorMessage}
            type="error"
            showIcon
            closable
            style={{ marginBottom: '24px' }}
            onClose={() => setErrorMessage(null)}
          />
        )}
        
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <DatabaseConnectionForm 
              onSubmit={handleConnect} 
              isLoading={isConnectionLoading} 
            />
          </Col>
          
          <Col xs={24} lg={16}>
            <QueryForm 
              onSubmit={handleQuerySubmit} 
              suggestedPrompts={suggestedPrompts} 
              isConnected={isConnected}
              isLoading={isQueryLoading}
            />
            
            {(queryResults || isQueryLoading) && (
              <div style={{ marginTop: '24px' }}>
                <QueryResults 
                  results={queryResults} 
                  isLoading={isQueryLoading} 
                />
              </div>
            )}
          </Col>
        </Row>
      </Content>
      
      <Footer style={{ textAlign: 'center' }}>
        Database Query Assistant ©{new Date().getFullYear()} - Ask databases using natural language
      </Footer>
    </Layout>
  );
};

export default MainPage;