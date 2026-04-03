export default function Home() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Workspace Overview
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Coordinate autonomous agents, monitor progress, and ship faster.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Active Agents", value: "12" },
          { title: "Queued Tasks", value: "28" },
          { title: "Completed Today", value: "143" },
          { title: "Avg. Response", value: "1.2s" },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <p className="text-xs uppercase tracking-wider text-slate-400">
              {item.title}
            </p>
            <p className="mt-2 text-2xl font-semibold text-cyan-300">
              {item.value}
            </p>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="text-base font-semibold text-white">System Activity</h3>
        <ul className="mt-4 space-y-3 text-sm text-slate-300">
          <li>Agent Alpha generated onboarding flow copy.</li>
          <li>Agent Beta fixed 3 TypeScript errors in `src/lib/chat.ts`.</li>
          <li>Agent Gamma queued performance profiling for dashboard route.</li>
        </ul>
      </div>
    </section>
  );
}
