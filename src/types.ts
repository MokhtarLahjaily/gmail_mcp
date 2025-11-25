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

export const MarkAsReadSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1, 'Provide at least one message ID'),
});

export const DeleteMessageSchema = z.object({
  messageIds: z.array(z.string().min(1)).min(1, 'Provide at least one message ID'),
});

export const ListLabelsSchema = z.object({
  count: z.number().min(1).max(100).optional().default(10),
});

export const CreateLabelSchema = z.object({
  labelName: z.string().min(1, 'Label name is required'),
});

export const LabelMessageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  labels: z.array(z.string().min(1)).min(1, 'At least one label is required'),
});

export const MoveMessageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  folder: z.string().min(1, 'Destination folder is required'),
  sourceFolder: z.string().optional().default('INBOX'),
});

export const SendMessageSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Message body cannot be empty'),
  html: z.string().optional(),
  cc: z.union([
    z.string().email(),
    z.array(z.string().email())
  ]).optional(),
  bcc: z.union([
    z.string().email(),
    z.array(z.string().email())
  ]).optional(),
});

export const DeleteLabelSchema = z.object({
  labelName: z.string().min(1, 'Label name is required'),
});

export const RenameLabelSchema = z.object({
  oldLabelName: z.string().min(1, 'Current label name is required'),
  newLabelName: z.string().min(1, 'New label name is required'),
});

export const MoveLabelSchema = z.object({
  labelName: z.string().min(1, 'Label name to move is required'),
  newParentLabel: z.string().min(1, 'New parent label is required'),
});

export type ListMessagesParams = z.infer<typeof ListMessagesSchema>;
export type ListUnreadParams = z.infer<typeof ListUnreadSchema>;
export type FindMessageParams = z.infer<typeof FindMessageSchema>;
export type SendMessageParams = z.infer<typeof SendMessageSchema>;
export type MarkAsReadParams = z.infer<typeof MarkAsReadSchema>;
export type DeleteMessageParams = z.infer<typeof DeleteMessageSchema>;
export type ListLabelsParams = z.infer<typeof ListLabelsSchema>;
export type CreateLabelParams = z.infer<typeof CreateLabelSchema>;
export type LabelMessageParams = z.infer<typeof LabelMessageSchema>;
export type MoveMessageParams = z.infer<typeof MoveMessageSchema>;
export type DeleteLabelParams = z.infer<typeof DeleteLabelSchema>;
export type RenameLabelParams = z.infer<typeof RenameLabelSchema>;
export type MoveLabelParams = z.infer<typeof MoveLabelSchema>;


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

export interface DeleteMessageResult {
  success: boolean;
  deletedCount: number;
  message: string;
}

export interface ListLabelsResult {
  success: boolean;
  labels: string[];
}

export interface CreateLabelResult {
  success: boolean;
  message: string;
}


export interface LabelMessageResult {
  success: boolean;
  message: string;
}

export interface MoveMessageResult {
  success: boolean;
  message: string;
}

export interface DeleteLabelResult {
  success: boolean;
  message: string;
}

export interface RenameLabelResult {
  success: boolean;
  message: string;
}

export interface MoveLabelResult {
  success: boolean;
  message: string;
}