// A workspace lib reached through the `@fixture/lib` tsconfig-path alias. `skein build` must inline
// this source into the graph bundle (it is not a published npm package).
export const BANNER = "from-aliased-workspace-lib";

export function banner(): string {
  return BANNER;
}
