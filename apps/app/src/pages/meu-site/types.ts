import type { SiteConfig } from '../../data/catalog'

/** altera um campo do rascunho do site */
export type SetSite = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => void
