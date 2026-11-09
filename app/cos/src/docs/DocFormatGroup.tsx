// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Proiectare › Formatare document (ca în procesorul de text cunoscut): Teme ▾, Seturi de stiluri ▾, Culori ▾, Fonturi ▾.
// Aceleași alegeri ca sus în panoul Stiluri; stilurile create de tine rămân când schimbi tema, culorile sau fonturile.
import { RGroup, RMenu } from '../ribbon/Ribbon';
import { STYLE_SETS, THEMES, THEME_COLORS, THEME_FONTS, applyTheme, styleSet, styleSetOf, themeColorsOf, themeFontsOf, themeOf, withThemeColors, withThemeFonts, type DocStyles } from './docStyles';

export default function DocFormatGroup({ styles, onStyles }: { styles?: DocStyles; onStyles(s: DocStyles | undefined): void }) {
  const custom = styles?.custom ?? [];
  const keep = (st: DocStyles | undefined) => onStyles(custom.length ? { ...(st ?? {}), custom } : st);
  const set = styleSetOf(styles), theme = themeOf(styles), tFonts = themeFontsOf(styles), tColors = themeColorsOf(styles);
  return (
    <RGroup label="Formatare document">
      <RMenu label="🎨 Teme" ariaLabel="Teme" keytip="TH" title="Tema documentului: fonturile, culorile și stilurile titlurilor, toate odată"
        items={THEMES.map(([k, label]) => ({ label, checked: theme === k, run: () => keep(applyTheme(k)) }))} />
      <RMenu label="¶ Seturi de stiluri" ariaLabel="Seturi de stiluri" keytip="SS" title="Setul de stiluri: cum arată Text normal și titlurile în tot documentul"
        items={STYLE_SETS.map(([k, label]) => ({ label, checked: set === k, run: () => keep(styleSet(k)) }))} />
      <RMenu label="■ Culori" ariaLabel="Culori" keytip="TC" title="Culorile temei: culoarea titlurilor și culorile din paleta de culori"
        items={THEME_COLORS.map(([k, label]) => ({ label, checked: tColors === k, run: () => keep(withThemeColors(styles, k)) }))} />
      <RMenu label="Aa Fonturi" ariaLabel="Fonturi" keytip="TF" title="Fonturile temei: un font pentru titluri și unul pentru text"
        items={THEME_FONTS.map(([k, label]) => ({ label, checked: tFonts === k, run: () => keep(withThemeFonts(styles, k)) }))} />
    </RGroup>
  );
}
