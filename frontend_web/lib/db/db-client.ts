// frontend_web/lib/db/db-client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

export async function executeSafeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}/ia/execute-safe-query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, params })
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.detail || `HTTP ${res.status}`)
    }

    const json = await res.json()
    return json.data ?? []
  } catch (error: any) {
    console.error("[db-client] Error executing safe query:", error)
    throw error
  }
}
