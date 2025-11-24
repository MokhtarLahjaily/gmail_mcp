import { z } from 'zod';

// Validation schemas
export const ListMessagesSchema = z.object({
  count: z.number().min(1).max(100).optional().default(10),
});

export const ListUnreadSchema = z.object({
  count: z.number().min(1).max(100).optional().default(10),
});

export const FindMessageSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
});

export const SendMessageSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Message body cannot be empty'),
  html: z.string().optional(), // Optional HTML version of the email
  cc: z.union([
    z.string().email(),
    z.array(z.string().email())
  ]).optional(),
  bcc: z.union([
    z.string().email(),
    z.array(z.string().email())
  ]).optional(),
});

export const MarkAsReadSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1, 'Provide at least one message ID'),
});

export type ListMessagesParams = z.infer<typeof ListMessagesSchema>;
export type ListUnreadParams = z.infer<typeof ListUnreadSchema>;
export type FindMessageParams = z.infer<typeof FindMessageSchema>;
export type SendMessageParams = z.infer<typeof SendMessageSchema>;
export type MarkAsReadParams = z.infer<typeof MarkAsReadSchema>;

// Response types
export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

export interface SearchResult {
  messages: EmailMessage[];
  totalCount: number;
  query: string;
}

export interface SendResult {
  messageId: string;
  success: boolean;
  message: string;
}

export interface MarkAsReadResult {
  success: boolean;
  updatedCount: number;
  message: string;
}

export const DeleteMessageSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1, 'Provide at least one message ID'),
});

export type DeleteMessageParams = z.infer<typeof DeleteMessageSchema>;

export interface DeleteMessageResult {
  success: boolean;
  deletedCount: number;
  message: string;
}
