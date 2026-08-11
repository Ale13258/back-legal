import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../../../shared/security/auth.middleware.js";
import { GetRegistrationInvitationUseCase } from "../../application/use-cases/get-registration-invitation.use-case.js";
import { LoginUseCase } from "../../application/use-cases/login.use-case.js";
import { RegisterClienteUseCase } from "../../application/use-cases/register-cliente.use-case.js";
import { RegisterStaffUseCase } from "../../application/use-cases/register-staff.use-case.js";
import { RefreshUseCase } from "../../application/use-cases/refresh.use-case.js";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case.js";
import { AuthPrismaRepository } from "../persistence/auth-prisma.repository.js";
import { Argon2PasswordHasher } from "../security/argon2-password-hasher.js";
import { JwtTokenService } from "../security/jwt-token.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

const registerStaffSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(6),
    confirm_password: z.string().min(6),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

const registrationInvitationQuerySchema = z.object({
  token: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const authRouter = Router();

const authPersistence = new AuthPrismaRepository();
const passwordHasher = new Argon2PasswordHasher();
const tokenService = new JwtTokenService();

const loginUseCase = new LoginUseCase({ authPersistence, passwordHasher, tokenService });
const registerClienteUseCase = new RegisterClienteUseCase({ authPersistence, passwordHasher });
const getRegistrationInvitationUseCase = new GetRegistrationInvitationUseCase({
  authPersistence,
});
const registerStaffUseCase = new RegisterStaffUseCase({ authPersistence, passwordHasher });
const refreshUseCase = new RefreshUseCase({ authPersistence, tokenService });
const logoutUseCase = new LogoutUseCase({ authPersistence, tokenService });

authRouter.post("/login", async (req, res, next) => {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await loginUseCase.execute(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/register-cliente", async (req, res, next) => {
  try {
    const dto = registerSchema.parse(req.body);
    const user = await registerClienteUseCase.execute({ email: dto.email, password: dto.password });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/registration-invitation", async (req, res, next) => {
  try {
    const dto = registrationInvitationQuerySchema.parse(req.query);
    const invitation = await getRegistrationInvitationUseCase.execute(dto);
    res.setHeader("Cache-Control", "no-store");
    res.json(invitation);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/register-staff", async (req, res, next) => {
  try {
    const dto = registerStaffSchema.parse(req.body);
    const user = await registerStaffUseCase.execute(dto);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(req.user);
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const dto = refreshSchema.parse(req.body);
    const result = await refreshUseCase.execute(dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const dto = refreshSchema.parse(req.body);
    await logoutUseCase.execute(dto);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
