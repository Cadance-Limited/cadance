"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { GlossaryIndex } from "./glossary-index";

/**
 * Floating "Glossary" trigger + modal. Renders a small button in the
 * footer area that opens the full glossary index dialog.
 */
export function GlossaryTrigger() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <BookOpen className="h-3 w-3" />
        Glossary
      </button>
      <GlossaryIndex open={open} onOpenChange={setOpen} />
    </>
  );
}
