/**
 * Icon.jsx — the app's single SVG icon set (stroke-based favicons).
 *
 * Every former emoji in the UI points at one of these icons. The same
 * definition powers the React <Icon/> component AND the string form used by
 * Leaflet divIcons / inline HTML via iconHtml().
 */

const ICONS = {
  sos: '<path d="M5 9.5v6a1 1 0 0 0 1 1h1.8l3.7 2.8V5.7L7.8 8.5H6a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a4.8 4.8 0 0 1 0 8"/><path d="M18 5.5a8.5 8.5 0 0 1 0 14"/>',
  ambulance:
    '<rect x="3" y="6" width="12" height="9" rx="1.5"/><path d="M13 10h3.4a2 2 0 0 1 1.8 1.1l1.3 2.6V15a1 1 0 0 1-1 1h-1"/><path d="M12 9.5v4M9.6 11.5h4.8"/>',
  hospital:
    '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><path d="M11.5 9v8M7.5 13h8"/>',
  console:
    '<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M8 20.5h8M12 17v3.5"/><path d="M6.5 8l2.2 2.4-2.2 2.4"/><path d="M10.5 12.8h4"/>',
  car: '<rect x="2.5" y="9.5" width="19" height="8" rx="1.5"/><path d="M5.5 9.5l1.4-3.4A2 2 0 0 1 8.8 4.5h6.4a2 2 0 0 1 1.9 1.6L18.5 9.5"/><path d="M3.5 9.5h17"/><circle cx="7" cy="13.5" r="0.4" fill="currentColor"/><circle cx="17" cy="13.5" r="0.4" fill="currentColor"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/>',
  siren:
    '<path d="M18 8.5A6 6 0 0 0 6 8.5c0 7-2 7-2 9h16c0-2-2-2-2-9"/><path d="M10.2 20.5a1.9 1.9 0 0 0 3.6 0"/><path d="M12 2.5V1"/>',
  bell: '<path d="M18 8.5A6 6 0 0 0 6 8.5c0 7-2 7-2 9h16c0-2-2-2-2-9"/><path d="M10.2 20.5a1.9 1.9 0 0 0 3.6 0"/>',
  sound: '<rect x="3.5" y="9" width="3.5" height="6" rx="1"/><path d="M7 9.5l4-3v11l-4-3"/><path d="M13.5 9.2a4 4 0 0 1 0 5.6"/><path d="M16 6.6a7 7 0 0 1 0 10.8"/>',
  stats: '<path d="M4 20.5h16"/><path d="M6.5 16.5v4M10.5 12.5v8M14.5 8.5v12M18.5 5v15" stroke-linecap="round"/>',
  location:
    '<path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5z"/><circle cx="12" cy="9.5" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.4-6 7.5-6s7.5 2 7.5 6"/>',
  phone:
    '<path d="M5 4.5h3l1.6 4L8 9.7a13.5 13.5 0 0 0 6.3 6.3l1.2-1.6 4 1.6v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3 6.5a2 2 0 0 1 2-2z"/>',
  age: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 2.5v4.5M16 2.5v4.5M4 10h16"/><path d="M9 14.5h6M12 11.5v6"/>',
  blood: '<path d="M12 3S6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11-6-11z"/><path d="M8.5 14.5A3.5 3.5 0 0 0 12 18"/>',
  alert:
    '<path d="M10.3 3.8L1.8 18a2 2 0 0 0 1.8 3h16.8a2 2 0 0 0 1.8-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2h.01"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="1.9"/><path d="M5.7 15.8c0-1.5 1.3-2.3 2.8-2.3s2.8.8 2.8 2.3"/><path d="M13.5 10.5H17M13.5 13.5H17"/>',
  tag: '<path d="M3.5 3.5h8l9 9-8 8-9-9v-8z"/><circle cx="8" cy="8" r="1" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  ok: '<path d="M4 11.5h2.5V20H4z"/><path d="M6.5 12l4.6-6.2A2 2 0 0 1 12.6 5v5a1 1 0 0 0 1 1h4a2 2 0 0 1 2 2.2l-.7 5a2 2 0 0 1-2 1.8H6.5"/>',
  crash: '<path d="M4 19L10 4l6 15"/><path d="M6.5 19h11"/><path d="M10 10.5h4"/>',
  play: '<path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" stroke="none"/>',
  send: '<path d="M21.5 2.5L11 13"/><path d="M21.5 2.5L15 21.5l-4-9-9-4 19.5-6z"/>',
  refresh: '<path d="M20 8.5A8 8 0 0 0 5.4 6.5"/><path d="M4 4v4h4"/><path d="M4 15.5a8 8 0 0 0 14.6 2"/><path d="M20 20v-4h-4"/>',
  road: '<path d="M4 4.5h.01M9 4.5h.01M14 4.5h.01M19 4.5h.01M4 19.5h.01M9 19.5h.01M14 19.5h.01M19 19.5h.01M6 9.5h.01M11 9.5h.01M16 9.5h.01M4 14.5h.01M9 14.5h.01M14 14.5h.01M19 14.5h.01M6 12h.01M11 12h.01M16 12h.01M4 17h.01M9 17h.01M14 17h.01M19 17h.01"/>',
  heart: '<path d="M12 20.5s-7.5-4.8-7.5-10A4.5 4.5 0 0 1 9 6c1.3 0 2.4.5 3 1.4.6-.9 1.7-1.4 3-1.4a4.5 4.5 0 0 1 4.5 4.5c0 5.2-7.5 10-7.5 10z"/>',
  map:
    '<path d="M9 5L3.5 7v12.5L9 17l6 2.5L21.5 17.5V5L16 7.5 10 5z"/><path d="M9 5v12M15 7.5V20"/>',
  camera: '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M9 6.5l1.3-2.5h3.4L15 6.5"/><circle cx="12" cy="13" r="3.5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="16.5" rx="2"/><path d="M9 4a3 3 0 0 1 6 0"/><path d="M9.5 10h5M9.5 13.5h5M9.5 17h3"/>',
  robot: '<rect x="4.5" y="8" width="15" height="11" rx="3"/><circle cx="9" cy="12.5" r="1.2" fill="currentColor"/><circle cx="15" cy="12.5" r="1.2" fill="currentColor"/><path d="M12 15.5v3M12 3.5v2M6 5.5L4 3.5M18 5.5L20 3.5M7 19v2M17 19v2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>',
  shock: '<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>',
  mic: '<path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4M8 22h8"/>',
  police: '<rect x="5" y="4" width="14" height="3" rx="1"/><path d="M7 7v4.5a5.5 5.5 0 0 0 10 0V7"/><path d="M9 13.5H15"/><rect x="8.5" y="16" width="7" height="5" rx="1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  chevrons: '<path d="M8 6l6 6-6 6"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  dots: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  pill: '<rect x="7" y="3" width="10" height="18" rx="5" transform="rotate(45 12 12)"/><path d="M4.5 4.5L19.5 19.5" />',
  shield: '<path d="M12 3l7 2.5V11c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V5.5L12 3z"/><path d="M9 11.5l2 2 4-4"/>',
};

/** Render one icon as a React component. */
export function Icon({ name, size = 18, className, style, strokeWidth = 2 }) {
  const inner = ICONS[name];
  if (!inner) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

/** Render one icon as a standalone HTML string (Leaflet divIcons, tooltips). */
export function iconHtml(name, { size = 24, color = "currentColor", className = "" } = {}) {
  const inner = ICONS[name];
  if (!inner) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}">${inner}</svg>`;
}

export default Icon;