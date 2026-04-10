import { WorkforceGraphEditorClient } from "@/components/workforce/workforce-graph-editor-client";

export default function WorkforcePage() {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Agent Workforce Graph
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Define your team of agents and their execution dependencies.
        </p>
      </header>

      <WorkforceGraphEditorClient />
    </section>
  );
}
