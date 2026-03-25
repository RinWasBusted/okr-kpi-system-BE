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
    tags: [
      {
        name: "Admin - Company Admins",
        description: "Manage company-level admin accounts (AdminCompany)",
      },
    ],
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
    // 👇 Đưa paths vào đây
    paths: {
      "/admin/companies/{company_id}/admins": {
        get: {
          summary: "Lấy danh sách AdminCompany của một công ty",
          tags: ["Admin - Company Admins"],
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "company_id", in: "path", required: true, schema: { type: "integer" } },
            { name: "is_active", in: "query", schema: { type: "boolean" } },
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
          ],
          responses: {
            200: { description: "Danh sách AdminCompany" },
            404: { description: "COMPANY_NOT_FOUND" },
          },
        },
        post: {
          summary: "Tạo tài khoản AdminCompany mới",
          tags: ["Admin - Company Admins"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["full_name", "email", "password"],
                  properties: {
                    full_name: { type: "string" },
                    email: { type: "string" },
                    password: { type: "string", minLength: 8 },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: "Tạo thành công" },
            409: { description: "EMAIL_EXISTS" },
            404: { description: "COMPANY_NOT_FOUND" },
            403: { description: "COMPANY_INACTIVE" },
          },
        },
      },
      "/admin/companies/{company_id}/admins/{admin_id}": {
        put: {
          summary: "Cập nhật tài khoản AdminCompany",
          tags: ["Admin - Company Admins"],
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    full_name: { type: "string" },
                    email: { type: "string" },
                    password: { type: "string", minLength: 8 },
                    is_active: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Cập nhật thành công" },
            404: { description: "COMPANY_NOT_FOUND hoặc ADMIN_NOT_FOUND" },
            409: { description: "EMAIL_EXISTS" },
            400: { description: "INVALID_PASSWORD hoặc INVALID_PAYLOAD" },
          },
        },
        delete: {
          summary: "Xoá tài khoản AdminCompany (soft delete)",
          tags: ["Admin - Company Admins"],
          security: [{ cookieAuth: [] }],
          responses: {
            200: { description: "Xoá thành công (is_active = false)" },
            404: { description: "ADMIN_NOT_FOUND" },
            400: { description: "LAST_ADMIN" },
          },
        },
      },
    },
  },
  apis: ["./src/api/**/*.js", "./src/server.js"],
};


// IMPORTANT: swaggerSpec must be created AFTER we finish mutating swaggerOptions.definition.paths
// (the file currently overrides paths later for AdminCompany documentation).
let swaggerSpec;

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

// 2.2 Thêm tài liệu cho API quản lý AdminCompany

swaggerOptions.definition.paths = {
  "/admin/companies/{company_id}/admins": {
    get: {
      summary: "Lấy danh sách AdminCompany của một công ty",
      tags: ["Admin - Company Admins"],
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "company_id",
          in: "path",
          required: true,
          schema: { type: "integer" },
        },
        { name: "is_active", in: "query", schema: { type: "boolean" } },
        { name: "page", in: "query", schema: { type: "integer" } },
        { name: "per_page", in: "query", schema: { type: "integer" } },
      ],
      responses: {
        200: {
          description: "Danh sách AdminCompany",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        full_name: { type: "string" },
                        email: { type: "string" },
                        is_active: { type: "boolean" },
                        created_at: { type: "string", format: "date-time" },
                        last_login_at: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                        },
                      },
                    },
                  },
                  meta: {
                    type: "object",
                    properties: {
                      page: { type: "integer" },
                      per_page: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        404: { description: "COMPANY_NOT_FOUND" },
      },
    },
    post: {
      summary: "Tạo tài khoản AdminCompany mới",
      tags: ["Admin - Company Admins"],
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["full_name", "email", "password"],
              properties: {
                full_name: { type: "string" },
                email: { type: "string" },
                password: { type: "string", minLength: 8 },
              },
            },
          },
        },
      },
      responses: {
        201: { description: "Tạo thành công" },
        409: { description: "EMAIL_EXISTS" },
        404: { description: "COMPANY_NOT_FOUND" },
        403: { description: "COMPANY_INACTIVE" },
      },
    },
  },
  "/admin/companies/{company_id}/admins/{admin_id}": {
    put: {
      summary: "Cập nhật tài khoản AdminCompany",
      tags: ["Admin - Company Admins"],
      security: [{ cookieAuth: [] }],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                full_name: { type: "string" },
                email: { type: "string" },
                password: { type: "string", minLength: 8 },
                is_active: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Cập nhật thành công" },
        404: { description: "COMPANY_NOT_FOUND hoặc ADMIN_NOT_FOUND" },
        409: { description: "EMAIL_EXISTS" },
        400: { description: "INVALID_PASSWORD hoặc INVALID_PAYLOAD" },
      },
    },
    delete: {
      summary: "Xoá tài khoản AdminCompany (soft delete)",
      tags: ["Admin - Company Admins"],
      security: [{ cookieAuth: [] }],
      responses: {
        200: { description: "Xoá thành công (is_active = false)" },
        404: { description: "ADMIN_NOT_FOUND" },
        400: { description: "LAST_ADMIN" },
      },
    },
  },
  "/objectives/{objectiveId}/key-results/generate": {
    post: {
      summary: "Generate key results for an objective",
      tags: ["OKR AI"],
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "objectiveId",
          in: "path",
          required: true,
          schema: { type: "integer" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                count: { type: "integer", minimum: 1, maximum: 10 },
                language: { type: "string", enum: ["vi", "en"] },
                constraints: {
                  type: "object",
                  properties: {
                    due_date: { type: "string", format: "date" },
                    unit: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Generated key results successfully",
        },
        401: { description: "Unauthorized" },
      },
    },
  },
  "/okr-ai/generate-test": {
    post: {
      summary: "Generate test key results (no auth, no objectiveId)",
      tags: ["OKR AI"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                objective: { type: "string", minLength: 8, maxLength: 300 },
                count: { type: "integer", minimum: 1, maximum: 10 },
                language: { type: "string", enum: ["vi", "en"] },
                constraints: {
                  type: "object",
                  properties: {
                    due_date: { type: "string", format: "date" },
                    unit: { type: "string" },
                  },
                },
              },
              required: ["objective"],
            },
          },
        },
      },
      responses: {
        200: { description: "Generated key results successfully" },
        400: { description: "Invalid input" },
      },
    },
  },
};

// Build the final swagger specification after paths are fully defined.
swaggerSpec = swaggerJsdoc(swaggerOptions);
