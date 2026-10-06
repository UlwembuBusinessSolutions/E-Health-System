interface Props {
  title: string;
  steps: { title: string; description: string }[];
}

export function PharmacyWorkflowGuide({ title, steps }: Props) {
  return (
    <details open className="mb-5 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-text-primary focus-visible:outline-brand-500">
        {title}
      </summary>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{index + 1}</span>
            <div>
              <p className="text-sm font-medium text-text-primary">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
