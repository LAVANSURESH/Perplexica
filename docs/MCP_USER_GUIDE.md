# MCP (Model Context Protocol) User Guide

## What is MCP?

The Model Context Protocol (MCP) is a standardized way for AI applications to connect to external tools and data sources. With MCP integration in Perplexica, your AI searches can now leverage external tools to provide more comprehensive and accurate answers.

## Features

### Available Capabilities

- **External Tool Integration**: Connect to MCP servers that provide specialized tools
- **Automatic Tool Discovery**: Perplexica automatically discovers available tools from connected servers
- **Intelligent Tool Selection**: AI automatically selects the most appropriate tools for your queries
- **Seamless Integration**: Tool results are combined with web search for comprehensive answers

### Use Cases

1. **Enhanced Search**: Use specialized tools alongside web search
2. **API Integration**: Access external APIs through MCP tools
3. **Specialized Computations**: Leverage tools for complex calculations
4. **Data Processing**: Use tools for data transformation and analysis

## Getting Started

### Prerequisites

- Perplexica installation (version 1.11.2 or higher)
- Access to MCP server(s) or knowledge to set up your own

### Enabling MCP

MCP is disabled by default. To enable it:

1. Navigate to Settings in Perplexica
2. Go to the "MCP" section
3. Toggle "Enable MCP" to ON
4. Click "Save Settings"

### Adding an MCP Server

#### Via UI (Coming Soon)

1. Go to Settings → MCP
2. Click "Add Server"
3. Fill in the server details:
   - **Server Name**: A friendly name for the server
   - **Server URL**: The URL of the MCP server
   - **Protocol**: Choose from HTTP, WebSocket, or stdio
   - **Authentication**: Configure if required
4. Click "Add"

#### Via API

```bash
curl -X POST http://localhost:3000/api/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-mcp-server",
    "name": "My MCP Server",
    "url": "http://localhost:8080",
    "protocol": "http",
    "enabled": true,
    "authConfig": {
      "type": "apiKey",
      "credentials": {
        "apiKey": "your-api-key"
      }
    }
  }'
```

#### Via Configuration File

Edit `data/mcp-config.json`:

```json
{
  "enabled": true,
  "servers": [
    {
      "id": "my-mcp-server",
      "name": "My MCP Server",
      "url": "http://localhost:8080",
      "protocol": "http",
      "enabled": true,
      "authConfig": {
        "type": "apiKey",
        "credentials": {
          "apiKey": "your-api-key"
        }
      }
    }
  ],
  "defaultTimeout": 30000,
  "maxConcurrentExecutions": 10,
  "enableToolCaching": true
}
```

## Using MCP in Searches

### Basic Usage

1. Enable MCP in settings
2. Add at least one MCP server
3. Select "MCP Search" as your focus mode
4. Enter your query
5. Perplexica will automatically:
   - Determine if tools are needed
   - Select appropriate tools
   - Execute the tools
   - Combine results with web search

### Example Queries

**With Calculation Tools:**
```
What is the compound interest on $10,000 at 5% for 10 years?
```

**With API Tools:**
```
What's the current weather in San Francisco and what are the top tourist attractions?
```

**With Data Tools:**
```
Convert this JSON data to CSV format: {"name": "John", "age": 30}
```

## Managing MCP Servers

### Viewing Servers

#### Via UI (Coming Soon)
Go to Settings → MCP → Servers

#### Via API
```bash
curl http://localhost:3000/api/mcp/servers
```

### Editing a Server

#### Via API
```bash
curl -X PUT http://localhost:3000/api/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-mcp-server",
    "enabled": false
  }'
```

### Removing a Server

#### Via API
```bash
curl -X DELETE "http://localhost:3000/api/mcp/servers?id=my-mcp-server"
```

## Viewing Available Tools

### Via API
```bash
# List all tools
curl http://localhost:3000/api/mcp/tools

# Search tools
curl "http://localhost:3000/api/mcp/tools?query=weather"

# Filter by category
curl "http://localhost:3000/api/mcp/tools?category=api"

# Filter by server
curl "http://localhost:3000/api/mcp/tools?serverId=my-mcp-server"
```

## Monitoring and Status

