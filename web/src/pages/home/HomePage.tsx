import { Anchor, Group, Paper, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { displayName, useAuth } from '@/auth/AuthProvider';
import { useVisibleAreas } from '@/shell/BottomNav';
import { SiteLink } from '@/shell/SiteLink';
import classes from './HomePage.module.css';

/** Legacy main.js: the work areas the user may open, as large cards. */
export function HomePage() {
  const { user } = useAuth();
  const cards = useVisibleAreas().filter((area) => area.homeCard);
  const name = displayName(user);

  return (
    <Stack gap="md">
      <div>
        <Title order={2} fz={22}>
          {name ? `Merhaba, ${name}` : 'Çalışma Alanları'}
        </Title>
        <Text c="dimmed" size="sm">
          Yetkinize göre ilgili alanı seçin
        </Text>
      </div>
      {cards.length === 0 ? (
        <Paper p="lg" withBorder>
          <Text c="dimmed">
            Açabileceğiniz bir çalışma alanı yok. Yetki için yöneticinize başvurun.
          </Text>
        </Paper>
      ) : (
        cards.map((area) => (
          <Paper key={area.key} withBorder className={classes.card}>
            <UnstyledButton component={SiteLink} to={area.path} className={classes.cardMain}>
              <ThemeIcon size={48} radius="md" variant="light">
                <area.icon size={28} />
              </ThemeIcon>
              <div className={classes.cardText}>
                <Text fw={600} fz="lg">
                  {area.label}
                </Text>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {area.description}
                </Text>
              </div>
              <IconChevronRight size={22} className={classes.chevron} aria-hidden />
            </UnstyledButton>
            {area.shortcuts ? (
              <Group gap="lg" className={classes.shortcuts}>
                {area.shortcuts.map((shortcut) => (
                  <Anchor
                    key={shortcut.path}
                    component={SiteLink}
                    to={shortcut.path}
                    fw={500}
                    size="sm"
                  >
                    {shortcut.label}
                  </Anchor>
                ))}
              </Group>
            ) : null}
          </Paper>
        ))
      )}
    </Stack>
  );
}
