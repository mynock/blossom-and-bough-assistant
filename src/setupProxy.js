const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Use environment variable for Docker, fallback to localhost for local development
  const target = process.env.PROXY_TARGET || 'http://localhost:3001';
  
  console.log(`🔄 Proxy configuration: API requests will be forwarded to ${target}`);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: target,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api', // Keep the /api prefix
      },
      onError: (err, req, res) => {
        console.error('❌ Proxy error:', err.message);
        console.error('   Request:', req.method, req.url);
        console.error('   Target:', target);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`📡 Proxying ${req.method} ${req.url} -> ${target}${req.url}`);
      }
    })
  );
}; 