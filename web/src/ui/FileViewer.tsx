import { Button, Group, Loader, Modal, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconDownload, IconExternalLink, IconFile } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { canShowPdfInline, downloadFile, fileKind, looksLikeText, type ViewFile } from './files';
import classes from './FileViewer.module.css';

function OpenCard({ file, message }: { file: ViewFile; message: string }) {
  return (
    <div className={classes.card}>
      <IconFile size={40} stroke={1.5} />
      <Text fw={600} className={classes.cardName}>
        {file.name}
      </Text>
      <Text size="sm" c="dimmed">
        {message}
      </Text>
      <Group justify="center" gap="xs">
        <Button
          variant="default"
          leftSection={<IconExternalLink size={18} />}
          component="a"
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Aç
        </Button>
        <Button
          leftSection={<IconDownload size={18} />}
          onClick={() => void downloadFile(file.url, file.name)}
        >
          İndir
        </Button>
      </Group>
    </div>
  );
}

function TextPreview({ file }: { file: ViewFile }) {
  const text = useQuery({
    queryKey: ['fileViewer', 'text', file.url],
    queryFn: async ({ signal }) => {
      const response = await fetch(file.url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return looksLikeText(bytes) ? new TextDecoder().decode(bytes) : null;
    },
    staleTime: Infinity,
    retry: false,
  });
  if (text.isPending) return <Loader color="gray" />;
  if (text.isError) return <OpenCard file={file} message="Dosya yüklenemedi." />;
  if (text.data === null) return <OpenCard file={file} message="Bu dosya için önizleme yok." />;
  return <pre className={classes.text}>{text.data}</pre>;
}

function ImagePreview({ file }: { file: ViewFile }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <OpenCard file={file} message="Resim yüklenemedi." />;
  return (
    <div className={classes.imageScroller}>
      <img
        src={file.url}
        alt={file.name}
        className={classes.image}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function Preview({ file }: { file: ViewFile }) {
  switch (fileKind(file.name)) {
    case 'image':
      return <ImagePreview file={file} />;
    case 'pdf':
      return canShowPdfInline() ? (
        <iframe className={classes.frame} src={file.url} title={file.name} />
      ) : (
        <OpenCard file={file} message="PDF telefonun kendi görüntüleyicisinde açılır." />
      );
    case 'video':
      return (
        <video className={classes.video} src={file.url} controls playsInline>
          Tarayıcınız video önizlemesini desteklemiyor.
        </video>
      );
    case 'text':
      return <TextPreview file={file} />;
    default:
      return <OpenCard file={file} message="Bu dosya türü için önizleme yok." />;
  }
}

/**
 * Preview one file (legacy Görüntüle): images, PDFs (in their own tab on
 * Android), video and text such as CNC programs; anything else gets Aç and
 * İndir. Full screen on a phone.
 */
export function FileViewer({ file, onClose }: { file: ViewFile | null; onClose: () => void }) {
  const phone = useMediaQuery('(max-width: 48em)');
  return (
    <Modal
      opened={!!file}
      onClose={onClose}
      size={1100}
      fullScreen={Boolean(phone)}
      title={file?.name}
      classNames={{ body: classes.body, title: classes.title }}
    >
      {file ? (
        <>
          <div className={classes.stage} data-kind={fileKind(file.name)}>
            <Preview key={file.url} file={file} />
          </div>
          <Group justify="flex-end" gap="xs" className={classes.footer}>
            <Button variant="default" onClick={onClose}>
              Kapat
            </Button>
            <Button
              leftSection={<IconDownload size={18} />}
              onClick={() => void downloadFile(file.url, file.name)}
            >
              İndir
            </Button>
          </Group>
        </>
      ) : null}
    </Modal>
  );
}
