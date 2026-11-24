import { Drawer, NavLink, Stack, UnstyledButton } from '@mantine/core';
import { IconDots, IconHome } from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import classes from './AppLayout.module.css';
import { AREAS, type Area } from './areas';
import { SiteLink } from './SiteLink';

/** Up to this many tabs; with more areas the last tab opens the full list. */
const MAX_TABS = 5;

/** The areas the user can open, in the legacy navbar's order. */
export function useVisibleAreas(): Area[] {
  const auth = useAuth();
  return AREAS.filter((area) => auth.canRoute(area.path));
}

export function BottomNav() {
  const areas = useVisibleAreas();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Home plus the areas; when they don't fit, the last slot is "Diğer".
  const fits = areas.length + 1 <= MAX_TABS;
  const tabs = fits ? areas : areas.slice(0, MAX_TABS - 2);
  const rest = fits ? [] : areas.slice(MAX_TABS - 2);
  const isActive = (area: Area) => pathname.startsWith(area.root);

  return (
    <nav className={classes.tabbar} aria-label="Ana menü">
      <UnstyledButton
        component={SiteLink}
        to={'/'}
        className={classes.tab}
        data-active={pathname === '/' || undefined}
      >
        <IconHome size={24} aria-hidden />
        <span className={classes.tabLabel}>Ana Sayfa</span>
      </UnstyledButton>
      {tabs.map((area) => (
        <UnstyledButton
          key={area.key}
          component={SiteLink}
          to={area.path}
          className={classes.tab}
          data-active={isActive(area) || undefined}
        >
          <area.icon size={24} aria-hidden />
          <span className={classes.tabLabel}>{area.short}</span>
        </UnstyledButton>
      ))}
      {rest.length > 0 ? (
        <>
          <UnstyledButton
            className={classes.tab}
            data-active={rest.some(isActive) || undefined}
            onClick={() => setMoreOpen(true)}
          >
            <IconDots size={24} aria-hidden />
            <span className={classes.tabLabel}>Diğer</span>
          </UnstyledButton>
          <Drawer
            opened={moreOpen}
            onClose={() => setMoreOpen(false)}
            position="bottom"
            title="Diğer alanlar"
            classNames={{ content: classes.sheet }}
          >
            <Stack gap={4} pb="md">
              {rest.map((area) => (
                <NavLink
                  key={area.key}
                  component={SiteLink}
                  to={area.path}
                  label={area.label}
                  leftSection={<area.icon size={22} />}
                  active={isActive(area)}
                  onClick={() => setMoreOpen(false)}
                />
              ))}
            </Stack>
          </Drawer>
        </>
      ) : null}
    </nav>
  );
}
