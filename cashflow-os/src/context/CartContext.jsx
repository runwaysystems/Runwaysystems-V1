import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const CART_KEY = 'runway-cart'

function readCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []
  } catch {
    return []
  }
}

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [keys, setKeys] = useState(readCart)

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(keys))
    } catch {
      // Persistence is optional when storage is restricted.
    }
  }, [keys])

  const add = useCallback((key) => {
    if (!key) return
    setKeys((current) => current.includes(key) ? current : [...current, key])
  }, [])

  const remove = useCallback((key) => {
    setKeys((current) => current.filter((item) => item !== key))
  }, [])

  const toggle = useCallback((key) => {
    if (!key) return
    setKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }, [])

  const clear = useCallback(() => setKeys([]), [])

  const has = useCallback((key) => keys.includes(key), [keys])

  return (
    <CartContext.Provider value={{ keys, add, remove, toggle, clear, has, count: keys.length }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
