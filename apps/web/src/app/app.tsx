import { Toaster } from "@qrtz/ui";
import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { type Services, ServicesProvider } from "./services";

// The workspace pulls in CodeMirror and PDF.js; load it only when a project opens.
const WorkspacePage = lazy(() =>
  import("../features/workspace/workspace-page").then((module) => ({
    default: module.WorkspacePage,
  })),
);

const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  {
    path: "/p/:projectId",
    element: (
      <Suspense fallback={null}>
        <WorkspacePage />
      </Suspense>
    ),
  },
]);

export function App({ services }: { services: Services }) {
  return (
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors closeButton />
    </ServicesProvider>
  );
}
