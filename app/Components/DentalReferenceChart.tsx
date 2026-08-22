"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

const DENTAL_CHART_URL = "/assets/ora-dental-chart.svg";
const DENTAL_CHART_VIEWBOX = "20 77 302 521";
const TOOTH_NUMBER = /^[1-4][1-8]$/;
const CONNECTOR_PAIRS = [
  ["18", "17"], ["17", "16"], ["16", "15"], ["15", "14"], ["14", "13"], ["13", "12"], ["12", "11"],
  ["11", "21"], ["21", "22"], ["22", "23"], ["23", "24"], ["24", "25"], ["25", "26"], ["26", "27"], ["27", "28"],
  ["48", "47"], ["47", "46"], ["46", "45"], ["45", "44"], ["44", "43"], ["43", "42"], ["42", "41"],
  ["41", "31"], ["31", "32"], ["32", "33"], ["33", "34"], ["34", "35"], ["35", "36"], ["36", "37"], ["37", "38"],
] as const;

type ToothCenter = { x: number; y: number };

const ARCH_CENTER: ToothCenter = { x: 171, y: 337.5 };
const CONNECTOR_OUTSET = 31;

// Centers are measured from the supplied Illustrator artboard (342 x 671).
const TOOTH_CENTERS: Record<string, ToothCenter> = {
  "11": { x: 152.3, y: 119.4 }, "12": { x: 121.4, y: 125.5 }, "13": { x: 99.3, y: 141.5 }, "14": { x: 82, y: 165.1 },
  "15": { x: 72.9, y: 192.9 }, "16": { x: 67.4, y: 228.3 }, "17": { x: 62.9, y: 271.6 }, "18": { x: 61.8, y: 311.7 },
  "21": { x: 189.9, y: 119.4 }, "22": { x: 220.8, y: 125.5 }, "23": { x: 242.9, y: 141.5 }, "24": { x: 260.3, y: 165.1 },
  "25": { x: 269.3, y: 192.9 }, "26": { x: 274.8, y: 228.3 }, "27": { x: 279.3, y: 271.6 }, "28": { x: 280.4, y: 311.7 },
  "31": { x: 184.3, y: 556.2 }, "32": { x: 209.5, y: 552.6 }, "33": { x: 229, y: 540.9 }, "34": { x: 246.2, y: 517.1 },
  "35": { x: 257.3, y: 487.7 }, "36": { x: 267.2, y: 449.8 }, "37": { x: 273.9, y: 404.6 }, "38": { x: 277.7, y: 363.1 },
  "41": { x: 157.9, y: 556.2 }, "42": { x: 132.7, y: 552.6 }, "43": { x: 113.3, y: 540.9 }, "44": { x: 96, y: 517.1 },
  "45": { x: 84.9, y: 487.7 }, "46": { x: 75, y: 449.8 }, "47": { x: 68.3, y: 404.6 }, "48": { x: 64.6, y: 363.1 },
};

function connectionKey(first: string, second: string) {
  return [first, second].sort().join(":");
}

function connectorPosition(first: string, second: string): ToothCenter {
  const firstCenter = TOOTH_CENTERS[first];
  const secondCenter = TOOTH_CENTERS[second];
  const midpoint = {
    x: (firstCenter.x + secondCenter.x) / 2,
    y: (firstCenter.y + secondCenter.y) / 2,
  };
  const toothVectorX = secondCenter.x - firstCenter.x;
  const toothVectorY = secondCenter.y - firstCenter.y;
  const toothDistance = Math.hypot(toothVectorX, toothVectorY) || 1;
  const perpendicular = {
    x: -toothVectorY / toothDistance,
    y: toothVectorX / toothDistance,
  };
  const oppositePerpendicular = { x: -perpendicular.x, y: -perpendicular.y };
  const firstCandidate = {
    x: midpoint.x + perpendicular.x * CONNECTOR_OUTSET,
    y: midpoint.y + perpendicular.y * CONNECTOR_OUTSET,
  };
  const secondCandidate = {
    x: midpoint.x + oppositePerpendicular.x * CONNECTOR_OUTSET,
    y: midpoint.y + oppositePerpendicular.y * CONNECTOR_OUTSET,
  };
  const distanceFromArchCenter = (point: ToothCenter) =>
    Math.hypot(point.x - ARCH_CENTER.x, point.y - ARCH_CENTER.y);
  const outside = distanceFromArchCenter(firstCandidate) > distanceFromArchCenter(secondCandidate)
    ? firstCandidate
    : secondCandidate;

  return outside;
}

