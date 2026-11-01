import type { ReactElement } from "react";
import { Route, Routes } from "react-router";

import { AdminUsers } from "./pages/AdminUsers";
import { Events } from "./pages/Events";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { PublicCalendarPage } from "./pages/PublicCalendar";
import { Register } from "./pages/Register";
import { Settings } from "./pages/Settings";
import { RequireAnonymous, RequireRole } from "./session";

const anonymousPage = (page: ReactElement): ReactElement => (
  <RequireAnonymous>{page}</RequireAnonymous>
);

/** Every page and who may see it. */
const AppRoutes = (): ReactElement => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/register" element={anonymousPage(<Register />)} />
    <Route path="/login" element={anonymousPage(<Login />)} />
    <Route path="/u/:calendarSlug" element={<PublicCalendarPage />} />
    <Route
      path="/events"
      element={
        <RequireRole role="owner">
          <Events />
        </RequireRole>
      }
    />
    <Route
      path="/settings"
      element={
        <RequireRole role="owner">
          <Settings />
        </RequireRole>
      }
    />
    <Route
      path="/admin/users"
      element={
        <RequireRole role="admin">
          <AdminUsers />
        </RequireRole>
      }
    />
  </Routes>
);

export { AppRoutes };
