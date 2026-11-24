import { Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './AuthScreen.module.css';

/** The red band with the logo and a card under it, for login and reset. */
export function AuthScreen({
  subtitle,
  title,
  children,
}: {
  subtitle?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.screen}>
      <div className={classes.band}>
        <img
          src={`${import.meta.env.BASE_URL}icons/gemkom-192.png`}
          alt=""
          className={classes.logo}
        />
        <Title order={1} fz={26} c="white">
          GEMKOM
        </Title>
        {subtitle ? <Text className={classes.subtitle}>{subtitle}</Text> : null}
      </div>
      <Paper className={classes.card} p="lg" shadow="lg">
        <Stack gap="md">
          {title ? (
            <Title order={2} fz={20}>
              {title}
            </Title>
          ) : null}
          {children}
        </Stack>
      </Paper>
    </div>
  );
}
