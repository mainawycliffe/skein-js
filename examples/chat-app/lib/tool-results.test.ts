// Contract tests tying the backend tools to the frontend renderers without a model: the trip tools
// `JSON.stringify` a payload, and these parsers must accept exactly that shape (and reject junk, so a
// malformed result falls back to the plain-text box rather than crashing the card).

import { describe, expect, it } from "vitest";

import { flightsFor, lookupFlight, weatherFor } from "../src/trip-tools.js";

import { parseApproval, parseBooking, parseFlights, parseWeather } from "./tool-results.js";

describe("parsers accept what the tools emit", () => {
  it("parseWeather round-trips a get_weather payload", () => {
    const parsed = parseWeather(JSON.stringify(weatherFor("Tokyo")));
    expect(parsed?.location).toBe("Tokyo");
    expect(parsed?.forecast).toHaveLength(5);
  });

  it("parseFlights round-trips a search_flights payload", () => {
    const parsed = parseFlights(JSON.stringify(flightsFor("San Francisco", "Tokyo")));
    expect(parsed?.flights.length).toBeGreaterThanOrEqual(3);
  });

  it("parseBooking round-trips a booked payload", () => {
    const flight = flightsFor("San Francisco", "Tokyo").flights[0]!;
    const booking = { status: "booked", flightId: flight.id, flight, confirmation: "SKN-X" };
    expect(parseBooking(JSON.stringify(booking))?.status).toBe("booked");
  });

  it("parseApproval narrows the interrupt payload the paused run surfaces", () => {
    const flight = lookupFlight(flightsFor("SFO", "NRT").flights[0]!.id)!;
    const request = { type: "approval", action: "book_flight", flight };
    expect(parseApproval(request)?.flight.id).toBe(flight.id);
  });
});

describe("parsers reject malformed input (fall back to plain text)", () => {
  it("returns null for non-JSON and wrong-shaped payloads", () => {
    expect(parseWeather("not json")).toBeNull();
    expect(parseWeather(undefined)).toBeNull();
    expect(parseFlights(JSON.stringify({ nope: true }))).toBeNull();
    expect(parseBooking(JSON.stringify({ status: "weird" }))).toBeNull();
    expect(parseApproval({ type: "not-approval" })).toBeNull();
  });
});
