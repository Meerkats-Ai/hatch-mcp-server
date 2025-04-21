#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Tool definitions
const FIND_EMAIL_TOOL: Tool = {
  name: 'hatch_find_email',
  description: 'Find an email address using first name, last name, and domain information.',
  inputSchema: {
    type: 'object',
    properties: {
      firstName: {
        type: 'string',
        description: 'First name of the person',
      },
      lastName: {
        type: 'string',
        description: 'Last name of the person',
      },
      domain: {
        type: 'string',
        description: 'Company domain name',
      },
    },
    required: ['firstName', 'lastName', 'domain'],
  },
};

const FIND_PHONE_TOOL: Tool = {
  name: 'hatch_find_phone',
  description: 'Find a phone number using LinkedIn profile URL.',
  inputSchema: {
    type: 'object',
    properties: {
      linkedInUrl: {
        type: 'string',
        description: 'LinkedIn profile URL of the person',
      },
    },
    required: ['linkedInUrl'],
  },
};

const VERIFY_EMAIL_TOOL: Tool = {
  name: 'hatch_verify_email',
  description: 'Verify if an email address is valid and active.',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Email address to verify',
      },
    },
    required: ['email'],
  },
};

const FIND_COMPANY_DATA_TOOL: Tool = {
  name: 'hatch_find_company_data',
  description: 'Find detailed information about a company using its domain.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Company domain name',
      },
    },
    required: ['domain'],
  },
};

const GET_LINKEDIN_URL_TOOL: Tool = {
  name: 'hatch_get_linkedin_url',
  description: 'Find LinkedIn URL using name, designation, and company information.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the person',
      },
      designation: {
        type: 'string',
        description: 'Job title or designation of the person',
      },
      companyName: {
        type: 'string',
        description: 'Company name',
      },
    },
    required: ['companyName'],
  },
};

// Type definitions
interface FindEmailParams {
  firstName: string;
  lastName: string;
  domain: string;
}

interface FindPhoneParams {
  linkedInUrl: string;
}

interface VerifyEmailParams {
  email: string;
}

interface FindCompanyDataParams {
  domain: string;
}

interface GetLinkedInUrlParams {
  name?: string;
  designation?: string;
  companyName: string;
}

// Type guards
function isFindEmailParams(args: unknown): args is FindEmailParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'firstName' in args &&
    typeof (args as { firstName: unknown }).firstName === 'string' &&
    'lastName' in args &&
    typeof (args as { lastName: unknown }).lastName === 'string' &&
    'domain' in args &&
    typeof (args as { domain: unknown }).domain === 'string'
  );
}

function isFindPhoneParams(args: unknown): args is FindPhoneParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'linkedInUrl' in args &&
    typeof (args as { linkedInUrl: unknown }).linkedInUrl === 'string'
  );
}

function isVerifyEmailParams(args: unknown): args is VerifyEmailParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'email' in args &&
    typeof (args as { email: unknown }).email === 'string'
  );
}

function isFindCompanyDataParams(args: unknown): args is FindCompanyDataParams {
  return (
    typeof args === 'object' &&
    args !== null &&
    'domain' in args &&
    typeof (args as { domain: unknown }).domain === 'string'
  );
}

function isGetLinkedInUrlParams(args: unknown): args is GetLinkedInUrlParams {
  if (
    typeof args !== 'object' ||
    args === null ||
    !('companyName' in args) ||
    typeof (args as { companyName: unknown }).companyName !== 'string'
  ) {
    return false;
  }

  // Optional parameters
  if (
    'name' in args &&
    (args as { name: unknown }).name !== undefined &&
    typeof (args as { name: unknown }).name !== 'string'
  ) {
    return false;
  }

  if (
    'designation' in args &&
    (args as { designation: unknown }).designation !== undefined &&
    typeof (args as { designation: unknown }).designation !== 'string'
  ) {
    return false;
  }

  return true;
}

