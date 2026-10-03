// Shared mock for a fetch() Response, used by every service test that calls
// Cloudflare Workers AI (tagService, selfieCheckService, cloudflareService) —
// was independently duplicated verbatim across all three test files.
export function makeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(String(body)),
  };
}
