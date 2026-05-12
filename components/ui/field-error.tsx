import { cn } from "@/lib/utils";

interface FieldErrorProps {
    error?: string | null;
    className?: string;
}

export function FieldError({ error, className }: FieldErrorProps) {
    if (!error) return null;
    return (
        <p className={cn("text-xs text-destructive mt-1", className)} role="alert">
            {error}
        </p>
    );
}
