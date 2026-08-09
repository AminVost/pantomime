import { z } from "zod";

export const createGameSchema = z.object({
  roundCount: z.number().int().min(1).max(20),
  roundDuration: z.number().int().min(15).max(300),
  categoryIds: z.array(z.number().int().positive()).min(1).max(50),
  playMode: z.enum(["SINGLE", "CONTINUOUS"]).default("SINGLE"),
  teams: z.array(z.object({
    name: z.string().trim().min(1).max(50),
    colorKey: z.string().trim().min(1).max(30)
  })).min(2).max(8)
});

export const queueSchema = z.object({
  categoryId: z.number().int().positive().nullable(),
  points: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(30)]),
  count: z.number().int().min(1).max(12).default(1)
}).superRefine((value, ctx) => {
  if (value.points !== 30 && value.categoryId === null) {
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "موضوع لازم است." });
  }
  if (value.points === 30 && value.categoryId !== null) {
    ctx.addIssue({ code: "custom", path: ["categoryId"], message: "ریسک ۳۰ موضوع ثابت ندارد." });
  }
});

export const startTurnSchema = z.object({
  teamId: z.string().min(1),
  turnId: z.string().min(8).max(64).optional(),
  startedAtMs: z.number().int().positive().optional()
});

export const answerSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  turnId: z.string().min(1),
  teamId: z.string().min(1),
  wordId: z.number().int().positive(),
  result: z.enum(["CORRECT", "SKIPPED"]),
  answeredAtMs: z.number().int().positive().optional()
});

export const releaseWordsSchema = z.object({
  wordIds: z.array(z.number().int().positive()).min(1).max(24)
});

export const changeWordSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  teamId: z.string().min(1),
  wordId: z.number().int().positive(),
  replacementWordId: z.number().int().positive().optional()
});

export const selectionSchema = z.object({
  teamId: z.string().min(1),
  roundNumber: z.number().int().min(1).max(20),
  categoryId: z.number().int().positive().nullable(),
  points: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(30)]),
  wordIds: z.array(z.number().int().positive()).min(1).max(12)
}).superRefine((value, ctx) => {
  if (value.points !== 30 && value.categoryId === null) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "موضوع لازم است." });
  if (value.points === 30 && value.categoryId !== null) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "ریسک ۳۰ موضوع ثابت ندارد." });
});

export const faultSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  turnId: z.string().min(1),
  teamId: z.string().min(1),
  occurredAtMs: z.number().int().positive().optional()
});
