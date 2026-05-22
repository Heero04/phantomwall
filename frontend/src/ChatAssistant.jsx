import React, { useEffect, useRef, useState } from "react"

const API_URL = import.meta.env.VITE_SURICATA_API_URL
const SHOWCASE_CHAT_MODE = true

const DEMO_RESPONSES = [
  "Demo AI (simulated): Detected elevated SSH scanning from 203.0.113.42 against honeypot-ssh-east in the last hour. No production systems were exposed.",
  "Demo AI (simulated): Top activity is credential stuffing over HTTP from 198.51.100.77. WAF challenge rules reduced successful probes by 92%.",
  "Demo AI (simulated): Current risk trend is stable. Critical signatures are isolated to decoy assets and response playbooks are marked completed.",
  "Demo AI (simulated): A multi-port scan from 192.0.2.23 touched 22/80/443/8080 and was blocked. Similar traffic has appeared in 3 regions today.",
]

function pickDemoResponse(prompt) {
  const text = prompt.toLowerCase()
  if (text.includes("last hour") || text.includes("recent")) return DEMO_RESPONSES[0]
  if (text.includes("waf") || text.includes("web")) return DEMO_RESPONSES[1]
  if (text.includes("risk") || text.includes("critical")) return DEMO_RESPONSES[2]
  if (text.includes("scan") || text.includes("port")) return DEMO_RESPONSES[3]
  return DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)]
}

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Hi! I am running in Demo AI mode with simulated responses for showcase safety. Ask something like 'Anything interesting in the last hour?'",
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
      if (SHOWCASE_CHAT_MODE || !API_URL) {
        const assistantMessage = {
          id: `assistant-demo-${Date.now()}`,
          role: "assistant",
          content: pickDemoResponse(prompt),
        }
        setMessages(prev => [...prev, assistantMessage])
        return
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
            <h3>Phantom AI (Demo Simulated)</h3>
            <p>Showcase-safe mode: responses are generated from mock security data.</p>
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
              <div className="chat-assistant__message chat-assistant__message--assistant">Analyzing...</div>
            )}
          </div>

          <form className="chat-assistant__composer" onSubmit={handleSend}>
            <input
              type="text"
              placeholder="Ask about mock honeypot activity"
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
