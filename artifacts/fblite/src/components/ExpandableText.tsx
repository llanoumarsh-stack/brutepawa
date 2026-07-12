import { useState } from "react";

interface Props {
  text: string;
  maxChars?: number;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
}

export default function ExpandableText({
  text,
  maxChars = 220,
  fontSize = 15,
  color = "#111827",
  lineHeight = 1.6,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!text || text.length <= maxChars) {
    return (
      <span style={{ fontSize, color, lineHeight, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {text}
      </span>
    );
  }

  if (expanded) {
    return (
      <span style={{ fontSize, color, lineHeight, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {text}
        {"  "}
        <span
          onClick={e => { e.stopPropagation(); setExpanded(false); }}
          style={{ color: "#22C55E", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Voir moins
        </span>
      </span>
    );
  }

  const cut = text.slice(0, maxChars).trimEnd();

  return (
    <span style={{ fontSize, color, lineHeight, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {cut}
      <span style={{ color: "#9CA3AF" }}>{"... "}</span>
      <span
        onClick={e => { e.stopPropagation(); setExpanded(true); }}
        style={{ color: "#22C55E", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        Voir plus
      </span>
    </span>
  );
}