// Server implementation
const server = new Server(
  {
    name: 'hatch-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Get API key and URL from environment variables
const HATCH_API_KEY = process.env.HATCH_API_KEY;
const HATCH_API_URL = process.env.HATCH_API_URL || 'https://api.hatchhq.ai';

// Check if API key is provided
if (!HATCH_API_KEY) {
  console.error('Error: HATCH_API_KEY environment variable is required');
  process.exit(1);
}

// Configuration for retries and monitoring
const CONFIG = {
  retry: {
    maxAttempts: Number(process.env.HATCH_RETRY_MAX_ATTEMPTS) || 3,
    initialDelay: Number(process.env.HATCH_RETRY_INITIAL_DELAY) || 1000,
    maxDelay: Number(process.env.HATCH_RETRY_MAX_DELAY) || 10000,
    backoffFactor: Number(process.env.HATCH_RETRY_BACKOFF_FACTOR) || 2,
  },
};

// Initialize Axios instance for API requests
const apiClient: AxiosInstance = axios.create({
  baseURL: HATCH_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': HATCH_API_KEY,
  },
});

let isStdioTransport = false;

function safeLog(
  level:
    | 'error'
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'critical'
    | 'alert'
    | 'emergency',
  data: any
): void {
  if (isStdioTransport) {
    // For stdio transport, log to stderr to avoid protocol interference
    console.error(
      `[${level}] ${typeof data === 'object' ? JSON.stringify(data) : data}`
    );
  } else {
    // For other transport types, use the normal logging mechanism
    server.sendLoggingMessage({ level, data });
  }
}

// Add utility function for delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add retry logic with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  attempt = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const isRateLimit =
      error instanceof Error &&
      (error.message.includes('rate limit') || error.message.includes('429'));

    if (isRateLimit && attempt < CONFIG.retry.maxAttempts) {
      const delayMs = Math.min(
        CONFIG.retry.initialDelay *
          Math.pow(CONFIG.retry.backoffFactor, attempt - 1),
        CONFIG.retry.maxDelay
      );

      safeLog(
        'warning',
        `Rate limit hit for ${context}. Attempt ${attempt}/${CONFIG.retry.maxAttempts}. Retrying in ${delayMs}ms`
      );

      await delay(delayMs);
      return withRetry(operation, context, attempt + 1);
    }

    throw error;
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    FIND_EMAIL_TOOL,
    FIND_PHONE_TOOL,
    VERIFY_EMAIL_TOOL,
    FIND_COMPANY_DATA_TOOL,
    GET_LINKEDIN_URL_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const startTime = Date.now();
  try {
    const { name, arguments: args } = request.params;

    // Log incoming request with timestamp
    safeLog(
      'info',
      `[${new Date().toISOString()}] Received request for tool: ${name}`
    );

    if (!args) {
      throw new Error('No arguments provided');
    }

    switch (name) {
      case 'hatch_find_email': {
        if (!isFindEmailParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for hatch_find_email'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/v1/findEmail', args),
            'find email'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'hatch_find_phone': {
        if (!isFindPhoneParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for hatch_find_phone'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/v1/findPhone', args),
            'find phone'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'hatch_verify_email': {
        if (!isVerifyEmailParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for hatch_verify_email'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/v1/verifyEmail', args),
            'verify email'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'hatch_find_company_data': {
        if (!isFindCompanyDataParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for hatch_find_company_data'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/v1/findCompanyData', args),
            'find company data'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      case 'hatch_get_linkedin_url': {
        if (!isGetLinkedInUrlParams(args)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid arguments for hatch_get_linkedin_url'
          );
        }

        try {
          const response = await withRetry(
            async () => apiClient.post('/v1/getLinkedinUrl', args),
            'get linkedin url'
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(response.data, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [
            { type: 'text', text: `Unknown tool: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    // Log detailed error information
    safeLog('error', {
      message: `Request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      tool: request.params.name,
      arguments: request.params.arguments,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  } finally {
    // Log request completion with performance metrics
    safeLog('info', `Request completed in ${Date.now() - startTime}ms`);
  }
});

// Server startup
async function runServer() {
  try {
    console.error('Initializing Hatch MCP Server...');

    const transport = new StdioServerTransport();

    // Detect if we're using stdio transport
    isStdioTransport = transport instanceof StdioServerTransport;
    if (isStdioTransport) {
      console.error(
        'Running in stdio mode, logging will be directed to stderr'
      );
    }

    await server.connect(transport);

    // Now that we're connected, we can send logging messages
    safeLog('info', 'Hatch MCP Server initialized successfully');
    safeLog(
      'info',
      `Configuration: API URL: ${HATCH_API_URL}`
    );

    console.error('Hatch MCP Server running on stdio');
  } catch (error) {
    console.error('Fatal error running server:', error);
    process.exit(1);
  }
}

runServer().catch((error: any) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
