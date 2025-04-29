import React from 'react';
import { Form, Input, Button, Card, Tag, Space, Typography } from 'antd';
import { SendOutlined, BulbOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

const QueryForm = ({ onSubmit, suggestedPrompts, isConnected, isLoading }) => {
  const [form] = Form.useForm();

  const handleSubmit = (values) => {
    onSubmit(values.prompt);
  };

  const handleSuggestionClick = (suggestion) => {
    form.setFieldsValue({ prompt: suggestion });
    onSubmit(suggestion);
  };

  return (
    <Card 
      title="Ask in Natural Language" 
      bordered={false}
      extra={isConnected ? <Tag color="success">Connected</Tag> : <Tag color="error">Not Connected</Tag>}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="prompt"
          rules={[{ required: true, message: 'Please enter your query' }]}
        >
          <TextArea 
            placeholder="Ask anything about your database in plain English, e.g., 'Show me the top 10 customers by order value'" 
            rows={4}
            disabled={!isConnected}
          />
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<SendOutlined />}
            loading={isLoading}
            disabled={!isConnected}
          >
            Submit Query
          </Button>
        </Form.Item>
      </Form>

      {suggestedPrompts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong><BulbOutlined /> Suggested queries:</Text>
          <div style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {suggestedPrompts.map((suggestion, index) => (
                <Tag
                  key={index}
                  color="blue"
                  style={{ cursor: 'pointer', padding: '4px 8px' }}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      )}
    </Card>
  );
};

export default QueryForm;