import "~style.css"
import { useState } from "react"
import LibraryView from "~components/LibraryView"
import LibrarianView from "~components/LibrarianView"

type Tab = "library" | "librarian"

export default function Popup() {
  const [tab, setTab] = useState<Tab>("library")

  return (
    <div className="w-[420px] h-[580px] bg-gray-950 text-gray-100 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {tab === "library" ? <LibraryView /> : <LibrarianView />}
      </div>

      {/* Bottom tab bar */}
      <div className="flex border-t border-gray-800 shrink-0">
        <button
          onClick={() => setTab("library")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "library"
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Library
        </button>
        <div className="w-px bg-gray-800" />
        <button
          onClick={() => setTab("librarian")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "librarian"
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Librarian
        </button>
      </div>
    </div>
  )
}
