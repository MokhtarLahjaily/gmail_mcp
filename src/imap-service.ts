import Imap from 'imap';
import { EmailMessage, MarkAsReadResult, SearchResult, DeleteMessageResult } from './types.js';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export class ImapService {
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  private createImapConnection(): Imap {
    return new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false },
    });
  }

  private parseHeader(header: string, attrs: any): EmailMessage {
    const lines = header.split('\r\n');
    const headers: Record<string, string> = {};

    lines.forEach((line) => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        headers[key.toLowerCase().trim()] = valueParts.join(':').trim();
      }
    });

    const toField = headers.to ? headers.to.split(',').map((address) => address.trim()).filter(Boolean) : [];

    return {
      id: attrs.uid?.toString() ?? '',
      threadId: attrs.uid?.toString() ?? '',
      subject: headers.subject || '(No Subject)',
      from: headers.from || '',
      to: toField.length > 0 ? toField : [headers.to || ''],
      date: attrs.date?.toISOString?.() || new Date().toISOString(),
      snippet: `${headers.subject || '(No Subject)'} - ${headers.from || 'Unknown sender'}`,
      labels: ['INBOX'],
    };
  }

  /**
   * Helper to handle IMAP connection lifecycle
   */
  private async connectAndRun<T>(
    action: (imap: Imap, resolve: (val: T) => void, reject: (err: any) => void) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const imap = this.createImapConnection();

      const cleanup = () => {
        try { imap.end(); } catch (e) { /* ignore */ }
      };

      imap.once('ready', () => {
        try {
          action(
            imap,
            (val) => { cleanup(); resolve(val); },
            (err) => { cleanup(); reject(err); }
          );
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      imap.once('error', (err: any) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      imap.connect();
    });
  }

  /**
   * Helper to fetch and parse messages
   */
  private fetchMessages(imap: Imap, source: number[] | string, isSequence: boolean): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const messages: EmailMessage[] = [];

      // If source is an empty array, return empty immediately
      if (Array.isArray(source) && source.length === 0) {
        resolve([]);
        return;
      }

      const fetch = isSequence
        ? imap.seq.fetch(source as string, { bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)', struct: true })
        : imap.fetch(source as number[], { bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)', struct: true });

      fetch.on('message', (msg: any) => {
        let header = '';
        let attributes: any;

        msg.on('body', (stream: any) => {
          stream.on('data', (chunk: any) => {
            header += chunk.toString('ascii');
          });
        });

        msg.once('attributes', (attrs: any) => {
          attributes = attrs;
        });

        msg.once('end', () => {
          if (attributes) {
            try {
              messages.push(this.parseHeader(header, attributes));
            } catch (error) {
              console.error('Error parsing message:', error);
            }
          }
        });
      });

      fetch.once('error', (err: any) => {
        reject(err);
      });

      fetch.once('end', () => {
        // Sort by date (newest first)
        messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(messages);
      });
    });
  }

  /**
   * List recent messages from INBOX
   */
  async listMessages(count: number = 10): Promise<EmailMessage[]> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox('INBOX', true, (err: any, box: any) => {
        if (err) return reject(err);

        const total = box.messages.total;
        if (total === 0) return resolve([]);

        const start = Math.max(1, total - count + 1);
        const range = `${start}:${total}`;

        this.fetchMessages(imap, range, true)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Parse Gmail-style search query to extract folder and search terms
   */
  private parseSearchQuery(query: string): { folder: string; searchTerms: string } {
    const folderMatch = query.match(/in:(\w+)/i);
    let folder = 'INBOX';
    let searchTerms = query;

    if (folderMatch) {
      const folderName = folderMatch[1].toLowerCase();
      // Map common folder names to Gmail IMAP folders
      const folderMap: Record<string, string> = {
        'inbox': 'INBOX',
        'sent': '[Gmail]/Sent Mail',
        'trash': '[Gmail]/Trash',
        'bin': '[Gmail]/Bin',
        'spam': '[Gmail]/Spam',
        'drafts': '[Gmail]/Drafts',
        'starred': '[Gmail]/Starred',
        'important': '[Gmail]/Important',
        'all': '[Gmail]/All Mail',
      };
      folder = folderMap[folderName] || 'INBOX';
      // Remove the in:folder part from search terms
      searchTerms = query.replace(/in:\w+\s*/gi, '').trim();
    }

    return { folder, searchTerms };
  }

  /**
   * Perform the actual IMAP search
   */
  private performSearch(
    imap: Imap,
    searchTerms: string,
    originalQuery: string,
    resolve: (val: SearchResult) => void,
    reject: (err: any) => void
  ): void {
    // If no search terms, search for all messages
    const searchCriteria = searchTerms ? ['ALL', ['TEXT', searchTerms]] : ['ALL'];

    imap.search(searchCriteria, (err: any, results: number[]) => {
      if (err) return reject(err);

      if (!results || results.length === 0) {
        return resolve({ messages: [], totalCount: 0, query: originalQuery });
      }

      // Limit results to 50
      const limitedResults = results.slice(0, 50);

      this.fetchMessages(imap, limitedResults, false)
        .then(messages => resolve({
          messages,
          totalCount: results.length,
          query: originalQuery
        }))
        .catch(reject);
    });
  }

  /**
   * Search for messages containing specific terms
   * Supports Gmail-style queries like "in:sent test" or "in:trash important"
   */
  async searchMessages(query: string): Promise<SearchResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      const { folder, searchTerms } = this.parseSearchQuery(query);

      imap.openBox(folder, true, (err: any) => {
        if (err) {
          // If the folder doesn't exist, try alternative names
          if (folder === '[Gmail]/Trash') {
            // Retry with Bin
            imap.openBox('[Gmail]/Bin', true, (binErr: any) => {
              if (binErr) return reject(new Error(`Failed to open folder ${folder}: ${err.message}`));
              this.performSearch(imap, searchTerms, query, resolve, reject);
            });
            return;
          }
          return reject(new Error(`Failed to open folder ${folder}: ${err.message}`));
        }

        this.performSearch(imap, searchTerms, query, resolve, reject);
      });
    });
  }

  async listUnreadMessages(count: number = 10): Promise<EmailMessage[]> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox('INBOX', true, (err: any) => {
        if (err) return reject(err);

        imap.search(['UNSEEN'], (err: any, results: number[]) => {
          if (err) return reject(err);

          if (!results || results.length === 0) {
            return resolve([]);
          }

          // Get the last 'count' messages
          const limitedResults = results.slice(-count);

          this.fetchMessages(imap, limitedResults, false)
            .then(resolve)
            .catch(reject);
        });
      });
    });
  }

  async markMessagesAsRead(messageIds: string[]): Promise<MarkAsReadResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox('INBOX', false, (err: any) => {
        if (err) return reject(err);

        imap.addFlags(messageIds, ['\\Seen'], (err: any) => {
          if (err) return reject(err);

          imap.closeBox(false, () => {
            resolve({
              success: true,
              updatedCount: messageIds.length,
              message: 'Messages marked as read',
            });
          });
        });
      });
    });
  }

  async deleteMessages(messageIds: string[]): Promise<DeleteMessageResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox('INBOX', false, (err: any) => {
        if (err) return reject(err);

        const tryMove = (dest: string, cb: (err?: any) => void) => {
          imap.move(messageIds, dest, cb);
        };

        tryMove('[Gmail]/Trash', (err) => {
          if (err) {
            // Fallback to Bin
            tryMove('[Gmail]/Bin', (binErr) => {
              if (binErr) return reject(binErr);
              finish();
            });
            return;
          }
          finish();
        });

        const finish = () => {
          imap.closeBox(false, () => {
            resolve({
              success: true,
              deletedCount: messageIds.length,
              message: 'Messages moved to Trash',
            });
          });
        };
      });
    });
  }
}