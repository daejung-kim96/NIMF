import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    // rollupNodePolyFill()는 build.rollupOptions.plugins에만 넣는 게 좋습니다
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      stream: 'stream-browserify',
      buffer: 'buffer/',
      process: 'process/browser',
      util: 'util',
      events: 'events',
      crypto: 'crypto-browserify',
      assert: 'assert',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      'socket.io-client',
      'simple-peer',
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyFill(),
        inject({
          // 자동으로 'Buffer', 'process' 글로벌 변수를 polyfill 해줍니다
          Buffer: ['buffer', 'Buffer'],
          process: 'process',
        }),
      ],
    },
  },
});
