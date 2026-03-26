import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    message = "Failed to load data. Please try again.",
    onRetry,
}: ErrorStateProps) {
    return (
        <Card className="border-destructive/20">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
                <AlertTriangle className="h-8 w-8 text-destructive/60" />
                <p className="text-sm text-muted-foreground">{message}</p>
                {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                        Retry
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
