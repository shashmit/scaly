import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listChatRuns = query({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiRuns")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", args.userId).eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const createChatRun = mutation({
  args: {
    userId: v.id("users"),
    conversationId: v.string(),
    model: v.string(),
    input: v.string(),
    output: v.optional(v.string()),
    tokenUsage: v.optional(v.number()),
    status: v.union(v.literal("completed"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiRuns", {
      ...args,
      kind: "chat",
    });
  },
});
