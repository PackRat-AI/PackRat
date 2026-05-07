'use client';

import { Button } from '@packrat/web-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@packrat/web-ui/components/dialog';
import { Braces } from 'lucide-react';

interface RawObjectDialogProps {
  label: string;
  data: unknown;
}

export function RawObjectDialog({ label, data }: RawObjectDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Braces className="h-3.5 w-3.5" />
          <span className="sr-only">View raw {label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{label}</DialogTitle>
          <DialogDescription className="sr-only">Raw JSON data for {label}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4">
          <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
