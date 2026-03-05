/**
 * Runtime environment configuration for frontend
 * This file is loaded before the main React app
 * It allows setting environment variables based on the current URL
 */

// Initialize ENV if not already set
if (!window.ENV) {
  window.ENV = {};
}

// Detect if running locally or in production
const hostname = window.location.hostname;
const protocol = window.location.protocol;
const port = window.location.port ? ':' + window.location.port : '';
const host = window.location.host;

const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const isRender = hostname.includes('onrender.com');
const isDocker = hostname.includes('docker') || hostname === 'frontend' || hostname === '172.18.0.1' || hostname === '172.17.0.1';

// Log current environment for debugging
console.log('[ENV CONFIG DEBUG]', {
  hostname,
  protocol,
  port,
  host,
  isLocalhost,
  isRender,
  isDocker,
  originalEnv: { ...window.ENV }
});

// Set API URL based on environment
if (!window.ENV.VITE_API_URL) {
  if (isLocalhost) {
    window.ENV.VITE_API_URL = 'http://localhost:5000/api';
    window.ENV.VITE_SOCKET_URL = 'http://localhost:5000';
  } else if (isRender) {
    // On Render: use the specific backend service URL
    window.ENV.VITE_API_URL = 'https://backend-v1-latest.onrender.com/api';
    window.ENV.VITE_SOCKET_URL = 'https://backend-v1-latest.onrender.com';
  } else if (isDocker) {
    // In Docker Compose: use the service name
    window.ENV.VITE_API_URL = 'http://backend-api:5000/api';
    window.ENV.VITE_SOCKET_URL = 'http://backend-api:5000';
  } else {
    // Generic fallback: use same host with /api path
    window.ENV.VITE_API_URL = protocol + '//' + host + '/api';
    window.ENV.VITE_SOCKET_URL = protocol + '//' + host;
  }
}

// Set Socket URL if not already set (in case it wasn't set above)
if (!window.ENV.VITE_SOCKET_URL) {
  if (isLocalhost) {
    window.ENV.VITE_SOCKET_URL = 'http://localhost:5000';
  } else if (isRender) {
    window.ENV.VITE_SOCKET_URL = 'https://backend-v1-latest.onrender.com';
  } else if (isDocker) {
    window.ENV.VITE_SOCKET_URL = 'http://backend-api:5000';
  } else {
    window.ENV.VITE_SOCKET_URL = protocol + '//' + host;
  }
}

// Final logging
console.log('[ENV CONFIG LOADED]', {
  environment: isLocalhost ? 'LOCAL' : isRender ? 'RENDER' : isDocker ? 'DOCKER' : 'UNKNOWN',
  VITE_API_URL: window.ENV.VITE_API_URL,
  VITE_SOCKET_URL: window.ENV.VITE_SOCKET_URL,
  currentUrl: window.location.href
});
