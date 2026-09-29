import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/setup/")({
  beforeLoad: () => {
    throw redirect({ to: "/setup/property" });
  },
});
