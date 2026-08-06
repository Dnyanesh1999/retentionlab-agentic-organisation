import { describe, expect, it, vi } from "vitest";

import { consumeRecoveryCapability } from "./recoveryCapability";

describe("recovery capability fragment", () => {
  it("consumes the capability from the hash route and removes it from browser history", () => {
    const replaceState = vi.fn();
    const capability = "opaque.recovery-capability_token-1234567890";

    expect(consumeRecoveryCapability(
      { hash: `#/cases/recovery-room?recovery=${capability}&source=email` } as Location,
      { replaceState } as unknown as History,
    )).toBe(capability);
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/cases/recovery-room?source=email");
  });

  it("removes malformed capabilities and never reads another route", () => {
    const replaceState = vi.fn();

    expect(consumeRecoveryCapability(
      { hash: "#/cases/recovery-room?recovery=short" } as Location,
      { replaceState } as unknown as History,
    )).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, "", "#/cases/recovery-room");

    replaceState.mockClear();
    expect(consumeRecoveryCapability(
      { hash: "#/cases/organisation?recovery=opaque.recovery-capability_token-1234567890" } as Location,
      { replaceState } as unknown as History,
    )).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