function printConnectorMarkup(selectedTeeth: string[], toothConnections: string[]) {
  const selected = new Set(selectedTeeth.filter((tooth) => TOOTH_NUMBER.test(tooth)));
  const connected = new Set(toothConnections);
  return CONNECTOR_PAIRS.flatMap(([first, second]) => {
    if (!selected.has(first) || !selected.has(second)) return [];
    const connectedClass = connected.has(connectionKey(first, second)) ? " connected" : "";
    const position = connectorPosition(first, second);
    return `<circle class="ora-print-connector${connectedClass}" cx="${position.x}" cy="${position.y}" r="7.5"/>`;
  }).join("");
}

let dentalChartSourcePromise: Promise<string> | null = null;

function loadDentalChartSource() {
  dentalChartSourcePromise ??= fetch(DENTAL_CHART_URL, { cache: "force-cache" }).then((response) => {
    if (!response.ok) throw new Error("The dental chart asset could not be loaded.");
    return response.text();
  });
  return dentalChartSourcePromise;
}

function decorateDentalChart(
  source: string,
  selectedTeeth: string[],
  interactive: boolean,
  toothConnections: string[] = [],
) {
  const selected = new Set(selectedTeeth.filter((tooth) => TOOTH_NUMBER.test(tooth)));
  const interactionStyles = `<style id="ora-dental-interaction">
    .ora-tooth { cursor: pointer; outline: none; }
    .ora-tooth > path { transition: fill .16s ease, stroke .16s ease, filter .16s ease; }
    .ora-tooth:hover > path:first-child { fill: #b6ddd7; stroke: #4f8f86; filter: drop-shadow(0 1px 1px rgba(20, 80, 71, .18)); }
    .ora-tooth:focus-visible > path:first-child { stroke: #6d4d91; stroke-width: 2px; }
    .ora-tooth.ora-selected > path:first-child { fill: #8fc8bf !important; stroke: #4f8f86 !important; filter: drop-shadow(0 2px 2px rgba(20, 80, 71, .16)); }
    .ora-tooth.ora-selected > path:not(:first-child) { stroke: #245b54 !important; }
    .ora-tooth-label { pointer-events: none; transition: fill .16s ease, stroke .16s ease; }
    .ora-tooth-label.ora-selected-label { fill: #174c45 !important; stroke: #174c45 !important; }
    .ora-print-connector { fill: #f3edf8; stroke: #a58abb; stroke-width: 1.6; }
    .ora-print-connector.connected { fill: #d2bce4; stroke: #76518f; }
  </style>`;

  return source
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace('viewBox="0 0 342 671"', `viewBox="${DENTAL_CHART_VIEWBOX}"`)
    .replace("</defs>", `${interactionStyles}</defs>`)
    .replace("<svg ", `<svg class="ora-dental-svg" aria-hidden="${interactive ? "false" : "true"}" `)
    .replace(/<g id="_([1-4][1-8])" data-name="\1">/g, (_match, tooth: string) => {
      const selectedClass = selected.has(tooth) ? " ora-selected" : "";
      const accessibility = interactive
        ? ` role="button" tabindex="0" aria-label="Tooth ${tooth}" aria-pressed="${selected.has(tooth)}"`
        : "";
      return `<g id="_${tooth}" data-name="${tooth}" data-tooth="${tooth}" class="ora-tooth${selectedClass}"${accessibility}>`;
    })
    .replace(/<text class="cls-2"([^>]*)>(\s*<tspan[^>]*>([1-4][1-8])<\/tspan>\s*)<\/text>/g, (_match, attributes: string, content: string, tooth: string) => {
      return `<text class="cls-2 ora-tooth-label${selected.has(tooth) ? " ora-selected-label" : ""}" data-tooth-label="${tooth}"${attributes}>${content}</text>`;
    })
    .replace("</svg>", `${interactive ? "" : printConnectorMarkup(selectedTeeth, toothConnections)}</svg>`);
}

function toothFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const group = target.closest<SVGGElement>("g[data-tooth]");
  const tooth = group?.dataset.tooth;
  return tooth && TOOTH_NUMBER.test(tooth) ? tooth : null;
}

export async function dentalChartPrintMarkup(selectedTeeth: string[], toothConnections: string[] = []) {
  try {
    const source = await loadDentalChartSource();
    return `<div class="job-order-teeth">${decorateDentalChart(source, selectedTeeth, false, toothConnections)}</div>`;
  } catch {
    const numbers = selectedTeeth.filter((tooth) => TOOTH_NUMBER.test(tooth)).join(", ") || "None selected";
    return `<div class="job-order-teeth job-order-teeth-fallback"><img src="${DENTAL_CHART_URL}" alt="Selected teeth chart"><strong>${numbers}</strong></div>`;
  }
}

export default function DentalReferenceChart({
  selectedTeeth,
  toothConnections,
  onToggleTooth,
  onToggleConnection,
}: {
  selectedTeeth: string[];
  toothConnections: string[];
  onToggleTooth: (tooth: string) => void;
  onToggleConnection: (first: string, second: string) => void;
}) {
  const [source, setSource] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadDentalChartSource().then((value) => {
      if (active) setSource(value);
    }).catch(() => {
      if (active) setLoadFailed(true);
    });
    return () => { active = false; };
  }, []);

  const markup = useMemo(() => source ? decorateDentalChart(source, selectedTeeth, true) : "", [selectedTeeth, source]);
  const chooseTarget = (target: EventTarget | null) => {
    const tooth = toothFromTarget(target);
    if (tooth) onToggleTooth(tooth);
  };
  const handleClick = (event: MouseEvent<HTMLDivElement>) => chooseTarget(event.target);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const tooth = toothFromTarget(event.target);
    if (!tooth) return;
    event.preventDefault();
    onToggleTooth(tooth);
  };

  const visibleConnectors = CONNECTOR_PAIRS.flatMap(([first, second]) => {
    if (!selectedTeeth.includes(first) || !selectedTeeth.includes(second)) return [];
    const position = connectorPosition(first, second);
    return [{
      first,
      second,
      key: connectionKey(first, second),
      x: position.x,
      y: position.y,
    }];
  });

  const toggleConnector = (first: string, second: string) => onToggleConnection(first, second);
  const handleConnectorKeyDown = (
    event: KeyboardEvent<SVGCircleElement>,
    first: string,
    second: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleConnector(first, second);
  };

  return <div className="dental-reference-chart" role="group" aria-label="Interactive dental chart">
    {markup
      ? <>
          <div className="dental-reference-svg" onClick={handleClick} onKeyDown={handleKeyDown} dangerouslySetInnerHTML={{ __html: markup }} />
          <svg className="dental-connector-layer" viewBox={DENTAL_CHART_VIEWBOX} aria-label="Tooth connections">
            {visibleConnectors.map((connector) => {
              const connected = toothConnections.includes(connector.key);
              return <circle
                key={connector.key}
                className={connected ? "connected" : ""}
                cx={connector.x}
                cy={connector.y}
                r="7.5"
                role="button"
                tabIndex={0}
                aria-label={`Connect teeth ${connector.first} and ${connector.second}`}
                aria-pressed={connected}
                onClick={() => toggleConnector(connector.first, connector.second)}
                onKeyDown={(event) => handleConnectorKeyDown(event, connector.first, connector.second)}
              />;
            })}
          </svg>
        </>
      : loadFailed
        ? <div className="dental-reference-error">Dental chart could not load.</div>
        : <div className="dental-reference-loading" aria-label="Loading dental chart" aria-busy="true" />}
  </div>;
}
