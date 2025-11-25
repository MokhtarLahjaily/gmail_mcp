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
  DeleteMessageSchema,
  EmailMessage,
  MoveMessageSchema,
  LabelMessageSchema,
  CreateLabelSchema,
  ListLabelsSchema,
  DeleteLabelSchema,
  RenameLabelSchema,
  MoveLabelSchema,
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

  /**
   * Helper to create a JSON response for MCP tools
   */
  private createJsonResponse(data: any) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  /**
   * Helper to format email messages for response
   */
  private formatMessages(messages: EmailMessage[]) {
    return messages.map((msg) => ({
      id: msg.id,
      subject: msg.subject,
      from: msg.from,
      date: msg.date,
      snippet: msg.snippet,
    }));
  }

  /**
   * Helper to handle errors consistently
   */
  private handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new McpError(ErrorCode.InternalError, message);
  }

  private setupToolHandlers() {
    // List Messages
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
          return this.createJsonResponse({
            success: true,
            count: messages.length,
            messages: this.formatMessages(messages),
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    // List Unread Messages
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
          return this.createJsonResponse({
            success: true,
            count: messages.length,
            messages: this.formatMessages(messages),
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    // Find Message
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
          return this.createJsonResponse({
            success: true,
            query: result.query,
            totalCount: result.totalCount,
            foundMessages: result.messages.length,
            messages: this.formatMessages(result.messages),
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    // Send Message
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
          return this.createJsonResponse({
            success: result.success,
            messageId: result.messageId,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    // Mark As Read
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
          return this.createJsonResponse({
            success: result.success,
            updatedCount: result.updatedCount,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    // Delete Message
    this.server.registerTool(
      'deleteMessage',
      {
        description: 'Delete specified messages (move to Trash)',
        inputSchema: DeleteMessageSchema,
      },
      async (args) => {
        try {
          const params = DeleteMessageSchema.parse(args ?? {});
          const result = await this.emailOperations.deleteMessages(params);
          return this.createJsonResponse({
            success: result.success,
            deletedCount: result.deletedCount,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'moveMessage',
      {
        description: 'Move a message to a specific folder',
        inputSchema: MoveMessageSchema,
      },
      async (args) => {
        try {
          const params = MoveMessageSchema.parse(args ?? {});
          const result = await this.emailOperations.moveMessage(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'labelMessage',
      {
        description: 'Add labels to a message (copy to label folders)',
        inputSchema: LabelMessageSchema,
      },
      async (args) => {
        try {
          const params = LabelMessageSchema.parse(args ?? {});
          const result = await this.emailOperations.labelMessage(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          })
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'createLabel',
      {
        description: 'Create a new label',
        inputSchema: CreateLabelSchema,
      },
      async (args) => {
        try {
          const params = CreateLabelSchema.parse(args ?? {});
          const result = await this.emailOperations.createLabel(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          })
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'listLabels',
      {
        description: 'List all labels',
        inputSchema: ListLabelsSchema,
      },
      async (args) => {
        try {
          const params = ListLabelsSchema.parse(args ?? {});
          const result = await this.emailOperations.listLabels(params);
          return this.createJsonResponse({
            success: result.success,
            labels: result.labels,
          })
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'deleteLabel',
      {
        description: 'Delete an existing label',
        inputSchema: DeleteLabelSchema,
      },
      async (args) => {
        try {
          const params = DeleteLabelSchema.parse(args ?? {});
          const result = await this.emailOperations.deleteLabel(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'renameLabel',
      {
        description: 'Rename a label (change its name directly)',
        inputSchema: RenameLabelSchema,
      },
      async (args) => {
        try {
          const params = RenameLabelSchema.parse(args ?? {});
          const result = await this.emailOperations.renameLabel(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
        }
      }
    );

    this.server.registerTool(
      'moveLabel',
      {
        description: 'Move a label under a new parent label',
        inputSchema: MoveLabelSchema,
      },
      async (args) => {
        try {
          const params = MoveLabelSchema.parse(args ?? {});
          const result = await this.emailOperations.moveLabel(params);
          return this.createJsonResponse({
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          this.handleError(error);
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