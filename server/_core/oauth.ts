import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { getGoogleAuthUrl, getGoogleUserInfo } from "./googleAuth";
import { ENV } from "./env";
import { notifyOwner } from "./notification";
import { isNewUser } from "../db";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // ─── Manus OAuth (mantener por compatibilidad) ─────────────────────────────
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Manus callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  // Paso 1: Redirigir a Google
  app.get("/api/auth/google", (req: Request, res: Response) => {
    try {
      // El origin viene del frontend como query param, o se infiere del request
      const origin = getQueryParam(req, "origin") ??
        (req.headers["x-forwarded-proto"]
          ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
          : `${req.protocol}://${req.headers.host}`);

      const authUrl = getGoogleAuthUrl(origin, origin);
      res.redirect(302, authUrl);
    } catch (error) {
      console.error("[Google OAuth] Failed to generate auth URL", error);
      res.status(500).json({ error: "Failed to initiate Google login" });
    }
  });

  // Paso 2: Callback de Google
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state"); // state contiene el origin

    if (!code) {
      res.redirect("/?error=google_auth_failed");
      return;
    }

    try {
      // Reconstruir el origin desde state o desde el request
      const origin = state ??
        (req.headers["x-forwarded-proto"]
          ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}`
          : `${req.protocol}://${req.headers.host}`);

      const googleUser = await getGoogleUserInfo(code, origin);

      // Usar googleId como openId para mantener compatibilidad con el sistema de sesiones
      const openId = `google:${googleUser.googleId}`;

      // Verificar si es un usuario nuevo antes del upsert
      const esNuevo = await isNewUser(openId);

      // Si el email coincide con el owner, asignar superadmin automáticamente
      const isOwner = ENV.ownerEmail && googleUser.email === ENV.ownerEmail;

      await db.upsertUser({
        openId,
        name: googleUser.name,
        email: googleUser.email,
        loginMethod: "google",
        lastSignedIn: new Date(),
        ...(isOwner ? { role: 'superadmin' } : {}),
      });

      // Notificar al superadmin si es un colaborador nuevo (no el owner)
      if (esNuevo && !isOwner) {
        notifyOwner({
          title: `Nuevo colaborador registrado: ${googleUser.name ?? googleUser.email}`,
          content: `Un nuevo colaborador se registró en Snowtea HQ y está pendiente de activación.\n\nNombre: ${googleUser.name ?? 'Sin nombre'}\nEmail: ${googleUser.email ?? 'Sin email'}\n\nEntra a Usuarios y Roles para asignarle un rol.`,
        }).catch(() => {}); // no bloquear el login si la notificación falla
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleUser.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.redirect("/?error=google_auth_failed");
    }
  });
}
