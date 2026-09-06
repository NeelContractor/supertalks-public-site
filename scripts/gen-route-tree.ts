import { Generator, getConfig } from "@tanstack/router-generator";

const config = getConfig(
  {
    routeTreeFileFooter: [
      "",
      "import type { getRouter } from './router.tsx'",
      "import type { startInstance } from './start.ts'",
      "declare module '@tanstack/react-start' {",
      "  interface Register {",
      "    ssr: true",
      "    router: Awaited<ReturnType<typeof getRouter>>",
      "    config: Awaited<ReturnType<typeof startInstance.getOptions>>",
      "  }",
      "}",
    ],
  },
  process.cwd(),
);

const generator = new Generator({
  root: process.cwd(),
  config,
});

await generator.run();
console.log("routeTree.gen.ts generated");