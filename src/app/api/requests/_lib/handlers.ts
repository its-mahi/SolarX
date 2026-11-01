// Shared helpers for the request Route Handlers.
import { ApiError } from "@/lib/api/errors";
import { withApiHandler, type RouteContext } from "@/lib/api/respond";
import { requestIdParamSchema } from "@/lib/validation/requests";

export const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;
export const PUBLISHED_MESSAGE = "This request has been published and can no longer be edited";

/** withApiHandler plus `Cache-Control: no-store` on every response, errors included (owner data, signed URLs). */
export function withNoStoreHandler<P = Record<string, string | string[]>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<Response>,
) {
  const wrapped = withApiHandler<P>(handler);
  return async (req: Request, ctx: RouteContext<P>): Promise<Response> => {
    const res = await wrapped(req, ctx);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
}

export async function parseRequestId(ctx: RouteContext<{ id: string }>): Promise<string> {
  const parsed = requestIdParamSchema.safeParse(await ctx.params);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", "The request id is not valid.", [{ path: "id", message: "Must be a valid id" }]);
  }
  return parsed.data.id;
}

export { dtoWithPhoto } from "@/lib/requests/present";
