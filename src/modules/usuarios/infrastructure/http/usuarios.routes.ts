import { Router } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireSuperAdmin,
} from "../../../../shared/security/auth.middleware.js";
import { NodemailerGmailEmailSender } from "../../../../shared/infrastructure/email/nodemailer-gmail.sender.js";
import { STAFF_ROLES } from "../../../../shared/security/roles.js";
import {
  CreateUsuarioUseCase,
  INVITABLE_STAFF_ROLES,
} from "../../application/use-cases/create-usuario.use-case.js";
import { DeactivateUsuarioUseCase } from "../../application/use-cases/deactivate-usuario.use-case.js";
import { GetUsuarioUseCase } from "../../application/use-cases/get-usuario.use-case.js";
import { ListUsuariosUseCase } from "../../application/use-cases/list-usuarios.use-case.js";
import { ResendInvitationUseCase } from "../../application/use-cases/resend-invitation.use-case.js";
import { UpdateUsuarioUseCase } from "../../application/use-cases/update-usuario.use-case.js";
import { UsuariosPrismaRepository } from "../persistence/usuarios-prisma.repository.js";

const staffRoleSchema = z.enum(STAFF_ROLES);
const invitableRoleSchema = z.enum(INVITABLE_STAFF_ROLES);
const statusSchema = z.enum(["pending", "active", "inactive"]);

const createSchema = z.object({
  email: z.string().email(),
  role: invitableRoleSchema,
});

const updateSchema = z
  .object({
    email: z.string().email().optional(),
    // No se puede asignar super_admin por API; solo roles invitables.
    role: invitableRoleSchema.optional(),
  })
  .refine((v) => v.email !== undefined || v.role !== undefined, {
    message: "Debes enviar al menos un campo para actualizar",
  });

export const usuariosRouter = Router();
usuariosRouter.use(requireAuth, requireSuperAdmin());

const usuariosPersistence = new UsuariosPrismaRepository();
const emailSender = new NodemailerGmailEmailSender();

const listUsuariosUseCase = new ListUsuariosUseCase({ usuariosPersistence });
const getUsuarioUseCase = new GetUsuarioUseCase({ usuariosPersistence });
const createUsuarioUseCase = new CreateUsuarioUseCase({ usuariosPersistence, emailSender });
const updateUsuarioUseCase = new UpdateUsuarioUseCase({ usuariosPersistence, emailSender });
const deactivateUsuarioUseCase = new DeactivateUsuarioUseCase({ usuariosPersistence });
const resendInvitationUseCase = new ResendInvitationUseCase({
  usuariosPersistence,
  emailSender,
});

usuariosRouter.get("/", async (req, res, next) => {
  try {
    const roleParse = staffRoleSchema.safeParse(req.query.role);
    const statusParse = statusSchema.safeParse(req.query.status);
    const isActiveRaw = req.query.is_active;
    const is_active =
      isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : undefined;

    const items = await listUsuariosUseCase.execute({
      role: roleParse.success ? roleParse.data : undefined,
      is_active,
      status: statusParse.success ? statusParse.data : undefined,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getUsuarioUseCase.execute(req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

usuariosRouter.post("/", async (req, res, next) => {
  try {
    const dto = createSchema.parse(req.body);
    const created = await createUsuarioUseCase.execute(dto);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

usuariosRouter.post("/:id/resend-invitation", async (req, res, next) => {
  try {
    const item = await resendInvitationUseCase.execute({ id: req.params.id });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

usuariosRouter.patch("/:id", async (req, res, next) => {
  try {
    const dto = updateSchema.parse(req.body);
    const updated = await updateUsuarioUseCase.execute({
      id: req.params.id,
      ...dto,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

usuariosRouter.delete("/:id", async (req, res, next) => {
  try {
    const updated = await deactivateUsuarioUseCase.execute({
      actorId: req.user!.id,
      id: req.params.id,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});
