/**
 * Example MCP Server - Simple implementation for Perplexica
 * 
 * To run: npm install express cors && node examples/mcp-server-example.js
 */
const express = require('express');
const app = express();
app.use(express.json());
app.use(require('cors')());

const tools = [
  { id: 'calculator', name: 'Calculator', description: 'Math calculations', category: 'computation', inputSchema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } }
];

app.get('/', (req, res) => res.json({ name: 'Example MCP Server', tools: tools.length }));
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/tools', (req, res) => res.json({ success: true, tools }));
app.post('/tools/:toolId/execute', (req, res) => {
  try {
    const result = eval(req.body.input.expression);
    res.json({ success: true, output: { result, expression: req.body.input.expression } });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(8080, () => console.log('MCP Server on http://localhost:8080'));
