import { describe, expect, it } from "vitest";
import { advisorShortcutStatusLine } from "@/components/advisor/advisor-shortcut-card";

describe("advisorShortcutStatusLine", () => {
  it.each([
    ["draft", "Finish your request to get full advice"],
    ["open", "Roof and cost summary ready — waiting for quotes"],
    ["quoted", "Quotes received — see what they mean"],
    ["accepted", "See advice on your chosen quote"],
    ["closed", "See advice on your chosen quote"],
    ["weird", "Open the advisor"],
    ["constructor", "Open the advisor"],
  ])("%s", (status, line) => {
    expect(advisorShortcutStatusLine(status)).toBe(line);
  });
});
