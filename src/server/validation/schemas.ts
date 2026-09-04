import { z } from 'zod';

export const SymbolSchema = z
  .string()
  .trim()
  .min(1, 'Symbol is required')
  .max(10, 'Symbol cannot exceed 10 characters')
  .regex(/^[A-Z0-9.]{1,10}$/i, 'Symbol must contain only letters, numbers, or dots')
  .transform((val) => val.toUpperCase());

export const AddWatchlistItemSchema = z.object({
  symbol: SymbolSchema,
  name: z.string().trim().max(100).optional(),
  sector: z.string().trim().max(50).optional(),
  sectorEtf: SymbolSchema.optional(),
});

export const RemoveWatchlistItemSchema = z.object({
  symbol: SymbolSchema,
});

export const ReorderWatchlistSchema = z.object({
  symbols: z.array(SymbolSchema).min(1, 'Must provide at least one symbol'),
});

export const AcknowledgeCheckpointSchema = z.object({
  label: z.string().trim().max(100).optional(),
});

export type AddWatchlistItemDto = z.infer<typeof AddWatchlistItemSchema>;
export type RemoveWatchlistItemDto = z.infer<typeof RemoveWatchlistItemSchema>;
export type ReorderWatchlistDto = z.infer<typeof ReorderWatchlistSchema>;
export type AcknowledgeCheckpointDto = z.infer<typeof AcknowledgeCheckpointSchema>;
