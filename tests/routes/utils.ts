import type { Handler } from "express";
import { vi } from "vitest";

interface InvokeOptions {
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
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
  const routeLayer = layer.route.stack.find(() => true);
  if (!routeLayer) {
    throw new Error(`Handler not found for ${method.toUpperCase()} ${path}`);
  }
  return routeLayer.handle as Handler;
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
    };
    const res = createMockResponse();
    await handler(req, res, () => undefined);
    return res;
  }
  return { router, invoke };
}
