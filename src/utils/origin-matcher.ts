export type AllowedOriginRule =
  | { type: "exact"; origin: string }
  | { type: "wildcard"; protocol: string; suffixHostname: string; port: string };

export function parseAllowedOriginRule(configuredOrigin: string): AllowedOriginRule | null {
  const wildcardMatch = configuredOrigin.match(/^(https?):\/\/\*\.(.+)$/i);

  if (wildcardMatch) {
    const protocol = wildcardMatch[1]?.toLowerCase();
    const hostAndPort = wildcardMatch[2];

    if (!protocol || !hostAndPort || hostAndPort.includes("/")) {
      return null;
    }

    try {
      const parsed = new URL(`${protocol}://placeholder.${hostAndPort}`);
      return {
        type: "wildcard",
        protocol: parsed.protocol,
        suffixHostname: parsed.hostname.replace(/^placeholder\./, "").toLowerCase(),
        port: parsed.port,
      };
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(configuredOrigin);
    return {
      type: "exact",
      origin: parsed.origin,
    };
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string, rules: AllowedOriginRule[]): boolean {
  let parsedIncomingOrigin: URL;

  try {
    parsedIncomingOrigin = new URL(origin);
  } catch {
    return false;
  }

  return rules.some((rule) => {
    if (rule.type === "exact") {
      return parsedIncomingOrigin.origin === rule.origin;
    }

    if (parsedIncomingOrigin.protocol !== rule.protocol) {
      return false;
    }

    if ((parsedIncomingOrigin.port ?? "") !== rule.port) {
      return false;
    }

    const incomingHostnameParts = parsedIncomingOrigin.hostname.toLowerCase().split(".");
    const suffixParts = rule.suffixHostname.split(".");

    if (incomingHostnameParts.length !== suffixParts.length + 1) {
      return false;
    }

    return incomingHostnameParts.slice(1).join(".") === rule.suffixHostname;
  });
}
