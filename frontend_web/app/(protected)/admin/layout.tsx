import React from "react"
import { HRChatWidget } from "@/components/ai/HRChatWidget"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <>
      {children}
      <HRChatWidget />
    </>
  )
}
