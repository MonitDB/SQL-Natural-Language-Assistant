import os
import subprocess
import time
import signal
import sys
import requests
from flask import Flask, jsonify, send_from_directory, send_file, redirect, url_for, request, Response

app = Flask(__name__)
nestjs_process = None

def start_nestjs():
    """Start the NestJS server as a subprocess"""
    global nestjs_process
    try:
        # Kill any existing node processes to avoid port conflicts
        try:
            subprocess.run("pkill -f 'node dist/main'", shell=True)
        except:
            pass
        
        # Build and start the NestJS application
        os.system("npx @nestjs/cli build")
        
        # Start the NestJS server with the port set to 3000
        nestjs_process = subprocess.Popen(
            "node dist/main.js",
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Give the NestJS server time to start
        time.sleep(2)
        print("NestJS server started on port 3000")
        return True
    except Exception as e:
        print(f"Error starting NestJS server: {e}")
        return False

@app.route("/health")
def health():
    """Health check endpoint for the Flask server"""
    return jsonify({"status": "ok", "message": "Flask server is running"})

@app.route('/app')
def app_route():
    """Serve the actual application interface"""
    return """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Database Query Assistant</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
        <link href="https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css" rel="stylesheet">
        <style>
            :root {
              /* Modern color scheme */
              --primary-color: #4361ee;
              --primary-light: #4895ef;
              --primary-dark: #3f37c9;
              --secondary-color: #4cc9f0;
              --accent-color: #7b2cbf;
              --accent-light: #9d4edd;
              --success-color: #0cce6b;
              --warning-color: #fca311;
              --error-color: #e63946;
              
              /* Dark theme */
              --bg-dark: #0f172a;
              --bg-darker: #0a0f1c;
              --surface-dark: #1e293b;
              --surface-darker: #172033;
              --border-dark: #334155;
              --text-primary: rgba(255, 255, 255, 0.92);
              --text-secondary: rgba(255, 255, 255, 0.7);
              --text-muted: rgba(255, 255, 255, 0.5);
            }
            /* Animations and transitions */
            @keyframes gradient-shift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            
            @keyframes floating {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
              100% { transform: translateY(0px); }
            }
            
            @keyframes pulse {
              0% { opacity: 0.6; }
              50% { opacity: 1; }
              100% { opacity: 0.6; }
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: var(--bg-dark);
              color: var(--text-primary);
              margin: 0;
              padding: 0;
              min-height: 100vh;
              overflow-x: hidden;
              transition: background-color 0.3s ease;
            }
            /* Modernized header with gradient */
            .app {
              display: flex;
              flex-direction: column;
              min-height: 100vh;
              position: relative;
            }
            
            .header {
              background: linear-gradient(135deg, var(--primary-dark), var(--primary-color), var(--secondary-color));
              background-size: 200% 200%;
              animation: gradient-shift 15s ease infinite;
              padding: 1.5rem 2rem;
              display: flex;
              align-items: center;
              justify-content: space-between;
              position: relative;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
              z-index: 10;
            }
            
            .header h1 {
              color: white;
              margin: 0;
              font-size: 1.8rem;
              font-weight: 700;
              letter-spacing: -0.5px;
              display: flex;
              align-items: center;
              opacity: 0; /* Start invisible for animation */
            }
            
            .header h1::before {
              content: "";
              display: inline-block;
              width: 24px;
              height: 24px;
              margin-right: 10px;
              background: rgba(255, 255, 255, 0.9);
              border-radius: 50%;
            }
            
            .header-subtitle {
              color: rgba(255, 255, 255, 0.85);
              font-weight: 400;
              margin-left: auto;
              padding-left: 24px;
              opacity: 0; /* Start invisible for animation */
            }
            .content {
              padding: 2rem;
              flex: 1;
              background: var(--bg-dark) url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%233f37c9' fill-opacity='0.03' fill-rule='evenodd'/%3E%3C/svg%3E") center/cover;
            }
            
            .row {
              display: flex;
              flex-wrap: wrap;
              gap: 1.5rem;
              max-width: 1400px;
              margin: 0 auto;
              opacity: 0; /* Start invisible for animation */
            }
            
            .col {
              flex: 1;
              min-width: 300px;
            }
            
            .col:first-child {
              flex: 0 0 320px;
            }
            
            .card {
              background-color: var(--surface-dark);
              border-radius: 12px;
              box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.3);
              padding: 1.5rem;
              margin-bottom: 1.5rem;
              border: 1px solid var(--border-dark);
              transition: transform 0.3s ease, box-shadow 0.3s ease;
              opacity: 0; /* Start invisible for animation */
              transform: translateY(20px); /* Start below for animation */
            }
            
            .card:hover {
              transform: translateY(-5px);
              box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.35);
            }
            
            .card-title {
              margin-top: 0;
              margin-bottom: 1.2rem;
              color: var(--text-primary);
              font-size: 1.25rem;
              font-weight: 600;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
            }
            
            .card-title::after {
              content: "";
              position: absolute;
              bottom: -8px;
              left: 0;
              width: 50px;
              height: 3px;
              background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
              border-radius: 3px;
            }
            .form-group {
              margin-bottom: 1.2rem;
            }
            
            .form-label {
              display: block;
              margin-bottom: 0.5rem;
              color: var(--text-secondary);
              font-size: 0.9rem;
              font-weight: 500;
            }
            
            .form-control {
              width: 100%;
              padding: 0.8rem 1rem;
              background-color: var(--surface-darker);
              border: 1px solid var(--border-dark);
              border-radius: 8px;
              color: var(--text-primary);
              font-size: 0.95rem;
              transition: all 0.2s ease;
            }
            
            .form-control:focus {
              border-color: var(--primary-color);
              outline: none;
              box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
            }
            
            .form-select {
              width: 100%;
              padding: 0.8rem 1rem;
              background-color: var(--surface-darker);
              border: 1px solid var(--border-dark);
              border-radius: 8px;
              color: var(--text-primary);
              font-size: 0.95rem;
              transition: all 0.2s ease;
              appearance: none;
              background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
              background-repeat: no-repeat;
              background-position: right 1rem center;
              background-size: 10px;
            }
            
            .form-select:focus {
              border-color: var(--primary-color);
              outline: none;
              box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
            }
            
            .btn {
              padding: 0.8rem 1.5rem;
              border-radius: 8px;
              border: none;
              cursor: pointer;
              font-size: 0.95rem;
              font-weight: 500;
              transition: all 0.2s ease;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              text-decoration: none;
              position: relative;
              overflow: hidden;
            }
            
            .btn::after {
              content: "";
              position: absolute;
              top: 50%;
              left: 50%;
              width: 5px;
              height: 5px;
              background: rgba(255, 255, 255, 0.3);
              opacity: 0;
              border-radius: 100%;
              transform: scale(1, 1) translate(-50%);
              transform-origin: 50% 50%;
            }
            
            .btn:focus:not(:active)::after {
              animation: ripple 1s ease-out;
            }
            
            @keyframes ripple {
              0% {
                transform: scale(0, 0);
                opacity: 0.5;
              }
              100% {
                transform: scale(20, 20);
                opacity: 0;
              }
            }
            
            .btn-primary {
              background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
              color: white;
              box-shadow: 0 4px 14px rgba(67, 97, 238, 0.3);
            }
            
            .btn-primary:hover {
              background: linear-gradient(135deg, var(--primary-light), var(--primary-color));
              box-shadow: 0 6px 20px rgba(67, 97, 238, 0.4);
              transform: translateY(-2px);
            }
            
            .btn-primary:active {
              transform: translateY(1px);
              box-shadow: 0 2px 10px rgba(67, 97, 238, 0.3);
            }
            
            .btn:disabled {
              background: #4c5572;
              cursor: not-allowed;
              box-shadow: none;
              opacity: 0.7;
            }
            
            .tag {
              display: inline-flex;
              align-items: center;
              padding: 0.35rem 0.8rem;
              border-radius: 6px;
              font-size: 0.8rem;
              font-weight: 500;
              margin-left: 0.75rem;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
              transition: all 0.2s ease;
            }
            
            .tag-success {
              background-color: rgba(12, 206, 107, 0.15);
              border: 1px solid rgba(12, 206, 107, 0.3);
              color: var(--success-color);
            }
            
            .tag-error {
              background-color: rgba(230, 57, 70, 0.15);
              border: 1px solid rgba(230, 57, 70, 0.3);
              color: var(--error-color);
            }
            
            .loading-tag {
              position: relative;
              background-color: rgba(252, 163, 17, 0.15);
              border: 1px solid rgba(252, 163, 17, 0.3);
              color: var(--warning-color);
            }
            
            .loading-tag::after {
              content: "●";
              margin-left: 5px;
              animation: pulse 1.5s infinite;
            }
            
            .textarea {
              min-height: 120px;
              resize: vertical;
              line-height: 1.5;
              font-family: inherit;
            }
            
            /* Loading animations */
            .loader {
              display: inline-block;
              width: 20px;
              height: 20px;
              border: 3px solid rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              border-top-color: var(--primary-light);
              animation: spin 1s ease-in-out infinite;
              margin-right: 10px;
            }
            
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            
            .loading-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: rgba(15, 23, 42, 0.85);
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s ease;
            }
            
            .loading-overlay.visible {
              opacity: 1;
              pointer-events: all;
            }
            
            .loading-spinner {
              width: 50px;
              height: 50px;
              border: 4px solid rgba(255, 255, 255, 0.1);
              border-radius: 50%;
              border-top-color: var(--primary-color);
              animation: spin 1.5s linear infinite;
            }
            
            .loading-text {
              margin-top: 1.5rem;
              color: var(--text-primary);
              font-weight: 500;
            }
            
            .loading-progress {
              margin-top: 1rem;
              width: 200px;
              height: 4px;
              background-color: rgba(255, 255, 255, 0.1);
              border-radius: 2px;
              overflow: hidden;
            }
            
            .loading-progress-bar {
              height: 100%;
              width: 0%;
              background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
            }
            
            .loading-dots {
              margin-top: 0.5rem;
              color: var(--text-secondary);
              font-size: 0.9rem;
            }
            
            .loading-dots::after {
              content: '...';
              display: inline-block;
              animation: ellipsis 1.5s infinite;
              width: 20px;
              text-align: left;
            }
            
            @keyframes ellipsis {
              0% { content: '.'; }
              33% { content: '..'; }
              66% { content: '...'; }
              100% { content: '.'; }
            }
            .suggested-query {
              display: inline-flex;
              margin: 0.3rem;
              padding: 0.5rem 1rem;
              background-color: rgba(67, 97, 238, 0.08);
              border: 1px solid rgba(67, 97, 238, 0.2);
              border-radius: 6px;
              color: var(--primary-light);
              cursor: pointer;
              transition: all 0.2s ease;
              font-size: 0.9rem;
            }
            
            .suggested-query:hover {
              background-color: rgba(67, 97, 238, 0.15);
              transform: translateY(-2px);
              box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
            }
            
            /* Modern tab design */
            .tabs {
              display: flex;
              gap: 0.5rem;
              margin-bottom: 1.5rem;
              border-bottom: 1px solid var(--border-dark);
              padding-bottom: 0.5rem;
            }
            
            .tab-item {
              padding: 0.6rem 1.2rem;
              cursor: pointer;
              border-radius: 6px;
              color: var(--text-secondary);
              background-color: transparent;
              transition: all 0.2s ease;
              font-weight: 500;
              font-size: 0.95rem;
              position: relative;
            }
            
            .tab-item.active {
              color: var(--text-primary);
              background-color: rgba(67, 97, 238, 0.08);
            }
            
            .tab-item.active::after {
              content: "";
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 30px;
              height: 3px;
              background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
              border-radius: 3px;
            }
            
            .tab-item:hover:not(.active) {
              background-color: rgba(255, 255, 255, 0.05);
              color: var(--text-primary);
            }
            
            .tab-content {
              padding: 1rem 0;
              min-height: 200px;
            }
            .pre-code {
              background-color: var(--surface-darker);
              padding: 1.2rem;
              border-radius: 8px;
              overflow-x: auto;
              color: #e6e6e6;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
              font-size: 0.9rem;
              line-height: 1.5;
              border: 1px solid var(--border-dark);
            }
            
            /* Data results styling */
            .data-rows-container {
              display: flex;
              flex-direction: column;
              gap: 1.2rem;
              margin-bottom: 1.5rem;
            }
            
            .data-row-card {
              background-color: var(--surface-darker);
              border: 1px solid var(--border-dark);
              border-radius: 8px;
              overflow: hidden;
              transition: transform 0.3s ease, box-shadow 0.3s ease;
              opacity: 0;
              transform: translateY(20px);
            }
            
            .data-row-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            
            .data-row-header {
              background: linear-gradient(90deg, rgba(67, 97, 238, 0.15), rgba(76, 201, 240, 0.15));
              padding: 0.8rem 1.2rem;
              border-bottom: 1px solid var(--border-dark);
              font-weight: 500;
            }
            
            .data-row-table {
              width: 100%;
              border-collapse: collapse;
            }
            
            .data-row-table th {
              text-align: left;
              padding: 0.8rem 1.2rem;
              border-right: 1px solid var(--border-dark);
              border-bottom: 1px solid var(--border-dark);
              background-color: rgba(0, 0, 0, 0.1);
              font-weight: 500;
              color: var(--text-secondary);
              font-size: 0.9rem;
            }
            
            .data-row-table td {
              padding: 0.8rem 1.2rem;
              border-bottom: 1px solid var(--border-dark);
              word-break: break-word;
              font-size: 0.95rem;
            }
            
            .data-row-table tr:last-child th,
            .data-row-table tr:last-child td {
              border-bottom: none;
            }
            
            .nested-json-table {
              width: 100%;
              border-collapse: collapse;
              margin: -4px;
              border-radius: 4px;
              overflow: hidden;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .nested-json-table th {
              width: 120px;
              font-size: 0.8rem;
              background-color: rgba(0, 0, 0, 0.2);
              padding: 0.5rem 0.7rem;
            }
            
            .nested-json-table td {
              font-size: 0.8rem;
              padding: 0.5rem 0.7rem;
              color: var(--text-secondary);
            }
            
            .null-value {
              color: var(--accent-light);
              font-style: italic;
              font-size: 0.9rem;
            }
            
            .empty-object {
              color: var(--text-muted);
              font-style: italic;
              font-size: 0.9rem;
            }
            
            .table {
              width: 100%;
              border-collapse: collapse;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid var(--border-dark);
            }
            
            .table th, .table td {
              padding: 0.8rem 1.2rem;
              text-align: left;
              border-bottom: 1px solid var(--border-dark);
            }
            
            .table th {
              background-color: var(--surface-darker);
              color: var(--text-secondary);
              font-weight: 500;
              font-size: 0.9rem;
            }
            
            .table tbody tr:hover {
              background-color: rgba(255, 255, 255, 0.05);
            }
            
            /* Footer redesign */
            .footer {
              text-align: center;
              padding: 1.5rem;
              color: var(--text-muted);
              background-color: var(--bg-darker);
              border-top: 1px solid var(--border-dark);
              font-size: 0.9rem;
            }
            
            /* Responsive design adjustments */
            @media (max-width: 768px) {
              .header {
                flex-direction: column;
                align-items: flex-start;
                padding: 1.2rem 1.5rem;
              }
              
              .header-subtitle {
                margin-left: 0;
                padding-left: 0;
                margin-top: 0.5rem;
              }
              
              .content {
                padding: 1.2rem;
              }
              
              .row {
                flex-direction: column;
                margin: 0;
              }
              
              .col {
                flex: 1 1 100%;
                padding: 0;
              }
              
              .tabs {
                overflow-x: auto;
                padding-bottom: 0.5rem;
              }
            }
        </style>
      </head>
      <body>
        <div class="app">
          <!-- Loading overlay for long operations -->
          <div id="loading-overlay" class="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">Processing your query</div>
            <div class="loading-progress">
              <div id="loading-progress-bar" class="loading-progress-bar"></div>
            </div>
            <div class="loading-dots">Please wait</div>
          </div>
        
          <div class="header">
            <h1>Database Query Assistant</h1>
            <span class="header-subtitle">Transform natural language into SQL and insights</span>
          </div>
          
          <div class="content">
            <div class="row">
              <div class="col" style="flex: 0 0 300px;">
                <div class="card" id="connection-card">
                  <h2 class="card-title">Database Connection</h2>
                  <form id="db-connection-form">
                    <div class="form-group">
                      <label class="form-label">Database Type</label>
                      <select class="form-select" id="db-type">
                        <option value="oracle">Oracle</option>
                        <option value="postgres">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="mssql">SQL Server</option>
                      </select>
                    </div>
                    
                    <div class="form-group">
                      <label class="form-label">Username</label>
                      <input type="text" class="form-control" id="db-username" placeholder="Database username" />
                    </div>
                    
                    <div class="form-group">
                      <label class="form-label">Password</label>
                      <input type="password" class="form-control" id="db-password" placeholder="Database password" />
                    </div>
                    
                    <div id="oracle-fields">
                      <div class="form-group">
                        <label class="form-label">Connection String</label>
                        <input type="text" class="form-control" id="db-connection-string" placeholder="e.g., localhost:1521/XEPDB1" />
                      </div>
                    </div>
                    
                    <div id="standard-fields" style="display: none;">
                      <div class="form-group">
                        <label class="form-label">Host</label>
                        <input type="text" class="form-control" id="db-host" placeholder="e.g., localhost" />
                      </div>
                      
                      <div class="form-group">
                        <label class="form-label">Port</label>
                        <input type="number" class="form-control" id="db-port" placeholder="Port number" />
                      </div>
                      
                      <div class="form-group">
                        <label class="form-label">Database Name</label>
                        <input type="text" class="form-control" id="db-name" placeholder="e.g., postgres, mydatabase" />
                      </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" id="connect-button">Connect to Database</button>
                  </form>
                </div>
              </div>
              
              <div class="col">
                <div class="card">
                  <h2 class="card-title">
                    Ask in Natural Language
                    <span id="connection-status" class="tag tag-error">Not Connected</span>
                  </h2>
                  
                  <form id="query-form">
                    <div class="form-group">
                      <textarea 
                        class="form-control textarea" 
                        id="prompt" 
                        placeholder="Ask anything about your database in plain English, e.g., 'Show me the top 10 customers by order value'"
                        disabled
                      ></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" disabled id="submit-query">Submit Query</button>
                  </form>
                  
                  <div id="suggested-queries" style="margin-top: 16px;">
                    <div><strong>Suggested queries:</strong></div>
                    <div style="margin-top: 8px;">
                      <span class="suggested-query">Show me all tables in this database</span>
                      <span class="suggested-query">List the columns in the employees table</span>
                      <span class="suggested-query">What is the average salary by department?</span>
                      <span class="suggested-query">Show top 10 orders by value</span>
                      <span class="suggested-query">Count of customers by country</span>
                    </div>
                  </div>
                </div>
                
                <div id="query-results" style="display: none;" class="card">
                  <h2 class="card-title">Query Results</h2>
                  
                  <div class="tabs">
                    <div class="tab-item active" data-tab="summary">Summary</div>
                    <div class="tab-item" data-tab="data">Data</div>
                    <div class="tab-item" data-tab="sql">SQL Queries</div>
                  </div>
                  
                  <div class="tab-content" id="tab-summary">
                    <div id="result-summary"></div>
                  </div>
                  
                  <div class="tab-content" id="tab-data" style="display: none;">
                    <div id="result-data"></div>
                  </div>
                  
                  <div class="tab-content" id="tab-sql" style="display: none;">
                    <div id="executed-queries"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            Database Query Assistant ©2025 - Ask databases using natural language
          </div>
        </div>
        
        <script>
          // Initialize animations when the page loads
          document.addEventListener('DOMContentLoaded', function() {
            // Header animations
            anime({
              targets: '.header h1',
              opacity: [0, 1],
              translateY: [20, 0],
              easing: 'easeOutCubic',
              duration: 800,
              delay: 300
            });
            
            anime({
              targets: '.header-subtitle',
              opacity: [0, 1],
              translateY: [20, 0],
              easing: 'easeOutCubic',
              duration: 800,
              delay: 500
            });
            
            // Content animations
            anime({
              targets: '.row',
              opacity: [0, 1],
              translateY: [30, 0],
              easing: 'easeOutCubic',
              duration: 1000,
              delay: 700
            });
            
            // Card animations - staggered
            anime({
              targets: '.card',
              opacity: [0, 1],
              translateY: [40, 0],
              easing: 'easeOutCubic',
              duration: 800,
              delay: anime.stagger(200, {start: 900})
            });
            
            // Suggestion animations
            anime({
              targets: '.suggested-query',
              opacity: [0, 1],
              translateY: [10, 0],
              scale: [0.9, 1],
              easing: 'easeOutElastic(1, .6)',
              duration: 1200,
              delay: anime.stagger(100, {start: 1200})
            });
          });
          
          // Function to show loading overlay with animation
          function showLoadingOverlay() {
            const overlay = document.getElementById('loading-overlay');
            overlay.classList.add('visible');
            
            // Reset and animate progress bar
            const progressBar = document.getElementById('loading-progress-bar');
            progressBar.style.width = '0%';
            
            // Progress animation (takes 20 seconds to reach 90%, then pauses)
            anime({
              targets: '#loading-progress-bar',
              width: ['0%', '90%'],
              easing: 'easeInOutQuad',
              duration: 20000,
              complete: function() {
                // After reaching 90%, pulse to show it's still working
                anime({
                  targets: '#loading-progress-bar',
                  opacity: [0.7, 1],
                  easing: 'easeInOutSine',
                  direction: 'alternate',
                  loop: true,
                  duration: 800
                });
              }
            });
          }
          
          // Function to hide loading overlay
          function hideLoadingOverlay() {
            const overlay = document.getElementById('loading-overlay');
            
            // Complete the progress bar first
            anime({
              targets: '#loading-progress-bar',
              width: '100%',
              easing: 'easeOutCirc',
              duration: 500,
              complete: function() {
                // Then fade out the overlay
                anime({
                  targets: '#loading-overlay',
                  opacity: 0,
                  duration: 500,
                  easing: 'easeOutQuad',
                  complete: function() {
                    overlay.classList.remove('visible');
                  }
                });
              }
            });
          }
          
          // Animate elements when they appear
          function animateDataRows() {
            anime({
              targets: '.data-row-card',
              opacity: [0, 1],
              translateY: [20, 0],
              easing: 'easeOutCubic',
              duration: 800,
              delay: anime.stagger(100)
            });
          }
          
          // Database type toggle logic
          document.getElementById('db-type').addEventListener('change', function() {
            const type = this.value;
            if (type === 'oracle') {
              document.getElementById('oracle-fields').style.display = 'block';
              document.getElementById('standard-fields').style.display = 'none';
            } else {
              document.getElementById('oracle-fields').style.display = 'none';
              document.getElementById('standard-fields').style.display = 'block';
              
              // Set default ports
              let defaultPort = 5432; // PostgreSQL
              if (type === 'mysql') defaultPort = 3306;
              if (type === 'mssql') defaultPort = 1433;
              document.getElementById('db-port').value = defaultPort;
            }
          });
          
          // Tab switching
          document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', function() {
              // Make all tabs inactive
              document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
              // Hide all tab contents
              document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
              
              // Make the clicked tab active
              this.classList.add('active');
              // Show the corresponding content
              document.getElementById('tab-' + this.dataset.tab).style.display = 'block';
            });
          });
          
          // Handle database connection form submission
          document.getElementById('db-connection-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const dbType = document.getElementById('db-type').value;
            const username = document.getElementById('db-username').value;
            const password = document.getElementById('db-password').value;
            const connectBtn = document.getElementById('connect-button');
            
            let connectionDetails = {
              type: dbType,
              username,
              password
            };
            
            if (dbType === 'oracle') {
              connectionDetails.connectionString = document.getElementById('db-connection-string').value;
            } else {
              const host = document.getElementById('db-host').value;
              const port = document.getElementById('db-port').value;
              connectionDetails.host = host;
              connectionDetails.port = parseInt(port);
              connectionDetails.database = document.getElementById('db-name').value;
            }
            
            const statusEl = document.getElementById('connection-status');
            statusEl.textContent = 'Connecting...';
            statusEl.className = 'tag loading-tag';
            
            // Disable the connect button and animate it
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<span class="loader"></span>Connecting...';
            
            // Log the connection details for debugging
            console.log('Sending connection details to API:', connectionDetails);
            
            // Call the API to test connection
            fetch('/ask/test-connection', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(connectionDetails)
            })
            .then(response => {
              console.log('Connection test response status:', response.status);
              return response.json();
            })
            .then(data => {
              console.log('Connection test response data:', data);
              if (data.success) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'tag tag-success';
                
                // Add success animation to the connection card
                anime({
                  targets: '#connection-card',
                  scale: [1, 1.02, 1],
                  boxShadow: [
                    '0 10px 30px -5px rgba(0, 0, 0, 0.3)',
                    '0 15px 40px -5px rgba(12, 206, 107, 0.4)',
                    '0 10px 30px -5px rgba(0, 0, 0, 0.3)'
                  ],
                  duration: 1000,
                  easing: 'easeOutElastic(1, .6)'
                });
                
                // Enable prompt textarea and submit button with animation
                document.getElementById('prompt').disabled = false;
                document.getElementById('submit-query').disabled = false;
                
                anime({
                  targets: '#prompt',
                  backgroundColor: [
                    'rgba(23, 32, 51, 1)',
                    'rgba(12, 206, 107, 0.1)',
                    'rgba(23, 32, 51, 1)'
                  ],
                  borderColor: [
                    'rgba(51, 65, 85, 1)',
                    'rgba(12, 206, 107, 0.5)',
                    'rgba(51, 65, 85, 1)'
                  ],
                  duration: 1500,
                  easing: 'easeOutCubic'
                });
                
                // Store connection details
                window.connectionDetails = connectionDetails;
              } else {
                statusEl.textContent = 'Connection Failed';
                statusEl.className = 'tag tag-error';
                alert('Failed to connect: ' + data.message);
                
                // Shake animation for error
                anime({
                  targets: '#connection-card',
                  translateX: [0, -10, 10, -10, 10, 0],
                  duration: 600,
                  easing: 'easeInOutCubic'
                });
              }
              
              // Reset the button
              connectBtn.disabled = false;
              connectBtn.textContent = 'Connect to Database';
            })
            .catch(error => {
              statusEl.textContent = 'Connection Error';
              statusEl.className = 'tag tag-error';
              alert('Error connecting to database: ' + error.message);
              
              // Reset the button
              connectBtn.disabled = false;
              connectBtn.textContent = 'Connect to Database';
              
              // Shake animation for error
              anime({
                targets: '#connection-card',
                translateX: [0, -10, 10, -10, 10, 0],
                duration: 600,
                easing: 'easeInOutCubic'
              });
            });
          });
          
          // Fetch suggested queries from API
          console.log('Fetching suggestions from API');
          fetch('/ask/suggestions')
            .then(response => {
              console.log('Suggestions API response status:', response.status);
              return response.json();
            })
            .then(data => {
              console.log('Received suggestions data:', data);
              if (data.suggestedPrompts && data.suggestedPrompts.length > 0) {
                const suggestionsHtml = data.suggestedPrompts.map(prompt => 
                  `<span class="suggested-query">${prompt}</span>`
                ).join('');
                
                document.getElementById('suggested-queries').innerHTML = `
                  <div><strong>Suggested queries to try:</strong></div>
                  <div style="margin-top: 8px;">${suggestionsHtml}</div>
                `;
                
                // Add event listeners
                document.querySelectorAll('.suggested-query').forEach(query => {
                  query.addEventListener('click', function() {
                    document.getElementById('prompt').value = this.textContent;
                  });
                });
              }
            })
            .catch(error => {
              console.error('Error fetching suggestions:', error);
              // Still add event listeners to default suggestions
              document.querySelectorAll('.suggested-query').forEach(query => {
                query.addEventListener('click', function() {
                  document.getElementById('prompt').value = this.textContent;
                });
              });
            });
          
          // Add animation to suggested query clicks
          document.addEventListener('click', function(e) {
            if (e.target.classList.contains('suggested-query')) {
              // Set value in the prompt field
              document.getElementById('prompt').value = e.target.textContent;
              
              // Animate the clicked suggestion
              anime({
                targets: e.target,
                scale: [1, 1.1, 1],
                backgroundColor: [
                  'rgba(67, 97, 238, 0.08)',
                  'rgba(67, 97, 238, 0.2)',
                  'rgba(67, 97, 238, 0.08)'
                ],
                duration: 600,
                easing: 'easeOutCubic'
              });
              
              // Also animate the textarea
              anime({
                targets: '#prompt',
                borderColor: [
                  'rgba(51, 65, 85, 1)',
                  'rgba(67, 97, 238, 0.5)',
                  'rgba(51, 65, 85, 1)'
                ],
                duration: 800,
                easing: 'easeOutCubic'
              });
            }
          });
          
          // Handle query submission
          document.getElementById('query-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!window.connectionDetails) {
              alert('Please connect to a database first');
              return;
            }
            
            const prompt = document.getElementById('prompt').value;
            const submitBtn = document.getElementById('submit-query');
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader"></span>Processing...';
            
            // Show the loading overlay since this operation takes time
            showLoadingOverlay();
            
            // Prepare request data
            const requestData = {
              ...window.connectionDetails,
              prompt
            };
            
            // Call the API
            fetch('/ask', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestData)
            })
            .then(response => response.json())
            .then(data => {
              // Hide loading overlay
              hideLoadingOverlay();
              
              // Show results card with animation
              const resultsCard = document.getElementById('query-results');
              if (resultsCard.style.display === 'none') {
                resultsCard.style.display = 'block';
                resultsCard.style.opacity = 0;
                anime({
                  targets: '#query-results',
                  opacity: [0, 1],
                  translateY: [20, 0],
                  easing: 'easeOutCubic',
                  duration: 600
                });
              }
              
              // Populate summary tab
              document.getElementById('result-summary').innerHTML = `<p>${data.result}</p>`;
              
              // Animate summary content
              anime({
                targets: '#result-summary p',
                opacity: [0, 1],
                translateY: [10, 0],
                easing: 'easeOutCubic',
                duration: 600
              });
              
              // Populate data tab with a more readable format
              if (data.rawResults && data.rawResults.length > 0) {
                const dataContainer = document.createElement('div');
                dataContainer.className = 'data-rows-container';
                
                // For each row of data, create a card-like structure
                data.rawResults.forEach((row, rowIndex) => {
                  const rowCard = document.createElement('div');
                  rowCard.className = 'data-row-card';
                  
                  // Create a header for the row
                  const rowHeader = document.createElement('div');
                  rowHeader.className = 'data-row-header';
                  rowHeader.innerHTML = `<strong>Row ${rowIndex + 1}</strong>`;
                  rowCard.appendChild(rowHeader);
                  
                  // Create a table for this row's data
                  const rowTable = document.createElement('table');
                  rowTable.className = 'data-row-table';
                  
                  // Add each field as a row in this table (column orientation)
                  Object.entries(row).forEach(([key, value]) => {
                    const tr = document.createElement('tr');
                    
                    // Key cell
                    const keyCell = document.createElement('th');
                    keyCell.textContent = key;
                    keyCell.style.width = '200px';
                    tr.appendChild(keyCell);
                    
                    // Value cell with intelligent formatting
                    const valueCell = document.createElement('td');
                    
                    if (value === null) {
                      valueCell.innerHTML = '<span class="null-value">NULL</span>';
                    } else if (typeof value === 'object') {
                      // Handle JSON objects recursively
                      if (Object.keys(value).length === 0) {
                        valueCell.innerHTML = '<span class="empty-object">{}</span>';
                      } else {
                        const jsonTable = document.createElement('table');
                        jsonTable.className = 'nested-json-table';
                        
                        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                          const jsonRow = document.createElement('tr');
                          
                          const nestedKeyCell = document.createElement('th');
                          nestedKeyCell.textContent = nestedKey;
                          jsonRow.appendChild(nestedKeyCell);
                          
                          const nestedValueCell = document.createElement('td');
                          nestedValueCell.textContent = nestedValue === null ? 'NULL' : 
                                        typeof nestedValue === 'object' ? JSON.stringify(nestedValue) : nestedValue;
                          jsonRow.appendChild(nestedValueCell);
                          
                          jsonTable.appendChild(jsonRow);
                        });
                        
                        valueCell.appendChild(jsonTable);
                      }
                    } else {
                      // Simple values
                      valueCell.textContent = value;
                    }
                    
                    tr.appendChild(valueCell);
                    rowTable.appendChild(tr);
                  });
                  
                  rowCard.appendChild(rowTable);
                  dataContainer.appendChild(rowCard);
                });
                
                // Add a style block for our new components
                const styleBlock = document.createElement('style');
                styleBlock.textContent = `
                  .data-rows-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    margin-bottom: 20px;
                  }
                  .data-row-card {
                    background-color: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    overflow: hidden;
                  }
                  .data-row-header {
                    background-color: rgba(24, 144, 255, 0.1);
                    padding: 8px 16px;
                    border-bottom: 1px solid var(--border-color);
                  }
                  .data-row-table {
                    width: 100%;
                    border-collapse: collapse;
                  }
                  .data-row-table th {
                    text-align: left;
                    padding: 8px 16px;
                    border-right: 1px solid var(--border-color);
                    border-bottom: 1px solid var(--border-color);
                    background-color: var(--background-color);
                    font-weight: normal;
                    color: var(--text-secondary-color);
                  }
                  .data-row-table td {
                    padding: 8px 16px;
                    border-bottom: 1px solid var(--border-color);
                    word-break: break-word;
                  }
                  .data-row-table tr:last-child th,
                  .data-row-table tr:last-child td {
                    border-bottom: none;
                  }
                  .nested-json-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: -4px;
                  }
                  .nested-json-table th {
                    width: 120px;
                    font-size: 12px;
                    background-color: rgba(0, 0, 0, 0.1);
                  }
                  .nested-json-table td {
                    font-size: 12px;
                  }
                  .null-value {
                    color: #b37feb;
                    font-style: italic;
                  }
                  .empty-object {
                    color: #d9d9d9;
                    font-style: italic;
                  }
                `;
                
                document.getElementById('result-data').innerHTML = '';
                document.getElementById('result-data').appendChild(styleBlock);
                document.getElementById('result-data').appendChild(dataContainer);
              } else {
                document.getElementById('result-data').innerHTML = '<p>No tabular data returned</p>';
              }
              
              // Populate SQL queries tab
              if (data.executedQueries && data.executedQueries.length > 0) {
                const queriesHtml = data.executedQueries.map((query, index) => `
                  <div style="margin-bottom: 16px;">
                    <strong>Query ${index + 1}:</strong>
                    <pre class="pre-code">${query}</pre>
                  </div>
                `).join('');
                document.getElementById('executed-queries').innerHTML = queriesHtml;
              } else {
                document.getElementById('executed-queries').innerHTML = '<p>No SQL queries were executed</p>';
              }
              
              // Update suggested queries if available
              if (data.suggestedPrompts && data.suggestedPrompts.length > 0) {
                const suggestionsHtml = data.suggestedPrompts.map(prompt => 
                  `<span class="suggested-query">${prompt}</span>`
                ).join('');
                document.getElementById('suggested-queries').innerHTML = `
                  <div><strong>Suggested follow-up queries:</strong></div>
                  <div style="margin-top: 8px;">${suggestionsHtml}</div>
                `;
                
                // Reattach event listeners to new suggested queries
                document.querySelectorAll('.suggested-query').forEach(query => {
                  query.addEventListener('click', function() {
                    document.getElementById('prompt').value = this.textContent;
                  });
                });
              }
              
              // Reset button state
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit Query';
            })
            .catch(error => {
              // Hide loading overlay
              hideLoadingOverlay();
              
              alert('Error processing query: ' + error.message);
              
              // Reset button state
              submitBtn.disabled = false;
              submitBtn.innerHTML = 'Submit Query';
              
              // Error animation
              anime({
                targets: '#query-form',
                translateX: [0, -10, 10, -10, 10, 0],
                duration: 600,
                easing: 'easeInOutCubic'
              });
            });
          });
        </script>
      </body>
    </html>
    """

@app.route("/")
def root_index():
    """Redirect to /app which serves the main HTML application"""
    return redirect('/app')

# Proxy all requests with /ask/* to the NestJS server
@app.route('/ask', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
@app.route('/ask/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def proxy_to_nestjs(path):
    """Proxy API requests to the NestJS server"""
    nestjs_url = f'http://0.0.0.0:3000/ask/{path}'
    
    # Forward the request method and body
    if request.method == 'OPTIONS':
        # Handle preflight request
        resp = Response("")
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    
    # Forward the request
    try:
        if path == '':
            nestjs_url = 'http://0.0.0.0:3000/ask'
        
        print(f"Proxying request to {nestjs_url}")
        
        # Forward the request with the appropriate method
        headers = {key: value for key, value in request.headers.items() if key.lower() != 'host'}
        resp = requests.request(
            method=request.method,
            url=nestjs_url,
            headers=headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False
        )
        
        # Create a Flask response object from the requests response
        content_type = resp.headers.get('content-type', 'application/json')
        response = Response(resp.content, resp.status_code, content_type=content_type)
        
        # Add all other headers from the original response
        for key, value in resp.headers.items():
            if key.lower() != 'content-length' and key.lower() != 'content-type':
                response.headers[key] = value
                
        return response
    except requests.RequestException as e:
        print(f"Request error proxying to NestJS: {e}")
        return jsonify({"error": f"API connection error: {str(e)}"}), 502
    except Exception as e:
        print(f"Error proxying to NestJS: {e}")
        return jsonify({"error": f"API server error: {str(e)}"}), 500

@app.route("/restart")
def restart_nestjs():
    """Endpoint to restart the NestJS server"""
    global nestjs_process
    
    if nestjs_process:
        # Terminate the existing process
        nestjs_process.terminate()
        nestjs_process.wait()
    
    # Start a new NestJS process
    success = start_nestjs()
    
    if success:
        return jsonify({"status": "ok", "message": "NestJS server restarted"})
    else:
        return jsonify({"status": "error", "message": "Failed to restart NestJS server"}), 500

# Clean up the child process when the parent exits
def cleanup(signum, frame):
    if nestjs_process:
        nestjs_process.terminate()
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

# Catch-all route to handle other URLs
@app.route('/<path:path>')
def catch_all(path):
    """Handle any other URLs by redirecting to index"""
    # Excludes any paths that are already handled by other routes
    if not path.startswith('ask'):
        return redirect(url_for('root_index'))
    return "Not found", 404

# Start the NestJS server when the Flask app starts
start_nestjs()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)