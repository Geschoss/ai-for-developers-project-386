import { Container, Title } from "@mantine/core";

/** Stands in for a page that a later issue builds. */
export function Placeholder({ title }: { title: string }) {
  return (
    <Container size="lg" py={64}>
      <Title order={1}>{title}</Title>
    </Container>
  );
}
