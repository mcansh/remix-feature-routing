import {
  isSegmentSeparator,
  paramPrefixChar,
  escapeStart,
  escapeEnd,
  optionalStart,
  optionalEnd,
} from "@remix-run/dev/dist/config/routesConvention";

export type State =
  | // normal path segment normal character concatenation until we hit a special character or the end of the segment (i.e. `/`, `.`, '\')
  "NORMAL"
  // we hit a `[` and are now in an escape sequence until we hit a `]` - take characters literally and skip isSegmentSeparator checks
  | "ESCAPE"
  // we hit a `(` and are now in an optional segment until we hit a `)` or an escape sequence
  | "OPTIONAL"
  // we previously were in a optional segment and hit a `[` and are now in an escape sequence until we hit a `]` - take characters literally and skip isSegmentSeparator checks - afterwards go back to OPTIONAL state
  | "OPTIONAL_ESCAPE";

export function getRouteSegments(routeId: string): [string[], string[]] {
  let routeSegments: string[] = [];
  let rawRouteSegments: string[] = [];
  let index = 0;
  let routeSegment = "";
  let rawRouteSegment = "";
  let state: State = "NORMAL";

  let pushRouteSegment = (segment: string, rawSegment: string) => {
    if (!segment) return;

    let notSupportedInRR = (segment: string, char: string) => {
      throw new Error(
        `Route segment "${segment}" for "${routeId}" cannot contain "${char}".\n` +
          `If this is something you need, upvote this proposal for React Router https://github.com/remix-run/react-router/discussions/9822.`
      );
    };

    if (rawSegment.includes("*")) {
      return notSupportedInRR(rawSegment, "*");
    }

    if (rawSegment.includes(":")) {
      return notSupportedInRR(rawSegment, ":");
    }

    if (rawSegment.includes("/")) {
      return notSupportedInRR(segment, "/");
    }

    routeSegments.push(segment);
    rawRouteSegments.push(rawSegment);
  };

  while (index < routeId.length) {
    let char = routeId[index];
    index++; //advance to next char

    switch (state) {
      case "NORMAL": {
        if (isSegmentSeparator(char)) {
          pushRouteSegment(routeSegment, rawRouteSegment);
          routeSegment = "";
          rawRouteSegment = "";
          state = "NORMAL";
          break;
        }
        if (char === escapeStart) {
          state = "ESCAPE";
          rawRouteSegment += char;
          break;
        }
        if (char === optionalStart) {
          state = "OPTIONAL";
          rawRouteSegment += char;
          break;
        }
        if (!routeSegment && char == paramPrefixChar) {
          if (index === routeId.length) {
            routeSegment += "*";
            rawRouteSegment += char;
          } else {
            routeSegment += ":";
            rawRouteSegment += char;
          }
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "ESCAPE": {
        if (char === escapeEnd) {
          state = "NORMAL";
          rawRouteSegment += char;
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "OPTIONAL": {
        if (char === optionalEnd) {
          routeSegment += "?";
          rawRouteSegment += char;
          state = "NORMAL";
          break;
        }

        if (char === escapeStart) {
          state = "OPTIONAL_ESCAPE";
          rawRouteSegment += char;
          break;
        }

        if (!routeSegment && char === paramPrefixChar) {
          if (index === routeId.length) {
            routeSegment += "*";
            rawRouteSegment += char;
          } else {
            routeSegment += ":";
            rawRouteSegment += char;
          }
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
      case "OPTIONAL_ESCAPE": {
        if (char === escapeEnd) {
          state = "OPTIONAL";
          rawRouteSegment += char;
          break;
        }

        routeSegment += char;
        rawRouteSegment += char;
        break;
      }
    }
  }

  // process remaining segment
  pushRouteSegment(routeSegment, rawRouteSegment);
  return [routeSegments, rawRouteSegments];
}

export function createRoutePath(
  routeSegments: string[],
  rawRouteSegments: string[],
  isIndex?: boolean
) {
  let result: string[] = [];

  if (isIndex) {
    routeSegments = routeSegments.slice(0, -1);
  }

  for (let index = 0; index < routeSegments.length; index++) {
    let segment = routeSegments[index];
    let rawSegment = rawRouteSegments[index];

    // skip pathless layout segments
    if (segment.startsWith("_") && rawSegment.startsWith("_")) {
      continue;
    }

    // remove trailing slash
    if (segment.endsWith("_") && rawSegment.endsWith("_")) {
      segment = segment.slice(0, -1);
    }

    result.push(segment);
  }

  return result.length ? result.join("/") : undefined;
}
