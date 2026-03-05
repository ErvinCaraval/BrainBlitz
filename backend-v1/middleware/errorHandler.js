/**
 * Error Handler Middleware
 * ✅ SECURITY FIX: Prevents leaking sensitive error information to clients
 */

function errorHandler(err, req, res, next) {
  // Log the full error server-side (for debugging)
  console.error('Internal Server Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Don't expose internal error messages to client
  const statusCode = err.statusCode || err.status || 500;
  
  // Generic error message for production
  const isProduction = process.env.NODE_ENV === 'production';
  const clientMessage = isProduction 
    ? 'Internal server error. Please contact support if the problem persists.'
    : err.message;

  res.status(statusCode).json({
    error: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      details: {
        message: err.message,
        stack: err.stack
      }
    })
  });
}

module.exports = errorHandler;
