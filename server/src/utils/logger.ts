import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Write all logs to console (existing behavior)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs to file
    new winston.transports.File({ 
      filename: path.join(logsDir, 'debug.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Write error logs to separate file
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Create a simple wrapper that maintains console.log behavior
export const debugLog = {
  log: (message: string, ...args: any[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}` : message;
    
    logger.info(fullMessage);
  },
  error: (message: string, ...args: any[]) => {
    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')}` : message;
    
    logger.error(fullMessage);
  }
};

export default logger; 