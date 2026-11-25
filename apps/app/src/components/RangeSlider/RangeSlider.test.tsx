// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RangeSlider } from ".";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

it.each([
  { value: 0.55, button: "common.increase", expected: 1.55 },
  { value: 1.55, button: "common.increase", expected: 2.05 },
  { value: 1.05, button: "common.decrease", expected: 0.05 },
])("keeps $button from $value on the native step grid", (testCase) => {
  const onChange = vi.fn();
  render(
    <RangeSlider
      id="range"
      value={testCase.value}
      defaultValue={1.05}
      min={0.05}
      max={2.1}
      step={0.1}
      minLabel="Low"
      maxLabel="High"
      ariaLabel="Range"
      onChange={onChange}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: testCase.button }));

  expect(onChange).toHaveBeenCalledWith(testCase.expected);
});
