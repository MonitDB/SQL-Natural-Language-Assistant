import React from 'react';
import { ConfigProvider, theme } from 'antd';
import MainPage from './pages/MainPage';
import './App.css';

/**
 * Main App component that wraps the application with the Ant Design ConfigProvider
 * and sets up the dark theme
 */
const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <MainPage />
    </ConfigProvider>
  );
};

export default App;
