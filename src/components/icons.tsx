/**
 * Icon set. Drawn for Prumo on a 24px grid, 1.75 stroke, round caps — one
 * consistent family instead of an icon dependency. Decorative by default
 * (aria-hidden); give the parent control an accessible name.
 */
import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const make = (name: string, body: ReactNode) => {
  const C = (p: IconProps) => <Icon {...p}>{body}</Icon>;
  C.displayName = name;
  return C;
};

export const SunIcon = make(
  'SunIcon',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
);
export const UpcomingIcon = make(
  'UpcomingIcon',
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18M9 15.5h6M13 13.5l2 2-2 2" />
  </>,
);
export const ListIcon = make(
  'ListIcon',
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const CalendarIcon = make(
  'CalendarIcon',
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </>,
);
export const CheckCircleIcon = make(
  'CheckCircleIcon',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </>,
);
export const SettingsIcon = make(
  'SettingsIcon',
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
);
export const LogOutIcon = make('LogOutIcon', <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M14 16l4-4-4-4M18 12H9" />);
export const PlusIcon = make('PlusIcon', <path d="M12 5v14M5 12h14" />);
export const SearchIcon = make(
  'SearchIcon',
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </>,
);
export const BellIcon = make('BellIcon', <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0" />);
export const ChevronLeftIcon = make('ChevronLeftIcon', <path d="m15 6-6 6 6 6" />);
export const ChevronRightIcon = make('ChevronRightIcon', <path d="m9 6 6 6-6 6" />);
export const ChevronDownIcon = make('ChevronDownIcon', <path d="m6 9 6 6 6-6" />);
export const XIcon = make('XIcon', <path d="M6 6l12 12M18 6 6 18" />);
export const CheckIcon = make('CheckIcon', <path d="m5 12.5 4.5 4.5L19 7" />);
export const ClockIcon = make(
  'ClockIcon',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const TrashIcon = make('TrashIcon', <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />);
export const PencilIcon = make('PencilIcon', <path d="M15.5 4.5l4 4L9 19H5v-4L15.5 4.5ZM13.5 6.5l4 4" />);
export const ReopenIcon = make('ReopenIcon', <path d="M4 5v5h5M4.6 10A8 8 0 1 1 6 16.5" />);
export const MoreIcon = make(
  'MoreIcon',
  <>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);
export const TagIcon = make(
  'TagIcon',
  <>
    <path d="M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" />
    <circle cx="8" cy="8" r="1.4" />
  </>,
);
export const TextIcon = make('TextIcon', <path d="M4 6h16M4 11h16M4 16h10" />);
export const MoonIcon = make('MoonIcon', <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />);
export const MonitorIcon = make(
  'MonitorIcon',
  <>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </>,
);
export const MenuIcon = make('MenuIcon', <path d="M4 7h16M4 12h16M4 17h16" />);
export const FilterIcon = make('FilterIcon', <path d="M4 6h16M7 12h10M10 18h4" />);
export const SortIcon = make('SortIcon', <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />);
export const MailIcon = make(
  'MailIcon',
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </>,
);
export const EyeIcon = make(
  'EyeIcon',
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const EyeOffIcon = make(
  'EyeOffIcon',
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </>,
);
export const EnterIcon = make('EnterIcon', <path d="M19 5v7a3 3 0 0 1-3 3H6M9.5 11.5 6 15l3.5 3.5" />);
export const HashIcon = make('HashIcon', <path d="M5 9h15M4 15h15M10 4 8 20M16 4l-2 16" />);
export const AlertIcon = make(
  'AlertIcon',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <circle cx="12" cy="16.3" r="0.6" fill="currentColor" />
  </>,
);

/** Brand mark: a plumb line and bob. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path d="M16 5v6.5" stroke="var(--color-accent-ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 11.5l5.2 5.6L16 27l-5.2-9.9z" fill="var(--color-accent-ink)" />
    </svg>
  );
}
