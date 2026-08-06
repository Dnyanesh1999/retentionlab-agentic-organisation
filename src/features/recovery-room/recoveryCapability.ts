const recoveryCapabilityPattern = /^[A-Za-z0-9._~-]{32,2048}$/;

type BrowserLocation = Pick<Location, "hash">;
type BrowserHistory = Pick<History, "replaceState">;

export function consumeRecoveryCapability(
  location: BrowserLocation = window.location,
  history: BrowserHistory = window.history,
) {
  const route = location.hash.replace(/^#/, "");
  const queryIndex = route.indexOf("?");
  if (queryIndex === -1 || route.slice(0, queryIndex) !== "/cases/recovery-room") return null;

  const path = route.slice(0, queryIndex);
  const parameters = new URLSearchParams(route.slice(queryIndex + 1));
  const capability = parameters.get("recovery");
  parameters.delete("recovery");

  const remaining = parameters.toString();
  history.replaceState(null, "", `#${path}${remaining ? `?${remaining}` : ""}`);

  return capability && recoveryCapabilityPattern.test(capability) ? capability : null;
}
