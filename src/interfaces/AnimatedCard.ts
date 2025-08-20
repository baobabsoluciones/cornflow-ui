export interface AnimatedCard {
    id: number
    text: string
    color: string
    icon?: string
    image?: string
    gridPosition: { row: number; col: number }
  }