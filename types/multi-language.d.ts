import 'templify-form'
import type { useLanguage } from "~/hooks/useLanguage"

declare module 'templify-form' {
    interface I18nResolveCxt {
        t: ReturnType<typeof useLanguage>['t']
    }
}

