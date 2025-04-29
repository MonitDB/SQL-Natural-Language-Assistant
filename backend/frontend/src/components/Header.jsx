import React from 'react';
import { Layout, Typography, Space } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header = () => {
  return (
    <AntHeader style={{ 
      display: 'flex', 
      alignItems: 'center',
      padding: '0 24px',
      background: '#001529'
    }}>
      <Space>
        <DatabaseOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        <Title level={3} style={{ 
          color: 'white', 
          margin: 0
        }}>
          Database Query Assistant
        </Title>
      </Space>
      
      <div style={{ flex: '1 1 auto' }} />
      
      <Space>
        <Typography.Text style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
          Ask your database in plain English
        </Typography.Text>
      </Space>
    </AntHeader>
  );
};

export default Header;