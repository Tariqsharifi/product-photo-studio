import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const signIn = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiry = Date.now() + 10 * 60 * 1000;

    await ctx.runMutation(internal.users.saveCode, {
      email,
      code,
      codeExpiry,
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PhotoCut <onboarding@resend.dev>",
        to: [email],
        subject: "کد ورود به PhotoCut",
        html: `<div dir="rtl" style="font-family: sans-serif;">
          <h2>کد ورود شما</h2>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
          <p>این کد تا ۱۰ دقیقه دیگه معتبره.</p>
        </div>`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend error:", errorText);
      throw new Error("ارسال ایمیل ناموفق بود");
    }

    return { success: true };
  },
});

export const saveCode = internalMutation({
  args: { email: v.string(), code: v.string(), codeExpiry: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { code: args.code, codeExpiry: args.codeExpiry });
    } else {
      await ctx.db.insert("users", { email: args.email, code: args.code, codeExpiry: args.codeExpiry });
    }
  },
});

export const verifyCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user || user.code !== args.code) {
      throw new Error("Invalid code");
    }

    if (user.codeExpiry && user.codeExpiry < Date.now()) {
      throw new Error("Code expired");
    }

    const token = crypto.randomUUID();

    await ctx.db.insert("sessions", {
      token,
      userId: user._id,
      createdAt: Date.now(),
    });

    await ctx.db.patch(user._id, { code: undefined, codeExpiry: undefined });

    return { token, userId: user._id };
  },
});

export const signOut = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.token) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .first();
      if (session) {
        await ctx.db.delete(session._id);
      }
    }
    return { success: true };
  },
});

export const getCurrentUser = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token!))
      .first();
    if (!session) return null;
    return await ctx.db.get(session.userId);
  },
});
