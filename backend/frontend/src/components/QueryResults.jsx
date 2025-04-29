import React, { useState } from 'react';
import { Card, Table, Tabs, Spin, Typography, Badge, Alert } from 'antd';
import { CodeOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

const QueryResults = ({ results, isLoading }) => {
  const [activeTab, setActiveTab] = useState('1');

  if (isLoading) {
    return (
      <Card style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Processing your query...</Text>
        </div>
      </Card>
    );
  }

  if (!results) {
    return null;
  }

  // Handle error case
  if (results.errorInfo) {
    return (
      <Card title="Query Results">
        <Alert
          message="Error"
          description={results.errorInfo.message || 'An error occurred while processing your query'}
          type="error"
          showIcon
        />
        {results.errorInfo.details && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Error Details:</Text>
            <SyntaxHighlighter language="sql" style={atomDark}>
              {results.errorInfo.details}
            </SyntaxHighlighter>
          </div>
        )}
      </Card>
    );
  }

  // Prepare data for the Results table
  const prepareTableData = () => {
    if (!results.rawResults || !Array.isArray(results.rawResults) || results.rawResults.length === 0) {
      return { dataSource: [], columns: [] };
    }
    
    const firstResult = results.rawResults[0];
    
    // Extract column names from the first row
    const columns = Object.keys(firstResult).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      render: (text) => {
        // Handle null, undefined, or objects
        if (text === null || text === undefined) {
          return <Text type="secondary">NULL</Text>;
        }
        
        if (typeof text === 'object') {
          return JSON.stringify(text);
        }
        
        return text;
      }
    }));
    
    // Add row numbers
    const dataSource = results.rawResults.map((row, index) => ({
      ...row,
      key: index
    }));
    
    return { dataSource, columns };
  };

  const { dataSource, columns } = prepareTableData();
  
  return (
    <Card 
      title={(
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>Query Results</span>
          {results.executedQueries && results.executedQueries.length > 0 && (
            <Badge 
              count={results.executedQueries.length} 
              style={{ backgroundColor: '#1890ff', marginLeft: 8 }}
              title={`${results.executedQueries.length} queries executed`}
            />
          )}
        </div>
      )}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={<span><FileTextOutlined /> Summary</span>} 
          key="1"
        >
          <div style={{ marginBottom: 16 }}>
            <Title level={4}>Results</Title>
            <div style={{ whiteSpace: 'pre-line' }}>
              {results.result}
            </div>
          </div>
        </TabPane>
        
        <TabPane 
          tab={<span><DatabaseOutlined /> Data</span>} 
          key="2"
        >
          {dataSource.length > 0 ? (
            <Table 
              dataSource={dataSource} 
              columns={columns} 
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Alert 
              message="No data returned" 
              description="The query did not return any tabular data."
              type="info" 
              showIcon 
            />
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><CodeOutlined /> SQL Queries</span>} 
          key="3"
        >
          {results.executedQueries && results.executedQueries.length > 0 ? (
            results.executedQueries.map((query, index) => (
              <div key={index} style={{ marginBottom: 16 }}>
                <Text strong>Query {index + 1}:</Text>
                <SyntaxHighlighter language="sql" style={atomDark}>
                  {query}
                </SyntaxHighlighter>
              </div>
            ))
          ) : (
            <Alert 
              message="No queries executed" 
              description="No SQL queries were executed for this request."
              type="info" 
              showIcon 
            />
          )}
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default QueryResults;