"use client";

// A Field that is either quiet or needs fixing: `error` carries the already translated tag and sentence.
// Whatever is typed in it is kept out of analytics and error-report recordings, should a later slice add either.
import { Field, type FieldProps } from "@/components/ui/field";

export type FieldProblem = { tag: string; message: string };

export function TextField({ error, ...props }: Readonly<Omit<FieldProps, "state" | "stateLabel" | "message"> & { error?: FieldProblem }>) {
  const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;
  return error ? <Field {...props} {...guarded} state="error" stateLabel={error.tag} message={error.message} /> : <Field {...props} {...guarded} />;
}
