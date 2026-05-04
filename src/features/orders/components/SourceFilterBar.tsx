import type { IntegrationMeta } from "../types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  integrations: IntegrationMeta[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
}

export function SourceFilterBar({ integrations, activeFilter, onFilterChange }: Props) {
  return (
    <div className="relative">
      {/* Fade-out on the right to hint scrollability */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />

      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {/* All Orders pill */}
        <button
          onClick={() => onFilterChange("all")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
            activeFilter === "all"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          All Orders
        </button>

        {integrations.map((integration) => {
          const isActive = activeFilter === integration.key;
          const isClickable = integration.isConnected;

          const pill = (
            <button
              key={integration.key}
              onClick={() => isClickable && onFilterChange(integration.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : isClickable
                  ? "border-border bg-background hover:bg-muted"
                  : "cursor-default border-dashed border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <span className="text-base leading-none">{integration.emoji}</span>
              {integration.label}
              {!isClickable && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  {integration.isSupported ? "Connect" : "Soon"}
                </span>
              )}
            </button>
          );

          if (!isClickable) {
            return (
              <Tooltip key={integration.key}>
                <TooltipTrigger asChild>{pill}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {integration.isSupported
                    ? `Connect ${integration.label} in Profile → Integrations`
                    : `${integration.label} coming soon`}
                </TooltipContent>
              </Tooltip>
            );
          }

          return pill;
        })}
      </div>
    </div>
  );
}