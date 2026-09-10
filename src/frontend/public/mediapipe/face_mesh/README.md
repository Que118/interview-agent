# [DEPLOY] MediaPipe Face Mesh 离线资源

将以下文件放入此目录：

从 npm 包复制：
  cp -r node_modules/@mediapipe/face_mesh/* public/mediapipe/face_mesh/

或从 jsdelivr CDN 下载：
  https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/

必需文件：
  - face_mesh_solution_packed_assets_loader.js
  - face_mesh_solution_simd_wasm_bin.wasm
  - face_mesh_solution_packed_assets.data

部署时确保 WASM 文件有正确的 MIME 类型：
  application/wasm  wasm
