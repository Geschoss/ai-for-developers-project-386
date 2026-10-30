import type { ReactElement } from "react";
import { Route, Routes } from "react-router";

import { AdminUsers } from "./pages/AdminUsers";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Placeholder } from "./pages/Placeholder";
import { PublicCalendarPage } from "./pages/PublicCalendar";
import { Register } from "./pages/Register";
import { Settings } from "./pages/Settings";
import { RequireAnonymous, RequireRole } from "./session";

const anonymousPage = (page: ReactElement): ReactElement => (
  <RequireAnonymous>{page}</RequireAnonymous>
);

const ownerPage = (title: string): ReactElement => (
  <RequireRole role="owner">
    <Placeholder title={title} />
  </RequireRole>
);

/** Every page and who may see it. */
const AppRoutes = (): ReactElement => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/register" element={anonymousPage(<Register />)} />
    <Route path="/login" element={anonymousPage(<Login />)} />
    <Route path="/u/:calendarSlug" element={<PublicCalendarPage />} />
    <Route path="/events" element={ownerPage("Предстоящие события")} />
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
