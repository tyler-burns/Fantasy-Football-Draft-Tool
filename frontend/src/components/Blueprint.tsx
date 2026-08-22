import type { CSSProperties, ReactNode } from 'react'

interface BlueprintProps {
  readonly children: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}

/** Wraps the shared `.blueprint` global class (theme.css) with its four
 * required corner registration marks, so a framed card can never be built
 * without them (the Industry system's explicit "Don't drop the registration
 * marks"). */
export function Blueprint({ children, className, style }: BlueprintProps) {
  return (
    <div className={className ? `blueprint ${className}` : 'blueprint'} style={style}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  )
}
