import { MantineProvider } from "@mantine/core";
import type { ReactElement } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { OwnerHeader } from "./OwnerHeader";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Placeholder } from "./pages/Placeholder";
import { Register } from "./pages/Register";
import { RequireAnonymous, RequireOwner, SessionProvider } from "./session";
import { theme } from "./theme";

const anonymousPage = (page: ReactElement): ReactElement => (
  <RequireAnonymous>{page}</RequireAnonymous>
);

const ownerPage = (title: string): ReactElement => (
  <RequireOwner>
    <Placeholder title={title} />
  </RequireOwner>
);

const AppRoutes = (): ReactElement => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/register" element={anonymousPage(<Register />)} />
    <Route path="/login" element={anonymousPage(<Login />)} />
    <Route path="/calendar" element={ownerPage("Мой календарь")} />
    <Route path="/events" element={ownerPage("Предстоящие события")} />
    <Route path="/settings" element={ownerPage("Настройки")} />
  </Routes>
);

const App = (): ReactElement => (
  <MantineProvider theme={theme}>
    <BrowserRouter>
      <SessionProvider>
        <OwnerHeader />
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  </MantineProvider>
);

export { App };
