"use client";

import { Component, Suspense, type ReactNode } from "react";

type Props = { name: string; children: ReactNode };
type State = { failed: boolean };

/** Error boundary + Suspense for extension slots: a failing slot renders nothing. */
class SlotErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== "production") console.warn(`[slot:${this.props.name}] failed`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SlotBoundary({ name, children }: Props) {
  return (
    <SlotErrorBoundary name={name}>
      <Suspense fallback={null}>{children}</Suspense>
    </SlotErrorBoundary>
  );
}
