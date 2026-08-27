import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// این اکشن هست که واقعاً ایمیل می‌فرسته (اکشن‌ها می‌تونن به اینترنت وصل بشن، mutation نمی‌تونه)
export const signIn = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiry = Date.now() + 10 * 60 * 1000;

    // کد رو توی دیتابیس ذخیره کن
    await ctx.runMutation(internal.users.saveCode, {
      email: args.email,
      code,
      codeExpiry,
    });

    // ایمیل رو با Resend بفرست
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PhotoCut <onboarding@resend.dev>",
        to: [args.email],
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

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
