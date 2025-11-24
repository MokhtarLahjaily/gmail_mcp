import { ImapService } from './imap-service.js';
import { SmtpService } from './smtp-service.js';
import {
  EmailMessage,
  SearchResult,
  SendResult,
  ListMessagesParams,
  ListUnreadParams,
  FindMessageParams,
  SendMessageParams,
  MarkAsReadParams,
  MarkAsReadResult,
  DeleteMessageParams,
  DeleteMessageResult,
} from './types.js';

export class EmailOperations {
  constructor(
    private imapService: ImapService,
    private smtpService: SmtpService
  ) { }

  /**
   * List recent messages from email inbox
   */
  async listMessages(params: ListMessagesParams): Promise<EmailMessage[]> {
    try {
      return await this.imapService.listMessages(params.count);
    } catch (error) {
      throw new Error(`Failed to list messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listUnreadMessages(params: ListUnreadParams): Promise<EmailMessage[]> {
    try {
      return await this.imapService.listUnreadMessages(params.count);
    } catch (error) {
      throw new Error(`Failed to list unread messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for messages containing specific words
   */
  async findMessages(params: FindMessageParams): Promise<SearchResult> {
    try {
      return await this.imapService.searchMessages(params.query);
    } catch (error) {
      throw new Error(`Failed to search messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send an email message
   */
  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    try {
      return await this.smtpService.sendMessage(params);
    } catch (error) {
      return {
        messageId: '',
        success: false,
        message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async markMessagesAsRead(params: MarkAsReadParams): Promise<MarkAsReadResult> {
    try {
      return await this.imapService.markMessagesAsRead(params.messageIds);
    } catch (error) {
      throw new Error(`Failed to mark messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteMessages(params: DeleteMessageParams): Promise<DeleteMessageResult> {
    try {
      return await this.imapService.deleteMessages(params.messageIds);
    } catch (error) {
      throw new Error(`Failed to delete messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}