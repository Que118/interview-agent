/** @type {import('next').NextConfig} */
const nextConfig = {
  // [DEPLOY] 静态导出模式（取消注释以启用静态部署）
  // output: 'export',

  // [DEPLOY] 如果部署到子路径，取消注释下面这行
  // basePath: '/interview-agent',

  // API 代理到 FastAPI 后端（dev模式 + SSR模式）
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },

  // [DEPLOY] 确保 WASM 和 MediaPipe 资源正确设置响应头
  async headers() {
    return [
      {
        source: "/mediapipe/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  // [DEPLOY] webpack 配置：允许 WASM 导入
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
