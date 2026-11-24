import {
  ActionIcon,
  Button,
  createTheme,
  Input,
  Modal,
  Paper,
  SegmentedControl,
  type MantineColorsTuple,
} from '@mantine/core';

// GEMKOM red (#8b0000, the logo's red) at shade 7; shade 8 is the hover.
// The same palette and type as the office app (white-app/web/src/theme.ts).
const gemkom: MantineColorsTuple = [
  '#fff0f0',
  '#ffdede',
  '#f9b9b9',
  '#f39191',
  '#ec6b6b',
  '#d94141',
  '#b81c1c',
  '#8b0000',
  '#730000',
  '#5c0000',
];

const sans = '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif';

// Laid out for phones used with gloves on a shop floor: controls default to
// size "lg" (≥ 44px tall), and inputs use 16px text so iOS doesn't zoom in on
// focus.
export const theme = createTheme({
  primaryColor: 'gemkom',
  primaryShade: 7,
  colors: { gemkom },
  defaultRadius: 'md',
  respectReducedMotion: true,
  fontFamily: sans,
  fontFamilyMonospace: '"IBM Plex Mono", Consolas, ui-monospace, monospace',
  headings: { fontFamily: sans, fontWeight: '700' },
  fontSizes: { xs: '13px', sm: '14px', md: '16px', lg: '17px', xl: '20px' },
  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  shadows: {
    xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
    sm: '0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 16px rgba(16, 24, 40, 0.05)',
    md: '0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 16px rgba(16, 24, 40, 0.05)',
    lg: '0 10px 28px rgba(16, 24, 40, 0.12)',
    xl: '0 12px 32px rgba(16, 24, 40, 0.18)',
  },
  components: {
    Button: Button.extend({ defaultProps: { size: 'lg' } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 'xl', variant: 'subtle' } }),
    Input: Input.extend({ defaultProps: { size: 'lg' } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { size: 'md', fullWidth: true } }),
    Modal: Modal.extend({
      defaultProps: {
        radius: 'lg',
        centered: true,
        overlayProps: { color: '#1f2933', backgroundOpacity: 0.5, blur: 2 },
      },
    }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
  },
});
