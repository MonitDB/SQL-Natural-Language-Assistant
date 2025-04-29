import React from 'react';
import { Card, Tabs, Typography, Table, Alert, Divider, Tag } from 'antd';
import { CodeOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AskResponseDto } from '../types/api.types';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface QueryResultsProps {
  results: AskResponseDto | null;
  isLoading: boolean;
}

const QueryResults: React.FC<QueryResultsProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <Card loading={true} title="Query Results" bordered={false} />
    );
  }

  if (!results) {
    return null;
  }

  // Extract column information from raw results if available
  const getColumnsFromResults = (rawResults: any[]): any[] => {
    if (!rawResults || !rawResults.length || !rawResults[0]) {
      return [];
    }

    // Get keys from the first result object
    const firstResult = rawResults[0];
    return Object.keys(firstResult).map(key => ({
      title: key,
      dataIndex: key,
      key,
      render: (text: any) => {
        if (text === null) return <Text type="secondary">NULL</Text>;
        if (typeof text === 'object') return JSON.stringify(text);
        return text.toString();
      }
    }));
  };

  // Handle error display
  if (results.errorInfo) {
    return (
      <Card title="Query Results" bordered={false}>
        <Alert
          message={results.errorInfo.message || 'Error executing query'}
          description={
            <div>
              {results.errorInfo.code && <div><Text strong>Error Code:</Text> {results.errorInfo.code}</div>}
              {results.errorInfo.details && <div><Text strong>Details:</Text> {results.errorInfo.details}</div>}
            </div>
          }
          type="error"
          showIcon
        />
        {results.executedQueries && results.executedQueries.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <Divider />
            <Title level={4}><CodeOutlined /> Attempted Queries</Title>
            <SyntaxHighlighter language="sql" style={coldarkDark}>
              {results.executedQueries.join(';\n\n')}
            </SyntaxHighlighter>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card title="Query Results" bordered={false}>
      <Tabs defaultActiveKey="summary">
        <TabPane 
          tab={<span><FileTextOutlined /> Summary</span>} 
          key="summary"
        >
          <Paragraph style={{ whiteSpace: 'pre-line' }}>
            {results.result}
          </Paragraph>
          
          {results.suggestedPrompts && results.suggestedPrompts.length > 0 && (
            <>
              <Divider />
              <Title level={5}>Follow-up Questions</Title>
              <div>
                {results.suggestedPrompts.map((prompt, index) => (
                  <Tag key={index} color="blue" style={{ margin: '4px' }}>
                    {prompt}
                  </Tag>
                ))}
              </div>
            </>
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><DatabaseOutlined /> Data</span>} 
          key="data"
        >
          {results.rawResults && results.rawResults.length > 0 ? (
            results.rawResults.map((resultSet, index) => (
              <div key={index} style={{ marginBottom: '20px' }}>
                {results.rawResults.length > 1 && (
                  <Title level={5}>Result Set {index + 1}</Title>
                )}
                
                {Array.isArray(resultSet) && resultSet.length > 0 ? (
                  <Table 
                    dataSource={resultSet} 
                    columns={getColumnsFromResults(resultSet)}
                    rowKey={(_, rowIndex) => `row-${index}-${rowIndex}`}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                    size="small"
                  />
                ) : (
                  <Alert
                    message="No rows returned"
                    description="This query did not return any rows."
                    type="info"
                    showIcon
                  />
                )}
              </div>
            ))
          ) : (
            <Alert
              message="No data available"
              description="This query did not return any tabular data results."
              type="info"
              showIcon
            />
          )}
        </TabPane>
        
        <TabPane 
          tab={<span><CodeOutlined /> SQL Queries</span>} 
          key="queries"
        >
          <SyntaxHighlighter language="sql" style={coldarkDark}>
            {results.executedQueries.join(';\n\n')}
          </SyntaxHighlighter>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default QueryResults;