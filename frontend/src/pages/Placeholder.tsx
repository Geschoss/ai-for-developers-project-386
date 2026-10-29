import { Container, Title } from "@mantine/core";
import type { ReactElement } from "react";

/** Stands in for a page that a later issue builds. */
export const Placeholder = ({ title }: { title: string }): ReactElement => (
  <Container size="lg" py={64}>
    <Title order={1}>{title}</Title>
  </Container>
);
