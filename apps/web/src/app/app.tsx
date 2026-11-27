import { Toaster } from "@qrtz/ui";
import { lazy, Suspense } from "react";
import { useIntl } from "react-intl";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { ProjectLoadingScreen } from "../features/shared/project-loading-screen";
import { LocaleProvider } from "./intl";
import { type Services, ServicesProvider } from "./services";
import { useSystemThemeSync } from "./theme";

// The workspace pulls in CodeMirror and PDF.js; load it only when a project opens.
const WorkspacePage = lazy(() =>
  import("../features/workspace/workspace-page").then((module) => ({
    default: module.WorkspacePage,
  })),
);

const router = createBrowserRouter(
  [
    { path: "/", element: <DashboardPage /> },
    {
      path: "/p/:projectId",
      element: (
        <Suspense fallback={<ProjectLoadingScreen />}>
          <WorkspacePage />
        </Suspense>
      ),
    },
  ],
  // Supports hosting under a sub-path such as https://user.github.io/quartz/.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

function Notifications() {
  const intl = useIntl();
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      containerAriaLabel={intl.formatMessage({ id: "notifications.label" })}
      toastOptions={{ closeButtonAriaLabel: intl.formatMessage({ id: "notifications.close" }) }}
    />
  );
}

export function App({ services }: { services: Services }) {
  useSystemThemeSync();
  return (
    <LocaleProvider>
      <ServicesProvider services={services}>
        <RouterProvider router={router} />
        <Notifications />
      </ServicesProvider>
    </LocaleProvider>
  );
}
