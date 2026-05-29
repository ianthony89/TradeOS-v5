interface SkeletonProps {
  width?:    number | string
  height?:   number | string
  rounded?:  boolean
  className?: string
}

export function Skeleton({ width = '100%', height = 14, rounded = false, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: rounded ? '999px' : undefined,
      }}
    />
  )
}
