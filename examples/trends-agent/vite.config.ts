import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    fs: {
      allow: [
        // Allow access to all node_modules
        '**/node_modules/**',
        // Allow access to project root
        process.cwd(),
        // Allow access to specific node_modules paths
        path.resolve(process.cwd(), 'node_modules/.pnpm'),
        path.resolve(process.cwd(), 'node_modules/.pnpm/@xyflow+react@12.6.0_@types+react@18.3.21_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/@xyflow/react/dist'),
        path.resolve(process.cwd(), 'node_modules/.pnpm/@motiadev+workbench@0.1.0-beta.28_@types+node@22.15.14_@types+react@18.3.21_eslint@9.26_1b21b652ae57dc22c2d029e54ee02b5a/node_modules/@motiadev/workbench/dist'),
      ],
    },
  },
}); 