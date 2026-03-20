import { useEffect, useCallback } from "react";
import { X, Check } from "lucide-react";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  quickAmounts?: number[];
}

export function Numpad({ value, onChange, onConfirm, quickAmounts = [1, 5, 10, 20, 50] }: NumpadProps) {
  const handleDigit = useCallback((digit: string) => {
    // Prevent multiple decimals
    if (digit === "." && value.includes(".")) return;
    // Don't append if it's 0 and we are starting
    if (value === "0" && digit !== ".") {
      onChange(digit);
      return;
    }
    onChange(value + digit);
  }, [value, onChange]);

  const handleBackspace = useCallback(() => {
    if (value.length <= 1) {
      onChange("0");
    } else {
      onChange(value.slice(0, -1));
    }
  }, [value, onChange]);

  const handleClear = useCallback(() => {
    onChange("0");
  }, [onChange]);

  const handleQuickAmount = useCallback((amount: number) => {
    onChange(amount.toString());
  }, [onChange]);

  // Handle keyboard input (for physical keyboards on POS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process if it's not inside an input field
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === ".") {
        handleDigit(".");
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Enter" && onConfirm) {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear, onConfirm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Amounts */}
      <div className="grid grid-cols-5 gap-2">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            onClick={() => handleQuickAmount(amount)}
            className="flex h-12 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary transition-colors hover:bg-primary/20 active:scale-95"
            dir="ltr"
          >
            {amount}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* Numpad 7-9 */}
        <button onClick={() => handleDigit("7")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">7</button>
        <button onClick={() => handleDigit("8")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">8</button>
        <button onClick={() => handleDigit("9")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">9</button>
        
        {/* Action: Clear */}
        <button onClick={handleClear} className="flex h-16 items-center justify-center rounded-xl bg-red-100 text-red-600 transition-colors hover:bg-red-200 active:bg-red-300">
          <X size={28} />
        </button>

        {/* Numpad 4-6 */}
        <button onClick={() => handleDigit("4")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">4</button>
        <button onClick={() => handleDigit("5")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">5</button>
        <button onClick={() => handleDigit("6")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">6</button>

        {/* Action: Backspace - spans 2 rows */}
        <button onClick={handleBackspace} className="row-span-2 flex items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition-colors hover:bg-orange-200 active:bg-orange-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/></svg>
        </button>

        {/* Numpad 1-3 */}
        <button onClick={() => handleDigit("1")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">1</button>
        <button onClick={() => handleDigit("2")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">2</button>
        <button onClick={() => handleDigit("3")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">3</button>

        {/* Numpad 0, dot */}
        <button onClick={() => handleDigit("0")} className="col-span-2 flex h-16 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold transition-colors hover:bg-gray-200 active:bg-gray-300">0</button>
        <button onClick={() => handleDigit(".")} className="flex h-16 items-center justify-center rounded-xl bg-gray-100 text-3xl font-bold pb-2 transition-colors hover:bg-gray-200 active:bg-gray-300">.</button>

        {/* Action: Confirm */}
        {onConfirm && (
          <button onClick={onConfirm} className="flex h-16 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary/90 active:scale-95">
            <Check size={32} />
          </button>
        )}
      </div>
    </div>
  );
}
