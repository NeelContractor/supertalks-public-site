import { useEffect } from "react";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { applyStoredSiteTheme } from "../lib/theme";

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    useEffect(() => {
      applyStoredSiteTheme();
    }, []);
    return <Outlet />;
  },
});