# MCP Server Examples

This directory contains example implementations of MCP servers that can be used with Perplexica.

## Example Server

`mcp-server-example.js` is a simple MCP server implementation that demonstrates:

- Tool discovery endpoint
- Tool execution endpoint  
- Basic error handling
- Example tools (calculator, weather, text analysis)

### Running the Example Server

```bash
# Install dependencies
npm install express cors

# Run the server
node examples/mcp-server-example.js
```

The server will start on `http://localhost:8080`.

### Adding to Perplexica

1. Start the example server
2. In Perplexica, add a new MCP server:
   - URL: `http://localhost:8080`
   - Protocol: `http`
   - No authentication required

### Available Tools

- **Calculator**: Performs basic math calculations
- **Weather Lookup**: Returns mock weather data (for demonstration)
- **Text Analysis**: Analyzes text and provides statistics

### Testing the Server

```bash
# Get server info
curl http://localhost:8080

# List available tools
curl http://localhost:8080/tools

# Execute calculator tool
curl -X POST http://localhost:8080/tools/calculator/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"expression": "2 + 2"}}'
```

## Creating Your Own MCP Server

See the [MCP User Guide](../docs/MCP_USER_GUIDE.md) for detailed information on creating custom MCP servers.
