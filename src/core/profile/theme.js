const rgb = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));
const hex = values => '#' + values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (color, target, amount) => color.map((v, i) => v * (1 - amount) + target[i] * amount);
export const luminance = values => values.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
export function themeTokens(color) {
  if (!/^#[a-f0-9]{6}$/i.test(color)) color = '#275f4d';
  if (color.toLowerCase() === '#275f4d') return { '--bg': '#f3f4ef', '--sidebar': '#183b33', '--accent': '#275f4d', '--accent-dark': '#1c483a', '--accent-wash': '#eaf1e9', '--teal': '#275f4d', '--action-bg': '#275f4d', '--action-hover': '#1b4839' };
  const original = rgb(color); let accent = [...original];
  // White button text and colored text on pale surfaces stay readable for any chosen hue.
  while (luminance(rgb(hex(accent))) > .14) accent = mix(accent, [0, 0, 0], .04);
  const primary = hex(accent), dark = hex(mix(accent, [0, 0, 0], .23));
  return { '--bg': hex(mix(original, [255, 255, 255], .97)), '--sidebar': hex(mix(accent, [0, 0, 0], .48)), '--accent': primary, '--accent-dark': dark, '--accent-wash': hex(mix(original, [255, 255, 255], .93)), '--teal': primary, '--action-bg': primary, '--action-hover': dark };
}
export function applyTheme(color) { for (const [key, value] of Object.entries(themeTokens(color))) document.documentElement.style.setProperty(key, value); }
