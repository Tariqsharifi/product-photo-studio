import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const signIn = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiry = Date.now() + 10 * 60 * 1000;
    
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", args.email)).first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { code, codeExpiry });
    } else {
      await ctx.db.insert("users", { email: args.email, code, codeExpiry });
    }
    
    console.log(`Code for ${args.email}: ${code}`);
    return { success: true };
  },
});

export const verifyCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", args.email)).first();
    
    if (!user || user.code !== args.code) {
      throw new Error("Invalid code");
    }
    
    if (user.codeExpiry && user.codeExpiry < Date.now()) {
      throw new Error("Code expired");
    }
    
    const token = crypto.randomUUID();
    await ctx.db.patch(user._id, { token, code: undefined, codeExpiry: undefined });
    
    return { token, userId: user._id };
  },
});

export const signOut = mutation({
  args: {},
  handler: async (ctx) => {
    return { success: true };
  },
});

export const getCurrentUser = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    return await ctx.db.query("users").withIndex("by_token", (q) => q.eq("token", args.token)).first();
  },
});
