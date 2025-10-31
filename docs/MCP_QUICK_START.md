# MCP Integration - Quick Start

This document provides a quick overview of the MCP (Model Context Protocol) integration in Perplexica.

## What is MCP?

MCP (Model Context Protocol) is a standardized protocol that allows AI applications to connect to external tools and data sources. This integration enables Perplexica to leverage external tools during searches, providing more comprehensive and accurate answers.

## Key Features

✅ **Automatic Tool Discovery** - Discovers available tools from MCP servers  
✅ **Intelligent Tool Selection** - AI automatically selects appropriate tools  
✅ **Seamless Integration** - Combines tool results with web search  
✅ **Multiple Protocols** - Supports HTTP, WebSocket, and stdio  
✅ **Authentication** - API keys, bearer tokens, OAuth support  
✅ **Rate Limiting** - Configurable limits per server/tool/user  
✅ **Monitoring** - Execution metrics and health checks  
✅ **Caching** - Tool metadata and result caching  

## Architecture Overview

```
User Query → MCP Search Agent → [Tool Selection] → [Tool Execution] → [Combine with Web Search] → Response
                                        ↓                    ↓
                                 Tool Registry         Tool Executor
                                        ↓                    ↓
                                 Server Manager        MCP Server
```

## Quick Start (5 minutes)

### 1. Start Example MCP Server

```bash
# In terminal 1
cd perplexica
npm install express cors
node examples/mcp-server-example.js
```

### 2. Add Server via API

```bash
# In terminal 2
curl -X POST http://localhost:3000/api/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "example-server",
    "name": "Example MCP Server",
    "url": "http://localhost:8080",
    "protocol": "http",
    "enabled": true
  }'
```

### 3. Enable MCP in Config

Edit `data/mcp-config.json`:
```json
{
  "enabled": true
}
```

Or via API:
```bash
# Enable MCP system
# (Feature to be added in UI)
```

### 4. Try MCP Search

Use the "MCP Search" focus mode in Perplexica and try queries like:
- "What is 25 * 47?"
- "Analyze this text: The quick brown fox jumps over the lazy dog"

## Directory Structure

```
src/lib/mcp/
├── types.ts          # Type definitions
├── manager.ts        # Server connection manager
├── registry.ts       # Tool discovery and caching
├── executor.ts       # Tool execution engine
├── config.ts         # Configuration management
└── index.ts          # Main exports

src/app/api/mcp/
├── servers/route.ts  # Server management API
├── tools/route.ts    # Tool execution API
└── status/route.ts   # Status and metrics API

src/lib/chains/
└── mcpSearchAgent.ts # Agent that integrates MCP tools

docs/
├── architecture/MCP_INTEGRATION.md  # Detailed architecture
└── MCP_USER_GUIDE.md                # Complete user guide

examples/
├── mcp-server-example.js            # Example MCP server
└── README.md                        # Examples documentation
```

## API Endpoints

### Server Management
- `GET /api/mcp/servers` - List all servers
- `POST /api/mcp/servers` - Add server
- `PUT /api/mcp/servers` - Update server
- `DELETE /api/mcp/servers?id={id}` - Remove server

### Tool Management
- `GET /api/mcp/tools` - List/search tools
- `POST /api/mcp/tools/execute` - Execute tool

### System Status
- `GET /api/mcp/status` - Get status and metrics

## Configuration

MCP configuration is stored in `data/mcp-config.json`:

```json
{
  "enabled": true,
  "servers": [
    {
      "id": "my-server",
      "name": "My MCP Server",
      "url": "http://localhost:8080",
      "protocol": "http",
      "enabled": true
    }
  ],
  "defaultTimeout": 30000,
  "maxConcurrentExecutions": 10,
  "enableToolCaching": true,
  "rateLimits": {
    "perServer": 100,
    "perUser": 1000,
    "perTool": 50
  }
}
```

## Creating Your Own MCP Server

Minimal example:

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// List tools
app.get('/tools', (req, res) => {
  res.json({
    success: true,
    tools: [{
      id: 'my-tool',
      name: 'My Tool',
      description: 'Does something useful',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      }
    }]
  });
});

// Execute tool
app.post('/tools/:toolId/execute', (req, res) => {
  const { input } = req.body;
  // Your tool logic here
  res.json({
    success: true,
    output: { result: 'Processed: ' + input.input }
  });
});

app.listen(8080);
```

## Security Best Practices

1. ✅ Use authentication for external servers
2. ✅ Validate all tool inputs
3. ✅ Set appropriate timeouts
4. ✅ Configure rate limits
5. ✅ Monitor execution metrics
6. ✅ Review tools before enabling servers

## Troubleshooting

### Server Won't Connect
- Check URL and protocol are correct
- Verify server is running and accessible
- Check authentication credentials
- Review firewall settings

### Tools Not Appearing
- Verify server is connected: `GET /api/mcp/status`
- Check server logs for errors
- Try restarting the server connection

### Tool Execution Fails
- Check input matches tool's input schema
- Verify server is responsive
- Review timeout settings
- Check server logs

## Next Steps

1. Read the [complete user guide](MCP_USER_GUIDE.md)
2. Review the [architecture document](architecture/MCP_INTEGRATION.md)
3. Try the [example server](../examples/mcp-server-example.js)
4. Create your own MCP tools
5. Integrate with external APIs

## Support

- GitHub Issues: https://github.com/ItzCrazyKns/Perplexica/issues
- Discord: https://discord.gg/EFwsmQDgAu

## Current Status

### ✅ Implemented
- Core infrastructure (types, managers, registry, executor)
- API endpoints for server and tool management
- MCP Search Agent with intelligent tool selection
- Configuration management system
- Logging and monitoring
- Example MCP server

### 🚧 In Progress / Future Work
- UI for MCP server management
- Actual MCP protocol implementations (HTTP, WebSocket, stdio)
- Comprehensive test coverage
- Additional security features
- Performance optimizations
- More example servers

### 📝 Note
The current implementation provides a complete framework for MCP integration. The actual protocol communication (HTTP requests, WebSocket connections, stdio pipes) needs to be implemented based on the finalized MCP specification. Placeholder methods are marked with TODO comments in the code.
