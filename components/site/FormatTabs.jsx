"use client";
import { Children, useEffect, useRef, useState } from "react";

// Cards remain server-rendered children; only tab selection needs client state.
// Before hydration (and with JS disabled), every format is available as a normal link.
export default function FormatTabs({ labels, children }) {
  const cards = Children.toArray(children),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(0),
    buttons = useRef([]);
  useEffect(() => setReady(true), []);
  function move(event, index) {
    const offsets = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -index,
      End: cards.length - 1 - index,
    };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = (index + offsets[event.key] + cards.length) % cards.length;
    setSelected(next);
    buttons.current[next]?.focus({ preventScroll: true });
  }
  return (
    <>
      <div
        className="format-tabs"
        role="tablist"
        aria-label="Формат мероприятия"
        hidden={!ready}
      >
        {labels.map((label, index) => (
          <button
            key={index}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            id={"format-tab-" + index}
            type="button"
            role="tab"
            aria-controls={"format-panel-" + index}
            aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => move(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={
          "event-grid editorial-formats" + (ready ? " formats-ready" : "")
        }
      >
        {cards.map((card, index) => (
          <div
            className="format-panel"
            key={card.key}
            id={"format-panel-" + index}
            role={ready ? "tabpanel" : undefined}
            aria-labelledby={ready ? "format-tab-" + index : undefined}
            hidden={ready && selected !== index}
          >
            {card}
          </div>
        ))}
      </div>
    </>
  );
}
