import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { registerApiRoutes } from "../src/apiRoutes.ts";

const app = express();
app.use(express.json());
registerApiRoutes(app);

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Let express handle incoming serverless requests on /api/*
  return (app as any)(req, res);
}
