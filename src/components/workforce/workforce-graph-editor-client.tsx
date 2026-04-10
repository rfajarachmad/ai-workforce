"use client";

import dynamic from "next/dynamic";

export const WorkforceGraphEditorClient = dynamic(
  () =>
    import("./workforce-graph-editor").then((m) => m.WorkforceGraphEditor),
  { ssr: false },
);
