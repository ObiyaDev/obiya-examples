import { z } from 'zod';

export const CastSchema = z.object({
  id: z.string(),
  text: z.string(),
  created_at: z.string(),
  author: z.object({
    username: z.string(),
    display_name: z.string(),
    follower_count: z.number(),
  }),
  reactions: z.object({
    likes_count: z.number(),
    recasts_count: z.number(),
  }).optional(),
});

export type Cast = z.infer<typeof CastSchema>;

export interface TrendAnalysis {
  keyword: string;
  count: number;
  engagement: number;
  sources: Array<{
    platform: 'farcaster';
    username: string;
    content: string;
    engagement: number;
  }>;
}

export interface TrendAnalysisResult {
  trends: TrendAnalysis[];
  timestamp: string;
  summary: string;
}

export const TrendAnalysisSchema = z.object({
  keyword: z.string(),
  count: z.number(),
  engagement: z.number(),
  sources: z.array(z.object({
    platform: z.string(),
    username: z.string(),
    content: z.string(),
    engagement: z.number(),
  })),
});

export const TrendAnalysisResultSchema = z.object({
  trends: z.array(TrendAnalysisSchema),
  timestamp: z.string(),
  summary: z.string(),
});

export const SlackNotificationSchema = z.object({
  trend_analysis: TrendAnalysisSchema,
  openai_summary: z.string(),
});

export type SlackNotification = z.infer<typeof SlackNotificationSchema>; 