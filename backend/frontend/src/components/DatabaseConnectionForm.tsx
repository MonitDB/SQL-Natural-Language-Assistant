import React, { useState } from 'react';
import { Form, Input, Select, Button, Card, InputNumber, Space, Divider, Tag } from 'antd';
import { DatabaseOutlined, KeyOutlined, UserOutlined, NumberOutlined, ApiOutlined } from '@ant-design/icons';
import { AskRequestDto } from '../types/api.types';

const { Option } = Select;

interface DatabaseConnectionFormProps {
  onSubmit: (connectionDetails: Omit<AskRequestDto, 'prompt'>) => void;
  isLoading: boolean;
}

const DatabaseConnectionForm: React.FC<DatabaseConnectionFormProps> = ({ onSubmit, isLoading }) => {
  const [selectedDbType, setSelectedDbType] = useState<'oracle' | 'postgres' | 'mysql' | 'mssql'>('oracle');
  const [form] = Form.useForm();

  const handleTypeChange = (value: 'oracle' | 'postgres' | 'mysql' | 'mssql') => {
    setSelectedDbType(value);
    
    // Reset form fields when database type changes
    form.setFieldsValue({
      connectionString: undefined,
      host: undefined,
      port: getDefaultPort(value),
      database: undefined,
      schema: undefined
    });
  };
  
  const getDefaultPort = (dbType: string): number => {
    switch (dbType) {
      case 'oracle': return 1521;
      case 'postgres': return 5432;
      case 'mysql': return 3306;
      case 'mssql': return 1433;
      default: return 1521;
    }
  };
  
  const getSchemaTooltip = (dbType: string): string => {
    switch (dbType) {
      case 'oracle':
        return "In Oracle, schemas are equivalent to owners/users (e.g., HR, SCOTT, SYS)";
      case 'mssql':
        return "In SQL Server, specify schema name (e.g., dbo, APPLICATION, HISTORIC, SOL)";
      case 'postgres':
        return "In PostgreSQL, specify schema name (e.g., public, schema1)";
      case 'mysql':
        return "In MySQL, schemas typically match database names. Only needed for multi-schema setups.";
      default:
        return "Specify a schema to focus on. If not provided, the system will scan multiple schemas.";
    }
  };
  
  const getSchemaPlaceholder = (dbType: string): string => {
    switch (dbType) {
      case 'oracle':
        return "e.g., HR, SCOTT, YOUR_USERNAME";
      case 'mssql':
        return "e.g., dbo, APPLICATION, HISTORIC, SOL";
      case 'postgres':
        return "e.g., public, custom_schema";
      case 'mysql':
        return "e.g., database schema (if different from database name)";
      default:
        return "e.g., schema name";
    }
  };

  const handleSubmit = (values: any) => {
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
        
        <Divider style={{ margin: '12px 0' }} />
        
        <Form.Item
          name="schema"
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              Schema (Optional)
              <Tag 
                color="blue" 
                style={{ marginLeft: '8px', fontSize: '12px' }}
              >
                Enhanced Analysis
              </Tag>
            </span>
          }
          tooltip={getSchemaTooltip(selectedDbType)}
          extra="Specifying a schema will focus the analysis on that schema (8 tables vs 3), improving query results."
        >
          <Input 
            prefix={<DatabaseOutlined />} 
            placeholder={getSchemaPlaceholder(selectedDbType)}
            allowClear
          />
        </Form.Item>

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