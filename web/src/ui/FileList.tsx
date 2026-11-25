import { Button, Text } from '@mantine/core';
import { IconDownload, IconEye, IconFile } from '@tabler/icons-react';
import { useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { downloadFile, type ViewFile } from './files';
import classes from './FileList.module.css';
import { FileViewer } from './FileViewer';

/**
 * A task's files (legacy files modal): name, uploader and date, with Önizle
 * (FileViewer) and İndir on every row.
 */
export function FileList({
  files,
  emptyText = 'Dosya yok',
}: {
  files: readonly ViewFile[];
  emptyText?: string;
}) {
  const [viewing, setViewing] = useState<ViewFile | null>(null);
  if (files.length === 0)
    return (
      <Text size="sm" c="dimmed">
        {emptyText}
      </Text>
    );
  return (
    <>
      <ul className={classes.list} aria-label="Dosyalar">
        {files.map((file, i) => {
          const meta = [file.uploadedBy, file.uploadedAt ? formatDateTime(file.uploadedAt) : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={file.id ?? i} className={classes.row}>
              <IconFile size={22} className={classes.icon} />
              <div className={classes.main}>
                <Text size="sm" fw={600} className={classes.name}>
                  {file.name}
                </Text>
                {meta ? (
                  <Text size="xs" c="dimmed">
                    {meta}
                  </Text>
                ) : null}
              </div>
              <div className={classes.actions}>
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconEye size={18} />}
                  aria-label={`${file.name} önizle`}
                  onClick={() => setViewing(file)}
                >
                  Önizle
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  leftSection={<IconDownload size={18} />}
                  aria-label={`${file.name} indir`}
                  onClick={() => void downloadFile(file.url, file.name)}
                >
                  İndir
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