### Check MCP Status

#### Via API
```bash
curl http://localhost:3000/api/mcp/status
```

Response includes:
- System status (enabled/disabled)
- Number of connected servers
- Number of available tools
- Health status
- Execution metrics

### View Metrics

The status endpoint provides:
- Total tool executions
- Success/failure rates
- Average execution time
- Server health checks

## Security Considerations

### Authentication

MCP supports multiple authentication methods:
- **API Key**: Simple key-based authentication
- **Bearer Token**: OAuth-style bearer tokens
- **OAuth**: Full OAuth 2.0 flow (coming soon)
- **None**: For internal/trusted servers

### Best Practices

1. **Use Authentication**: Always enable authentication for external servers
2. **Limit Access**: Only enable servers you trust
3. **Review Tools**: Check available tools before enabling a server
4. **Monitor Usage**: Regularly check execution logs
5. **Secure Credentials**: Store API keys securely

## Troubleshooting

### Server Won't Connect

1. Check server URL is correct and accessible
2. Verify protocol (HTTP/WebSocket/stdio) matches server
3. Check authentication credentials
4. Review server logs for errors
5. Check firewall settings

### Tools Not Appearing

1. Verify server is connected (check status)
2. Trigger manual tool discovery:
   ```bash
   # Restart the server connection
   curl -X PUT http://localhost:3000/api/mcp/servers \
     -H "Content-Type: application/json" \
     -d '{"id": "my-server", "enabled": false}'
   
   curl -X PUT http://localhost:3000/api/mcp/servers \
     -H "Content-Type: application/json" \
     -d '{"id": "my-server", "enabled": true}'
   ```

### Tool Execution Fails

1. Check tool input requirements
2. Verify server is responsive
3. Check timeout settings
4. Review error messages in status endpoint
5. Check server logs

### Performance Issues

1. Reduce number of concurrent executions in config
2. Increase timeout values if needed
3. Enable tool caching
4. Monitor execution metrics
5. Consider server proximity/latency

## Advanced Configuration

### Rate Limiting

Configure rate limits in `data/mcp-config.json`:

```json
{
  "rateLimits": {
    "perServer": 100,
    "perUser": 1000,
    "perTool": 50
  }
}
```

### Timeouts

```json
{
  "defaultTimeout": 30000
}
```

### Caching

```json
{
  "enableToolCaching": true,
  "cacheTimeout": 300000
}
```

### Concurrent Execution

```json
{
  "maxConcurrentExecutions": 10
}
```

## API Reference

### Server Management

- `GET /api/mcp/servers` - List all servers
- `POST /api/mcp/servers` - Add a server
- `PUT /api/mcp/servers` - Update a server
- `DELETE /api/mcp/servers?id={id}` - Remove a server

### Tool Management

- `GET /api/mcp/tools` - List/search tools
- `POST /api/mcp/tools/execute` - Execute a tool

### Status

- `GET /api/mcp/status` - Get system status

## Creating Your Own MCP Server

### Requirements

Your MCP server should:
1. Implement the MCP protocol
2. Expose available tools
3. Accept tool execution requests
4. Return structured responses

### Protocol Support

Perplexica supports:
- **HTTP**: REST-based API
- **WebSocket**: Real-time bidirectional communication
- **stdio**: Process-based communication

### Example Server (Node.js/Express)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// List available tools
app.get('/tools', (req, res) => {
  res.json([
    {
      id: 'calculator',
      name: 'Calculator',
      description: 'Performs basic calculations',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        },
        required: ['expression']
      }
    }
  ]);
});

// Execute tool
app.post('/tools/:toolId/execute', (req, res) => {
  const { toolId } = req.params;
  const { input } = req.body;
  
  if (toolId === 'calculator') {
    try {
      const result = eval(input.expression);
      res.json({ success: true, output: result });
    } catch (error) {
      res.json({ success: false, error: error.message });
    }
  } else {
    res.status(404).json({ error: 'Tool not found' });
  }
});

app.listen(8080);
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/ItzCrazyKns/Perplexica/issues
- Discord: https://discord.gg/EFwsmQDgAu

## Contributing

We welcome contributions to improve MCP integration! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
