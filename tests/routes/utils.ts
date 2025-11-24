import type { Handler } from "express";
import { vi } from "vitest";

interface InvokeOptions {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}

function createMockResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.jsonData = undefined;
  res.json = vi.fn().mockImplementation((data: any) => {
    res.jsonData = data;
    return res;
  });
  return res;
}

function getHandler(router: any, method: string, path: string): Handler {
  const lowerMethod = method.toLowerCase();
  const layer = router.stack?.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[lowerMethod],
  );
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  // Execute all handlers in sequence (middleware + final handler)
  const handlers = layer.route.stack.map((h: any) => h.handle);
  return async (req: any, res: any, next: any) => {
    let index = 0;
    const runNext = async () => {
      if (index < handlers.length) {
        const handler = handlers[index++];
        await handler(req, res, runNext);
      } else if (next) {
        await next();
      }
    };
    await runNext();
  };
}

export function createRouterInvoker<T extends (...args: any[]) => any>(routerFactory: T) {
  const router = routerFactory();
  async function invoke(method: string, path: string, options: InvokeOptions = {}) {
    const handler = getHandler(router, method, path);
    const req: any = {
      params: options.params || {},
      query: options.query || {},
      body: options.body || {},
      method: method.toUpperCase(),
      path,
      headers: options.headers || { authorization: "Bearer test-token" },
      // Add mock user for requireAuth middleware
      user: { id: 1, username: "testuser" },
    };
    const res = createMockResponse();
    await handler(req, res, () => undefined);
    return res;
  }
  return { router, invoke };
}

