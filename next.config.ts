import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database schema is applied at runtime, so every server function needs the SQL file.
  outputFileTracingIncludes: {
    "/**": ["./db/schema.sql"],
  },
};

export default nextConfig;
