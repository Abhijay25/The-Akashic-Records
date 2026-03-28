import "~style.css"
import { useState } from "react"
import LibraryView from "~components/LibraryView"
import LibrarianView from "~components/LibrarianView"

type Tab = "library" | "librarian"

export default function Popup() {
  const [tab, setTab] = useState<Tab>("library")

  return (
    <div className="w-[420px] h-[580px] bg-white text-black flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {tab === "library" ? <LibraryView /> : <LibrarianView />}
      </div>

      {/* Watermark */}
      <div className="shrink-0 py-1 flex justify-center pointer-events-none">
        <p className="text-[9px] text-black opacity-20 tracking-wide">
          Built for TinyFish SG Hackathon
        </p>
      </div>

      {/* Bottom tab bar */}
      <div className="flex border-t border-[#F6B37A] shrink-0">
        <button
          onClick={() => setTab("library")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "library"
              ? "bg-[#FF7A00] text-white"
              : "text-gray-500 hover:text-black hover:bg-[#FFF6ED]"
          }`}
        >
          Library
        </button>
        <div className="w-px bg-[#F6B37A]" />
        <button
          onClick={() => setTab("librarian")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "librarian"
              ? "bg-[#FF7A00] text-white"
              : "text-gray-500 hover:text-black hover:bg-[#FFF6ED]"
          }`}
        >
          Librarian
        </button>
      </div>
    </div>
  )
}
