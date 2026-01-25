import React, { useEffect, useRef, useState } from "react"

const API_URL = import.meta.env.VITE_SURICATA_API_URL

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Hi! I can summarise recent honeypot activity. Ask something like 'Anything interesting in the last hour?'",
    },
  ])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  const toggle = () => setIsOpen(prev => !prev)

  async function handleSend(e) {
    e.preventDefault()
    const prompt = input.trim()
    if (!prompt) return

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    try {
      if (!API_URL) {
        throw new Error("VITE_SURICATA_API_URL is not configured")
      }

      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`)
      }

      const payload = await response.json()
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: payload.answer || "I couldn't find any relevant events.",
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const assistantMessage = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I couldn't complete that request: ${err.message}`,
      }
      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="chat-assistant">
      <button className="chat-assistant__toggle" onClick={toggle}>
        {isOpen ? "Close" : "AI"}
      </button>

      {isOpen && (
        <div className="chat-assistant__panel">
          <header>
            <h3>Phantom AI (preview)</h3>
            <p>Powered by AWS Bedrock + Suricata telemetry.</p>
          </header>

          <div className="chat-assistant__messages" ref={scrollRef}>
            {messages.map(message => (
              <div
                key={message.id}
                className={`chat-assistant__message chat-assistant__message--${message.role}`}
              >
                {message.content}
              </div>
            ))}
            {isSending && (
              <div className="chat-assistant__message chat-assistant__message--assistant">Working?</div>
            )}
          </div>

          <form className="chat-assistant__composer" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Ask about honeypot activity"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isSending}
            />
            <button type="submit" disabled={isSending}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
