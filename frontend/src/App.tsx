import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router";
import { Landing } from "./pages/Landing";
import { Placeholder } from "./pages/Placeholder";
import { theme } from "./theme";

export function App() {
  return (
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Placeholder title="Регистрация" />} />
          <Route path="/login" element={<Placeholder title="Вход" />} />
        </Routes>
      </BrowserRouter>
    </MantineProvider>
  );
}
