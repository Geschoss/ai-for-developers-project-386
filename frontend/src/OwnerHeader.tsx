import { Anchor, Button, Container, Group } from "@mantine/core";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { forget } from "./forget";
import { type Owner, useSession } from "./session";

const copyGuestLink = async (calendarSlug: string): Promise<void> => {
  const url = new URL(`/u/${calendarSlug}`, globalThis.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // The clipboard can be blocked; the page stays usable.
  }
};

const OwnerBar = ({
  onLogout,
  owner,
}: {
  onLogout: () => Promise<void>;
  owner: Owner;
}): ReactElement => {
  const copy = (): void => {
    forget(copyGuestLink(owner.calendarSlug));
  };

  return (
    <Container component="header" size="lg" py="sm">
      <Group justify="space-between">
        <Group>
          <Anchor component={Link} to="/calendar">
            Мой календарь
          </Anchor>
          <Button variant="subtle" onClick={copy}>
            Скопировать ссылку
          </Button>
          <Anchor component={Link} to="/events">
            Предстоящие события
          </Anchor>
          <Anchor component={Link} to="/settings">
            Настройки
          </Anchor>
        </Group>
        <Button
          variant="subtle"
          onClick={() => {
            forget(onLogout());
          }}
        >
          Выйти
        </Button>
      </Group>
    </Container>
  );
};

/** Header of a logged-in owner. Absent for everyone else. */
const OwnerHeader = (): ReactElement => {
  const session = useSession();
  if (session.owner === undefined) {
    return <></>;
  }
  return <OwnerBar owner={session.owner} onLogout={session.logout} />;
};

export { OwnerHeader };
