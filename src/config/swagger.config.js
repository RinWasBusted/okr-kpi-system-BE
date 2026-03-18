import "dotenv/config";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL
  ? `${process.env.BASE_URL}:${PORT}`
  : `http://localhost:${PORT}`;

const SAME_ORIGIN_SERVER = {
  url: "/api",
  description: "Same-origin (recommended for Swagger UI + cookies)",
};

const ABSOLUTE_SERVER = {
  url: `${BASE_URL}/api`,
  description: "Absolute API Server (cross-origin, cookies not auto-sent)",
};

const SWAGGER_ENABLE_ABSOLUTE_SERVER =
  process.env.SWAGGER_ENABLE_ABSOLUTE_SERVER === "true";

const swaggerServers = [SAME_ORIGIN_SERVER];
if (SWAGGER_ENABLE_ABSOLUTE_SERVER) {
  swaggerServers.push(ABSOLUTE_SERVER);
}

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "OKR-KPI System API",
      version: "1.0.0",
      description: "API docs for OKR-KPI System Backend",
    },
    servers: swaggerServers,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/api/**/*.js", "./src/server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export const setupSwagger = (app) => {
  const swaggerUiOptions = {
    swaggerOptions: {
      withCredentials: true,
      persistAuthorization: true,
      requestInterceptor: (req) => {
        req.credentials = "include";
        return req;
      },
    },
  };

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};
