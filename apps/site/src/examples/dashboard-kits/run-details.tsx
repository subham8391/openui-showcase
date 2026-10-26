"use client";

import { type OpenUIError } from "@openuidev/react-lang";
import { type ToolCall } from "./kits/client";

export function RunDetails({
  program,
  calls,
  errors,
}: {
  program: string;
  calls: ToolCall[];
  errors: OpenUIError[];
}) {
  const failed = calls.filter((c) => !c.ok).length;
  return (
    <div className="details">
      <p className="details__summary">
        {calls.length} tool {calls.length === 1 ? "call" : "calls"}
        {failed > 0 && <span className="details__bad"> · {failed} failed</span>}
        {" · "}
        {errors.length === 0 ? (
          "no renderer errors"
        ) : (
          <span className="details__bad">
            {errors.length} renderer {errors.length === 1 ? "error" : "errors"}
          </span>
        )}
      </p>
      {errors.length > 0 && (
        <ul className="details__errors">
          {errors.map((error, i) => (
            <li key={i}>
              <code>{error.code}</code> {error.message}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Tool calls</summary>
        <ul className="details__calls">
          {calls.map((call, i) => (
            <li key={i}>
              <code>{call.tool}</code> {JSON.stringify(call.args)} · {call.ms} ms
              {call.ok ? "" : " · failed"}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>openui-lang program</summary>
        <pre className="code">{program}</pre>
      </details>
    </div>
  );
}
