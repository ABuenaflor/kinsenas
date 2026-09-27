import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { routeLoaders } from "@/routes";

const PaydayPage = lazy(routeLoaders["/"]);
const ExpensesPage = lazy(routeLoaders["/expenses"]);
const ToBuyPage = lazy(routeLoaders["/to-buy"]);
const InsightsPage = lazy(routeLoaders["/insights"]);
const SettingsPage = lazy(routeLoaders["/settings"]);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <PaydayPage /> },
      { path: "expenses", element: <ExpensesPage /> },
      { path: "to-buy", element: <ToBuyPage /> },
      { path: "insights", element: <InsightsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <PaydayPage /> },
    ],
  },
]);
