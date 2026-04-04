import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { login, register } from "./auth";
import { createRule, listRules } from "./rules";
import openApiDocument from "./docs/openapi";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// OpenAPIの生JSONです。PostmanにこのURLをそのままインポートできます。
app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

// Swagger UIです。ブラウザで開いて「Try it out」からAPI実行できます。
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.post("/api/auth/register", register);
app.post("/api/auth/login", login);
app.post("/api/rules", createRule);
app.get("/api/rules", listRules);

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
