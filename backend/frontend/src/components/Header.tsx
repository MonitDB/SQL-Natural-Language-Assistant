import React from 'react';
import { Layout, Typography, Space } from 'antd';
import { DatabaseOutlined, MessageOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header: React.FC = () => {
  return (
    <AntHeader style={{ 
      background: '#001529', 
      display: 'flex', 
      alignItems: 'center', 
      padding: '0 24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
    }}>
      <Space>
        <DatabaseOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          Database Query Assistant
        </Title>
      </Space>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        <Space>
          <MessageOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
          <span style={{ color: 'white' }}>Ask in Natural Language</span>
        </Space>
      </div>
    </AntHeader>
  );
};

export default Header;