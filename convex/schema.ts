import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    token: v.optional(v.string()),
    code: v.optional(v.string()),
    codeExpiry: v.optional(v.number()),
  }).index("by_email", ["email"])
    .index("by_token", ["token"]),
  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
  }).index("by_token", ["token"]),
});
