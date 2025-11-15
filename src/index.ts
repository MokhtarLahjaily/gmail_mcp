import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ImapService } from './imap-service.js';
import { SmtpService } from './smtp-service.js';
import { EmailOperations } from './email-operations.js';
import {
  ListMessagesSchema,
  ListUnreadSchema,
  FindMessageSchema,
  SendMessageSchema,
  MarkAsReadSchema,
} from './types.js';

// Load environment variables
dotenv.config();

class EmailMCPServer {
  private server: McpServer;
  private emailOperations: EmailOperations;

  constructor() {
    this.server = new McpServer(
      {
        name: 'gmail-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize IMAP and SMTP services
    const imapConfig = {
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      user: process.env.EMAIL_ADDRESS!,
      password: process.env.EMAIL_PASSWORD!,
      tls: true,
    };

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.EMAIL_ADDRESS!,
      password: process.env.EMAIL_PASSWORD!,
    };

    const imapService = new ImapService(imapConfig);
    const smtpService = new SmtpService(smtpConfig);
    this.emailOperations = new EmailOperations(imapService, smtpService);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.registerTool(
      'listMessages',
      {
        description: 'List recent messages from Gmail inbox',
        inputSchema: ListMessagesSchema,
      },
      async (args) => {
        try {
          const params = ListMessagesSchema.parse(args ?? {});
          const messages = await this.emailOperations.listMessages(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    count: messages.length,
                    messages: messages.map((msg) => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      snippet: msg.snippet,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(ErrorCode.InternalError, message);
        }
      }
    );

    this.server.registerTool(
      'listUnread',
      {
        description: 'List unread messages from Gmail inbox',
        inputSchema: ListUnreadSchema,
      },
      async (args) => {
        try {
          const params = ListUnreadSchema.parse(args ?? {});
          const messages = await this.emailOperations.listUnreadMessages(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    count: messages.length,
                    messages: messages.map((msg) => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      snippet: msg.snippet,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(ErrorCode.InternalError, message);
        }
      }
    );

    this.server.registerTool(
      'findMessage',
      {
        description: 'Search for messages containing specific words or phrases',
        inputSchema: FindMessageSchema,
      },
      async (args) => {
        try {
          const params = FindMessageSchema.parse(args ?? {});
          const result = await this.emailOperations.findMessages(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    query: result.query,
                    totalCount: result.totalCount,
                    foundMessages: result.messages.length,
                    messages: result.messages.map((msg) => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      snippet: msg.snippet,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(ErrorCode.InternalError, message);
        }
      }
    );

    this.server.registerTool(
      'sendMessage',
      {
        description: 'Send an email message',
        inputSchema: SendMessageSchema,
      },
      async (args) => {
        try {
          const params = SendMessageSchema.parse(args ?? {});
          const result = await this.emailOperations.sendMessage(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: result.success,
                    messageId: result.messageId,
                    message: result.message,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(ErrorCode.InternalError, message);
        }
      }
    );

    this.server.registerTool(
      'markAsRead',
      {
        description: 'Mark specified messages as read',
        inputSchema: MarkAsReadSchema,
      },
      async (args) => {
        try {
          const params = MarkAsReadSchema.parse(args ?? {});
          const result = await this.emailOperations.markMessagesAsRead(params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: result.success,
                    updatedCount: result.updatedCount,
                    message: result.message,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error occurred';
          throw new McpError(ErrorCode.InternalError, message);
        }
      }
    );

  }

  async run() {
    // Check if environment variables are set
    if (!process.env.EMAIL_ADDRESS || !process.env.EMAIL_PASSWORD) {
      console.error('Missing required environment variables. Please check your .env file.');
      console.error('Required variables: EMAIL_ADDRESS, EMAIL_PASSWORD');
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Gmail MCP server running on stdio');
  }
}

// Start the server
const server = new EmailMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});