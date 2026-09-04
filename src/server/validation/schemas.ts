import { z } from 'zod';

export const SymbolSchema = z
  .string()
  .trim()
  .min(1, 'Symbol is required')
  .max(20, 'Symbol cannot exceed 20 characters')
  .regex(/^[A-Z0-9.:-]{1,20}$/i, 'Symbol must contain only letters, numbers, dots, colons, or hyphens')
  .transform((val) => val.toUpperCase());

export const AddWatchlistItemSchema = z.object({
  symbol: SymbolSchema,
  name: z.string().trim().max(100).optional(),
  sector: z.string().trim().max(50).optional(),
  sectorEtf: SymbolSchema.optional(),
  exchange: z.string().trim().max(50).optional(),
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

export const InstrumentSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Search query must be at least 2 characters')
    .max(50, 'Search query cannot exceed 50 characters'),
});

export type AddWatchlistItemDto = z.infer<typeof AddWatchlistItemSchema>;
export type RemoveWatchlistItemDto = z.infer<typeof RemoveWatchlistItemSchema>;
export type ReorderWatchlistDto = z.infer<typeof ReorderWatchlistSchema>;
export type AcknowledgeCheckpointDto = z.infer<typeof AcknowledgeCheckpointSchema>;
export type InstrumentSearchQueryDto = z.infer<typeof InstrumentSearchQuerySchema>;
