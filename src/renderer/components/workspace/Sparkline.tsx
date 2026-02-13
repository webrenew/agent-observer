interface Props {
  data: number[]
  color: string
}

export function Sparkline({ data, color }: Props) {
  return (
    <span className="sparkline-container">
      {data.map((v, i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: `${(v / 9) * 100}%`,
            minHeight: 1,
            background: color,
            borderRadius: 1,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}
