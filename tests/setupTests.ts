import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import Module from 'module';
import path from 'path';
import url from 'url';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const objectAssignMockPath = path.resolve(__dirname, './mocks/object-assign.cjs');

const originalResolve = Module._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'object.assign') {
    return objectAssignMockPath;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

vi.mock('deep-equal', () => ({
  default: (a: unknown, b: unknown) => Object.is(a, b),
  __esModule: true,
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error - jsdom does not provide ResizeObserver
global.ResizeObserver = global.ResizeObserver || MockResizeObserver;
