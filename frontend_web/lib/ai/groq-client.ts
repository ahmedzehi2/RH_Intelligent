// Ce fichier ne doit JAMAIS être importé dans un composant client
import Groq from "groq-sdk"

export const getGroqClient = (): Groq => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey.includes("<votre") || apiKey.includes("votre_key") || apiKey === "") {
    throw new Error("[Groq] GROQ_API_KEY manquante ou non configurée dans .env.local")
  }
  return new Groq({ apiKey })
}

// Proxy de compatibilité pour éviter les plantages au chargement du module
export const groqClient = new Proxy({} as Groq, {
  get(target, prop, receiver) {
    try {
      const client = getGroqClient()
      const value = Reflect.get(client, prop, receiver)
      if (typeof value === "function") {
        return value.bind(client)
      }
      return value
    } catch (err: any) {
      throw new Error(err.message || "[Groq] Erreur d'initialisation du client Groq")
    }
  }
})

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
