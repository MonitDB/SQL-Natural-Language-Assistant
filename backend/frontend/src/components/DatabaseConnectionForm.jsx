import React, { useState } from 'react';
import { Form, Input, Select, Button, Card, InputNumber, Space } from 'antd';
import { DatabaseOutlined, KeyOutlined, UserOutlined, NumberOutlined, ApiOutlined } from '@ant-design/icons';

const { Option } = Select;

const DatabaseConnectionForm = ({ onSubmit, isLoading }) => {
  const [selectedDbType, setSelectedDbType] = useState('oracle');
  const [form] = Form.useForm();

  const handleTypeChange = (value) => {
    setSelectedDbType(value);
    
    // Reset form fields when database type changes
    form.setFieldsValue({
      connectionString: undefined,
      host: undefined,
      port: getDefaultPort(value),
      database: undefined
    });
  };
  
  const getDefaultPort = (dbType) => {
    switch (dbType) {
      case 'oracle': return 1521;
      case 'postgres': return 5432;
      case 'mysql': return 3306;
      case 'mssql': return 1433;
      default: return 1521;
    }
  };

  const handleSubmit = (values) => {
    onSubmit({
      ...values,
      type: selectedDbType
    });
  };

  return (
    <Card title="Database Connection" bordered={false}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'oracle', port: 1521 }}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="type"
          label="Database Type"
          rules={[{ required: true, message: 'Please select database type' }]}
        >
          <Select 
            onChange={handleTypeChange} 
            value={selectedDbType}
            suffixIcon={<DatabaseOutlined />}
          >
            <Option value="oracle">Oracle</Option>
            <Option value="postgres">PostgreSQL</Option>
            <Option value="mysql">MySQL</Option>
            <Option value="mssql">SQL Server</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: 'Please enter username' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Database username" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please enter password' }]}
        >
          <Input.Password prefix={<KeyOutlined />} placeholder="Database password" />
        </Form.Item>

        {selectedDbType === 'oracle' ? (
          <Form.Item
            name="connectionString"
            label="Connection String"
            rules={[{ required: true, message: 'Please enter connection string' }]}
          >
            <Input 
              prefix={<ApiOutlined />} 
              placeholder="e.g., localhost:1521/XEPDB1" 
            />
          </Form.Item>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item
              name="host"
              label="Host"
              rules={[{ required: true, message: 'Please enter host' }]}
            >
              <Input prefix={<DatabaseOutlined />} placeholder="e.g., localhost" />
            </Form.Item>

            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: 'Please enter port' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={1} 
                max={65535} 
                prefix={<NumberOutlined />} 
              />
            </Form.Item>

            <Form.Item
              name="database"
              label="Database Name"
              rules={[{ required: true, message: 'Please enter database name' }]}
            >
              <Input prefix={<DatabaseOutlined />} placeholder="e.g., postgres, mydatabase" />
            </Form.Item>
          </Space>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading}>
            Connect
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default DatabaseConnectionForm;