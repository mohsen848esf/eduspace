import { z } from "zod";
import type { TFunction } from "i18next";

/**
 * Schema factories — accept a translator so validation messages
 * are localized through the i18n layer.
 *
 * Usage in hooks:
 *   const { t } = useTranslation("auth");
 *   const schema = useMemo(() => buildLoginSchema(t), [t]);
 */

export const buildLoginSchema = (t: TFunction) =>
  z.object({
    username: z.string().min(3, t("validation.usernameMin")),
    password: z.string().min(6, t("validation.passwordMin6")),
  });

export const buildRegisterSchema = (t: TFunction) =>
  z
    .object({
      full_name: z.string().min(2, t("validation.fullNameMin")),
      username: z
        .string()
        .min(3, t("validation.usernameMin"))
        .max(20, t("validation.usernameMax"))
        .regex(/^[a-zA-Z0-9_]+$/, t("validation.usernamePattern")),
      email: z.email(t("validation.emailInvalid")),
      password: z.string().min(8, t("validation.passwordMin8")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsMismatch"),
      path: ["confirmPassword"],
    });

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  avatar: z.instanceof(File).optional(),
});

// Types — derived from the schemas (use a placeholder translator to infer types)
type LoginSchema = ReturnType<typeof buildLoginSchema>;
type RegisterSchema = ReturnType<typeof buildRegisterSchema>;

export type LoginInput = z.infer<LoginSchema>;
export type RegisterInput = z.infer<RegisterSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// API payload type — without confirmPassword
export type RegisterPayload = Omit<RegisterInput, "confirmPassword">;
