import { X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  onConfirm,
  onCancel,
  isDestructive = true,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onCancel}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
          >
            <X size={24} />
          </button>
        </div>
        
        <p className="mb-8 text-lg text-gray-600">
          {message}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="flex h-14 w-full items-center justify-center rounded-xl font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200 sm:w-auto sm:px-6 sm:h-auto sm:py-3"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex h-14 w-full items-center justify-center rounded-xl font-bold text-white active:scale-95 sm:w-auto sm:px-6 sm:h-auto sm:py-3 transition-colors ${
              isDestructive 
                ? "bg-red-600 hover:bg-red-700 active:bg-red-800" 
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
