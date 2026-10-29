import { Center, Loader } from "@mantine/core";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate } from "react-router";
import type { components } from "spec/api";

import { api } from "./api";
import { forget } from "./forget";

type Owner = components["schemas"]["CurrentOwner"];

interface Session {
  logout: () => Promise<void>;
  owner: Owner | undefined;
  ready: boolean;
  setOwner: (owner: Owner) => void;
}

const SessionContext = createContext<Session | undefined>(undefined);

const useSession = (): Session => {
  const session = useContext(SessionContext);
  if (session === undefined) {
    throw new Error("SessionProvider is missing");
  }
  return session;
};

const loadOwner = async (): Promise<Owner | undefined> => {
  try {
    const result = await api.GET("/api/auth/me");
    if (result.data !== undefined && result.data.role === "owner") {
      return result.data;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const Waiting = (): ReactElement => (
  <Center h="100vh">
    <Loader />
  </Center>
);

/** Loads the current user once. Registration and login publish the owner they just received. */
const SessionProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [owner, setOwnerState] = useState<Owner>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setOwnerState(await loadOwner());
      } finally {
        setReady(true);
      }
    };
    forget(load());
  }, []);

  const session = useMemo<Session>(
    () => ({
      logout: async (): Promise<void> => {
        try {
          await api.POST("/api/auth/logout");
        } catch {
          // The local session is cleared below even when the request does not land.
        }
        setOwnerState(undefined);
      },
      owner,
      ready,
      setOwner: setOwnerState,
    }),
    [owner, ready],
  );

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};

/** Owner pages. An anonymous visitor goes to `/login`. */
const RequireOwner = ({ children }: { children: ReactNode }): ReactElement => {
  const session = useSession();
  if (session.owner === undefined) {
    if (session.ready) {
      return <Navigate to="/login" replace />;
    }
    return <Waiting />;
  }
  return <>{children}</>;
};

/** `/register` and `/login`. A logged-in owner goes to their events. */
const RequireAnonymous = ({ children }: { children: ReactNode }): ReactElement => {
  const session = useSession();
  if (session.owner === undefined) {
    if (session.ready) {
      return <>{children}</>;
    }
    return <Waiting />;
  }
  return <Navigate to="/events" replace />;
};

export { type Owner, RequireAnonymous, RequireOwner, SessionProvider, useSession };
