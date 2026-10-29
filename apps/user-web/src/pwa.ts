export function isStandaloneDisplay(target: Window = window): boolean {
  const iosNavigator = target.navigator as Navigator & { standalone?: boolean };
  return target.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

export function markStandaloneDisplay(target: Window = window): void {
  if (isStandaloneDisplay(target)) target.document.documentElement.dataset.standalone = 'true';
}
