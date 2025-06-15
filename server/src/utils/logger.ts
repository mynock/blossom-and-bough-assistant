import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Configure winston logger
export const debugLog = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'scheduling-assistant' },
  transports: [
    // Write all logs to debug.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'debug.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Write errors to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  debugLog.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: 'info' // Only show info and above in console
  }));
}

// Helper methods for common logging patterns
export const logApiCall = (endpoint: string, data: any) => {
  debugLog.info('API Call', { endpoint, data, timestamp: new Date().toISOString() });
};

export const logError = (error: Error, context?: any) => {
  debugLog.error('Error occurred', { 
    message: error.message, 
    stack: error.stack, 
    context,
    timestamp: new Date().toISOString() 
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  debugLog.info('Performance', { 
    operation, 
    duration, 
    metadata,
    timestamp: new Date().toISOString() 
  });
}; 