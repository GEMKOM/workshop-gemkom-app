import { ActionIcon, Menu } from '@mantine/core';
import { IconArrowLeft, IconLogout, IconUserCircle, IconUserEdit } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { displayName, useAuth } from '@/auth/AuthProvider';
import { logout } from '@/auth/authService';
import classes from './AppLayout.module.css';
import { ProfileModal } from './ProfileModal';

export function TopBar({ title, back }: { title: string; back?: string }) {
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className={classes.topbar}>
      {back ? (
        <ActionIcon
          component={Link}
          to={back}
          aria-label="Geri"
          className={classes.topbarButton}
          color="white"
        >
          <IconArrowLeft size={24} />
        </ActionIcon>
      ) : null}
      <h1 className={classes.topbarTitle}>{title}</h1>
      <Menu position="bottom-end" width={240} shadow="lg">
        <Menu.Target>
          <ActionIcon aria-label="Hesap" className={classes.topbarButton} color="white">
            <IconUserCircle size={26} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{displayName(user)}</Menu.Label>
          <Menu.Item leftSection={<IconUserEdit size={18} />} onClick={() => setProfileOpen(true)}>
            Profili Düzenle
          </Menu.Item>
          <Menu.Item color="red" leftSection={<IconLogout size={18} />} onClick={logout}>
            Çıkış Yap
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {profileOpen ? <ProfileModal onClose={() => setProfileOpen(false)} /> : null}
    </header>
  );
}
