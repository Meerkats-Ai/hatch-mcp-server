# Hatch MCP Server

This is a Model Context Protocol (MCP) server for Hatch API integration. It provides tools for finding emails, phone numbers, verifying emails, finding company data, and getting LinkedIn URLs.

## Features

- Find email addresses using first name, last name, and domain information
- Find phone numbers using LinkedIn profile URLs
- Verify if an email address is valid and active
- Find detailed information about a company using its domain
- Find LinkedIn URLs using name, designation, and company information

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example` and add your Hatch API key:

```
HATCH_API_KEY=your_api_key_here
```

4. Build the project:

```bash
npm run build
```

## Usage

### Standalone Usage

To start the server directly:

```bash
npm start
```

### Integration with Claude

To use this MCP server with Claude, you need to add it to the MCP settings file:

1. For Claude VSCode extension, add it to `c:\Users\<username>\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
2. For Claude desktop app, add it to `%APPDATA%\Claude\claude_desktop_config.json` on Windows

Example configuration:

```json
{
  "mcpServers": {
    "hatch": {
      "command": "node",
      "args": ["E:/mcp-servers/hatch/dist/index.js"],
      "env": {
        "HATCH_API_KEY": "your_api_key_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Replace `your_api_key_here` with your actual Hatch API key.

## Configuration

The server can be configured using environment variables:

- `HATCH_API_KEY` (required): Your Hatch API key
- `HATCH_API_URL` (optional): Custom API URL (defaults to https://api.hatchhq.ai)
- `HATCH_RETRY_MAX_ATTEMPTS`: Maximum retry attempts for API calls (default: 3)
- `HATCH_RETRY_INITIAL_DELAY`: Initial delay in milliseconds for retries (default: 1000)
- `HATCH_RETRY_MAX_DELAY`: Maximum delay in milliseconds for retries (default: 10000)
- `HATCH_RETRY_BACKOFF_FACTOR`: Backoff factor for retry delays (default: 2)

## Available Tools

### hatch_find_email

Find an email address using first name, last name, and domain information.

**Parameters:**
- `firstName` (required): First name of the person
- `lastName` (required): Last name of the person
- `domain` (required): Company domain name

### hatch_find_phone

Find a phone number using LinkedIn profile URL.

**Parameters:**
- `linkedInUrl` (required): LinkedIn profile URL of the person

### hatch_verify_email

Verify if an email address is valid and active.

**Parameters:**
- `email` (required): Email address to verify

### hatch_find_company_data

Find detailed information about a company using its domain.

**Parameters:**
- `domain` (required): Company domain name

### hatch_get_linkedin_url

Find LinkedIn URL using name, designation, and company information.

**Parameters:**
- `name`: Name of the person
- `designation`: Job title or designation of the person
- `companyName` (required): Company name

## License

MIT
