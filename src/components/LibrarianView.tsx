import { useState, useEffect, useRef } from "react"

// Placeholder steps shown while the Librarian agent backend is being built.
// When the real agent is wired up, replace this with live port messages.
const PLACEHOLDER_STEPS = [
  "Understanding your request...",
  "Opening browser session...",
  "Navigating to target page...",
  "Reading page content...",
  "Performing the requested action...",
  "Verifying the result...",
]

type State = "idle" | "working" | "done"

export default function LibrarianView() {
  const [state, setState] = useState<State>("idle")
  const [prompt, setPrompt] = useState("")
  const [steps, setSteps] = useState<string[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [steps])

  const handleSubmit = () => {
    if (!prompt.trim() || state === "working") return
    setState("working")
    setSteps([])
    setCurrentStepIndex(0)

    PLACEHOLDER_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setSteps((prev) => [...prev, step])
        setCurrentStepIndex(i)
        if (i === PLACEHOLDER_STEPS.length - 1) {
          setTimeout(() => setState("done"), 900)
        }
      }, i * 1300)
    })
  }

  const reset = () => {
    setState("idle")
    setPrompt("")
    setSteps([])
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {state === "idle" && (
        <>
          <div className="text-center mt-4">
            <p className="text-sm font-medium text-gray-200">What do you need done?</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Describe a task and the Librarian will handle it for you
            </p>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={
              "e.g. Log into LinkedIn with username@email.com / mypassword and apply to the Google internship\n\ne.g. Find the cheapest iPhone 16 on Shopee and add it to my cart"
            }
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-700 resize-none focus:outline-none focus:border-gray-600 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Let Librarian handle it
          </button>
        </>
      )}

      {state === "working" && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-white rounded-full animate-spin shrink-0" />
            <p className="text-xs text-gray-400 truncate">"{prompt}"</p>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-[11px] space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className={`shrink-0 mt-px ${
                    i < currentStepIndex ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  {i < currentStepIndex ? "✓" : ">"}
                </span>
                <span className={i < currentStepIndex ? "text-gray-600" : "text-gray-200"}>
                  {step}
                </span>
              </div>
            ))}

            {/* Animated cursor */}
            <div className="flex items-center gap-1 pt-1">
              <span
                className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <div ref={bottomRef} />
          </div>
        </>
      )}

      {state === "done" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center text-2xl">
            ✓
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white">Task done!</p>
            <p className="text-[11px] text-gray-600 mt-1 max-w-[230px] mx-auto line-clamp-2">
              "{prompt}"
            </p>
          </div>

          {/* Completed step log */}
          <div className="w-full bg-gray-900 rounded-lg p-3 font-mono text-[11px] space-y-1.5 max-h-44 overflow-y-auto">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-500 shrink-0">✓</span>
                <span className="text-gray-600">{step}</span>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            New task
          </button>
        </div>
      )}
    </div>
  )
}
