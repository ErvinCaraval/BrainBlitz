#!/bin/sh

# Generate env-config.js at runtime with environment variables from Render
cat > /usr/share/nginx/html/env-config.js << 'EOF'
/**
 * Runtime environment configuration - Generated at container startup
 */
window.ENV = {
  VITE_API_URL: window.ENV?.VITE_API_URL || (
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000/api'
      : window.location.protocol + '//' + window.location.host + '/api'
  ),
  VITE_SOCKET_URL: window.ENV?.VITE_SOCKET_URL || (
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : window.location.protocol + '//' + window.location.host
  )
};

// For Render deployment: If RENDER_EXTERNAL_URL is set, use it
if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
  // Extract the backend URL from environment or construct from hostname pattern
  const backendHost = window.location.hostname.replace('frontend-v2-latest', 'backend-v1-latest');
  window.ENV.VITE_API_URL = window.location.protocol + '//' + backendHost + '/api';
  window.ENV.VITE_SOCKET_URL = window.location.protocol + '//' + backendHost;
}

console.log('[ENV CONFIG]', window.ENV);
EOF

# Show what was generated
echo "Generated env-config.js:"
cat /usr/share/nginx/html/env-config.js

# Start nginx
exec nginx -g "daemon off;"
