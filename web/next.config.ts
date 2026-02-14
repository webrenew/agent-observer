import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
};

const withMDX = createMDX();

export default withMDX(nextConfig);
