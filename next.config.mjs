import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${FASTAPI_BASE_URL}/api/:path*`,
        },
        {
          source: "/swagger",
          destination: `${FASTAPI_BASE_URL}/swagger`,
        },
        {
          source: "/swagger/:path*",
          destination: `${FASTAPI_BASE_URL}/swagger/:path*`,
        },
        {
          source: "/openapi.json",
          destination: `${FASTAPI_BASE_URL}/openapi.json`,
        },
      ],
    };
  },
};

export default nextConfig;
