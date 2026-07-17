"use client";

import { Cloud, CloudRain, CloudSnow, Sun, Wind } from "lucide-react";
import type { ComponentType } from "react";

import type { WeatherCondition, WeatherResult } from "@/lib/tool-results";

const CONDITION_ICONS: Record<WeatherCondition, ComponentType<{ className?: string }>> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
  windy: Wind,
};

function ConditionIcon({
  condition,
  className,
}: {
  condition: WeatherCondition;
  className?: string;
}) {
  const Icon = CONDITION_ICONS[condition] ?? Cloud;
  return <Icon className={className} />;
}

/**
 * A `get_weather` result rendered as a weather card: current conditions on the left, a 5-day strip
 * across the bottom. This is the "structured JSON, not raw text" payoff — the tool returned JSON and
 * the UI renders it.
 */
export function WeatherCard({ weather }: { weather: WeatherResult }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3" data-testid="weather-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{weather.location}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">{weather.current.tempC}°</span>
            <span className="text-xs capitalize text-muted-foreground">
              {weather.current.condition}
            </span>
          </div>
        </div>
        <ConditionIcon
          condition={weather.current.condition}
          className="size-8 text-muted-foreground"
        />
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {weather.forecast.map((day) => (
          <div
            key={day.day}
            className="flex flex-col items-center gap-1 rounded-md bg-muted/50 py-2 text-center"
          >
            <span className="text-[11px] font-medium text-muted-foreground">{day.day}</span>
            <ConditionIcon condition={day.condition} className="size-4 text-muted-foreground" />
            <span className="text-xs tabular-nums">
              {day.highC}° <span className="text-muted-foreground">{day.lowC}°</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
