import { Button, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconLock, IconMapPinQuestion, type Icon } from '@tabler/icons-react';
import { Link } from 'react-router';

function StatusPage({
  icon: StatusIcon,
  title,
  text,
}: {
  icon: Icon;
  title: string;
  text: string;
}) {
  return (
    <Paper p="xl" withBorder>
      <Stack align="center" ta="center">
        <ThemeIcon size={64} radius="xl" variant="light">
          <StatusIcon size={34} />
        </ThemeIcon>
        <Title order={2} fz={20}>
          {title}
        </Title>
        <Text c="dimmed">{text}</Text>
        <Button component={Link} to="/" fullWidth>
          Ana Sayfa
        </Button>
      </Stack>
    </Paper>
  );
}

/** Where the route guard sends a refused user (missing in the legacy app: a 404). */
export function UnauthorizedPage() {
  return (
    <StatusPage
      icon={IconLock}
      title="Yetkiniz yok"
      text="Bu sayfayı açma yetkiniz bulunmuyor. Yetki için yöneticinize başvurun."
    />
  );
}

export function NotFoundPage() {
  return (
    <StatusPage
      icon={IconMapPinQuestion}
      title="Sayfa bulunamadı"
      text="Aradığınız sayfa yok ya da taşınmış."
    />
  );
}
