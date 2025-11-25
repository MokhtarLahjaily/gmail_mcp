import Imap from 'imap';
import { EmailMessage, MarkAsReadResult, SearchResult, DeleteMessageResult, ListLabelsResult, CreateLabelResult, LabelMessageResult, MoveMessageResult, DeleteLabelResult, RenameLabelResult, MoveLabelResult } from './types.js';

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
   * Helper to recursively parse mailbox objects into a flat list of paths
   */
  private parseMailboxes(boxes: any, parent: string = ''): string[] {
    let results: string[] = [];

    // Iterate over the keys (folder names) of the object
    for (const key of Object.keys(boxes)) {
      const box = boxes[key];
      // Use the delimiter provided by the server (usually '/')
      const delimiter = box.delimiter || '/';
      const fullPath = parent ? `${parent}${delimiter}${key}` : key;

      results.push(fullPath);

      // Recursively parse children if they exist
      if (box.children) {
        results = results.concat(this.parseMailboxes(box.children, fullPath));
      }
    }

    return results;
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

  async listLabels(): Promise<ListLabelsResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.getBoxes((err: any, boxes: any) => {
        if (err) return reject(err);

        // Same logic as folders for Gmail
        const labels = this.parseMailboxes(boxes);

        resolve({
          success: true,
          labels,
        });
      });
    });
  }

  async createLabel(labelName: string): Promise<CreateLabelResult> {
    // In Gmail IMAP, labels are treated essentially as folders
    return this.connectAndRun((imap, resolve, reject) => {
      imap.addBox(labelName, (err: any) => {
        if (err) return reject(err);
        resolve({
          success: true,
          message: `Label "${labelName}" created successfully`,
        });
      });
    });
  }

  async labelMessage(messageId: string, labels: string[]): Promise<LabelMessageResult> {
    // In Gmail IMAP, applying a label is equivalent to COPYING the message to the folder/label
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox('INBOX', false, (err: any) => {
        if (err) return reject(err);

        // We need to perform a copy operation for each label
        const copyPromises = labels.map(label => {
          return new Promise<void>((res, rej) => {
            imap.copy(messageId, label, (err: any) => {
              if (err) rej(err);
              else res();
            });
          });
        });

        Promise.all(copyPromises)
          .then(() => {
            resolve({
              success: true,
              message: `Message "${messageId}" labeled with: ${labels.join(', ')}`,
            });
          })
          .catch(reject);
      });
    });
  }

  async moveMessage(messageId: string, destination: string, sourceFolder: string = 'INBOX'): Promise<MoveMessageResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.openBox(sourceFolder, false, (err: any) => {
        if (err) return reject(err);

        imap.move(messageId, destination, (err: any) => {
          if (err) return reject(err);
          resolve({
            success: true,
            message: `Message "${messageId}" moved from "${sourceFolder}" to "${destination}" successfully`,
          });
        });
      });
    });
  }

  async deleteLabel(labelName: string): Promise<DeleteLabelResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.delBox(labelName, (err: any) => {
        if (err) return reject(err);
        resolve({
          success: true,
          message: `Label "${labelName}" deleted successfully`,
        });
      });
    });
  }

  async renameLabel(oldLabelName: string, newLabelName: string): Promise<RenameLabelResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      imap.renameBox(oldLabelName, newLabelName, (err: any) => {
        if (err) return reject(err);
        resolve({
          success: true,
          message: `Label renamed from "${oldLabelName}" to "${newLabelName}" successfully`,
        });
      });
    });
  }

  async moveLabel(labelName: string, newParentLabel: string): Promise<MoveLabelResult> {
    return this.connectAndRun((imap, resolve, reject) => {
      // Logic: Extract the leaf name (e.g., "Project" from "Work/Project")
      // and append it to the new parent (e.g., "Archive" -> "Archive/Project")
      const leafName = labelName.split('/').pop() || labelName;
      const destination = `${newParentLabel}/${leafName}`;

      imap.renameBox(labelName, destination, (err: any) => {
        if (err) return reject(err);
        resolve({
          success: true,
          message: `Label "${labelName}" moved to "${destination}" successfully`,
        });
      });
    });
  }
}