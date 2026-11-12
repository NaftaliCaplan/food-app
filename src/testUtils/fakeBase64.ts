// Produces a base64 string that decodes to exactly `byteLength` bytes — used
// by service tests to simulate expo-image-manipulator's saveAsync() output
// at a specific effective photo size (cloudflareVision.ts derives `size`
// from the base64 string's own length, not a separate byte read — see its
// own comment for why).
export function fakeBase64(byteLength: number): string {
  const fullGroups = Math.floor(byteLength / 3);
  const remainder = byteLength % 3;
  let base64 = 'A'.repeat(fullGroups * 4);
  if (remainder === 1) base64 += 'AA==';
  else if (remainder === 2) base64 += 'AAA=';
  return base64;
}
