import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkPassword, normalizePhone, phoneToAuthEmail } from "./phone";

/**
 * AuthService (server side): registration, phone confirmation and
 * OTP-based password recovery. The phone number is the only identifier;
 * a deterministic synthetic email backs the Supabase credential.
 */

const phoneField = z
  .string()
  .trim()
  .max(30)
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: "invalid_phone" });

const passwordField = z
  .string()
  .min(8)
  .max(72)
  .refine((v) => checkPassword(v).ok, { message: "weak_password" });

const registerSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  phone: phoneField,
  password: passwordField,
});

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueOtp } = await import("./otp.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, phone_verified")
      .eq("phone", data.phone)
      .maybeSingle();

    if (existing?.phone_verified) return { ok: false as const, error: "phone_taken" };

    let userId = existing?.id ?? null;

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: phoneToAuthEmail(data.phone),
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: data.firstName, last_name: data.lastName },
      });
      if (error || !created.user) return { ok: false as const, error: "phone_taken" };
      userId = created.user.id;

      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
      });
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return { ok: false as const, error: "phone_taken" };
      }
    } else {
      // Unfinished registration for the same number — refresh it.
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.password });
      await supabaseAdmin
        .from("profiles")
        .update({ first_name: data.firstName, last_name: data.lastName })
        .eq("id", userId);
    }

    const { devCode } = await issueOtp(supabaseAdmin, {
      userId,
      phone: data.phone,
      purpose: "registration",
    });

    return { ok: true as const, devCode };
  });

const otpSchema = z.object({ phone: phoneField, code: z.string().trim().min(4).max(8) });

export const confirmRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyOtp } = await import("./otp.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, phone_verified")
      .eq("phone", data.phone)
      .maybeSingle();
    if (!profile) return { ok: false as const, error: "invalid" };
    if (profile.phone_verified) return { ok: true as const };

    const result = await verifyOtp(supabaseAdmin, {
      userId: profile.id,
      phone: data.phone,
      purpose: "registration",
      code: data.code,
    });
    if (result !== "ok") return { ok: false as const, error: result };

    await supabaseAdmin.from("profiles").update({ phone_verified: true }).eq("id", profile.id);
    return { ok: true as const };
  });

const phoneOnly = z.object({ phone: phoneField });

export const resendRegistrationCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneOnly.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueOtp } = await import("./otp.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, phone_verified")
      .eq("phone", data.phone)
      .maybeSingle();
    if (!profile || profile.phone_verified) return { ok: true as const, devCode: null };

    const { devCode } = await issueOtp(supabaseAdmin, {
      userId: profile.id,
      phone: data.phone,
      purpose: "registration",
    });
    return { ok: true as const, devCode };
  });

/** Password recovery: the code goes to the phone, never to an email. */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => phoneOnly.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueOtp } = await import("./otp.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();
    // Always report success so the endpoint cannot enumerate customers.
    if (!profile) return { ok: true as const, devCode: null };

    const { devCode } = await issueOtp(supabaseAdmin, {
      userId: profile.id,
      phone: data.phone,
      purpose: "password_reset",
    });
    return { ok: true as const, devCode };
  });

const resetSchema = z.object({
  phone: phoneField,
  code: z.string().trim().min(4).max(8),
  password: passwordField,
});

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyOtp } = await import("./otp.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();
    if (!profile) return { ok: false as const, error: "invalid" };

    const result = await verifyOtp(supabaseAdmin, {
      userId: profile.id,
      phone: data.phone,
      purpose: "password_reset",
      code: data.code,
    });
    if (result !== "ok") return { ok: false as const, error: result };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.password,
    });
    if (error) return { ok: false as const, error: "invalid" };

    await supabaseAdmin.from("profiles").update({ phone_verified: true }).eq("id", profile.id);
    return { ok: true as const };
  });
