import { useLanguage, useTranslation, type Locale, LocaleProvider } from '../../language/react';
import { useTheme, type ThemeName } from '../../theme/react';
export { LocaleProvider };
export function Preferences() {
  const { locale, setLocale } = useLanguage(); const { theme, setTheme, themes } = useTheme(); const t = useTranslation();
  return <div className="preference-controls"><label><span className="sr-only">{t('language')}</span><select aria-label={t('language')} data-testid="locale-switch" value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="ja">日本語</option><option value="zh-CN">简体中文</option><option value="en">English</option></select></label><label><span className="sr-only">{t('theme')}</span><select aria-label={t('theme')} data-testid="theme-switch" value={theme} onChange={event => setTheme(event.target.value as ThemeName)}>{themes.map(item => <option key={item.value} value={item.value}>{item.label ?? item.labelKey ?? item.value}</option>)}</select></label></div>;
}
